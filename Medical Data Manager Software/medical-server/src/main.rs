mod config;
mod db;
mod models;
mod routes;
mod schema;
mod services;

use std::sync::Arc;
use tokio::sync::RwLock;

use actix_files::Files;
use actix_web::{
    middleware::{Compress, Logger},
    web, App, HttpServer,
};
use tera::Tera;

use crate::config::Config;
use crate::services::minio_service::MinioClient;

/// 从 DATABASE_URL 中解析出各连接参数。
/// 期望格式：`postgres://{user}:{password}@{host}:{port}/{dbname}`
fn parse_database_url(url: &str) -> Option<(String, String, String, String, String)> {
    // 去掉 "postgres://" 或 "postgresql://" 前缀
    let rest = url
        .strip_prefix("postgres://")
        .or_else(|| url.strip_prefix("postgresql://"))?;

    // 拆分 userinfo 和 host 部分：用 @ 分割
    let at = rest.rfind('@')?;
    let userinfo = &rest[..at];
    let hostdb = &rest[at + 1..];

    // 解析 user:password
    let colon = userinfo.find(':')?;
    let user = userinfo[..colon].to_string();
    let password = userinfo[colon + 1..].to_string();

    // 解析 host:port/dbname
    let slash = hostdb.find('/')?;
    let hostport = &hostdb[..slash];
    let dbname = hostdb[slash + 1..].to_string();

    let (host, port) = if let Some(c) = hostport.rfind(':') {
        (hostport[..c].to_string(), hostport[c + 1..].to_string())
    } else {
        (hostport.to_string(), "5432".to_string())
    };

    Some((user, password, host, port, dbname))
}

/// 检测 PostgreSQL 是否在 5432 端口运行，若未运行则通过 Windows 服务启动。
/// 启动后还会确保 DATABASE_URL 指定的数据库存在（不存在则自动创建）。
async fn start_postgresql_if_needed(database_url: &str) {
    // ── 1. 启动 Windows 服务 ──────────────────────────────────────────────
    if tokio::net::TcpStream::connect("127.0.0.1:5432")
        .await
        .is_ok()
    {
        log::info!("PostgreSQL already running on port 5432, skipping auto-start");
    } else {
        log::info!("PostgreSQL not detected, starting Windows service 'postgresql-x64-16'...");

        let output = std::process::Command::new("net")
            .args(["start", "postgresql-x64-16"])
            .output();

        match output {
            Ok(o) => {
                let stdout = String::from_utf8_lossy(&o.stdout);
                let stderr = String::from_utf8_lossy(&o.stderr);
                if o.status.success()
                    || stdout.contains("已经启动")
                    || stdout.contains("already been started")
                {
                    log::info!("PostgreSQL service is running");
                } else {
                    log::error!(
                        "Failed to start PostgreSQL (exit={}): {} {}",
                        o.status,
                        stdout.trim(),
                        stderr.trim()
                    );
                    return;
                }
            }
            Err(e) => {
                log::error!("Failed to execute 'net start': {}", e);
                return;
            }
        }

        // 等待 PostgreSQL 就绪（最多 15 秒）
        let mut ready = false;
        for attempt in 1..=30 {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            if tokio::net::TcpStream::connect("127.0.0.1:5432")
                .await
                .is_ok()
            {
                log::info!("PostgreSQL ready (attempt {})", attempt);
                ready = true;
                break;
            }
        }
        if !ready {
            log::error!("PostgreSQL did not become available within 15 seconds, proceeding anyway");
            return;
        }
    }

    // ── 2. 确保目标数据库存在（读取 .env 中的连接信息，用 Diesel 直接操作）──
    let (user, password, host, port, dbname) = match parse_database_url(database_url) {
        Some(v) => v,
        None => {
            log::warn!("Cannot parse DATABASE_URL, skipping database creation check");
            return;
        }
    };

    // connect_timeout=5 防止连接操作无限等待
    let target_url = format!(
        "postgres://{}:{}@{}:{}/{}?connect_timeout=5",
        user, password, host, port, dbname
    );
    let system_url = format!(
        "postgres://{}:{}@{}:{}/postgres?connect_timeout=5",
        user, password, host, port
    );
    let target_db = dbname.clone();

    let result = tokio::time::timeout(
        tokio::time::Duration::from_secs(15),
        tokio::task::spawn_blocking(move || -> Result<(), String> {
            use diesel::pg::PgConnection;
            use diesel::prelude::*;

            // 步骤 1：直连目标数据库
            // 成功 → 库已存在，直接返回；失败 → 继续判断是否需要创建
            match PgConnection::establish(&target_url) {
                Ok(_) => {
                    log::info!("Database '{}' already exists", target_db);
                    return Ok(());
                }
                Err(e) => {
                    let msg = e.to_string();
                    if !msg.contains("does not exist") && !msg.contains("不存在") {
                        // 非"库不存在"的连接错误（如密码错误）直接上报
                        return Err(format!("Cannot connect to '{}': {}", target_db, msg));
                    }
                    log::info!("Database '{}' not found, will create it...", target_db);
                }
            }

            // 步骤 2：连接 postgres 系统库，执行 CREATE DATABASE
            let mut conn = PgConnection::establish(&system_url)
                .map_err(|e| format!("Cannot connect to postgres system DB: {}", e))?;

            diesel::sql_query(format!("CREATE DATABASE \"{}\"", target_db))
                .execute(&mut conn)
                .map_err(|e| format!("Failed to create database '{}': {}", target_db, e))?;

            log::info!("Database '{}' created successfully", target_db);
            Ok(())
        }),
    )
    .await;

    match result {
        Ok(Ok(Ok(()))) => {}
        Ok(Ok(Err(e))) => log::error!("{}", e),
        Ok(Err(e)) => log::error!("spawn_blocking panicked: {}", e),
        Err(_) => log::error!("Database existence check timed out after 15s"),
    }
}

/// 检测 MinIO 是否在 9000 端口运行，若未运行则自动启动。
/// minio.exe 和 minio-data/ 均位于工作区根目录（medical-server 的上级目录）。
async fn start_minio_if_needed() {
    // 先尝试连接 9000 端口，已运行则跳过
    if tokio::net::TcpStream::connect("127.0.0.1:9000")
        .await
        .is_ok()
    {
        log::info!("MinIO already running on port 9000, skipping auto-start");
        return;
    }

    // 计算工作区根目录（cargo run 的 cwd 是 medical-server/，取其父目录）
    let cwd = std::env::current_dir().expect("Cannot get current directory");
    let workspace_root = cwd.parent().unwrap_or(&cwd).to_path_buf();

    let minio_exe = workspace_root.join("minio.exe");
    let minio_data = workspace_root.join("minio-data");

    if !minio_exe.exists() {
        log::warn!(
            "minio.exe not found at '{}', skipping MinIO auto-start",
            minio_exe.display()
        );
        return;
    }

    // 确保 minio-data 目录存在
    if let Err(e) = std::fs::create_dir_all(&minio_data) {
        log::error!("Failed to create minio-data dir: {}", e);
        return;
    }

    log::info!(
        "Starting MinIO: '{}' server '{}' --console-address :9001",
        minio_exe.display(),
        minio_data.display()
    );

    match std::process::Command::new(&minio_exe)
        .arg("server")
        .arg(&minio_data) // 路径作为独立参数，不受空格影响
        .arg("--console-address")
        .arg(":9001")
        .spawn()
    {
        Ok(_) => log::info!("MinIO process spawned"),
        Err(e) => {
            log::error!("Failed to spawn MinIO: {}", e);
            return;
        }
    }

    // 等待 MinIO 就绪（最多 10 秒）
    for attempt in 1..=20 {
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        if tokio::net::TcpStream::connect("127.0.0.1:9000")
            .await
            .is_ok()
        {
            log::info!("MinIO ready (attempt {})", attempt);
            return;
        }
    }
    log::error!("MinIO did not become available within 10 seconds, proceeding anyway");
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // 1. 初始化日志（RUST_LOG 环境变量控制级别，默认 info）
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    // 2. 加载配置
    let config = Config::from_env();
    log::info!(
        "Starting server at {}:{}",
        config.server_host,
        config.server_port
    );

    // 3. 自动启动 PostgreSQL（若尚未运行），并确保数据库存在
    start_postgresql_if_needed(&config.database_url).await;

    // 4. 自动启动 MinIO（若尚未运行）
    start_minio_if_needed().await;

    // 5. 初始化数据库连接池
    let pool = db::init_pool(&config.database_url);
    log::info!("Database connection pool initialized (max_size=10)");

    // 6. 初始化 MinIO 客户端，加载所有活跃部位对应的桶
    let mut minio_client = MinioClient::new(&config);
    minio_client.init_buckets_from_db(&pool).await;
    log::info!("MinIO buckets initialized");

    // 7. 用 Arc<RwLock<>> 包装 MinioClient，以便在多个请求处理器中共享
    let minio_data = Arc::new(RwLock::new(minio_client));

    // 8. 初始化 Tera 模板引擎
    let tera = Tera::new("templates/**/*").unwrap_or_else(|e| {
        log::warn!("Tera template loading warning: {}", e);
        Tera::default()
    });

    let bind_addr = format!("{}:{}", config.server_host, config.server_port);

    // 9. 启动 Actix-web HTTP 服务
    HttpServer::new(move || {
        App::new()
            // gzip / brotli 压缩（STL bundle 约 41 MB → ~10 MB）
            .wrap(Compress::default())
            // 日志中间件
            .wrap(Logger::default())
            // 共享数据
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(tera.clone()))
            .app_data(web::Data::new(minio_data.clone()))
            // 上传大小限制：500 MB
            .app_data(web::JsonConfig::default().limit(500 * 1024 * 1024))
            .app_data(
                actix_multipart::form::MultipartFormConfig::default()
                    .total_limit(500 * 1024 * 1024),
            )
            // 静态文件服务
            .service(Files::new("/static", "static").show_files_listing())
            // 前端应用（Vue 医学模型浏览器）
            .service(Files::new("/viewer", "../medical-web/dist").index_file("index.html"))
            // 业务路由
            .configure(routes::init)
    })
    .bind(&bind_addr)?
    .run()
    .await
}

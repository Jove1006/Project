use actix_multipart::form::{tempfile::TempFile, text::Text, MultipartForm};
use actix_web::{web, HttpResponse, Result as ActixResult};
use chrono::Local;
use diesel::result::Error as DieselError;
use serde::{Deserialize, Serialize};
use tera::Context;

use crate::db::DbPool;
use crate::models::{NewMedicalRecord, UpdateMedicalRecord};
use crate::services::file_service;
use crate::services::minio_service::MinioClient;
use crate::services::record_service::{self, PaginationParams};
use crate::services::upload_service::MODEL_COLOR_PRESETS;

// ── 查询参数结构体 ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub page: Option<i64>,
    pub year: Option<i32>,
    pub month: Option<i16>,
    pub hospital_id: Option<i32>,
    pub body_part_id: Option<i32>,
    pub keyword: Option<String>,
    pub sort: Option<String>,
    pub order: Option<String>,
}

// Tera 模板用的嵌套对象
#[derive(Serialize)]
struct PaginationCtx {
    page: i64,
    per_page: i64,
    total: i64,
    total_unfiltered: i64,
    total_pages: i64,
    page_end: i64,   // min(page * per_page, total)
    pages: Vec<i64>, // 1..=total_pages，用于模板 for 循环
}

#[derive(Serialize)]
struct FilterCtx {
    year: Option<i32>,
    month: Option<i16>,
    hospital_id: Option<i32>,
    body_part_id: Option<i32>,
    keyword: Option<String>,
}

// ── GET / — 记录列表页 ──────────────────────────────────────────────────────

pub async fn index(
    pool: web::Data<DbPool>,
    tera: web::Data<tera::Tera>,
    query: web::Query<ListQuery>,
) -> ActixResult<HttpResponse> {
    let pagination = PaginationParams {
        page: query.page.unwrap_or(1),
        per_page: 20,
    };

    let pool_ref = pool.get_ref();

    // 获取分页记录列表
    let paginated = record_service::list_records(pool_ref, &pagination).map_err(|e| {
        log::error!("list_records error: {}", e);
        actix_web::error::ErrorInternalServerError("数据库查询失败")
    })?;

    // 获取下拉数据
    let hospitals = record_service::list_active_hospitals(pool_ref).map_err(|e| {
        log::error!("list_active_hospitals error: {}", e);
        actix_web::error::ErrorInternalServerError("数据库查询失败")
    })?;

    let body_parts = record_service::list_active_body_parts(pool_ref).map_err(|e| {
        log::error!("list_active_body_parts error: {}", e);
        actix_web::error::ErrorInternalServerError("数据库查询失败")
    })?;

    // 构建 query_string（不含 page，供分页链接使用）
    let mut qs_parts: Vec<String> = Vec::new();
    if let Some(y) = query.year {
        qs_parts.push(format!("year={}", y));
    }
    if let Some(m) = query.month {
        qs_parts.push(format!("month={}", m));
    }
    if let Some(h) = query.hospital_id {
        qs_parts.push(format!("hospital_id={}", h));
    }
    if let Some(b) = query.body_part_id {
        qs_parts.push(format!("body_part_id={}", b));
    }
    if let Some(ref k) = query.keyword {
        qs_parts.push(format!("keyword={}", k));
    }
    if let Some(ref s) = query.sort {
        qs_parts.push(format!("sort={}", s));
    }
    if let Some(ref o) = query.order {
        qs_parts.push(format!("order={}", o));
    }
    let query_string = qs_parts.join("&");

    // 构建模板上下文
    let mut ctx = Context::new();
    ctx.insert("active_page", "index");
    ctx.insert("records", &paginated.records);
    ctx.insert("hospitals", &hospitals);
    ctx.insert("body_parts", &body_parts);
    let page_end = (paginated.page * paginated.per_page).min(paginated.total);
    let pages: Vec<i64> = (1..=paginated.total_pages).collect();
    ctx.insert(
        "pagination",
        &PaginationCtx {
            page: paginated.page,
            per_page: paginated.per_page,
            total: paginated.total,
            total_unfiltered: paginated.total,
            total_pages: paginated.total_pages,
            page_end,
            pages,
        },
    );
    ctx.insert(
        "filter",
        &FilterCtx {
            year: query.year,
            month: query.month,
            hospital_id: query.hospital_id,
            body_part_id: query.body_part_id,
            keyword: query.keyword.clone(),
        },
    );
    ctx.insert("query_string", &query_string);
    ctx.insert("sort", &query.sort);
    ctx.insert("order", &query.order);

    let html = tera.render("index.html", &ctx).map_err(|e| {
        log::error!("tera render error: {:?}", e);
        actix_web::error::ErrorInternalServerError(format!("模板渲染失败: {}", e))
    })?;

    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(html))
}

// ── POST /records — 创建记录 + 上传文件 ──────────────────────────────

#[derive(MultipartForm)]
pub struct CreateRecordForm {
    pub year: Text<String>,
    pub month: Text<String>,
    pub day: Text<String>,
    pub hospital_id: Text<String>,
    pub body_part_id: Text<String>,
    pub description: Text<String>,
    #[multipart(limit = "500MB")]
    pub image_files: Vec<TempFile>,
    #[multipart(limit = "500MB")]
    pub model_files: Vec<TempFile>,
    #[multipart(limit = "500MB")]
    pub annotation_files: Vec<TempFile>,
    #[multipart(limit = "500MB")]
    pub report_files: Vec<TempFile>,
}

pub async fn create_record(
    pool: web::Data<DbPool>,
    minio: web::Data<std::sync::Arc<tokio::sync::RwLock<MinioClient>>>,
    MultipartForm(form): MultipartForm<CreateRecordForm>,
) -> ActixResult<HttpResponse> {
    // ── 1. 解析表单基本字段 ──────────────────────────────────────────
    let year: i32 = form
        .year
        .parse()
        .map_err(|_| actix_web::error::ErrorBadRequest("年份格式错误"))?;
    let month: i16 = form
        .month
        .parse()
        .map_err(|_| actix_web::error::ErrorBadRequest("月份格式错误"))?;
    let day: i16 = form
        .day
        .parse()
        .map_err(|_| actix_web::error::ErrorBadRequest("日期格式错误"))?;
    let hospital_id: i32 = form
        .hospital_id
        .parse()
        .map_err(|_| actix_web::error::ErrorBadRequest("医院 ID 格式错误"))?;
    let body_part_id: i32 = form
        .body_part_id
        .parse()
        .map_err(|_| actix_web::error::ErrorBadRequest("部位 ID 格式错误"))?;
    let description = form.description.as_str();

    let record_date = chrono::NaiveDate::from_ymd_opt(year, month as u32, day as u32)
        .ok_or_else(|| actix_web::error::ErrorBadRequest("日期无效"))?;

    // ── 2. 查询部位信息（part_code + bucket_name 用于 MinIO）────────────────
    let pool_ref = pool.get_ref();
    let body_part = record_service::get_active_body_part(pool_ref, body_part_id).map_err(|e| {
        log::error!("get_active_body_part error: {}", e);
        actix_web::error::ErrorInternalServerError("数据库查询失败")
    })?;

    let part_code = body_part.part_code.clone();
    let bucket_name = body_part.bucket_name.clone();

    // ── 3. 生成记录编号 & 短码 & 写入数据库 ─────────────────────────────────
    let record_no = record_service::generate_record_no(pool_ref, year).map_err(|e| {
        log::error!("generate_record_no error: {}", e);
        actix_web::error::ErrorInternalServerError("编号生成失败")
    })?;

    let short_code = record_service::generate_short_code();

    let new_record = NewMedicalRecord {
        record_no: &record_no,
        year,
        month,
        day,
        record_date,
        hospital_id,
        body_part_id,
        description,
        short_code: &short_code,
    };

    let record = record_service::create_record(pool_ref, &new_record).map_err(|e| {
        log::error!("create_record error: {}", e);
        actix_web::error::ErrorInternalServerError("记录内入失败")
    })?;

    log::info!("Record created: id={} no={}", record.id, record.record_no);

    // ── 4. 处理上传文件（并发）────────────────────────────────────────────

    struct UploadItem {
        _temp_file: TempFile,
        temp_path: std::path::PathBuf,
        file_type: String,
        original_name: String,
        storage_name: String,
        object_key: String,
        extension: String,
    }

    let file_groups: Vec<(&str, Vec<TempFile>)> = vec![
        ("image", form.image_files),
        ("model", form.model_files),
        ("annotation", form.annotation_files),
        ("report", form.report_files),
    ];

    // 1. 验证并收集所有待上传文件的元数据（同步，无 I/O）
    // _temp_file 必须保留：TempFile drop 时会删除磁盘临时文件，
    // 若在异步读取前 drop 则文件已不存在。
    let mut upload_items: Vec<UploadItem> = Vec::new();
    for (file_type, temp_files) in file_groups {
        for temp_file in temp_files {
            let original_name = temp_file
                .file_name
                .clone()
                .unwrap_or_else(|| "unknown".to_string());
            let extension = file_service::get_full_extension(&original_name);
            if !file_service::validate_file_type(file_type, &extension) {
                log::warn!(
                    "Skipped '{}' (type={}, ext={}): not in whitelist",
                    original_name,
                    file_type,
                    extension
                );
                continue;
            }
            let storage_name = file_service::generate_storage_name(&extension);
            let object_key =
                MinioClient::build_object_key(file_type, year, month, record.id, &storage_name);
            let temp_path = temp_file.file.path().to_path_buf();
            upload_items.push(UploadItem {
                _temp_file: temp_file,
                temp_path,
                file_type: file_type.to_string(),
                original_name,
                storage_name,
                object_key,
                extension,
            });
        }
    }

    // 2. 克隆 Bucket 后立即释放 RwLock，避免长时间持锁阻塞写操作
    let bucket = {
        let guard = minio.read().await;
        guard
            .clone_bucket(&part_code)
            .ok_or_else(|| actix_web::error::ErrorBadRequest("部位桶不存在"))?
    };

    // 3. 并发读取文件 + 上传 MinIO（所有文件同时进行）
    let upload_futures: Vec<_> = upload_items
        .iter()
        .map(|item| {
            let bucket = bucket.clone();
            let path = item.temp_path.clone();
            let key = item.object_key.clone();
            let name = item.original_name.clone();
            async move {
                match tokio::fs::read(&path).await {
                    Ok(bytes) => {
                        let size = bytes.len() as i64;
                        match bucket.put_object(&key, &bytes).await {
                            Ok(_) => Ok(size),
                            Err(e) => {
                                log::error!(
                                    "MinIO upload failed for '{}' (key={}): {}",
                                    name,
                                    key,
                                    e
                                );
                                Err(())
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to read temp file '{}': {}", name, e);
                        Err(())
                    }
                }
            }
        })
        .collect();

    let upload_results = futures_util::future::join_all(upload_futures).await;

    // 4. 串行写入数据库（DB 插入很快）
    let mut model_idx = 0usize;
    for (item, result) in upload_items.iter().zip(upload_results.iter()) {
        match result {
            Ok(file_size) => {
                // 模型文件自动分配预设颜色
                let auto_color: Option<String> = if item.file_type == "model" {
                    let color =
                        MODEL_COLOR_PRESETS[model_idx % MODEL_COLOR_PRESETS.len()].to_string();
                    model_idx += 1;
                    Some(color)
                } else {
                    None
                };
                let new_file = crate::models::NewFileRecord {
                    record_id: record.id,
                    file_type: &item.file_type,
                    original_name: &item.original_name,
                    storage_name: &item.storage_name,
                    bucket_name: &bucket_name,
                    object_key: &item.object_key,
                    file_size: *file_size,
                    file_extension: &item.extension,
                    color_hex: auto_color.as_deref(),
                };
                if let Err(e) = file_service::create_file_record(pool_ref, &new_file) {
                    log::error!("DB insert file failed for '{}': {}", item.original_name, e);
                } else {
                    log::info!(
                        "File saved: record={} type={} key={}",
                        record.id,
                        item.file_type,
                        item.object_key
                    );
                }
            }
            Err(_) => {} // 已在上方记录日志
        }
    }

    // ── 5. 重定向到详情页 ─────────────────────────────────────────────────
    Ok(HttpResponse::SeeOther()
        .insert_header((
            "Location",
            format!("/records/{}/{}", record.record_no, record.short_code),
        ))
        .finish())
}

// ── GET /records/{id} — 记录详情页 ──────────────────────────────────────────

/// 供模板使用的文件视图（含格式化字段）
#[derive(Serialize)]
struct FileView {
    id: i32,
    original_name: String,
    file_extension: String,
    file_size_str: String,
    upload_time_str: String,
    color_hex: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ShowQuery {
    pub edit: Option<String>,
    pub msg: Option<String>,
}

pub async fn show_record(
    pool: web::Data<DbPool>,
    tera: web::Data<tera::Tera>,
    path: web::Path<(String, String)>,
    query: web::Query<ShowQuery>,
) -> ActixResult<HttpResponse> {
    let (record_no, short_code) = path.into_inner();
    let pool_ref = pool.get_ref();

    // 查询记录 + 医院名 + 部位名 + 部位编码
    let (record, hospital_name, part_name, part_code) =
        record_service::get_record_view(pool_ref, &record_no).map_err(|e| match e {
            DieselError::NotFound => actix_web::error::ErrorNotFound("记录不存在"),
            _ => {
                log::error!("get_record_view error: {}", e);
                actix_web::error::ErrorInternalServerError("数据库查询失败")
            }
        })?;

    // 验证短码匹配
    if record.short_code != short_code {
        return Err(actix_web::error::ErrorNotFound("记录不存在"));
    }

    // 查询关联文件并按类型分组
    let all_files = file_service::list_files_by_record(pool_ref, record.id).map_err(|e| {
        log::error!("list_files_by_record error: {}", e);
        actix_web::error::ErrorInternalServerError("数据库查询失败")
    })?;

    let to_view = |f: &crate::models::FileRecord| FileView {
        id: f.id,
        original_name: f.original_name.clone(),
        file_extension: f.file_extension.clone(),
        file_size_str: f.file_size_display(),
        upload_time_str: f.upload_time.format("%Y-%m-%d %H:%M").to_string(),
        color_hex: f.color_hex.clone(),
    };

    let image_files: Vec<FileView> = all_files
        .iter()
        .filter(|f| f.file_type == "image")
        .map(to_view)
        .collect();
    let model_files: Vec<FileView> = all_files
        .iter()
        .filter(|f| f.file_type == "model")
        .map(to_view)
        .collect();
    let annotation_files: Vec<FileView> = all_files
        .iter()
        .filter(|f| f.file_type == "annotation")
        .map(to_view)
        .collect();
    let report_files: Vec<FileView> = all_files
        .iter()
        .filter(|f| f.file_type == "report")
        .map(to_view)
        .collect();

    let image_count = image_files.len();
    let model_count = model_files.len();
    let annotation_count = annotation_files.len();
    let report_count = report_files.len();
    let total_file_count = all_files.len();

    // 格式化日期
    let record_date_str = format!("{}年{:02}月{:02}日", record.year, record.month, record.day);
    let created_at_str = record.created_at.format("%Y-%m-%d %H:%M:%S").to_string();
    let updated_at_str = record.updated_at.format("%Y-%m-%d %H:%M:%S").to_string();

    // 编辑下拉所需字典数据
    let hospitals = record_service::list_active_hospitals(pool_ref).map_err(|e| {
        log::error!("list_active_hospitals error: {}", e);
        actix_web::error::ErrorInternalServerError("数据库查询失败")
    })?;
    let body_parts = record_service::list_active_body_parts(pool_ref).map_err(|e| {
        log::error!("list_active_body_parts error: {}", e);
        actix_web::error::ErrorInternalServerError("数据库查询失败")
    })?;

    let edit_mode = query.edit.as_deref() == Some("1");
    let flash_msg = query.msg.clone().unwrap_or_default();

    let mut ctx = tera::Context::new();
    ctx.insert("active_page", "index");
    ctx.insert("record", &record);
    ctx.insert("hospital_name", &hospital_name);
    ctx.insert("part_name", &part_name);
    ctx.insert("part_code", &part_code);
    ctx.insert("record_date_str", &record_date_str);
    ctx.insert("created_at_str", &created_at_str);
    ctx.insert("updated_at_str", &updated_at_str);
    ctx.insert("image_files", &image_files);
    ctx.insert("model_files", &model_files);
    ctx.insert("annotation_files", &annotation_files);
    ctx.insert("report_files", &report_files);
    ctx.insert("image_count", &image_count);
    ctx.insert("model_count", &model_count);
    ctx.insert("annotation_count", &annotation_count);
    ctx.insert("report_count", &report_count);
    ctx.insert("total_file_count", &total_file_count);
    ctx.insert("hospitals", &hospitals);
    ctx.insert("body_parts", &body_parts);
    ctx.insert("edit_mode", &edit_mode);
    ctx.insert("flash_msg", &flash_msg);

    let html = tera.render("record_detail.html", &ctx).map_err(|e| {
        log::error!("tera render error (record_detail.html): {:?}", e);
        actix_web::error::ErrorInternalServerError(format!("模板渲染失败: {}", e))
    })?;

    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(html))
}

// ── GET /records/new — 新增记录页面 ────────────────────────────────────────

pub async fn new_record(
    pool: web::Data<DbPool>,
    tera: web::Data<tera::Tera>,
) -> ActixResult<HttpResponse> {
    let pool_ref = pool.get_ref();

    let hospitals = record_service::list_active_hospitals(pool_ref).map_err(|e| {
        log::error!("list_active_hospitals error: {}", e);
        actix_web::error::ErrorInternalServerError("数据库查询失败")
    })?;

    let body_parts = record_service::list_active_body_parts(pool_ref).map_err(|e| {
        log::error!("list_active_body_parts error: {}", e);
        actix_web::error::ErrorInternalServerError("数据库查询失败")
    })?;

    let now = Local::now();
    let mut ctx = Context::new();
    ctx.insert("active_page", "record-new");
    ctx.insert("hospitals", &hospitals);
    ctx.insert("body_parts", &body_parts);
    ctx.insert(
        "current_year",
        &(now.format("%Y").to_string().parse::<i32>().unwrap_or(2026)),
    );
    ctx.insert(
        "current_month",
        &(now.format("%-m").to_string().parse::<i32>().unwrap_or(1)),
    );
    ctx.insert(
        "current_day",
        &(now.format("%-d").to_string().parse::<i32>().unwrap_or(1)),
    );

    let html = tera.render("record_new.html", &ctx).map_err(|e| {
        log::error!("tera render error (record_new.html): {:?}", e);
        actix_web::error::ErrorInternalServerError(format!("模板渲染失败: {}", e))
    })?;

    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(html))
}

// ── GET /records/{record_no}/{short_code}/edit — 重定向到合并后的详情页（编辑模式）───

pub async fn edit_record_form(path: web::Path<(String, String)>) -> ActixResult<HttpResponse> {
    let (record_no, short_code) = path.into_inner();
    Ok(HttpResponse::Found()
        .insert_header((
            "Location",
            format!("/records/{}/{}?edit=1", record_no, short_code),
        ))
        .finish())
}

// ── POST /records/{record_no}/{short_code}/update — 提交编辑 ─────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateRecordForm {
    pub year: String,
    pub month: String,
    pub day: String,
    pub hospital_id: String,
    pub body_part_id: String,
    pub description: String,
}

pub async fn update_record(
    pool: web::Data<DbPool>,
    path: web::Path<(String, String)>,
    form: web::Form<UpdateRecordForm>,
) -> ActixResult<HttpResponse> {
    let (record_no, short_code) = path.into_inner();
    let pool_ref = pool.get_ref();

    // 1. 查询原记录（校验短码 + 获取 id）
    let (record, _, _, _) =
        record_service::get_record_view(pool_ref, &record_no).map_err(|e| match e {
            DieselError::NotFound => actix_web::error::ErrorNotFound("记录不存在"),
            _ => {
                log::error!("get_record_view error: {}", e);
                actix_web::error::ErrorInternalServerError("数据库查询失败")
            }
        })?;

    if record.short_code != short_code {
        return Err(actix_web::error::ErrorNotFound("记录不存在"));
    }

    // 2. 解析表单字段
    let year: i32 = form
        .year
        .parse()
        .map_err(|_| actix_web::error::ErrorBadRequest("年份格式错误"))?;
    let month: i16 = form
        .month
        .parse()
        .map_err(|_| actix_web::error::ErrorBadRequest("月份格式错误"))?;
    let day: i16 = form
        .day
        .parse()
        .map_err(|_| actix_web::error::ErrorBadRequest("日期格式错误"))?;
    let hospital_id: i32 = form
        .hospital_id
        .parse()
        .map_err(|_| actix_web::error::ErrorBadRequest("医院 ID 格式错误"))?;
    let body_part_id: i32 = form
        .body_part_id
        .parse()
        .map_err(|_| actix_web::error::ErrorBadRequest("部位 ID 格式错误"))?;

    let record_date = chrono::NaiveDate::from_ymd_opt(year, month as u32, day as u32)
        .ok_or_else(|| actix_web::error::ErrorBadRequest("日期无效"))?;

    // 3. 构建 changeset 并更新
    let changeset = UpdateMedicalRecord {
        year,
        month,
        day,
        record_date,
        hospital_id,
        body_part_id,
        description: form.description.clone(),
    };

    record_service::update_record(pool_ref, record.id, changeset).map_err(|e| {
        log::error!("update_record error: {}", e);
        actix_web::error::ErrorInternalServerError("更新记录失败")
    })?;

    log::info!("Record updated: no={}", record_no);

    // 4. 重定向回详情页（携带成功消息）
    Ok(HttpResponse::SeeOther()
        .insert_header((
            "Location",
            format!("/records/{}/{}?msg=updated", record_no, short_code),
        ))
        .finish())
}

// ── POST /records/{record_no}/{short_code}/delete — 删除记录（级联清理）────────

pub async fn delete_record(
    pool: web::Data<DbPool>,
    minio: web::Data<
        std::sync::Arc<tokio::sync::RwLock<crate::services::minio_service::MinioClient>>,
    >,
    path: web::Path<(String, String)>,
) -> ActixResult<HttpResponse> {
    let (record_no, short_code) = path.into_inner();
    let pool_ref = pool.get_ref();

    // 1. 查询记录，校验 short_code
    let (record, _, _, part_code) =
        record_service::get_record_view(pool_ref, &record_no).map_err(|e| match e {
            DieselError::NotFound => actix_web::error::ErrorNotFound("记录不存在"),
            _ => {
                log::error!("get_record_view error: {}", e);
                actix_web::error::ErrorInternalServerError("数据库查询失败")
            }
        })?;

    if record.short_code != short_code {
        return Err(actix_web::error::ErrorNotFound("记录不存在"));
    }

    // 2. 查询所有关联文件
    let file_list = file_service::list_files_by_record(pool_ref, record.id).map_err(|e| {
        log::error!("list_files_by_record error: {}", e);
        actix_web::error::ErrorInternalServerError("查询文件列表失败")
    })?;

    // 3. 逐个从 MinIO 删除对象（失败只记警告，不中断）
    {
        let bucket_opt = {
            let guard = minio.read().await;
            guard.get_bucket(&part_code).cloned()
        };
        if let Some(bucket) = bucket_opt {
            for f in &file_list {
                match bucket.delete_object(&f.object_key).await {
                    Ok(_) => log::info!("MinIO deleted: {}", f.object_key),
                    Err(e) => log::warn!("MinIO delete failed for '{}': {}", f.object_key, e),
                }
            }
        } else {
            log::warn!(
                "Bucket not found for part_code='{}', skipping MinIO cleanup",
                part_code
            );
        }
    }

    // 4. 删除数据库记录（ON DELETE CASCADE 自动清理 files 表）
    record_service::delete_record(pool_ref, record.id).map_err(|e| {
        log::error!("delete_record error: {}", e);
        actix_web::error::ErrorInternalServerError("删除记录失败")
    })?;

    log::info!(
        "Record deleted: no={}, files_count={}",
        record_no,
        file_list.len()
    );

    // 5. 重定向到列表页
    Ok(HttpResponse::SeeOther()
        .insert_header(("Location", "/?msg=deleted"))
        .finish())
}

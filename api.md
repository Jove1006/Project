# 医学数据管理系统 — API 与模块文档

> 更新日期：2026-02-27
> 状态：核心 CRUD 已完成，模型展示页待重构为前端 SPA
> `cargo check` 通过，无编译错误

---

## 模块总览

```
medical-server/src/
├── config.rs                — 配置管理（.env → Config 结构体）
├── db.rs                    — 数据库连接池（r2d2 + Diesel）
├── main.rs                  — 入口：自动启动 PG / MinIO、初始化模板、HTTP 服务
├── models.rs                — 数据模型（Queryable / Insertable / View）
├── schema.rs                — Diesel 自动生成（勿手改）
├── services/
│   ├── mod.rs
│   ├── minio_service.rs     — MinIO 对象存储封装            ✅
│   ├── record_service.rs    — 记录业务逻辑（分页/CRUD/编号） ✅
│   └── file_service.rs      — 文件业务逻辑（校验/存储/CRUD） ✅
└── routes/
    ├── mod.rs               — 路由注册
    ├── records.rs           — 记录路由（列表/新建/详情/编辑/删除） ✅
    └── files.rs             — 文件路由（上传/查看/删除）          ✅

medical-server/templates/    — Tera HTML 模板
├── base.html                — 公共布局
├── index.html               — 记录列表页
├── record_new.html          — 新建记录页
└── record_detail.html       — 记录详情页（含编辑模式）

medical-server/static/
├── css/style.css            — 全局样式
└── js/main.js               — 全局脚本
```

### 已删除的旧组件

| 组件                             | 原用途                             | 删除原因          |
| -------------------------------- | ---------------------------------- | ----------------- |
| `vtk-renderer/`                | Python VTK 后端渲染 WebSocket 服务 | 改为前端 GPU 渲染 |
| `templates/model_gallery.html` | 后端推帧模型浏览页                 | 同上              |
| `templates/model_viewer.html`  | 裁剪版 vtk.js 单文件预览页         | 同上              |
| `static/js/vtk.js` (2.3MB)     | 裁剪版 vtk.js UMD 包               | npm 完整版替代    |
| `static/js/three.min.js`       | Three.js                           | 不再使用          |
| `static/js/STLLoader.js`       | Three.js STL 加载器                | 不再使用          |
| `static/js/OrbitControls.js`   | Three.js 轨道控制器                | 不再使用          |

---

## 路由表

### routes/mod.rs — `init(cfg)`

**记录路由 (records.rs)**

| 方法 | 路径                                         | 处理函数                      | 说明                       |
| ---- | -------------------------------------------- | ----------------------------- | -------------------------- |
| GET  | `/`                                        | `records::index`            | 记录列表页（分页 + 筛选）  |
| GET  | `/records/new`                             | `records::new_record`       | 新建记录页面               |
| POST | `/records`                                 | `records::create_record`    | 创建记录（含文件上传）     |
| GET  | `/records/{record_no}/{short_code}`        | `records::show_record`      | 记录详情页                 |
| GET  | `/records/{record_no}/{short_code}/edit`   | `records::edit_record_form` | 重定向到详情页编辑模式     |
| POST | `/records/{record_no}/{short_code}/update` | `records::update_record`    | 提交编辑                   |
| POST | `/records/{record_no}/{short_code}/delete` | `records::delete_record`    | 删除记录（级联清理 MinIO） |

**文件路由 (files.rs)**

| 方法 | 路径                                            | 处理函数                   | 说明               |
| ---- | ----------------------------------------------- | -------------------------- | ------------------ |
| POST | `/records/{record_no}/files`                  | `files::upload_files`    | 为已有记录上传文件 |
| GET  | `/records/{record_no}/files/{file_id}/view`   | `files::view_model_file` | 返回文件二进制流   |
| POST | `/records/{record_no}/files/{file_id}/delete` | `files::delete_file`     | 删除单个文件       |

**静态资源**

| 路径          | 说明              |
| ------------- | ----------------- |
| `/static/*` | CSS / JS 静态文件 |

---

## config.rs — `Config`

### 字段

| 字段                 | 类型       | 环境变量             | 默认值          |
| -------------------- | ---------- | -------------------- | --------------- |
| `database_url`     | `String` | `DATABASE_URL`     | 必填            |
| `minio_endpoint`   | `String` | `MINIO_ENDPOINT`   | 必填            |
| `minio_access_key` | `String` | `MINIO_ACCESS_KEY` | 必填            |
| `minio_secret_key` | `String` | `MINIO_SECRET_KEY` | 必填            |
| `minio_region`     | `String` | `MINIO_REGION`     | `"us-east-1"` |
| `server_host`      | `String` | `SERVER_HOST`      | `"127.0.0.1"` |
| `server_port`      | `u16`    | `SERVER_PORT`      | `8080`        |

### 方法

| 方法                           | 说明                                     |
| ------------------------------ | ---------------------------------------- |
| `Config::from_env() -> Self` | 加载 `.env` 文件，读取环境变量构建实例 |

---

## db.rs — 数据库连接池

| 类型/函数                    | 说明                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| `DbPool`                   | `r2d2::Pool<ConnectionManager<PgConnection>>`             |
| `DbConn`                   | `r2d2::PooledConnection<ConnectionManager<PgConnection>>` |
| `init_pool(url) -> DbPool` | 创建连接池，`max_size=10`，`timeout=20s`                |
| `get_conn(pool) -> DbConn` | 从池中获取连接                                              |

---

## main.rs — 启动流程

1. `env_logger::init` — 初始化日志
2. `Config::from_env()` — 加载配置
3. `start_postgresql_if_needed()` — 检测 PG 5432 端口，未运行则启动 Windows 服务 + 自动建库
4. `start_minio_if_needed()` — 检测 MinIO 9000 端口，未运行则启动 `minio.exe server`
5. `db::init_pool()` — 初始化 DB 连接池
6. `MinioClient::init_buckets_from_db()` — 从 DB 读取活跃部位，创建/验证 MinIO 桶
7. `Tera::new("templates/**/*")` — 加载 Tera 模板
8. `HttpServer::new()` — 启动 Actix-web，绑定 `{host}:{port}`

---

## models.rs — 数据模型

### BodyPart（`body_parts` 表）

| 结构体              | 用途         |
| ------------------- | ------------ |
| `BodyPart`        | 查询结果映射 |
| `NewBodyPart<'a>` | INSERT 使用  |

字段：`id`, `part_code`, `part_name`, `bucket_name`, `is_active`, `sort_order`, `description`, `created_at`, `updated_at`

### Hospital（`hospitals` 表）

| 结构体              | 用途         |
| ------------------- | ------------ |
| `Hospital`        | 查询结果映射 |
| `NewHospital<'a>` | INSERT 使用  |

字段：`id`, `hospital_name`, `short_name`, `is_active`, `sort_order`, `created_at`, `updated_at`

### MedicalRecord（`medical_records` 表）

| 结构体                   | 用途                  |
| ------------------------ | --------------------- |
| `MedicalRecord`        | 查询结果映射          |
| `NewMedicalRecord<'a>` | INSERT 使用           |
| `UpdateMedicalRecord`  | UPDATE changeset      |
| `MedicalRecordView`    | JOIN 查询列表展示视图 |

字段：`id`, `record_no`, `short_code`, `year`, `month`, `day`, `record_date`, `hospital_id`, `body_part_id`, `description`, `created_at`, `updated_at`

`MedicalRecordView` 聚合字段：`id`, `record_no`, `year`, `month`, `day`, `record_date`, `hospital_name`, `body_part_name`, `body_part_code`, `description`, `file_count`, `created_at`

### FileRecord（`files` 表）

| 结构体                | 用途         |
| --------------------- | ------------ |
| `FileRecord`        | 查询结果映射 |
| `NewFileRecord<'a>` | INSERT 使用  |

字段：`id`, `record_id`, `file_type`, `original_name`, `storage_name`, `bucket_name`, `object_key`, `file_size`, `file_extension`, `upload_time`

| 方法                              | 说明                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `file_type_display() -> &str`   | `image`→医学图像 / `model`→模型 / `annotation`→标注 / `report`→报告 |
| `file_size_display() -> String` | 自动选择 B / KB / MB / GB 单位                                                  |

---

## services/record_service.rs

| 函数/结构体                                                              | 说明                                        |
| ------------------------------------------------------------------------ | ------------------------------------------- |
| `PaginationParams { page, per_page }`                                  | 分页参数                                    |
| `PaginatedRecords { records, page, per_page, total, total_pages }`     | 分页结果                                    |
| `list_records(pool, params) -> PaginatedRecords`                       | 分页列表查询（JOIN 医院 + 部位 + 文件计数） |
| `list_active_hospitals(pool) -> Vec<Hospital>`                         | 活跃医院列表                                |
| `list_active_body_parts(pool) -> Vec<BodyPart>`                        | 活跃部位列表                                |
| `generate_short_code() -> String`                                      | 生成 6 位随机短码                           |
| `generate_record_no(pool, year) -> String`                             | 生成记录编号（MR-{year}-{seq}）             |
| `create_record(pool, new_record) -> MedicalRecord`                     | 新建记录                                    |
| `get_record_by_id(pool, id) -> MedicalRecord`                          | 按 ID 查记录                                |
| `update_record(pool, id, changeset)`                                   | 更新记录                                    |
| `delete_record(pool, id)`                                              | 删除记录（ON DELETE CASCADE 清理文件）      |
| `get_record_view(pool, record_no) -> (Record, 医院名, 部位名, 部位码)` | 按编号查记录详情                            |

---

## services/file_service.rs

| 函数                                                         | 说明                           |
| ------------------------------------------------------------ | ------------------------------ |
| `get_full_extension(filename) -> String`                   | 提取完整后缀（如 `.nii.gz`） |
| `validate_file_type(file_type, ext) -> bool`               | 按类型白名单校验扩展名         |
| `generate_storage_name(ext) -> String`                     | 生成 UUID 存储文件名           |
| `create_file_record(pool, new_file) -> FileRecord`         | 插入文件记录                   |
| `list_files_by_record(pool, record_id) -> Vec<FileRecord>` | 查询某记录下所有文件           |
| `get_file_by_id(pool, file_id) -> FileRecord`              | 按 ID 查文件                   |
| `delete_file_record(pool, file_id) -> usize`               | 删除文件记录                   |

---

## services/minio_service.rs — `MinioClient`

| 方法                                                        | 类型  | 说明                                     |
| ----------------------------------------------------------- | ----- | ---------------------------------------- |
| `new(config) -> Self`                                     | 同步  | 构造客户端                               |
| `init_buckets_from_db(pool)`                              | async | 启动时从 DB 加载部位，创建/验证 MinIO 桶 |
| `get_bucket(part_code) -> Option<&Bucket>`                | 同步  | 按部位编码查找已缓存 Bucket              |
| `clone_bucket(part_code) -> Option<Bucket>`               | 同步  | 克隆 Bucket（用于释放锁后操作）          |
| `add_bucket(part_code, bucket_name)`                      | async | 运行时新增桶                             |
| `build_object_key(type, year, month, id, name) -> String` | 静态  | 拼接对象键                               |
| `upload_object(part_code, key, data)`                     | async | 上传字节到 MinIO                         |
| `delete_object(part_code, key)`                           | async | 删除 MinIO 对象                          |
| `get_presigned_url(part_code, key, expires)`              | async | 生成预签名下载 URL                       |

对象键格式：`{file_type}/{year}/{month}/{record_id}/{storage_name}`

---

## 待实现

| 模块                          | 内容                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `medical-web/` (新前端项目) | Vite + Vue 3 + @kitware/vtk.js 模型展示 SPA                                                     |
| Rust 新增 JSON API            | `GET /api/records/:no/models` (模型文件列表 JSON)、`GET /api/files/:id/data` (文件二进制流) |
| Rust 静态托管                 | `/viewer/*` → `medical-web/dist/`                                                          |

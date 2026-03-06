use actix_multipart::form::{tempfile::TempFile, text::Text, MultipartForm};
use actix_web::{web, HttpResponse, Result as ActixResult};
use diesel::prelude::*;
use diesel::result::Error as DieselError;
use serde::{Deserialize, Serialize};

use crate::db::{get_conn, DbPool};
use crate::schema::{body_parts, files as files_table, medical_records};
use crate::services::{file_service, minio_service::MinioClient, record_service, upload_service};

#[derive(MultipartForm)]
pub struct UploadFilesForm {
    pub file_type: Text<String>,
    #[multipart(limit = "500MB")]
    pub files: Vec<TempFile>,
}

pub async fn upload_files(
    pool: web::Data<DbPool>,
    minio: web::Data<std::sync::Arc<tokio::sync::RwLock<MinioClient>>>,
    path: web::Path<String>,
    MultipartForm(form): MultipartForm<UploadFilesForm>,
) -> ActixResult<HttpResponse> {
    let record_no = path.into_inner();
    let file_type = form.file_type.as_str();
    let valid_types = ["image", "model", "annotation", "report"];
    if !valid_types.contains(&file_type) {
        return Err(actix_web::error::ErrorBadRequest("无效的文件类型"));
    }

    let pool_ref = pool.get_ref();
    let target =
        record_service::get_record_storage_target(pool_ref, &record_no).map_err(|e| match e {
            DieselError::NotFound => actix_web::error::ErrorNotFound("记录不存在"),
            _ => {
                log::error!("get_record_storage_target error: {}", e);
                actix_web::error::ErrorInternalServerError("数据库查询失败")
            }
        })?;

    let existing_model_count = if file_type == "model" {
        record_service::count_record_files_by_type(pool_ref, target.record_id, "model").unwrap_or(0)
            as usize
    } else {
        0
    };

    let service_target = upload_service::RecordStorageTarget {
        record_id: target.record_id,
        year: target.year,
        month: target.month,
        part_code: target.part_code,
        bucket_name: target.bucket_name,
    };

    let uploaded = upload_service::upload_record_file_batch(
        pool_ref,
        minio.get_ref(),
        &service_target,
        file_type,
        form.files,
        existing_model_count,
    )
    .await
    .map_err(|e| {
        log::error!("upload_record_file_batch error: {}", e);
        actix_web::error::ErrorInternalServerError("文件上传失败")
    })?;

    log::info!(
        "upload_files: record_no={} type={} uploaded={}",
        record_no,
        file_type,
        uploaded
    );

    Ok(HttpResponse::Ok().finish())
}

pub async fn delete_file(
    pool: web::Data<DbPool>,
    minio: web::Data<std::sync::Arc<tokio::sync::RwLock<MinioClient>>>,
    path: web::Path<(String, i32)>,
) -> ActixResult<HttpResponse> {
    let (record_no, file_id) = path.into_inner();
    let pool_ref = pool.get_ref();

    let file = file_service::get_file_by_id(pool_ref, file_id).map_err(|e| match e {
        DieselError::NotFound => actix_web::error::ErrorNotFound("文件不存在"),
        _ => actix_web::error::ErrorInternalServerError("数据库查询失败"),
    })?;

    let mut conn = get_conn(pool_ref);
    let (short_code, part_code): (String, String) = medical_records::table
        .inner_join(body_parts::table)
        .filter(medical_records::id.eq(file.record_id))
        .select((medical_records::short_code, body_parts::part_code))
        .first(&mut conn)
        .map_err(|_| actix_web::error::ErrorInternalServerError("数据库查询失败"))?;

    {
        let minio_guard = minio.read().await;
        if let Err(e) = minio_guard
            .delete_object(&part_code, &file.object_key)
            .await
        {
            log::error!("MinIO delete failed (key={}): {}", file.object_key, e);
        }
    }

    file_service::delete_file_record(pool_ref, file_id).map_err(|e| {
        log::error!("delete_file_record error: {}", e);
        actix_web::error::ErrorInternalServerError("删除失败")
    })?;

    log::info!("File deleted: id={} record={}", file_id, record_no);

    Ok(HttpResponse::SeeOther()
        .insert_header((
            "Location",
            format!("/records/{}/{}?msg=file_deleted", record_no, short_code),
        ))
        .finish())
}

#[derive(Serialize)]
struct ModelFileItem {
    id: i32,
    original_name: String,
    file_size: i64,
    file_size_str: String,
    color_hex: Option<String>,
}

#[derive(Serialize)]
struct ModelsResponse {
    record_no: String,
    files: Vec<ModelFileItem>,
}

pub async fn api_list_models(
    pool: web::Data<DbPool>,
    path: web::Path<String>,
) -> ActixResult<HttpResponse> {
    let record_no = path.into_inner();
    let pool_ref = pool.get_ref();

    let (record, _, _, _) =
        record_service::get_record_view(pool_ref, &record_no).map_err(|e| match e {
            DieselError::NotFound => actix_web::error::ErrorNotFound("记录不存在"),
            _ => {
                log::error!("get_record_view error: {}", e);
                actix_web::error::ErrorInternalServerError("数据库查询失败")
            }
        })?;

    let mut conn = get_conn(pool_ref);
    let model_files: Vec<crate::models::FileRecord> = files_table::table
        .filter(files_table::record_id.eq(record.id))
        .filter(files_table::file_type.eq("model"))
        .filter(files_table::file_extension.ne("drc"))
        .order(files_table::original_name.asc())
        .load(&mut conn)
        .map_err(|e| {
            log::error!("list model files error: {}", e);
            actix_web::error::ErrorInternalServerError("数据库查询失败")
        })?;

    let files: Vec<ModelFileItem> = model_files
        .iter()
        .map(|f| ModelFileItem {
            id: f.id,
            original_name: f.original_name.clone(),
            file_size: f.file_size,
            file_size_str: f.file_size_display(),
            color_hex: f.color_hex.clone(),
        })
        .collect();

    Ok(HttpResponse::Ok().json(ModelsResponse { record_no, files }))
}

#[derive(Serialize)]
struct BundleFileItem {
    id: i32,
    original_name: String,
    file_size: i64,
    color_hex: Option<String>,
    offset: usize,
    length: usize,
}

#[derive(Serialize)]
struct BundleManifest {
    files: Vec<BundleFileItem>,
}

pub async fn api_models_bundle(
    pool: web::Data<DbPool>,
    minio: web::Data<std::sync::Arc<tokio::sync::RwLock<MinioClient>>>,
    path: web::Path<String>,
) -> ActixResult<HttpResponse> {
    let record_no = path.into_inner();
    let pool_ref = pool.get_ref();

    let mut conn = get_conn(pool_ref);
    let (record_id, part_code): (i32, String) = medical_records::table
        .inner_join(body_parts::table)
        .filter(medical_records::record_no.eq(&record_no))
        .select((medical_records::id, body_parts::part_code))
        .first(&mut conn)
        .map_err(|e| match e {
            DieselError::NotFound => actix_web::error::ErrorNotFound("记录不存在"),
            _ => actix_web::error::ErrorInternalServerError("数据库查询失败"),
        })?;

    let model_files: Vec<crate::models::FileRecord> = files_table::table
        .filter(files_table::record_id.eq(record_id))
        .filter(files_table::file_type.eq("model"))
        .filter(files_table::file_extension.ne("drc"))
        .order(files_table::original_name.asc())
        .load(&mut conn)
        .map_err(|e| {
            log::error!("list model files error: {}", e);
            actix_web::error::ErrorInternalServerError("数据库查询失败")
        })?;

    if model_files.is_empty() {
        let manifest = serde_json::to_vec(&BundleManifest { files: vec![] }).unwrap();
        let len = (manifest.len() as u32).to_le_bytes();
        let mut body = Vec::with_capacity(4 + manifest.len());
        body.extend_from_slice(&len);
        body.extend_from_slice(&manifest);
        return Ok(HttpResponse::Ok()
            .insert_header(("Content-Type", "application/octet-stream"))
            .insert_header(("Cache-Control", "public, max-age=86400, immutable"))
            .insert_header(("Access-Control-Allow-Origin", "*"))
            .body(body));
    }

    let bucket = {
        let guard = minio.read().await;
        guard.get_bucket(&part_code).cloned()
    }
    .ok_or_else(|| actix_web::error::ErrorInternalServerError("桶未初始化"))?;

    let fetches = model_files.iter().map(|f| {
        let bkt = bucket.clone();
        let key = f.object_key.clone();
        async move { bkt.get_object(&key).await }
    });
    let results = futures_util::future::join_all(fetches).await;

    let mut blobs: Vec<Vec<u8>> = Vec::with_capacity(model_files.len());
    let mut manifest_items: Vec<BundleFileItem> = Vec::with_capacity(model_files.len());
    let mut offset: usize = 0;

    for (i, res) in results.into_iter().enumerate() {
        let f = &model_files[i];
        match res {
            Ok(resp) => {
                let data = resp.bytes().to_vec();
                let length = data.len();
                manifest_items.push(BundleFileItem {
                    id: f.id,
                    original_name: f.original_name.clone(),
                    file_size: f.file_size,
                    color_hex: f.color_hex.clone(),
                    offset,
                    length,
                });
                offset += length;
                blobs.push(data);
            }
            Err(e) => {
                log::error!("MinIO get_object error (key={}): {}", f.object_key, e);
            }
        }
    }

    let manifest_json = serde_json::to_vec(&BundleManifest {
        files: manifest_items,
    })
    .unwrap();
    let total_blob_size: usize = blobs.iter().map(|b| b.len()).sum();
    let mut body = Vec::with_capacity(4 + manifest_json.len() + total_blob_size);
    body.extend_from_slice(&(manifest_json.len() as u32).to_le_bytes());
    body.extend_from_slice(&manifest_json);
    for blob in &blobs {
        body.extend_from_slice(blob);
    }

    log::info!(
        "api_models_bundle: record={} files={} total_size={}",
        record_no,
        blobs.len(),
        body.len()
    );

    Ok(HttpResponse::Ok()
        .insert_header(("Content-Type", "application/octet-stream"))
        .insert_header(("Cache-Control", "public, max-age=86400, immutable"))
        .insert_header(("Access-Control-Allow-Origin", "*"))
        .body(body))
}

pub async fn api_file_data(
    pool: web::Data<DbPool>,
    minio: web::Data<std::sync::Arc<tokio::sync::RwLock<MinioClient>>>,
    path: web::Path<i32>,
) -> ActixResult<HttpResponse> {
    let file_id = path.into_inner();
    let pool_ref = pool.get_ref();

    let mut conn = get_conn(pool_ref);
    let (file, part_code): (crate::models::FileRecord, String) = files_table::table
        .inner_join(medical_records::table.inner_join(body_parts::table))
        .filter(files_table::id.eq(file_id))
        .select((
            crate::models::FileRecord::as_select(),
            body_parts::part_code,
        ))
        .first(&mut conn)
        .map_err(|e| match e {
            DieselError::NotFound => actix_web::error::ErrorNotFound("文件不存在"),
            _ => actix_web::error::ErrorInternalServerError("数据库查询失败"),
        })?;

    if file.file_type != "model" {
        return Err(actix_web::error::ErrorForbidden("仅允许获取模型文件"));
    }

    let bucket = {
        let guard = minio.read().await;
        guard.get_bucket(&part_code).cloned()
    }
    .ok_or_else(|| actix_web::error::ErrorInternalServerError("桶未初始化"))?;

    let response = bucket.get_object(&file.object_key).await.map_err(|e| {
        log::error!("MinIO get_object error (key={}): {}", file.object_key, e);
        actix_web::error::ErrorInternalServerError("获取文件失败")
    })?;

    let data = response.bytes().to_vec();
    log::info!(
        "api_file_data: id={} name={} size={}",
        file_id,
        file.original_name,
        data.len()
    );

    Ok(HttpResponse::Ok()
        .insert_header(("Content-Type", "application/octet-stream"))
        .insert_header(("Cache-Control", "public, max-age=86400, immutable"))
        .insert_header(("Access-Control-Allow-Origin", "*"))
        .body(data))
}

#[derive(Deserialize)]
pub struct UpdateColorBody {
    pub color_hex: Option<String>,
}

pub async fn api_update_color(
    pool: web::Data<DbPool>,
    path: web::Path<i32>,
    body: web::Json<UpdateColorBody>,
) -> ActixResult<HttpResponse> {
    let file_id = path.into_inner();
    let pool_ref = pool.get_ref();

    if let Some(ref hex) = body.color_hex {
        if !hex.starts_with('#') || hex.len() != 7 {
            return Err(actix_web::error::ErrorBadRequest(
                "颜色格式无效，应为 #RRGGBB",
            ));
        }
    }

    let _file = file_service::get_file_by_id(pool_ref, file_id).map_err(|e| match e {
        DieselError::NotFound => actix_web::error::ErrorNotFound("文件不存在"),
        _ => actix_web::error::ErrorInternalServerError("数据库查询失败"),
    })?;

    let mut conn = get_conn(pool_ref);
    diesel::update(files_table::table.filter(files_table::id.eq(file_id)))
        .set(files_table::color_hex.eq(&body.color_hex))
        .execute(&mut conn)
        .map_err(|e| {
            log::error!("update color_hex error: {}", e);
            actix_web::error::ErrorInternalServerError("更新颜色失败")
        })?;

    log::info!(
        "Color updated: file_id={} color={:?}",
        file_id,
        body.color_hex
    );
    Ok(HttpResponse::Ok().json(serde_json::json!({ "ok": true })))
}

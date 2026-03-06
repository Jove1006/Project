use std::path::PathBuf;
use std::sync::Arc;

use actix_multipart::form::tempfile::TempFile;
use tokio::sync::RwLock;

use crate::db::DbPool;
use crate::models::NewFileRecord;
use crate::services::file_service;
use crate::services::minio_service::MinioClient;

pub const MODEL_COLOR_PRESETS: &[&str] = &[
    "#E53935", "#1E88E5", "#43A047", "#FDD835", "#8E24AA", "#FB8C00", "#00ACC1", "#D81B60",
    "#7CB342", "#3949AB", "#F4511E", "#039BE5", "#00897B", "#C0CA33", "#5E35B1", "#FFB300",
    "#6D4C41", "#FF80AB", "#EA80FC", "#82B1FF", "#80D8FF", "#A7FFEB", "#CCFF90", "#FFD180",
    "#FF9E80", "#B388FF", "#78909C", "#E8D44D", "#FFFFFF", "#212121",
];

pub struct RecordStorageTarget {
    pub record_id: i32,
    pub year: i32,
    pub month: i16,
    pub part_code: String,
    pub bucket_name: String,
}

struct UploadItem {
    _temp_file: TempFile,
    temp_path: PathBuf,
    original_name: String,
    storage_name: String,
    object_key: String,
    extension: String,
}

pub async fn upload_record_file_batch(
    pool: &DbPool,
    minio: &Arc<RwLock<MinioClient>>,
    target: &RecordStorageTarget,
    file_type: &str,
    temp_files: Vec<TempFile>,
    starting_model_index: usize,
) -> Result<usize, String> {
    let mut upload_items: Vec<UploadItem> = Vec::new();
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
        let object_key = MinioClient::build_object_key(
            file_type,
            target.year,
            target.month,
            target.record_id,
            &storage_name,
        );

        upload_items.push(UploadItem {
            temp_path: temp_file.file.path().to_path_buf(),
            _temp_file: temp_file,
            original_name,
            storage_name,
            object_key,
            extension,
        });
    }

    if upload_items.is_empty() {
        return Ok(0);
    }

    let bucket = {
        let guard = minio.read().await;
        guard
            .clone_bucket(&target.part_code)
            .ok_or_else(|| format!("No bucket registered for part_code '{}'", target.part_code))?
    };

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

    let mut uploaded = 0usize;
    for (item, result) in upload_items.iter().zip(upload_results.iter()) {
        match result {
            Ok(file_size) => {
                let auto_color: Option<String> = if file_type == "model" {
                    let idx = (starting_model_index + uploaded) % MODEL_COLOR_PRESETS.len();
                    Some(MODEL_COLOR_PRESETS[idx].to_string())
                } else {
                    None
                };

                let new_file = NewFileRecord {
                    record_id: target.record_id,
                    file_type,
                    original_name: &item.original_name,
                    storage_name: &item.storage_name,
                    bucket_name: &target.bucket_name,
                    object_key: &item.object_key,
                    file_size: *file_size,
                    file_extension: &item.extension,
                    color_hex: auto_color.as_deref(),
                };

                match file_service::create_file_record(pool, &new_file) {
                    Ok(_) => {
                        uploaded += 1;
                        log::info!(
                            "File saved: record={} type={} key={}",
                            target.record_id,
                            file_type,
                            item.object_key
                        );
                    }
                    Err(e) => {
                        log::error!("DB insert file failed for '{}': {}", item.original_name, e);
                    }
                }
            }
            Err(_) => {}
        }
    }

    Ok(uploaded)
}

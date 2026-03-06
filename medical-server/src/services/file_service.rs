use diesel::prelude::*;
use uuid::Uuid;

use crate::db::DbPool;
use crate::models::{FileRecord, NewFileRecord};
use crate::schema::files;

/// 提取文件完整扩展名，支持双扩展名（如 `.nii.gz`）。
/// 返回小写扩展名字符串，无扩展名时返回空字符串。
pub fn get_full_extension(filename: &str) -> String {
    let lower = filename.to_lowercase();
    if lower.ends_with(".nii.gz") {
        return "nii.gz".to_string();
    }
    match lower.rfind('.') {
        Some(pos) => lower[pos + 1..].to_string(),
        None => String::new(),
    }
}

/// 验证文件类型与扩展名是否匹配白名单。
/// - image:      dcm, nii.gz, zip, rar
/// - model:      stl
/// - annotation: zip, nii.gz
/// - report:     pdf, docx, xlsx, md
pub fn validate_file_type(file_type: &str, extension: &str) -> bool {
    let ext = extension.to_lowercase();
    match file_type {
        "image" => matches!(ext.as_str(), "dcm" | "nii.gz" | "zip" | "rar"),
        "model" => matches!(ext.as_str(), "stl"),
        "annotation" => matches!(ext.as_str(), "zip" | "nii.gz"),
        "report" => matches!(ext.as_str(), "pdf" | "docx" | "xlsx" | "md"),
        _ => false,
    }
}

/// 生成唯一的存储文件名：`{UUID v4}.{extension}`
pub fn generate_storage_name(extension: &str) -> String {
    if extension.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        format!("{}.{}", Uuid::new_v4(), extension)
    }
}

/// 将文件元数据写入 `files` 表，返回插入后的完整记录。
pub fn create_file_record(pool: &DbPool, new_file: &NewFileRecord) -> QueryResult<FileRecord> {
    let mut conn = pool.get().expect("Failed to get db connection");
    diesel::insert_into(files::table)
        .values(new_file)
        .get_result(&mut conn)
}

/// 查询某条医学记录关联的所有文件，按 `file_type` 升序排列。
pub fn list_files_by_record(pool: &DbPool, rid: i32) -> QueryResult<Vec<FileRecord>> {
    let mut conn = pool.get().expect("Failed to get db connection");
    files::table
        .filter(files::record_id.eq(rid))
        .order(files::file_type.asc())
        .load::<FileRecord>(&mut conn)
}

/// 按主键查询单个文件记录。
pub fn get_file_by_id(pool: &DbPool, file_id: i32) -> QueryResult<FileRecord> {
    let mut conn = pool.get().expect("Failed to get db connection");
    files::table.find(file_id).get_result(&mut conn)
}

/// 从数据库删除文件记录。
pub fn delete_file_record(pool: &DbPool, file_id: i32) -> QueryResult<usize> {
    let mut conn = pool.get().expect("Failed to get db connection");
    diesel::delete(files::table.find(file_id)).execute(&mut conn)
}

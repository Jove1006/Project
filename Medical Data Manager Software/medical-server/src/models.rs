use chrono::{NaiveDate, NaiveDateTime};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::schema::{body_parts, files, hospitals, medical_records};

// ============================================================
// BodyPart — 身体部位字典表
// ============================================================

#[derive(Debug, Clone, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = body_parts)]
pub struct BodyPart {
    pub id: i32,
    pub part_code: String,
    pub part_name: String,
    pub bucket_name: String,
    pub is_active: bool,
    pub sort_order: i32,
    pub description: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = body_parts)]
pub struct NewBodyPart<'a> {
    pub part_code: &'a str,
    pub part_name: &'a str,
    pub bucket_name: &'a str,
    pub sort_order: i32,
    pub description: &'a str,
}

// ============================================================
// Hospital — 医院字典表
// ============================================================

#[derive(Debug, Clone, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = hospitals)]
pub struct Hospital {
    pub id: i32,
    pub hospital_name: String,
    pub short_name: String,
    pub is_active: bool,
    pub sort_order: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = hospitals)]
pub struct NewHospital<'a> {
    pub hospital_name: &'a str,
    pub short_name: &'a str,
}

// ============================================================
// MedicalRecord — 医学数据记录主表
// ============================================================

#[derive(Debug, Clone, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = medical_records)]
pub struct MedicalRecord {
    pub id: i32,
    pub record_no: String,
    pub year: i32,
    pub month: i16,
    pub day: i16,
    pub record_date: NaiveDate,
    pub hospital_id: i32,
    pub body_part_id: i32,
    pub description: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub short_code: String,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = medical_records)]
pub struct NewMedicalRecord<'a> {
    pub record_no: &'a str,
    pub year: i32,
    pub month: i16,
    pub day: i16,
    pub record_date: NaiveDate,
    pub hospital_id: i32,
    pub body_part_id: i32,
    pub description: &'a str,
    pub short_code: &'a str,
}

/// 编辑记录时使用的 changeset（不修改 record_no / short_code）
#[derive(Debug, AsChangeset)]
#[diesel(table_name = medical_records)]
pub struct UpdateMedicalRecord {
    pub year: i32,
    pub month: i16,
    pub day: i16,
    pub record_date: NaiveDate,
    pub hospital_id: i32,
    pub body_part_id: i32,
    pub description: String,
}

/// 列表展示用，JOIN hospitals + body_parts 后的聚合视图
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicalRecordView {
    pub id: i32,
    pub record_no: String,
    pub year: i32,
    pub month: i16,
    pub day: i16,
    pub record_date: NaiveDate,
    pub hospital_name: String, // JOIN hospitals
    pub part_name: String,     // JOIN body_parts
    pub part_code: String,     // JOIN body_parts（MinIO 桶定位用）
    pub description: String,
    pub image_count: i64,
    pub model_count: i64,
    pub annotation_count: i64,
    pub report_count: i64,
    pub created_at: NaiveDateTime,
    pub short_code: String,
}

// ============================================================
// FileRecord — 文件元数据表
// ============================================================

#[derive(Debug, Clone, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = files)]
pub struct FileRecord {
    pub id: i32,
    pub record_id: i32,
    pub file_type: String,
    pub original_name: String,
    pub storage_name: String,
    pub bucket_name: String,
    pub object_key: String,
    pub file_size: i64,
    pub file_extension: String,
    pub upload_time: NaiveDateTime,
    pub color_hex: Option<String>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = files)]
pub struct NewFileRecord<'a> {
    pub record_id: i32,
    pub file_type: &'a str,
    pub original_name: &'a str,
    pub storage_name: &'a str,
    pub bucket_name: &'a str,
    pub object_key: &'a str,
    pub file_size: i64,
    pub file_extension: &'a str,
    pub color_hex: Option<&'a str>,
}

impl FileRecord {
    /// 文件业务类型中文名
    pub fn file_type_display(&self) -> &str {
        match self.file_type.as_str() {
            "image" => "医学图像",
            "model" => "模型",
            "annotation" => "标注",
            "report" => "报告",
            _ => "未知",
        }
    }

    /// 人类可读的文件大小（B / KB / MB / GB）
    pub fn file_size_display(&self) -> String {
        const KB: i64 = 1024;
        const MB: i64 = 1024 * KB;
        const GB: i64 = 1024 * MB;

        if self.file_size < KB {
            format!("{} B", self.file_size)
        } else if self.file_size < MB {
            format!("{:.1} KB", self.file_size as f64 / KB as f64)
        } else if self.file_size < GB {
            format!("{:.1} MB", self.file_size as f64 / MB as f64)
        } else {
            format!("{:.2} GB", self.file_size as f64 / GB as f64)
        }
    }
}

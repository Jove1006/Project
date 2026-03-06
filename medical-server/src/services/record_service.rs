use std::collections::HashMap;

use diesel::dsl::count_star;
use diesel::prelude::*;

use crate::db::{get_conn, DbPool};
use crate::models::{
    BodyPart, Hospital, MedicalRecord, MedicalRecordView, NewMedicalRecord, UpdateMedicalRecord,
};
use crate::schema::{body_parts, files, hospitals, medical_records};

// ── 分页参数 ────────────────────────────────────────────────────────────────

pub struct PaginationParams {
    pub page: i64,
    pub per_page: i64,
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            page: 1,
            per_page: 20,
        }
    }
}

// ── 分页结果 ────────────────────────────────────────────────────────────────

pub struct PaginatedRecords {
    pub records: Vec<MedicalRecordView>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

pub struct RecordStorageTarget {
    pub record_id: i32,
    pub year: i32,
    pub month: i16,
    pub short_code: String,
    pub part_code: String,
    pub bucket_name: String,
}

// ── 列表查询 ────────────────────────────────────────────────────────────────

/// 查询医学记录列表（分页 + JOIN 医院/部位名称 + 文件计数）
pub fn list_records(pool: &DbPool, pagination: &PaginationParams) -> QueryResult<PaginatedRecords> {
    let mut conn = get_conn(pool);

    let page = pagination.page.max(1);
    let per_page = pagination.per_page.max(1);
    let offset = (page - 1) * per_page;

    // 1. 统计总记录数
    let total: i64 = medical_records::table.count().get_result(&mut conn)?;

    // 2. JOIN 查询当前页数据
    // 返回元组：(id, record_no, year, month, day, record_date,
    //             hospital_name, part_name, part_code, description, created_at)
    type Row = (
        i32,
        String,
        i32,
        i16,
        i16,
        chrono::NaiveDate,
        String,
        String,
        String,
        String,
        chrono::NaiveDateTime,
        String,
    );

    let rows: Vec<Row> = medical_records::table
        .inner_join(hospitals::table)
        .inner_join(body_parts::table)
        .select((
            medical_records::id,
            medical_records::record_no,
            medical_records::year,
            medical_records::month,
            medical_records::day,
            medical_records::record_date,
            hospitals::hospital_name,
            body_parts::part_name,
            body_parts::part_code,
            medical_records::description,
            medical_records::created_at,
            medical_records::short_code,
        ))
        .order_by(medical_records::id.desc())
        .limit(per_page)
        .offset(offset)
        .load(&mut conn)?;

    // 3. 批量查询当前页所有记录的关联文件计数（按类型，避免 N+1）
    let record_ids: Vec<i32> = rows.iter().map(|r| r.0).collect();

    let file_type_counts: Vec<(i32, String, i64)> = files::table
        .filter(files::record_id.eq_any(&record_ids))
        .group_by((files::record_id, files::file_type))
        .select((files::record_id, files::file_type, count_star()))
        .load(&mut conn)?;

    // record_id -> { type -> count }
    let mut type_count_map: HashMap<i32, HashMap<String, i64>> = HashMap::new();
    for (rid, ftype, cnt) in file_type_counts {
        type_count_map.entry(rid).or_default().insert(ftype, cnt);
    }

    // 4. 组装 MedicalRecordView
    let records: Vec<MedicalRecordView> = rows
        .into_iter()
        .map(|row| {
            let counts = type_count_map.get(&row.0).cloned().unwrap_or_default();
            MedicalRecordView {
                id: row.0,
                record_no: row.1,
                year: row.2,
                month: row.3,
                day: row.4,
                record_date: row.5,
                hospital_name: row.6,
                part_name: row.7,
                part_code: row.8,
                description: row.9,
                image_count: *counts.get("image").unwrap_or(&0),
                model_count: *counts.get("model").unwrap_or(&0),
                annotation_count: *counts.get("annotation").unwrap_or(&0),
                report_count: *counts.get("report").unwrap_or(&0),
                created_at: row.10,
                short_code: row.11,
            }
        })
        .collect();

    let total_pages = (total + per_page - 1) / per_page;

    Ok(PaginatedRecords {
        records,
        total,
        page,
        per_page,
        total_pages,
    })
}

// ── 字典查询辅助函数 ────────────────────────────────────────────────────────

/// 查询所有启用的医院（列表页筛选下拉用）
pub fn list_active_hospitals(pool: &DbPool) -> QueryResult<Vec<Hospital>> {
    let mut conn = get_conn(pool);
    hospitals::table
        .filter(hospitals::is_active.eq(true))
        .order_by(hospitals::sort_order.asc())
        .load::<Hospital>(&mut conn)
}

/// 查询所有启用的身体部位（列表页筛选下拉用）
pub fn list_active_body_parts(pool: &DbPool) -> QueryResult<Vec<BodyPart>> {
    let mut conn = get_conn(pool);
    body_parts::table
        .filter(body_parts::is_active.eq(true))
        .order_by(body_parts::sort_order.asc())
        .load::<BodyPart>(&mut conn)
}

pub fn get_active_body_part(pool: &DbPool, id: i32) -> QueryResult<BodyPart> {
    let mut conn = get_conn(pool);
    body_parts::table
        .filter(body_parts::id.eq(id))
        .filter(body_parts::is_active.eq(true))
        .first::<BodyPart>(&mut conn)
}

// ── 编号生成 ────────────────────────────────────────────────────────────────

/// 生成短码（8位随机字母数字）
pub fn generate_short_code() -> String {
    use uuid::Uuid;
    let s = Uuid::new_v4().to_string().replace('-', "");
    s[..8].to_string()
}

/// 生成下一个记录编号，格式：`MR-{year}-{6位序号}`
///
/// 从数据库中查询当年最大的 record_no，解析序号部分后 +1。
/// 若当年无记录则从 000001 开始。
pub fn generate_record_no(pool: &DbPool, year: i32) -> QueryResult<String> {
    let mut conn = get_conn(pool);

    // 查询该年度最大的 record_no（按字典序降序取第一条，6位补零格式字典序等价于数值序）
    let last_no: Option<String> = medical_records::table
        .filter(medical_records::year.eq(year))
        .select(medical_records::record_no)
        .order_by(medical_records::record_no.desc())
        .first::<String>(&mut conn)
        .optional()?;

    let next_seq: u64 = match last_no {
        None => 1,
        Some(no) => {
            // 期望格式：MR-{year}-xxxxxx
            let prefix = format!("MR-{}-", year);
            no.strip_prefix(&prefix)
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0)
                + 1
        }
    };

    Ok(format!("MR-{}-{:06}", year, next_seq))
}

// ── 记录写入 / 查询 ────────────────────────────────────────────────────────

/// 插入新医学记录，返回含自动生成字段（id、created_at 等）的完整行
pub fn create_record(pool: &DbPool, new_record: &NewMedicalRecord) -> QueryResult<MedicalRecord> {
    let mut conn = get_conn(pool);
    diesel::insert_into(medical_records::table)
        .values(new_record)
        .get_result(&mut conn)
}

/// 按主键查询单条记录
pub fn get_record_by_id(pool: &DbPool, id: i32) -> QueryResult<MedicalRecord> {
    let mut conn = get_conn(pool);
    medical_records::table.find(id).get_result(&mut conn)
}

/// 更新医学记录基本信息（不含文件）
pub fn update_record(
    pool: &DbPool,
    id: i32,
    changeset: UpdateMedicalRecord,
) -> QueryResult<MedicalRecord> {
    let mut conn = get_conn(pool);
    diesel::update(medical_records::table.find(id))
        .set(&changeset)
        .get_result(&mut conn)
}

/// 删除医学记录
pub fn delete_record(pool: &DbPool, id: i32) -> QueryResult<usize> {
    let mut conn = get_conn(pool);
    diesel::delete(medical_records::table.find(id)).execute(&mut conn)
}

/// 按记录编号查询记录，同时 JOIN 医院名、部位名、部位编码
/// 返回 (MedicalRecord, hospital_name, part_name, part_code)
pub fn get_record_view(
    pool: &DbPool,
    record_no: &str,
) -> QueryResult<(MedicalRecord, String, String, String)> {
    let mut conn = get_conn(pool);

    type Row = (
        i32,
        String,
        i32,
        i16,
        i16,
        chrono::NaiveDate,
        i32,
        i32,
        String,
        chrono::NaiveDateTime,
        chrono::NaiveDateTime,
        String,
        String,
        String,
        String,
    );

    let row: Row = medical_records::table
        .inner_join(hospitals::table)
        .inner_join(body_parts::table)
        .filter(medical_records::record_no.eq(record_no))
        .select((
            medical_records::id,
            medical_records::record_no,
            medical_records::year,
            medical_records::month,
            medical_records::day,
            medical_records::record_date,
            medical_records::hospital_id,
            medical_records::body_part_id,
            medical_records::description,
            medical_records::created_at,
            medical_records::updated_at,
            medical_records::short_code,
            hospitals::hospital_name,
            body_parts::part_name,
            body_parts::part_code,
        ))
        .first(&mut conn)?;

    let record = MedicalRecord {
        id: row.0,
        record_no: row.1,
        year: row.2,
        month: row.3,
        day: row.4,
        record_date: row.5,
        hospital_id: row.6,
        body_part_id: row.7,
        description: row.8,
        created_at: row.9,
        updated_at: row.10,
        short_code: row.11,
    };

    Ok((record, row.12, row.13, row.14))
}

pub fn get_record_storage_target(
    pool: &DbPool,
    record_no: &str,
) -> QueryResult<RecordStorageTarget> {
    let mut conn = get_conn(pool);

    type Row = (i32, i32, i16, String, String, String);

    let row: Row = medical_records::table
        .inner_join(body_parts::table)
        .filter(medical_records::record_no.eq(record_no))
        .select((
            medical_records::id,
            medical_records::year,
            medical_records::month,
            medical_records::short_code,
            body_parts::part_code,
            body_parts::bucket_name,
        ))
        .first(&mut conn)?;

    Ok(RecordStorageTarget {
        record_id: row.0,
        year: row.1,
        month: row.2,
        short_code: row.3,
        part_code: row.4,
        bucket_name: row.5,
    })
}

pub fn count_record_files_by_type(
    pool: &DbPool,
    record_id: i32,
    file_type: &str,
) -> QueryResult<i64> {
    let mut conn = get_conn(pool);
    files::table
        .filter(files::record_id.eq(record_id))
        .filter(files::file_type.eq(file_type))
        .count()
        .get_result(&mut conn)
}

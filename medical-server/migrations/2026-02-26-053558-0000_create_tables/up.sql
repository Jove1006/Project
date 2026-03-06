-- ============================================================
-- 触发器函数：自动更新 updated_at 字段
-- 作用：绑定此函数的表在执行 UPDATE 时，自动将 updated_at 设为当前时间
-- NOW() 返回事务开始时间，同一事务内多次调用值相同
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();   -- 将即将写入的新行的 updated_at 改为当前时间
    RETURN NEW;               -- 返回修改后的行，PostgreSQL 会将其写入磁盘
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. 身体部位字典表 (body_parts)
-- ============================================================
CREATE TABLE body_parts (
    id              SERIAL PRIMARY KEY,              -- 自增主键
    part_code       VARCHAR(50) UNIQUE NOT NULL,     -- 部位编码（英文，如 knee），全表唯一，自动建索引
    part_name       VARCHAR(100) NOT NULL,           -- 部位中文名称（如 膝关节）
    bucket_name     VARCHAR(100) UNIQUE NOT NULL,    -- 对应的 MinIO 桶名（如 medical-knee），全表唯一
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,   -- 是否启用，FALSE 表示软删除
    sort_order      INTEGER NOT NULL DEFAULT 0,      -- 前端下拉框排序顺序
    description     TEXT NOT NULL DEFAULT '',         -- 描述备注，默认空字符串避免 NULL
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),-- 创建时间，插入时自动取当前时间
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW() -- 更新时间，由触发器自动维护
);

-- 加速 WHERE is_active = TRUE 查询（part_code 和 bucket_name 的 UNIQUE 已自动建索引）
CREATE INDEX idx_body_parts_active ON body_parts(is_active);

-- 绑定触发器：UPDATE body_parts 的任意行时，自动更新该行的 updated_at
CREATE TRIGGER set_body_parts_updated_at
    BEFORE UPDATE ON body_parts      -- 在写入前拦截
    FOR EACH ROW                     -- 每行触发一次
    EXECUTE FUNCTION update_updated_at_column();

-- 初始数据：6个身体部位，每个部位对应一个 MinIO 存储桶
-- id/is_active/description/created_at/updated_at 使用默认值，无需指定
INSERT INTO body_parts (part_code, part_name, bucket_name, sort_order) VALUES
('scapula', '肩胛骨', 'medical-scapula', 1),
('elbow',   '肘关节', 'medical-elbow',   2),
('pelvis',  '骨盆',   'medical-pelvis',  3),
('knee',    '膝关节', 'medical-knee',    4),
('ankle',   '足踝',   'medical-ankle',   5),
('hand',    '手掌',   'medical-hand',    6);

-- ============================================================
-- 2. 医院字典表 (hospitals)
-- ============================================================
CREATE TABLE hospitals (
    id              SERIAL PRIMARY KEY,              -- 自增主键
    hospital_name   VARCHAR(200) UNIQUE NOT NULL,    -- 医院全名，全表唯一
    short_name      VARCHAR(100) NOT NULL DEFAULT '',-- 医院简称
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,   -- 是否启用
    sort_order      INTEGER NOT NULL DEFAULT 0,      -- 排序顺序
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),-- 创建时间
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW() -- 更新时间，触发器维护
);

-- 加速按医院名称模糊搜索
CREATE INDEX idx_hospitals_name ON hospitals(hospital_name);
-- 加速按启用状态筛选
CREATE INDEX idx_hospitals_active ON hospitals(is_active);

-- UPDATE 时自动更新 updated_at
CREATE TRIGGER set_hospitals_updated_at
    BEFORE UPDATE ON hospitals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. 医学数据记录主表 (medical_records)
-- ============================================================
CREATE TABLE medical_records (
    id              SERIAL PRIMARY KEY,              -- 自增主键
    record_no       VARCHAR(50) UNIQUE NOT NULL,     -- 业务编号，格式 MR-2026-000001，全表唯一
    year            INTEGER NOT NULL,                -- 数据采集年份，拆开存方便按年筛选
    month           SMALLINT NOT NULL                -- 数据采集月份
                    CHECK (month BETWEEN 1 AND 12),  -- CHECK 约束：只允许 1-12
    day             SMALLINT NOT NULL                -- 数据采集日
                    CHECK (day BETWEEN 1 AND 31),    -- CHECK 约束：只允许 1-31
    record_date     DATE NOT NULL,                   -- year+month+day 组合的完整日期，便于日期范围查询
    hospital_id     INTEGER NOT NULL                 -- 关联医院
                    REFERENCES hospitals(id),         -- 外键 → hospitals 表
    body_part_id    INTEGER NOT NULL                 -- 关联部位（决定文件存入哪个 MinIO 桶）
                    REFERENCES body_parts(id),        -- 外键 → body_parts 表
    description     TEXT NOT NULL DEFAULT '',         -- 描述/备注
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),-- 创建时间
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW() -- 更新时间，触发器维护
);

CREATE INDEX idx_records_date ON medical_records(record_date);       -- 加速日期范围查询
CREATE INDEX idx_records_hospital ON medical_records(hospital_id);   -- 加速按医院筛选
CREATE INDEX idx_records_body_part ON medical_records(body_part_id); -- 加速按部位筛选
CREATE INDEX idx_records_year_month ON medical_records(year, month); -- 加速按年+月组合筛选
CREATE INDEX idx_records_record_no ON medical_records(record_no);    -- 加速按编号精确查找

-- UPDATE 时自动更新 updated_at
CREATE TRIGGER set_medical_records_updated_at
    BEFORE UPDATE ON medical_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. 文件元数据表 (files)
-- ============================================================
CREATE TABLE files (
    id              SERIAL PRIMARY KEY,              -- 自增主键
    record_id       INTEGER NOT NULL                 -- 所属记录 ID
                    REFERENCES medical_records(id)    -- 外键 → medical_records
                    ON DELETE CASCADE,                -- 删除记录时自动删除其所有文件元数据
    file_type       VARCHAR(20) NOT NULL             -- 业务类型：image/model/annotation/report
                    CHECK (file_type IN ('image', 'model', 'annotation', 'report')),  -- 只允许这4种值
    original_name   VARCHAR(500) NOT NULL,           -- 用户上传时的原始文件名
    storage_name    VARCHAR(500) NOT NULL,           -- MinIO 中的存储文件名（UUID 重命名，如 a1b2c3d4.dcm）
    bucket_name     VARCHAR(100) NOT NULL,           -- MinIO 桶名（冗余存储，避免每次 JOIN body_parts）
    object_key      VARCHAR(1000) NOT NULL,          -- MinIO 对象键，格式：{类型}/{年}/{月}/{记录ID}/{文件名}
    file_size       BIGINT NOT NULL DEFAULT 0,       -- 文件大小（字节）
    file_extension  VARCHAR(20) NOT NULL DEFAULT '', -- 文件扩展名（支持双扩展名如 nii.gz）
    upload_time     TIMESTAMP NOT NULL DEFAULT NOW() -- 上传时间
);

CREATE INDEX idx_files_record_id ON files(record_id);  -- 加速查询某条记录的所有文件
CREATE INDEX idx_files_file_type ON files(file_type);  -- 加速按文件类型筛选
CREATE INDEX idx_files_bucket ON files(bucket_name);   -- 加速按桶名查询

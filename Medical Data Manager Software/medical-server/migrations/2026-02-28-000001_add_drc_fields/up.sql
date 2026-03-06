-- 为 files 表添加 DRC 转换相关字段

-- 1. format 字段：记录文件格式（stl / drc）
ALTER TABLE files ADD COLUMN format VARCHAR(20) DEFAULT 'stl';

-- 2. conversion_status 字段：记录 DRC 转换状态（pending / completed / failed）
ALTER TABLE files ADD COLUMN conversion_status VARCHAR(20) DEFAULT 'pending';

-- 3. drc_file_id 字段：如果这是 STL，转换生成的 DRC 文件ID；如果是 DRC，则为 NULL
ALTER TABLE files ADD COLUMN drc_file_id INT REFERENCES files(id) ON DELETE SET NULL;

-- 4. model_metadata 字段：JSON 格式的模型元信息（面数、顶点数、边界框等）
ALTER TABLE files ADD COLUMN model_metadata TEXT DEFAULT NULL;

-- 5. conversion_time 字段：DRC 转换完成的时间
ALTER TABLE files ADD COLUMN conversion_time TIMESTAMP DEFAULT NULL;

-- 6. conversion_error 字段：转换失败时的错误信息
ALTER TABLE files ADD COLUMN conversion_error TEXT DEFAULT NULL;

-- 为 model 类型的 STL 文件建立索引，方便查询待转换的文件
CREATE INDEX idx_files_pending_drc ON files(record_id, conversion_status) 
WHERE format = 'stl' AND conversion_status = 'pending';

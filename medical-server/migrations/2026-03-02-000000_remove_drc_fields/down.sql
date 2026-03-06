-- 回滚：恢复 DRC 相关字段

ALTER TABLE files ADD COLUMN format VARCHAR(20) DEFAULT 'stl';
ALTER TABLE files ADD COLUMN conversion_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE files ADD COLUMN drc_file_id INT REFERENCES files(id) ON DELETE SET NULL;
ALTER TABLE files ADD COLUMN model_metadata TEXT DEFAULT NULL;
ALTER TABLE files ADD COLUMN conversion_time TIMESTAMP DEFAULT NULL;
ALTER TABLE files ADD COLUMN conversion_error TEXT DEFAULT NULL;

CREATE INDEX idx_files_pending_drc ON files(record_id, conversion_status) 
WHERE format = 'stl' AND conversion_status = 'pending';

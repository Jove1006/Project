-- 为 medical_records 表添加 short_code 列（每条记录的 URL 唯一短码）
ALTER TABLE medical_records ADD COLUMN short_code VARCHAR(16);

-- 为已有记录回填随机 8 位短码（取 md5(random()) 前 8 位，重试保证唯一）
DO $$
DECLARE
    rec RECORD;
    candidate VARCHAR(16);
BEGIN
    FOR rec IN SELECT id FROM medical_records LOOP
        LOOP
            candidate := substring(md5(random()::text || rec.id::text), 1, 8);
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM medical_records WHERE short_code = candidate
            );
        END LOOP;
        UPDATE medical_records SET short_code = candidate WHERE id = rec.id;
    END LOOP;
END $$;

-- 设置非空约束和唯一索引
ALTER TABLE medical_records ALTER COLUMN short_code SET NOT NULL;
CREATE UNIQUE INDEX idx_medical_records_short_code ON medical_records(short_code);

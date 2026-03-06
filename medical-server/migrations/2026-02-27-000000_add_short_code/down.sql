DROP INDEX IF EXISTS idx_medical_records_short_code;
ALTER TABLE medical_records DROP COLUMN IF EXISTS short_code;

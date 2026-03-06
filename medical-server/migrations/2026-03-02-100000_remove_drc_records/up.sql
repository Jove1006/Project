-- 删除所有 DRC 文件记录（MinIO 中的 DRC 文件已不存在）
DELETE FROM files WHERE file_extension = 'drc';

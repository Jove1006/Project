-- 为文件表添加颜色字段，用于模型展示时的自定义渲染颜色
-- NULL 表示使用默认白色 (#FFFFFF)
ALTER TABLE files ADD COLUMN color_hex VARCHAR(7) DEFAULT NULL;

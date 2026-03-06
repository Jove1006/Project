use std::collections::HashMap;

use s3::bucket::Bucket;
use s3::bucket_ops::BucketConfiguration;
use s3::creds::Credentials;
use s3::region::Region;

use crate::config::Config;
use crate::db::DbPool;

/// MinIO 客户端，封装对象存储的所有操作。
/// 每个身体部位对应一个独立的 MinIO 桶，以 part_code 为键索引。
pub struct MinioClient {
    /// key = part_code，value = 对应 Bucket 实例
    buckets: HashMap<String, Bucket>,
    region: Region,
    credentials: Credentials,
}

impl MinioClient {
    /// 从 Config 构建 MinioClient，不发起任何网络请求
    pub fn new(config: &Config) -> Self {
        let region = Region::Custom {
            region: config.minio_region.clone(),
            endpoint: config.minio_endpoint.clone(),
        };

        let credentials = Credentials::new(
            Some(&config.minio_access_key),
            Some(&config.minio_secret_key),
            None,
            None,
            None,
        )
        .expect("Failed to create MinIO credentials");

        MinioClient {
            buckets: HashMap::new(),
            region,
            credentials,
        }
    }

    /// 从数据库加载所有活跃的身体部位，并确保对应的 MinIO 桶存在。
    /// 在服务启动阶段调用一次。
    pub async fn init_buckets_from_db(&mut self, pool: &DbPool) {
        use crate::schema::body_parts::dsl::{
            body_parts, bucket_name, is_active, part_code, sort_order,
        };
        use diesel::prelude::*;

        let mut conn = pool
            .get()
            .expect("Failed to get db connection for MinIO init");

        let active_parts: Vec<(String, String)> = body_parts
            .filter(is_active.eq(true))
            .select((part_code, bucket_name))
            .order(sort_order.asc())
            .load::<(String, String)>(&mut conn)
            .expect("Failed to load body parts from database");

        log::info!(
            "Initializing MinIO: found {} active body parts",
            active_parts.len()
        );

        for (code, bname) in active_parts {
            if let Err(e) = self.ensure_bucket_exists(&bname).await {
                panic!("MinIO init failed for bucket '{}': {}", bname, e);
            }

            let bucket = self.build_path_style_bucket(&bname);
            self.buckets.insert(code.clone(), bucket);
            log::info!("Bucket ready: '{}' (part_code={})", bname, code);
        }
    }

    /// 构建已配置 path_style 的 Bucket 实例（内部辅助）
    fn build_path_style_bucket(&self, bucket_name: &str) -> Bucket {
        Bucket::new(bucket_name, self.region.clone(), self.credentials.clone())
            .unwrap_or_else(|e| panic!("Failed to build Bucket '{}': {}", bucket_name, e))
            .with_path_style()
    }

    /// 检查桶是否存在，不存在则新建；返回 Err 表示致命错误
    async fn ensure_bucket_exists(
        &self,
        bucket_name: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let bucket = self.build_path_style_bucket(bucket_name);

        // 尝试列举（即使空桶也会返回200）；若报错则认为桶不存在
        match bucket.list("".to_string(), None).await {
            Ok(_) => {
                log::debug!("Bucket '{}' already exists", bucket_name);
                Ok(())
            }
            Err(_) => {
                log::info!("Bucket '{}' not found, creating...", bucket_name);
                let resp = Bucket::create_with_path_style(
                    bucket_name,
                    self.region.clone(),
                    self.credentials.clone(),
                    BucketConfiguration::default(),
                )
                .await?;

                // 200 = 新建成功，409 = 已存在（并发场景）
                if resp.response_code == 200 || resp.response_code == 409 {
                    log::info!(
                        "Bucket '{}' ready (HTTP {})",
                        bucket_name,
                        resp.response_code
                    );
                    Ok(())
                } else {
                    Err(format!(
                        "Unexpected HTTP {} creating bucket '{}'",
                        resp.response_code, bucket_name
                    )
                    .into())
                }
            }
        }
    }

    // ──────────────────────────────────────────────
    // 公开接口
    // ──────────────────────────────────────────────

    /// 根据 part_code 查找 Bucket 引用
    pub fn get_bucket(&self, part_code: &str) -> Option<&Bucket> {
        self.buckets.get(part_code)
    }

    /// 克隆指定 part_code 对应的 Bucket，用于并发上传（调用方可在释放锁后独立使用）
    pub fn clone_bucket(&self, part_code: &str) -> Option<Bucket> {
        self.buckets.get(part_code).cloned()
    }

    /// 运行时新增部位对应的 MinIO 桶（用于字典管理页新增部位）
    pub async fn add_bucket(&mut self, part_code: &str, bucket_name: &str) {
        if let Err(e) = self.ensure_bucket_exists(bucket_name).await {
            panic!("Failed to add bucket '{}': {}", bucket_name, e);
        }
        let bucket = self.build_path_style_bucket(bucket_name);
        self.buckets.insert(part_code.to_string(), bucket);
        log::info!(
            "Added bucket '{}' for part_code='{}'",
            bucket_name,
            part_code
        );
    }

    /// 构建 MinIO 对象键
    /// 格式：`{file_type}/{year}/{month}/{record_id}/{storage_name}`
    /// 示例：`image/2026/2/42/550e8400-e29b-41d4-a716.dcm`
    pub fn build_object_key(
        file_type: &str,
        year: i32,
        month: i16,
        record_id: i32,
        storage_name: &str,
    ) -> String {
        format!(
            "{}/{}/{}/{}/{}",
            file_type, year, month, record_id, storage_name
        )
    }

    /// 上传字节数据到指定部位的桶
    pub async fn upload_object(
        &self,
        part_code: &str,
        object_key: &str,
        data: &[u8],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let bucket = self
            .buckets
            .get(part_code)
            .ok_or_else(|| format!("No bucket registered for part_code: {}", part_code))?;

        bucket.put_object(object_key, data).await?;
        Ok(())
    }

    /// 从指定部位的桶删除对象
    pub async fn delete_object(
        &self,
        part_code: &str,
        object_key: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let bucket = self
            .buckets
            .get(part_code)
            .ok_or_else(|| format!("No bucket registered for part_code: {}", part_code))?;

        bucket.delete_object(object_key).await?;
        Ok(())
    }

    /// 生成预签名下载 URL
    /// `expires` 为有效期秒数，典型值 3600（1小时）
    pub async fn get_presigned_url(
        &self,
        part_code: &str,
        object_key: &str,
        expires: u32,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let bucket = self
            .buckets
            .get(part_code)
            .ok_or_else(|| format!("No bucket registered for part_code: {}", part_code))?;

        let url = bucket.presign_get(object_key, expires, None).await?;
        Ok(url)
    }
}

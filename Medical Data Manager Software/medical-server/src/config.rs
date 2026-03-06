pub struct Config {
    pub database_url: String,
    pub minio_endpoint: String,
    pub minio_access_key: String,
    pub minio_secret_key: String,
    pub minio_region: String,
    pub server_host: String,
    pub server_port: u16,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        Config {
            database_url: std::env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            minio_endpoint: std::env::var("MINIO_ENDPOINT").expect("MINIO_ENDPOINT must be set"),
            minio_access_key: std::env::var("MINIO_ACCESS_KEY")
                .expect("MINIO_ACCESS_KEY must be set"),
            minio_secret_key: std::env::var("MINIO_SECRET_KEY")
                .expect("MINIO_SECRET_KEY must be set"),
            minio_region: std::env::var("MINIO_REGION").unwrap_or_else(|_| "us-east-1".to_string()),
            server_host: std::env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            server_port: std::env::var("SERVER_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .expect("SERVER_PORT must be a valid u16"),
        }
    }
}

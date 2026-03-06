use diesel::pg::PgConnection;
use diesel::r2d2::{self, ConnectionManager};

pub type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;
pub type DbConn = r2d2::PooledConnection<ConnectionManager<PgConnection>>;

pub fn init_pool(database_url: &str) -> DbPool {
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    r2d2::Pool::builder()
        .max_size(10)
        .connection_timeout(std::time::Duration::from_secs(20))
        .build(manager)
        .expect("Failed to create database connection pool")
}

pub fn get_conn(pool: &DbPool) -> DbConn {
    pool.get()
        .expect("Failed to get database connection from pool")
}

use actix_web::web;

pub mod files;
pub mod records;

pub fn init(cfg: &mut web::ServiceConfig) {
    cfg.route("/", web::get().to(records::index));
    cfg.route("/records/new", web::get().to(records::new_record));
    cfg.route("/records", web::post().to(records::create_record));
    cfg.route(
        "/records/{record_no}/{short_code}/edit",
        web::get().to(records::edit_record_form),
    );
    cfg.route(
        "/records/{record_no}/{short_code}/update",
        web::post().to(records::update_record),
    );
    cfg.route(
        "/records/{record_no}/{short_code}",
        web::get().to(records::show_record),
    );

    cfg.route(
        "/records/{record_no}/files/{file_id}/delete",
        web::post().to(files::delete_file),
    );
    cfg.route(
        "/records/{record_no}/files",
        web::post().to(files::upload_files),
    );
    cfg.route(
        "/records/{record_no}/{short_code}/delete",
        web::post().to(records::delete_record),
    );

    // ── JSON API（模型展示页 Vue SPA 使用）──
    cfg.route(
        "/api/records/{record_no}/models",
        web::get().to(files::api_list_models),
    );
    cfg.route(
        "/api/records/{record_no}/models/bundle",
        web::get().to(files::api_models_bundle),
    );
    cfg.route(
        "/api/files/{file_id}/data",
        web::get().to(files::api_file_data),
    );
    cfg.route(
        "/api/files/{file_id}/color",
        web::put().to(files::api_update_color),
    );
}

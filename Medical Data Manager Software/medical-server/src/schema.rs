// @generated automatically by Diesel CLI.

diesel::table! {
    body_parts (id) {
        id -> Int4,
        #[max_length = 50]
        part_code -> Varchar,
        #[max_length = 100]
        part_name -> Varchar,
        #[max_length = 100]
        bucket_name -> Varchar,
        is_active -> Bool,
        sort_order -> Int4,
        description -> Text,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    files (id) {
        id -> Int4,
        record_id -> Int4,
        #[max_length = 20]
        file_type -> Varchar,
        #[max_length = 500]
        original_name -> Varchar,
        #[max_length = 500]
        storage_name -> Varchar,
        #[max_length = 100]
        bucket_name -> Varchar,
        #[max_length = 1000]
        object_key -> Varchar,
        file_size -> Int8,
        #[max_length = 20]
        file_extension -> Varchar,
        upload_time -> Timestamp,
        #[max_length = 7]
        color_hex -> Nullable<Varchar>,
    }
}

diesel::table! {
    hospitals (id) {
        id -> Int4,
        #[max_length = 200]
        hospital_name -> Varchar,
        #[max_length = 100]
        short_name -> Varchar,
        is_active -> Bool,
        sort_order -> Int4,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    medical_records (id) {
        id -> Int4,
        #[max_length = 50]
        record_no -> Varchar,
        year -> Int4,
        month -> Int2,
        day -> Int2,
        record_date -> Date,
        hospital_id -> Int4,
        body_part_id -> Int4,
        description -> Text,
        created_at -> Timestamp,
        updated_at -> Timestamp,
        #[max_length = 16]
        short_code -> Varchar,
    }
}

diesel::joinable!(files -> medical_records (record_id));
diesel::joinable!(medical_records -> body_parts (body_part_id));
diesel::joinable!(medical_records -> hospitals (hospital_id));

diesel::allow_tables_to_appear_in_same_query!(body_parts, files, hospitals, medical_records,);

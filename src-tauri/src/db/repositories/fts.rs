use rusqlite::Connection;

pub fn rebuild_fts_index(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
          file_id UNINDEXED,
          display_name,
          positive_prompt,
          model,
          tokenize='unicode61'
        );
        DELETE FROM files_fts;
        INSERT INTO files_fts(file_id, display_name, positive_prompt, model)
        SELECT f.id, f.display_name,
               COALESCE(m.positive_prompt, ''),
               COALESCE(m.model, '')
        FROM files f
        LEFT JOIN ai_generation_metadata m ON m.file_id = f.id
        WHERE f.is_deleted = 0 AND f.is_directory = 0;
        "#,
    )
    .map_err(|e| e.to_string())
}

pub fn upsert_fts_for_file(conn: &Connection, file_id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM files_fts WHERE file_id = ?1", [file_id])
        .map_err(|e| e.to_string())?;
    conn.execute(
        r#"
        INSERT INTO files_fts(file_id, display_name, positive_prompt, model)
        SELECT f.id, f.display_name,
               COALESCE(m.positive_prompt, ''),
               COALESCE(m.model, '')
        FROM files f
        LEFT JOIN ai_generation_metadata m ON m.file_id = f.id
        WHERE f.id = ?1 AND f.is_deleted = 0 AND f.is_directory = 0
        "#,
        [file_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

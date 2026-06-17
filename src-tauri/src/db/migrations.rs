pub const MIGRATION_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  absolute_path TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  extension TEXT,
  mime_type TEXT,
  file_kind TEXT NOT NULL,
  size_bytes INTEGER DEFAULT 0,
  width INTEGER,
  height INTEGER,
  created_at TEXT,
  modified_at TEXT,
  indexed_at TEXT,
  content_hash TEXT,
  perceptual_hash TEXT,
  is_directory INTEGER DEFAULT 0,
  is_hidden INTEGER DEFAULT 0,
  is_favorite INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  local_only INTEGER DEFAULT 1,
  remote_object_path TEXT
);

CREATE TABLE IF NOT EXISTS ai_generation_metadata (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  source_app TEXT,
  positive_prompt TEXT,
  negative_prompt TEXT,
  model TEXT,
  sampler TEXT,
  scheduler TEXT,
  seed TEXT,
  steps INTEGER,
  cfg_scale REAL,
  generation_width INTEGER,
  generation_height INTEGER,
  workflow_json TEXT,
  raw_metadata_json TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY(file_id) REFERENCES files(id)
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  kind TEXT DEFAULT 'user',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS file_tags (
  file_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY(file_id, tag_id),
  FOREIGN KEY(file_id) REFERENCES files(id),
  FOREIGN KEY(tag_id) REFERENCES tags(id)
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT DEFAULT 'manual',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS collection_files (
  collection_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY(collection_id, file_id),
  FOREIGN KEY(collection_id) REFERENCES collections(id),
  FOREIGN KEY(file_id) REFERENCES files(id)
);

CREATE TABLE IF NOT EXISTS indexed_folders (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  path TEXT NOT NULL,
  display_name TEXT,
  bookmark_data TEXT,
  recursive INTEGER DEFAULT 1,
  created_at TEXT,
  last_scanned_at TEXT
);

CREATE TABLE IF NOT EXISTS thumbnails (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  size INTEGER NOT NULL,
  local_path TEXT NOT NULL,
  created_at TEXT,
  FOREIGN KEY(file_id) REFERENCES files(id)
);

CREATE TABLE IF NOT EXISTS processed_photo_assets (
  local_identifier TEXT PRIMARY KEY,
  processed_at TEXT NOT NULL
);
"#;

const POST_MIGRATION_SQL: &str = r#"
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_metadata_file_id ON ai_generation_metadata(file_id);
CREATE INDEX IF NOT EXISTS idx_files_content_hash ON files(content_hash) WHERE content_hash IS NOT NULL AND is_deleted = 0;

CREATE TABLE IF NOT EXISTS character_suggestions (
  tag TEXT PRIMARY KEY,
  hit_count INTEGER DEFAULT 0,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS danbooru_character_tags (
  name TEXT PRIMARY KEY,
  normalized TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
"#;

fn ensure_collections_match_keywords(conn: &rusqlite::Connection) -> Result<(), String> {
    let has_column: bool = conn
        .prepare("PRAGMA table_info(collections)")
        .map_err(|e| e.to_string())?
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .any(|name| name == "match_keywords");
    if !has_column {
        conn.execute(
            "ALTER TABLE collections ADD COLUMN match_keywords TEXT",
            [],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn run_migrations(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch(MIGRATION_SQL)
        .map_err(|e| e.to_string())?;
    crate::db::repositories::metadata::dedupe_by_file_id(conn)?;
    conn.execute_batch(POST_MIGRATION_SQL)
        .map_err(|e| e.to_string())?;
    ensure_collections_match_keywords(conn)?;
    let _ = crate::db::repositories::fts::rebuild_fts_index(conn);
    Ok(())
}

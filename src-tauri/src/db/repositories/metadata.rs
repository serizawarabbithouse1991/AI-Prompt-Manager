use rusqlite::{params, Connection, Row};

use crate::db::connection::now_iso;
use crate::models::metadata::{AIGenerationMetadata, UpdateMetadataPayload};

fn row_to_metadata(row: &Row) -> Result<AIGenerationMetadata, rusqlite::Error> {
    Ok(AIGenerationMetadata {
        id: row.get("id")?,
        file_id: row.get("file_id")?,
        source_app: row.get("source_app")?,
        positive_prompt: row.get("positive_prompt")?,
        negative_prompt: row.get("negative_prompt")?,
        model: row.get("model")?,
        sampler: row.get("sampler")?,
        scheduler: row.get("scheduler")?,
        seed: row.get("seed")?,
        steps: row.get("steps")?,
        cfg_scale: row.get("cfg_scale")?,
        generation_width: row.get("generation_width")?,
        generation_height: row.get("generation_height")?,
        workflow_json: row.get("workflow_json")?,
        raw_metadata_json: row.get("raw_metadata_json")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn upsert_metadata(conn: &Connection, meta: &AIGenerationMetadata) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT INTO ai_generation_metadata (
          id, file_id, source_app, positive_prompt, negative_prompt, model, sampler, scheduler,
          seed, steps, cfg_scale, generation_width, generation_height, workflow_json,
          raw_metadata_json, created_at, updated_at
        ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)
        ON CONFLICT(id) DO UPDATE SET
          source_app=excluded.source_app,
          positive_prompt=excluded.positive_prompt,
          negative_prompt=excluded.negative_prompt,
          model=excluded.model,
          sampler=excluded.sampler,
          scheduler=excluded.scheduler,
          seed=excluded.seed,
          steps=excluded.steps,
          cfg_scale=excluded.cfg_scale,
          generation_width=excluded.generation_width,
          generation_height=excluded.generation_height,
          workflow_json=excluded.workflow_json,
          raw_metadata_json=excluded.raw_metadata_json,
          updated_at=excluded.updated_at
        "#,
        params![
            meta.id,
            meta.file_id,
            meta.source_app,
            meta.positive_prompt,
            meta.negative_prompt,
            meta.model,
            meta.sampler,
            meta.scheduler,
            meta.seed,
            meta.steps,
            meta.cfg_scale,
            meta.generation_width,
            meta.generation_height,
            meta.workflow_json,
            meta.raw_metadata_json,
            meta.created_at,
            meta.updated_at,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_by_file_id(conn: &Connection, file_id: &str) -> Result<Option<AIGenerationMetadata>, String> {
    let mut stmt = conn
        .prepare("SELECT * FROM ai_generation_metadata WHERE file_id = ?1 LIMIT 1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![file_id]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        return Ok(Some(row_to_metadata(&row).map_err(|e| e.to_string())?));
    }
    Ok(None)
}

pub fn update_metadata(
    conn: &Connection,
    file_id: &str,
    payload: &UpdateMetadataPayload,
) -> Result<(), String> {
    let existing = get_by_file_id(conn, file_id)?;
    let Some(mut meta) = existing else {
        return Err("Metadata not found".to_string());
    };
    if payload.positive_prompt.is_some() {
        meta.positive_prompt = payload.positive_prompt.clone();
    }
    if payload.negative_prompt.is_some() {
        meta.negative_prompt = payload.negative_prompt.clone();
    }
    if payload.model.is_some() {
        meta.model = payload.model.clone();
    }
    meta.updated_at = Some(now_iso());
    upsert_metadata(conn, &meta)
}

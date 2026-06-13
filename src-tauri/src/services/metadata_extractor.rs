use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use regex::Regex;
use crate::db::connection::now_iso;
use crate::models::metadata::AIGenerationMetadata;
use crate::services::hash::{metadata_id_for_file, path_to_id};

pub fn extract_from_file(path: &str, file_id: &str) -> Result<Option<AIGenerationMetadata>, String> {
    let path_obj = Path::new(path);
    let ext = path_obj
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let raw_chunks = match ext.as_str() {
        "png" => read_png_text_chunks(path)?,
        "jpg" | "jpeg" | "webp" => read_exif_metadata(path)?,
        _ => HashMap::new(),
    };

    if raw_chunks.is_empty() {
        return Ok(None);
    }

    let raw_json = serde_json::to_string(&raw_chunks).map_err(|e| e.to_string())?;
    let mut meta = AIGenerationMetadata {
        id: metadata_id_for_file(file_id),
        file_id: file_id.to_string(),
        source_app: None,
        positive_prompt: None,
        negative_prompt: None,
        model: None,
        sampler: None,
        scheduler: None,
        seed: None,
        steps: None,
        cfg_scale: None,
        generation_width: None,
        generation_height: None,
        workflow_json: None,
        raw_metadata_json: Some(raw_json),
        created_at: Some(now_iso()),
        updated_at: Some(now_iso()),
    };

    if let Some(comment) = chunk_get(&raw_chunks, "Comment") {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(comment) {
            meta.source_app = Some("NovelAI".to_string());
            meta.positive_prompt = json
                .get("prompt")
                .or_else(|| json.get("Description"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            meta.negative_prompt = json
                .get("uc")
                .or_else(|| json.get("negative_prompt"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            meta.seed = json.get("seed").map(|v| v.to_string());
            meta.steps = json.get("steps").and_then(|v| v.as_i64());
            meta.cfg_scale = json.get("scale").and_then(|v| v.as_f64());
            meta.sampler = json
                .get("sampler")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            meta.model = json
                .get("model")
                .or_else(|| json.get("source"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            return Ok(Some(meta));
        }
    }

    if let Some(params) = chunk_get(&raw_chunks, "parameters")
        .or_else(|| chunk_get(&raw_chunks, "Parameters"))
    {
        parse_a1111_parameters(&mut meta, params);
        if params.contains("Version: f2.") || params.contains("NovelAI") {
            meta.source_app = Some("NovelAI".to_string());
        } else {
            meta.source_app = Some("Stable Diffusion WebUI".to_string());
        }
        return Ok(Some(meta));
    }

    if let Some(description) = chunk_get(&raw_chunks, "Description") {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(description) {
            meta.source_app = Some("NovelAI".to_string());
            meta.positive_prompt = json
                .get("prompt")
                .or_else(|| json.get("Description"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            meta.negative_prompt = json
                .get("uc")
                .or_else(|| json.get("negative_prompt"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            return Ok(Some(meta));
        }
        if description.contains("Negative prompt:") || description.contains("Steps:") {
            parse_a1111_parameters(&mut meta, description);
            meta.source_app = Some("Stable Diffusion WebUI".to_string());
            return Ok(Some(meta));
        }
    }

    if let Some(workflow) = chunk_get(&raw_chunks, "workflow").or_else(|| chunk_get(&raw_chunks, "prompt")) {
        meta.source_app = Some("ComfyUI".to_string());
        meta.workflow_json = Some(workflow.clone());
        meta.positive_prompt = Some(truncate_prompt(workflow));
        return Ok(Some(meta));
    }

    meta.source_app = Some("unknown".to_string());
    Ok(Some(meta))
}

pub fn extract_for_path(path: &str) -> Result<Option<AIGenerationMetadata>, String> {
    let file_id = path_to_id(path);
    extract_from_file(path, &file_id)
}

fn truncate_prompt(text: &str) -> String {
    if text.len() > 500 {
        format!("{}…", &text[..500])
    } else {
        text.to_string()
    }
}

fn parse_a1111_parameters(meta: &mut AIGenerationMetadata, params: &str) {
    if let Some((prompt, rest)) = params.split_once("\nNegative prompt:") {
        meta.positive_prompt = Some(prompt.trim().to_string());
        if let Some((neg, tail)) = rest.split_once("\nSteps:") {
            meta.negative_prompt = Some(neg.trim().to_string());
            parse_a1111_tail(meta, tail);
        } else {
            meta.negative_prompt = Some(rest.trim().to_string());
        }
    } else {
        meta.positive_prompt = Some(params.trim().to_string());
    }
}

fn parse_a1111_tail(meta: &mut AIGenerationMetadata, tail: &str) {
    let steps_re = Regex::new(r"^(\d+),").ok();
    let sampler_re = Regex::new(r"Sampler:\s*([^,\n]+)").ok();
    let scheduler_re = Regex::new(r"Schedule type:\s*([^,\n]+)").ok();
    let cfg_re = Regex::new(r"CFG scale:\s*([\d.]+)").ok();
    let seed_re = Regex::new(r"Seed:\s*(\d+)").ok();
    let size_re = Regex::new(r"Size:\s*(\d+)x(\d+)").ok();
    let model_re = Regex::new(r"Model:\s*([^,\n]+)").ok();

    if let Some(re) = steps_re {
        if let Some(caps) = re.captures(tail) {
            meta.steps = caps.get(1).and_then(|m| m.as_str().parse().ok());
        }
    }
    if let Some(re) = sampler_re {
        meta.sampler = re
            .captures(tail)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().to_string());
    }
    if let Some(re) = scheduler_re {
        meta.scheduler = re
            .captures(tail)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().to_string());
    }
    if let Some(re) = cfg_re {
        meta.cfg_scale = re
            .captures(tail)
            .and_then(|c| c.get(1))
            .and_then(|m| m.as_str().parse().ok());
    }
    if let Some(re) = seed_re {
        meta.seed = re
            .captures(tail)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string());
    }
    if let Some(re) = size_re {
        if let Some(caps) = re.captures(tail) {
            meta.generation_width = caps.get(1).and_then(|m| m.as_str().parse().ok());
            meta.generation_height = caps.get(2).and_then(|m| m.as_str().parse().ok());
        }
    }
    if let Some(re) = model_re {
        meta.model = re
            .captures(tail)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().to_string());
    }
}

fn read_png_text_chunks(path: &str) -> Result<HashMap<String, String>, String> {
    let decoder = png::Decoder::new(File::open(path).map_err(|e| e.to_string())?);
    let reader = decoder.read_info().map_err(|e| e.to_string())?;
    let mut map = HashMap::new();
    for text in &reader.info().uncompressed_latin1_text {
        map.insert(text.keyword.clone(), text.text.clone());
    }
    for text in &reader.info().utf8_text {
        map.insert(text.keyword.clone(), text.get_text().unwrap_or_default().to_string());
    }
    Ok(map)
}

fn chunk_get<'a>(map: &'a HashMap<String, String>, key: &str) -> Option<&'a String> {
    if let Some(value) = map.get(key) {
        return Some(value);
    }
    map.iter()
        .find(|(candidate, _)| candidate.eq_ignore_ascii_case(key))
        .map(|(_, value)| value)
}

fn read_exif_metadata(path: &str) -> Result<HashMap<String, String>, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut bufreader = BufReader::new(file);
    let exif = exif::Reader::new()
        .read_from_container(&mut bufreader)
        .map_err(|e| e.to_string())?;
    let mut map = HashMap::new();
    if let Some(field) = exif.get_field(exif::Tag::ImageDescription, exif::In::PRIMARY) {
        let value = field.display_value().to_string();
        map.insert("ImageDescription".to_string(), value.clone());
        if value.contains("Negative prompt:") || value.contains("Steps:") {
            map.insert("parameters".to_string(), value);
        }
    }
    if let Some(field) = exif.get_field(exif::Tag::UserComment, exif::In::PRIMARY) {
        let value = field.display_value().to_string();
        map.insert("UserComment".to_string(), value.clone());
        if !map.contains_key("parameters") {
            map.insert("parameters".to_string(), value);
        }
    }
    Ok(map)
}

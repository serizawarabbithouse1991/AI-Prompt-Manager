use sha2::{Digest, Sha256};
use std::path::Path;
use uuid::{uuid, Uuid};

const FILE_NAMESPACE: Uuid = uuid!("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
const METADATA_NAMESPACE: Uuid = uuid!("7c9e6679-7425-40de-944b-e07fc1f90ae7");

pub fn path_to_id(path: &str) -> String {
    Uuid::new_v5(&FILE_NAMESPACE, path.as_bytes()).to_string()
}

pub fn metadata_id_for_file(file_id: &str) -> String {
    Uuid::new_v5(&METADATA_NAMESPACE, file_id.as_bytes()).to_string()
}

pub fn file_content_hash(path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn thumbnail_path_for_hash(app_data: &Path, size: u32, hash: &str) -> std::path::PathBuf {
    let prefix1 = &hash[0..2.min(hash.len())];
    let prefix2 = if hash.len() >= 4 {
        &hash[2..4]
    } else {
        "00"
    };
    app_data
        .join("thumbnails")
        .join(size.to_string())
        .join(prefix1)
        .join(prefix2)
        .join(format!("{hash}.webp"))
}

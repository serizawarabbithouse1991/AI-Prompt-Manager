use sha2::{Digest, Sha256};
use std::io::{Read, Write};
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
    file_content_hash_streaming(path)
}

pub fn file_content_hash_streaming(path: &Path) -> Result<String, String> {
    use std::fs::File;

    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65_536];
    loop {
        let read = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Copy a file to `dest` while computing its SHA-256 in a single pass.
pub fn copy_file_with_content_hash(src: &Path, dest: &Path) -> Result<String, String> {
    use std::fs::File;

    let mut src_file = File::open(src).map_err(|e| e.to_string())?;
    let mut dest_file = File::create(dest).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65_536];
    loop {
        let read = src_file.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        dest_file
            .write_all(&buffer[..read])
            .map_err(|e| e.to_string())?;
    }
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

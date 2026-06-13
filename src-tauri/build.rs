use std::{
  fs::{copy, create_dir_all, remove_dir_all},
  path::{Path, PathBuf},
};

fn main() {
  tauri_build::build();
  setup_ios_folder_import();
}

#[cfg(not(target_os = "macos"))]
fn setup_ios_folder_import() {}

#[cfg(target_os = "macos")]
fn setup_ios_folder_import() {
  let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
  if target_os != "ios" {
    return;
  }

  let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
  let ios_path = manifest_dir.join("ios");
  if !ios_path.join("Package.swift").exists() {
    return;
  }

  let tauri_library_path = std::env::var("DEP_TAURI_IOS_LIBRARY_PATH")
    .expect("missing DEP_TAURI_IOS_LIBRARY_PATH; ensure tauri is a dependency");
  println!("cargo:rerun-if-env-changed=DEP_TAURI_IOS_LIBRARY_PATH");

  let tauri_dep_path = manifest_dir.join(".tauri");
  create_dir_all(&tauri_dep_path).expect("failed to create .tauri directory");
  copy_tauri_api(Path::new(&tauri_library_path), &tauri_dep_path.join("tauri-api"))
    .expect("failed to copy tauri-api for folder-import plugin");

  tauri_utils::build::link_apple_library("folder-import", &ios_path);
  println!("cargo:rerun-if-changed={}", ios_path.display());
}

#[cfg(target_os = "macos")]
fn copy_tauri_api(source: &Path, target: &Path) -> std::io::Result<()> {
  if target.exists() {
    remove_dir_all(target)?;
  }
  create_dir_all(target)?;

  for entry in walkdir::WalkDir::new(source) {
    let entry = entry.map_err(|e| std::io::Error::other(e))?;
    let rel_path = entry
      .path()
      .strip_prefix(source)
      .map_err(|e| std::io::Error::other(e))?;
    let rel_path_str = rel_path.to_string_lossy();
    if rel_path_str.starts_with(".build")
      || rel_path_str.starts_with("Package.resolved")
      || rel_path_str.starts_with("Tests")
    {
      continue;
    }

    let dest_path = target.join(rel_path);
    if entry.file_type().is_dir() {
      create_dir_all(&dest_path)?;
    } else {
      if let Some(parent) = dest_path.parent() {
        create_dir_all(parent)?;
      }
      copy(entry.path(), &dest_path)?;
      println!("cargo:rerun-if-changed={}", entry.path().display());
    }
  }

  Ok(())
}

// swift-tools-version:5.3

import PackageDescription

let package = Package(
  name: "folder-import",
  platforms: [
    .iOS(.v14),
  ],
  products: [
    .library(
      name: "folder-import",
      type: .static,
      targets: ["folder-import"]
    ),
  ],
  dependencies: [
    .package(name: "Tauri", path: "../.tauri/tauri-api"),
  ],
  targets: [
    .target(
      name: "folder-import",
      dependencies: [
        .byName(name: "Tauri"),
      ],
      path: "Sources"
    ),
  ]
)

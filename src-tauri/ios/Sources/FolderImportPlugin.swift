import Photos
import PhotosUI
import SwiftRs
import Tauri
import UIKit
import UniformTypeIdentifiers

@available(iOS 14.0, *)
private class ImportPickerDelegate: NSObject, UIDocumentPickerDelegate {
  private let invoke: Invoke
  private let multiple: Bool

  init(invoke: Invoke, multiple: Bool) {
    self.invoke = invoke
    self.multiple = multiple
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard !urls.isEmpty else {
      resolveEmpty()
      return
    }

    var stagedPaths: [String] = []
    for url in urls {
      let didAccess = url.startAccessingSecurityScopedResource()
      defer {
        if didAccess {
          url.stopAccessingSecurityScopedResource()
        }
      }

      do {
        stagedPaths.append(try FolderImportPlugin.stageItemForImport(from: url))
      } catch {
        invoke.reject("Failed to stage item: \(error.localizedDescription)")
        return
      }
    }

    if multiple {
      invoke.resolve(["paths": stagedPaths])
    } else {
      invoke.resolve(["path": stagedPaths.first ?? NSNull()])
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    resolveEmpty()
  }

  private func resolveEmpty() {
    if multiple {
      invoke.resolve(["paths": NSNull()])
    } else {
      invoke.resolve(["path": NSNull()])
    }
  }
}

@available(iOS 14.0, *)
private class PhotoImportPickerDelegate: NSObject, PHPickerViewControllerDelegate {
  private let invoke: Invoke

  init(invoke: Invoke) {
    self.invoke = invoke
  }

  func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    picker.dismiss(animated: true)

    guard !results.isEmpty else {
      invoke.resolve(["paths": NSNull()])
      return
    }

    let stagingRoot = FileManager.default.temporaryDirectory.appendingPathComponent(
      "photo-import-\(UUID().uuidString)",
      isDirectory: true
    )

    do {
      try FileManager.default.createDirectory(at: stagingRoot, withIntermediateDirectories: true)
    } catch {
      invoke.reject("Failed to create staging directory: \(error.localizedDescription)")
      return
    }

    let group = DispatchGroup()
    var paths: [String] = []
    var exportError: String?

    for (index, result) in results.enumerated() {
      group.enter()
      exportPhotoResult(result, to: stagingRoot, index: index) { path, error in
        defer { group.leave() }
        if let error = error {
          exportError = error
          return
        }
        if let path = path {
          paths.append(path)
        }
      }
    }

    group.notify(queue: .main) { [invoke] in
      if let exportError = exportError {
        invoke.reject(exportError)
        return
      }
      invoke.resolve(["paths": paths])
    }
  }

  private func exportPhotoResult(
    _ result: PHPickerResult,
    to stagingRoot: URL,
    index: Int,
    completion: @escaping (String?, String?) -> Void
  ) {
    if #available(iOS 15.0, *), let assetId = result.assetIdentifier {
      let assets = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil)
      if let asset = assets.firstObject {
        exportOriginalAsset(asset, to: stagingRoot, index: index, completion: completion)
        return
      }
    }
    exportFromItemProvider(result.itemProvider, to: stagingRoot, index: index, completion: completion)
  }

  private func exportOriginalAsset(
    _ asset: PHAsset,
    to stagingRoot: URL,
    index: Int,
    completion: @escaping (String?, String?) -> Void
  ) {
    let resources = PHAssetResource.assetResources(for: asset)
    let resource =
      resources.first(where: { $0.type == .photo || $0.type == .fullSizePhoto || $0.type == .alternatePhoto })
      ?? resources.first

    guard let resource = resource else {
      completion(nil, "No photo resource found")
      return
    }

    let originalName = resource.originalFilename
    let filename: String
    if originalName.isEmpty {
      filename = "photo_\(index).png"
    } else {
      filename = originalName
    }

    let dest = uniqueDestination(in: stagingRoot, filename: filename)
    if FileManager.default.fileExists(atPath: dest.path) {
      try? FileManager.default.removeItem(at: dest)
    }

    let options = PHAssetResourceRequestOptions()
    options.isNetworkAccessAllowed = true

    PHAssetResourceManager.default().writeData(for: resource, toFile: dest, options: options) { error in
      if let error = error {
        completion(nil, error.localizedDescription)
      } else {
        completion(dest.path, nil)
      }
    }
  }

  private func exportFromItemProvider(
    _ provider: NSItemProvider,
    to stagingRoot: URL,
    index: Int,
    completion: @escaping (String?, String?) -> Void
  ) {
    provider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { [self] data, error in
      if let error = error {
        completion(nil, error.localizedDescription)
        return
      }
      guard let data = data else {
        completion(nil, "Empty image data")
        return
      }

      let suggested = provider.suggestedName ?? "photo_\(index)"
      let filename = suggested.contains(".") ? suggested : "\(suggested).png"
      let dest = self.uniqueDestination(in: stagingRoot, filename: filename)

      do {
        try data.write(to: dest)
        completion(dest.path, nil)
      } catch {
        completion(nil, error.localizedDescription)
      }
    }
  }

  private func uniqueDestination(in directory: URL, filename: String) -> URL {
    let base = (filename as NSString).deletingPathExtension
    let ext = (filename as NSString).pathExtension
    var candidate = directory.appendingPathComponent(filename)
    var counter = 1
    while FileManager.default.fileExists(atPath: candidate.path) {
      let nextName = ext.isEmpty ? "\(base)_\(counter)" : "\(base)_\(counter).\(ext)"
      candidate = directory.appendingPathComponent(nextName)
      counter += 1
    }
    return candidate
  }
}

@available(iOS 14.0, *)
class FolderImportPlugin: Plugin {
  private var pickerDelegate: ImportPickerDelegate?
  private var photoPickerDelegate: PhotoImportPickerDelegate?

  override init() {
    super.init()
  }

  private struct ShareFileArgs: Decodable {
    let path: String
  }

  private static let importContentTypes: [UTType] = [
    .folder,
    .image,
    .png,
    .jpeg,
    .gif,
    .webP,
    .zip,
  ]

  @objc public func pickFolder(_ invoke: Invoke) {
    presentImportPicker(invoke: invoke, allowsMultipleSelection: false)
  }

  @objc public func pickItems(_ invoke: Invoke) {
    presentImportPicker(invoke: invoke, allowsMultipleSelection: true)
  }

  @objc public func pickPhotos(_ invoke: Invoke) {
    DispatchQueue.main.async {
      guard let presenter = self.manager.viewController else {
        invoke.reject("View controller unavailable")
        return
      }

      var configuration = PHPickerConfiguration(photoLibrary: .shared())
      configuration.filter = .images
      configuration.selectionLimit = 0

      let picker = PHPickerViewController(configuration: configuration)
      let delegate = PhotoImportPickerDelegate(invoke: invoke)
      self.photoPickerDelegate = delegate
      picker.delegate = delegate
      picker.modalPresentationStyle = .fullScreen
      presenter.present(picker, animated: true)
    }
  }

  @objc public func shareFile(_ invoke: Invoke) throws {
    guard let args = invoke.parseArgs(ShareFileArgs.self) else { return }
    let url = URL(fileURLWithPath: args.path)
    guard FileManager.default.fileExists(atPath: url.path) else {
      invoke.reject("File not found")
      return
    }

    DispatchQueue.main.async {
      guard let presenter = self.manager.viewController else {
        invoke.reject("View controller unavailable")
        return
      }

      let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
      if let popover = activity.popoverPresentationController {
        popover.sourceView = presenter.view
        popover.sourceRect = CGRect(
          x: presenter.view.bounds.midX,
          y: presenter.view.bounds.midY,
          width: 0,
          height: 0
        )
      }
      presenter.present(activity, animated: true)
      invoke.resolve()
    }
  }

  private func presentImportPicker(invoke: Invoke, allowsMultipleSelection: Bool) {
    DispatchQueue.main.async {
      guard let presenter = self.manager.viewController else {
        invoke.reject("View controller unavailable")
        return
      }

      let picker = UIDocumentPickerViewController(
        forOpeningContentTypes: Self.importContentTypes,
        asCopy: false
      )
      picker.allowsMultipleSelection = allowsMultipleSelection
      let delegate = ImportPickerDelegate(invoke: invoke, multiple: allowsMultipleSelection)
      self.pickerDelegate = delegate
      picker.delegate = delegate
      picker.modalPresentationStyle = .fullScreen
      presenter.present(picker, animated: true)
    }
  }

  static func stageItemForImport(from source: URL) throws -> String {
    let fileManager = FileManager.default
    let stagingRoot = fileManager.temporaryDirectory.appendingPathComponent(
      "folder-import-\(UUID().uuidString)",
      isDirectory: true
    )
    try fileManager.createDirectory(at: stagingRoot, withIntermediateDirectories: true)

    var isDirectory: ObjCBool = false
    guard fileManager.fileExists(atPath: source.path, isDirectory: &isDirectory) else {
      throw NSError(
        domain: "FolderImportPlugin",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Selected item does not exist"]
      )
    }

    let destination = stagingRoot.appendingPathComponent(
      source.lastPathComponent,
      isDirectory: isDirectory.boolValue
    )
    try fileManager.copyItem(at: source, to: destination)
    return destination.path
  }
}

@available(iOS 14.0, *)
@_cdecl("init_plugin_folder_import")
func initPluginFolderImport() -> Plugin {
  return FolderImportPlugin()
}

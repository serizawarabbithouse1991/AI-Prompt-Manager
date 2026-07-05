import Photos
import PhotosUI
import SwiftRs
import Tauri
import UIKit
import UniformTypeIdentifiers

private let photoLibraryExportConcurrency = 6

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
    let pathsLock = NSLock()
    let semaphore = DispatchSemaphore(value: photoLibraryExportConcurrency)

    for (index, result) in results.enumerated() {
      group.enter()
      DispatchQueue.global(qos: .utility).async {
        semaphore.wait()
        defer {
          semaphore.signal()
          group.leave()
        }

        let exportGroup = DispatchGroup()
        var path: String?
        var errorMessage: String?

        exportGroup.enter()
        self.exportPhotoResult(result, to: stagingRoot, index: index) { exportedPath, error in
          path = exportedPath
          errorMessage = error
          exportGroup.leave()
        }
        exportGroup.wait()

        if let errorMessage = errorMessage {
          pathsLock.lock()
          if exportError == nil {
            exportError = errorMessage
          }
          pathsLock.unlock()
          return
        }
        if let path = path {
          pathsLock.lock()
          paths.append(path)
          pathsLock.unlock()
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
        PhotoAssetExporter.exportOriginalAsset(asset, to: stagingRoot, index: index, completion: completion)
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
    PhotoAssetExporter.exportOriginalAsset(asset, to: stagingRoot, index: index, completion: completion)
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
    PhotoAssetExporter.uniqueDestination(in: directory, filename: filename)
  }
}

@available(iOS 14.0, *)
private enum PhotoAssetExporter {
  static func exportOriginalAsset(
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

  static func uniqueDestination(in directory: URL, filename: String) -> URL {
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

  static func isPngAsset(_ asset: PHAsset) -> Bool {
    let resources = PHAssetResource.assetResources(for: asset)
    let resource =
      resources.first(where: { $0.type == .photo || $0.type == .fullSizePhoto || $0.type == .alternatePhoto })
      ?? resources.first
    guard let resource = resource else { return false }
    let name = resource.originalFilename.lowercased()
    if name.hasSuffix(".png") { return true }
    return resource.uniformTypeIdentifier == UTType.png.identifier
  }

  static func probeNovelAiPng(_ asset: PHAsset) -> Bool {
    let resources = PHAssetResource.assetResources(for: asset)
    let resource =
      resources.first(where: { $0.type == .photo || $0.type == .fullSizePhoto || $0.type == .alternatePhoto })
      ?? resources.first
    guard let resource = resource else { return false }

    let semaphore = DispatchSemaphore(value: 0)
    var collected = Data()
    var matched = false
    var finished = false
    let options = PHAssetResourceRequestOptions()
    options.isNetworkAccessAllowed = true

    PHAssetResourceManager.default().requestData(for: resource, options: options) { chunk in
      if finished { return }
      collected.append(chunk)
      if collected.count >= 65536 {
        finished = true
        if collected.range(of: Data("NovelAI".utf8)) != nil {
          matched = true
        } else if let text = String(data: collected.prefix(65536), encoding: .utf8) {
          matched = text.contains("NovelAI") || text.contains("\"Description\"")
        }
        semaphore.signal()
      }
    } completionHandler: { error in
      if finished { return }
      finished = true
      if error == nil {
        if collected.range(of: Data("NovelAI".utf8)) != nil {
          matched = true
        } else if let text = String(data: collected, encoding: .utf8) {
          matched = text.contains("NovelAI") || text.contains("\"Description\"")
        }
      }
      semaphore.signal()
    }

    semaphore.wait()
    return matched
  }
}

@available(iOS 14.0, *)
private struct PhotoLibraryScanSession {
  let stagingRoot: URL
  let assetList: [PHAsset]
  let pngOnly: Bool
  let novelaiProbe: Bool

  var total: Int { assetList.count }
}

@available(iOS 14.0, *)
class FolderImportPlugin: Plugin {
  private var pickerDelegate: ImportPickerDelegate?
  private var photoPickerDelegate: PhotoImportPickerDelegate?
  private static var photoLibraryExportCancelled = false
  private static let photoExportConcurrency = photoLibraryExportConcurrency
  private static var photoLibraryScanSessions: [String: PhotoLibraryScanSession] = [:]
  private static let photoLibraryScanSessionsLock = NSLock()

  override init() {
    super.init()
  }

  private struct ShareFileArgs: Decodable {
    let path: String
  }

  private struct ExportBatchArgs: Decodable {
    let sessionId: String
    let offset: Int
    let limit: Int
  }

  private struct SessionIdArgs: Decodable {
    let sessionId: String
    let cleanup: Bool?
  }

  private struct BeginPhotoLibraryScanArgs: Decodable {
    let excludeLocalIdentifiers: [String]?
    let pngOnly: Bool?
    let novelaiProbe: Bool?
    let sinceDate: String?
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

  @objc public func cancelPhotoLibraryExport(_ invoke: Invoke) {
    FolderImportPlugin.photoLibraryExportCancelled = true
    Self.cleanupPhotoLibraryScanSessions(removeFiles: true)
    invoke.resolve()
  }

  @objc public func beginPhotoLibraryScan(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(BeginPhotoLibraryScanArgs.self)
    FolderImportPlugin.photoLibraryExportCancelled = false
    requestPhotoLibraryAccess { status in
      guard status == .authorized || status == .limited else {
        invoke.reject("Photo library access denied")
        return
      }

      let fetchOptions = PHFetchOptions()
      fetchOptions.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
      if let sinceDateStr = args.sinceDate {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let sinceDate =
          formatter.date(from: sinceDateStr)
          ?? ISO8601DateFormatter().date(from: sinceDateStr)
        if let sinceDate = sinceDate {
          fetchOptions.predicate = NSPredicate(format: "creationDate >= %@", sinceDate as NSDate)
        }
      }
      let assets = PHAsset.fetchAssets(with: .image, options: fetchOptions)
      let excludeSet = Set(args.excludeLocalIdentifiers ?? [])
      let pngOnly = args.pngOnly ?? false
      let novelaiProbe = args.novelaiProbe ?? pngOnly
      var assetList: [PHAsset] = []
      assetList.reserveCapacity(assets.count)

      assets.enumerateObjects { asset, _, _ in
        if excludeSet.contains(asset.localIdentifier) {
          return
        }
        if pngOnly && !PhotoAssetExporter.isPngAsset(asset) {
          return
        }
        assetList.append(asset)
      }

      let totalCount = assetList.count

      if totalCount == 0 {
        invoke.resolve(["sessionId": NSNull(), "total": 0])
        return
      }

      let stagingRoot = FileManager.default.temporaryDirectory.appendingPathComponent(
        "photo-library-scan-\(UUID().uuidString)",
        isDirectory: true
      )

      do {
        try FileManager.default.createDirectory(at: stagingRoot, withIntermediateDirectories: true)
      } catch {
        invoke.reject("Failed to create staging directory: \(error.localizedDescription)")
        return
      }

      let sessionId = UUID().uuidString
      let session = PhotoLibraryScanSession(
        stagingRoot: stagingRoot,
        assetList: assetList,
        pngOnly: pngOnly,
        novelaiProbe: novelaiProbe
      )

      Self.photoLibraryScanSessionsLock.lock()
      Self.photoLibraryScanSessions[sessionId] = session
      Self.photoLibraryScanSessionsLock.unlock()

      invoke.resolve(["sessionId": sessionId, "total": totalCount])
    }
  }

  @objc public func exportPhotoLibraryBatch(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(ExportBatchArgs.self)

    DispatchQueue.global(qos: .utility).async {
      if FolderImportPlugin.photoLibraryExportCancelled {
        invoke.resolve(["items": []])
        return
      }

      Self.photoLibraryScanSessionsLock.lock()
      let session = Self.photoLibraryScanSessions[args.sessionId]
      Self.photoLibraryScanSessionsLock.unlock()

      guard let session = session else {
        invoke.reject("Photo library scan session not found")
        return
      }

      let start = max(0, args.offset)
      let end = min(start + max(1, args.limit), session.total)
      guard start < end else {
        invoke.resolve(["items": []])
        return
      }

      var exportedItems: [[String: String]] = []
      exportedItems.reserveCapacity(end - start)
      let pathsLock = NSLock()
      let group = DispatchGroup()
      let semaphore = DispatchSemaphore(value: Self.photoExportConcurrency)
      var exportError: String?

      for index in start..<end {
        if FolderImportPlugin.photoLibraryExportCancelled {
          break
        }

        let asset = session.assetList[index]
        group.enter()
        semaphore.wait()

        DispatchQueue.global(qos: .utility).async {
          defer {
            semaphore.signal()
            group.leave()
          }

          if FolderImportPlugin.photoLibraryExportCancelled {
            return
          }

          if session.novelaiProbe && !PhotoAssetExporter.probeNovelAiPng(asset) {
            pathsLock.lock()
            exportedItems.append([
              "path": "",
              "assetId": asset.localIdentifier,
            ])
            pathsLock.unlock()
            return
          }

          let waitGroup = DispatchGroup()
          var path: String?
          var errorMessage: String?

          waitGroup.enter()
          PhotoAssetExporter.exportOriginalAsset(asset, to: session.stagingRoot, index: index) { exportedPath, error in
            path = exportedPath
            errorMessage = error
            waitGroup.leave()
          }
          waitGroup.wait()

          if let errorMessage = errorMessage {
            pathsLock.lock()
            if exportError == nil {
              exportError = errorMessage
            }
            pathsLock.unlock()
            return
          }

          if let path = path {
            pathsLock.lock()
            exportedItems.append([
              "path": path,
              "assetId": asset.localIdentifier,
            ])
            pathsLock.unlock()
          }
        }
      }

      group.notify(queue: .main) {
        if let exportError = exportError {
          invoke.reject(exportError)
          return
        }
        invoke.resolve(["items": exportedItems])
      }
    }
  }

  @objc public func endPhotoLibraryScan(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SessionIdArgs.self)
    let cleanup = args.cleanup ?? true
    Self.removePhotoLibraryScanSession(args.sessionId, removeFiles: cleanup)
    invoke.resolve()
  }

  private func requestPhotoLibraryAccess(completion: @escaping (PHAuthorizationStatus) -> Void) {
    if #available(iOS 14.0, *) {
      PHPhotoLibrary.requestAuthorization(for: .readWrite, handler: completion)
    } else {
      PHPhotoLibrary.requestAuthorization(completion)
    }
  }

  private static func removePhotoLibraryScanSession(_ sessionId: String, removeFiles: Bool) {
    photoLibraryScanSessionsLock.lock()
    let session = photoLibraryScanSessions.removeValue(forKey: sessionId)
    photoLibraryScanSessionsLock.unlock()

    guard removeFiles, let session = session else {
      return
    }

    try? FileManager.default.removeItem(at: session.stagingRoot)
  }

  private static func cleanupPhotoLibraryScanSessions(removeFiles: Bool) {
    photoLibraryScanSessionsLock.lock()
    let sessions = photoLibraryScanSessions
    photoLibraryScanSessions.removeAll()
    photoLibraryScanSessionsLock.unlock()

    guard removeFiles else {
      return
    }

    for session in sessions.values {
      try? FileManager.default.removeItem(at: session.stagingRoot)
    }
  }

  @objc public func scanNovelAiPhotos(_ invoke: Invoke) {
    FolderImportPlugin.photoLibraryExportCancelled = false

    let requestAuthorization: (@escaping (PHAuthorizationStatus) -> Void) -> Void = { handler in
      if #available(iOS 14.0, *) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite, handler: handler)
      } else {
        PHPhotoLibrary.requestAuthorization(handler)
      }
    }

    requestAuthorization { status in
      guard status == .authorized || status == .limited else {
        invoke.reject("Photo library access denied")
        return
      }
      self.exportAllPhotoLibraryAssets(invoke: invoke)
    }
  }

  private func exportAllPhotoLibraryAssets(invoke: Invoke) {
    let fetchOptions = PHFetchOptions()
    fetchOptions.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
    let assets = PHAsset.fetchAssets(with: .image, options: fetchOptions)
    let totalCount = assets.count

    if totalCount == 0 {
      invoke.resolve(["paths": []])
      return
    }

    let stagingRoot = FileManager.default.temporaryDirectory.appendingPathComponent(
      "photo-library-scan-\(UUID().uuidString)",
      isDirectory: true
    )

    do {
      try FileManager.default.createDirectory(at: stagingRoot, withIntermediateDirectories: true)
    } catch {
      invoke.reject("Failed to create staging directory: \(error.localizedDescription)")
      return
    }

    var exportedPaths: [String] = []
    exportedPaths.reserveCapacity(totalCount)
    let pathsLock = NSLock()
    let group = DispatchGroup()
    let semaphore = DispatchSemaphore(value: Self.photoExportConcurrency)
    var exportError: String?

    for index in 0..<totalCount {
      if FolderImportPlugin.photoLibraryExportCancelled {
        break
      }

      let asset = assets.object(at: index)
      group.enter()
      semaphore.wait()

      DispatchQueue.global(qos: .utility).async {
        defer {
          semaphore.signal()
          group.leave()
        }

        if FolderImportPlugin.photoLibraryExportCancelled {
          return
        }

        let semaphoreGroup = DispatchGroup()
        var path: String?
        var errorMessage: String?

        semaphoreGroup.enter()
        PhotoAssetExporter.exportOriginalAsset(asset, to: stagingRoot, index: index) { exportedPath, error in
          path = exportedPath
          errorMessage = error
          semaphoreGroup.leave()
        }
        semaphoreGroup.wait()

        if let errorMessage = errorMessage {
          pathsLock.lock()
          if exportError == nil {
            exportError = errorMessage
          }
          pathsLock.unlock()
          return
        }

        if let path = path {
          pathsLock.lock()
          exportedPaths.append(path)
          pathsLock.unlock()
        }
      }
    }

    group.notify(queue: .main) {
      if let exportError = exportError {
        invoke.reject(exportError)
        return
      }
      if FolderImportPlugin.photoLibraryExportCancelled {
        for path in exportedPaths {
          try? FileManager.default.removeItem(atPath: path)
        }
        try? FileManager.default.removeItem(at: stagingRoot)
        invoke.resolve(["paths": []])
        return
      }
      invoke.resolve(["paths": exportedPaths])
    }
  }

  @objc public func shareFile(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(ShareFileArgs.self)
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

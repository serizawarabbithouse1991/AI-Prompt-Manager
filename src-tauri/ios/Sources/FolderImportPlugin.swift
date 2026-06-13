import SwiftRs
import Tauri
import UIKit
import UniformTypeIdentifiers

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
class FolderImportPlugin: Plugin {
  private var pickerDelegate: ImportPickerDelegate?

  override init() {
    super.init()
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

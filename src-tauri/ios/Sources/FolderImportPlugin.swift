import SwiftRs
import Tauri
import UIKit
import UniformTypeIdentifiers

private class FolderPickerDelegate: NSObject, UIDocumentPickerDelegate {
  private let invoke: Invoke

  init(invoke: Invoke) {
    self.invoke = invoke
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let source = urls.first else {
      invoke.resolve(["path": NSNull()])
      return
    }

    let didAccess = source.startAccessingSecurityScopedResource()
    defer {
      if didAccess {
        source.stopAccessingSecurityScopedResource()
      }
    }

    do {
      let stagedPath = try FolderImportPlugin.stageFolderForImport(from: source)
      invoke.resolve(["path": stagedPath])
    } catch {
      invoke.reject("Failed to stage folder: \(error.localizedDescription)")
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    invoke.resolve(["path": NSNull()])
  }
}

@available(iOS 14.0, *)
class FolderImportPlugin: Plugin {
  private var pickerDelegate: FolderPickerDelegate?

  override init() {
    super.init()
  }

  @objc public func pickFolder(_ invoke: Invoke) {
    DispatchQueue.main.async {
      guard let presenter = self.manager.viewController else {
        invoke.reject("View controller unavailable")
        return
      }

      let picker = UIDocumentPickerViewController(
        forOpeningContentTypes: [UTType.folder],
        asCopy: false
      )
      picker.allowsMultipleSelection = false
      let delegate = FolderPickerDelegate(invoke: invoke)
      self.pickerDelegate = delegate
      picker.delegate = delegate
      picker.modalPresentationStyle = .fullScreen
      presenter.present(picker, animated: true)
    }
  }

  static func stageFolderForImport(from source: URL) throws -> String {
    let fileManager = FileManager.default
    let stagingRoot = fileManager.temporaryDirectory.appendingPathComponent(
      "folder-import-\(UUID().uuidString)",
      isDirectory: true
    )
    try fileManager.createDirectory(at: stagingRoot, withIntermediateDirectories: true)

    var isDirectory: ObjCBool = false
    guard fileManager.fileExists(atPath: source.path, isDirectory: &isDirectory), isDirectory.boolValue else {
      throw NSError(
        domain: "FolderImportPlugin",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Selected item is not a folder"]
      )
    }

    let destination = stagingRoot.appendingPathComponent(source.lastPathComponent, isDirectory: true)
    try fileManager.copyItem(at: source, to: destination)
    return destination.path
  }
}

@available(iOS 14.0, *)
@_cdecl("init_plugin_folder_import")
func initPluginFolderImport() -> Plugin {
  return FolderImportPlugin()
}

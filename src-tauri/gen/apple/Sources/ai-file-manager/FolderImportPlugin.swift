import Tauri
import UIKit
import UniformTypeIdentifiers

private class FolderPickerDelegate: NSObject, UIDocumentPickerDelegate {
  private let invoke: Invoke

  init(invoke: Invoke) {
    self.invoke = invoke
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first else {
      invoke.resolve(["path": NSNull()])
      return
    }

    let didAccess = url.startAccessingSecurityScopedResource()
    defer {
      if didAccess {
        url.stopAccessingSecurityScopedResource()
      }
    }

    invoke.resolve(["path": url.path])
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    invoke.resolve(["path": NSNull()])
  }
}

class FolderImportPlugin: Plugin {
  private var pickerDelegate: FolderPickerDelegate?

  @objc public func pickFolder(_ invoke: Invoke) throws {
    DispatchQueue.main.async {
      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.folder], asCopy: true)
      picker.allowsMultipleSelection = false
      let delegate = FolderPickerDelegate(invoke: invoke)
      self.pickerDelegate = delegate
      picker.delegate = delegate
      picker.modalPresentationStyle = .formSheet
      self.manager.viewController?.present(picker, animated: true)
    }
  }
}

@_cdecl("init_plugin_folder_import")
func initPluginFolderImport() -> Plugin {
  return FolderImportPlugin()
}

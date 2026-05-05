import AppKit
import ApplicationServices
import Combine
import CryptoKit
import Darwin
import Foundation
import Network
import PDFKit
import SwiftUI
import UniformTypeIdentifiers
import WebKit

extension IDEWorkspace {

    var collapsedTools: some View {
        VStack(spacing: 10) {
            IDEToolIconButton(icon: "square.and.arrow.down", label: "Save") {
                model.saveCurrent()
            }
            IDEToolIconButton(icon: "wand.and.stars", label: "Format") {
                model.formatCurrent()
                model.autosaveCurrent()
            }
            IDEToolIconButton(icon: "terminal", label: "Terminal") {
                model.showTerminal.toggle()
                toolsExpanded = true
                model.persistWorkspaceState()
            }
            IDEToolIconButton(icon: "safari", label: "Preview") {
                if let file = model.selectedFile {
                    model.preview(file, settings: appModel.settings)
                }
                model.showPreview.toggle()
                toolsExpanded = true
                model.persistWorkspaceState()
            }
            IDEToolIconButton(icon: "exclamationmark.triangle", label: "Problems") {
                model.scanProblemMarkers()
                toolsExpanded = true
            }
            IDEToolIconButton(icon: "play.fill", label: "Run") {
                if let command = model.currentFileRunCommands.first {
                    model.terminal.run(command.command)
                    model.showTerminal = true
                    toolsExpanded = true
                }
            }
            Spacer()
        }
        .padding(.top, 10)
    }
}

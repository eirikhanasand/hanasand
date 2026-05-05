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

struct IDELaunchpadWorkspace: View {
    @EnvironmentObject var model: DesktopAgentModel

    var body: some View {
        FeatureWorkspace(title: "IDE", subtitle: "Code and files.") {
            HStack(spacing: 12) {
                FeatureCard(title: "Workspace", value: model.status.cwd, icon: "folder")
                FeatureCard(title: "Agent", value: model.status.ok ? "Online" : "Offline", icon: "terminal")
            }
            ActionGrid(actions: [
                .route("AI Workspace", "Models, repositories, conversations, and previews.", "sparkles", "/dashboard/system/ai"),
                .route("Shares", "Shares and hosted files.", "folder.badge.gearshape", "/s"),
                .route("Links", "Create and inspect /g shortcut links.", "link", "/g"),
                .route("Load Tests", "Recent public load-test runs.", "speedometer", "/dashboard/tests"),
                .task("Reveal working directory", "Open the active local folder in Finder.", "folder") { model in
                    NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: model.status.cwd)])
                },
            ])
        }
    }
}

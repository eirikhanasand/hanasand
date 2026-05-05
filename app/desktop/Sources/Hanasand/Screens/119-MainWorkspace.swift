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

struct MainWorkspace: View {
    @EnvironmentObject var model: DesktopAgentModel
    @Environment(\.desktopTheme) var theme
    let commandFocused: FocusState<Bool>.Binding

    var body: some View {
        switch model.selectedSection {
        case .command:
            VStack(spacing: 0) {
                TopBar()
                Transcript()
                ChangedFilesDock()
                CommandDock(commandFocused: commandFocused)
            }
            .background(theme.background)
            .task { await model.loadAIPage() }
        case .control:
            ControlPlaneWorkspace(commandFocused: commandFocused)
        case .dashboard:
            DashboardWorkspace()
        case .browser:
            BrowserWorkspace()
        case .ide:
            IDEWorkspace()
        case .mac:
            MacWorkspace()
        case .mail:
            MailWorkspace()
        case .documents:
            DocumentWorkspace()
        case .images:
            ImageReviewWorkspace()
        case .ai:
            VStack(spacing: 0) {
                TopBar()
                Transcript()
                ChangedFilesDock()
                CommandDock(commandFocused: commandFocused)
            }
            .background(theme.background)
            .task {
                model.selectedSection = .command
                await model.loadAIPage()
            }
        case .server:
            ServerWorkspace()
        case .updates:
            UpdatesWorkspace()
        case .settings:
            SettingsWorkspace()
        }
    }
}

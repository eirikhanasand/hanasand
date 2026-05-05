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

struct TopBar: View {
    @EnvironmentObject var model: DesktopAgentModel
    @Environment(\.desktopTheme) var theme

    var body: some View {
        HStack(spacing: 12) {
            Text(model.selectedSection == .command ? model.selectedProject : model.selectedSection.title)
                .font(.system(size: 13, weight: .black))
                .foregroundStyle(theme.text)
            Text("Desktop")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(theme.textTertiary)
            Button {
                model.recordCommand("open_section_dashboard")
            } label: {
                Image(systemName: "ellipsis")
                    .foregroundStyle(.secondary)
                    .frame(width: 24, height: 24)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Open Dashboard")
            .accessibilityLabel("Open Dashboard")
            Spacer()
            AgentStatusPill(status: model.status)
            UpdateStatusPill(status: model.updateStatus)
            TopBarIconButton(icon: "message", label: "Chat", active: model.selectedSection == .command) {
                model.recordCommand("open_section_command")
            }
            TopBarIconButton(icon: "folder", label: "IDE", active: model.selectedSection == .ide) {
                model.recordCommand("open_section_ide")
            }
            if model.selectedSection == .ai {
                TopBarIconButton(
                    icon: model.aiRightRailMode == .hidden ? "sidebar.right" : "eye.slash",
                    label: model.aiRightRailMode == .hidden ? "Tools" : "Hide",
                    active: model.aiRightRailMode != .hidden
                ) {
                    model.toggleAIRightRailFromHeader()
                }
            }
            TopBarIconButton(icon: "gearshape", label: "Settings", active: model.selectedSection == .settings) {
                model.recordCommand("open_section_settings")
            }
        }
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(theme.textSecondary)
        .padding(.horizontal, 16)
        .frame(height: 48)
        .background(theme.commandBar)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }
}

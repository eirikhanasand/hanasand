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

struct DashboardWorkspace: View {
    @EnvironmentObject var model: DesktopAgentModel
    @Environment(\.desktopTheme) var theme

    var body: some View {
        if model.selectedDashboardPath == nil {
            FeatureWorkspace(title: "Dashboard", subtitle: "Native Hanasand controls and API previews.") {
                DashboardSectionHeader(title: "Workspace", subtitle: "Open native panels where implemented, with API-backed previews for the rest.")
                ActionGrid(actions: model.dashboardActions)
                DashboardSectionHeader(title: "Administration", subtitle: "API-backed operational views.")
                ActionGrid(actions: model.adminActions)
                DashboardSectionHeader(title: "Web and external", subtitle: "These intentionally leave the app or use hosted flows.")
                ActionGrid(actions: model.quickAppActions)
            }
        } else {
            NativeDashboardDetail()
        }
    }
}

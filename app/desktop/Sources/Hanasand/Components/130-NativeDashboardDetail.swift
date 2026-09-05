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

struct NativeDashboardDetail: View {
    @EnvironmentObject var model: DesktopAgentModel
    @Environment(\.desktopTheme) var theme

    var body: some View {
        FeatureWorkspace(title: model.selectedDashboardTitle, subtitle: model.nativeDashboardStatus) {
            HStack(spacing: 10) {
                ActionButton(title: "Back", icon: "chevron.left") {
                    model.closeNativeDashboardPage()
                }
                ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                    Task { await model.loadNativeDashboardData() }
                }
                if model.isLoadingNativeDashboard {
                    ProgressView()
                        .scaleEffect(0.70)
                }
            }

            HStack(spacing: 12) {
                FeatureCard(title: "Surface", value: model.selectedDashboardPath ?? "dashboard", icon: "rectangle.3.group")
                FeatureCard(title: "Mode", value: "Native desktop", icon: "macwindow")
                FeatureCard(title: "Auth", value: model.nativeDashboardStatus.localizedCaseInsensitiveContains("401") ? "Rejected" : "Settings/env", icon: "key")
            }

            nativeDashboardBody
        }
        .task(id: model.selectedDashboardPath) {
            await model.loadNativeDashboardData()
        }
    }

    @ViewBuilder
    var nativeDashboardBody: some View {
        switch model.selectedDashboardPath {
        case "/dashboard":
            DashboardOverviewNativePanel()
        case "/g":
            LinksNativePanel()
        case "/dashboard/tests":
            RecentTestsNativePanel()
        case "/mail":
            MailNativePanel()
        case "/system":
            SystemNativePanel()
        case "/vms":
            VMsNativePanel()
        case "/logs":
            LogsNativePanel()
        case "/system/ai":
            AIModelsNativePanel()
        case "/system/rates":
            RateLimitsNativePanel()
        case "/profile":
            ProfileNativePanel()
        case "/management", "/users":
            UsersNativePanel()
        case "/role":
            RolesNativePanel()
        case "/s":
            SharesNativePanel()
        case "/content/articles":
            ArticlesNativePanel()
        case "/content/thoughts":
            ThoughtsNativePanel()
        case "/notes":
            NotesNativePanel()
        case "/db":
            DatabaseNativePanel()
        case "/db/backups":
            BackupNativePanel()
        case "/db/restore":
            RestoreNativePanel()
        case "/vulnerabilities":
            VulnerabilityNativePanel()
        case "/traffic":
            TrafficNativePanel()
        case "/upload", "/dashboard/files":
            UploadNativePanel()
        default:
            NativeRouteFallbackPanel()
        }
    }
}

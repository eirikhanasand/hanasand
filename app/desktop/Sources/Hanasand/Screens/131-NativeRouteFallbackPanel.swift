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

struct NativeRouteFallbackPanel: View {
    @EnvironmentObject var model: DesktopAgentModel
    @Environment(\.desktopTheme) var theme

    var body: some View {
        NativeGroupPanel(title: model.selectedDashboardTitle, subtitle: model.selectedDashboardPath ?? "Dashboard route") {
            VStack(alignment: .leading, spacing: 12) {
                NativeNotice(
                    message: "This dashboard area is available in the embedded browser while the native panel is being prepared.",
                    title: "Browser-backed workspace",
                    tone: .info
                )

                HStack(spacing: 10) {
                    ActionButton(title: "Dashboard", icon: "square.grid.2x2") {
                        model.closeNativeDashboardPage()
                    }
                    ActionButton(title: "Open browser", icon: "globe") {
                        let path = model.selectedDashboardPath ?? "/dashboard"
                        model.openInlineBrowser(url: path, title: model.selectedDashboardTitle, source: "Dashboard")
                    }
                    ActionButton(title: "Settings", icon: "gearshape") {
                        model.selectedSection = .settings
                    }
                }
            }
        }
    }
}

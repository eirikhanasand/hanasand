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
        NativeGroupPanel(title: "Native panel not mapped yet", subtitle: model.selectedDashboardPath ?? "Unknown route") {
            VStack(alignment: .leading, spacing: 12) {
                Text("This route is not part of the native dashboard set yet. You can jump back to the dashboard, open the workspace browser, or keep reviewing the available native panels.")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

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

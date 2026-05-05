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

struct DashboardSectionHeader: View {
    @Environment(\.desktopTheme) var theme
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(theme.text)
            Text(subtitle)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(theme.textTertiary)
        }
        .padding(.top, 4)
    }
}

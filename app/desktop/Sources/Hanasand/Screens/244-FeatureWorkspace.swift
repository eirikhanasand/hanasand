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

struct FeatureWorkspace<Content: View>: View {
    @Environment(\.desktopTheme) var theme
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            TopBar()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(title)
                            .font(.system(size: 27, weight: .black))
                            .foregroundStyle(theme.text)
                        if !subtitle.isEmpty {
                            Text(subtitle)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(theme.textTertiary)
                                .lineLimit(2)
                                .textSelection(.enabled)
                        }
                    }
                    content
                }
                .frame(maxWidth: 980, alignment: .leading)
                .padding(.horizontal, 34)
                .padding(.top, 38)
                .padding(.bottom, 44)
                .frame(maxWidth: .infinity)
            }
        }
        .background(
            ZStack {
                theme.background
                RadialGradient(colors: [theme.accent.opacity(theme.isLight ? 0.08 : 0.16), .clear], center: .topLeading, startRadius: 40, endRadius: 720)
                RadialGradient(colors: [theme.green.opacity(theme.isLight ? 0.05 : 0.10), .clear], center: .bottomTrailing, startRadius: 60, endRadius: 760)
            }
        )
    }
}

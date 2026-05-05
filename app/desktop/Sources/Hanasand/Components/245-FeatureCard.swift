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

struct FeatureCard: View {
    @Environment(\.desktopTheme) var theme
    let title: String
    let value: String
    let icon: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .black))
                .foregroundStyle(theme.accent)
                .frame(width: 34, height: 34)
                .background(theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                Text(value)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
                    .textSelection(.enabled)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 76, alignment: .topLeading)
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(theme.divider.opacity(0.95), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

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

struct ThemeTextRow: View {
    @Environment(\.desktopTheme) var theme
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .lineLimit(1)
                .foregroundStyle(theme.textSecondary)
                .padding(.horizontal, 12)
                .frame(width: 180, height: 34, alignment: .leading)
                .background(theme.field)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .padding(.horizontal, 18)
        .frame(height: 52)
        .overlay(alignment: .bottom) {
            Rectangle().fill(theme.divider).frame(height: 1)
        }
    }
}

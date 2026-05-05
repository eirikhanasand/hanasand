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

struct ThemeToggleRow: View {
    @Environment(\.desktopTheme) var theme
    let label: String

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
            Spacer()
            Text("On")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(theme.text)
                .padding(.horizontal, 12)
                .frame(height: 30)
                .background(theme.cardRaised)
                .clipShape(Capsule())
        }
        .padding(.horizontal, 18)
        .frame(height: 52)
        .overlay(alignment: .bottom) {
            Rectangle().fill(theme.divider).frame(height: 1)
        }
    }
}

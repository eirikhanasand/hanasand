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

struct NavRow: View {
    @Environment(\.desktopTheme) var theme
    let icon: String
    let title: String
    var isSelected = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(isSelected ? theme.accent : theme.textSecondary)
                .frame(width: 18)
            Text(title)
                .foregroundStyle(isSelected ? theme.text : theme.textSecondary)
        }
        .font(.system(size: 13, weight: .semibold))
        .padding(.horizontal, 10)
        .frame(height: 32)
        .contentShape(Rectangle())
    }
}

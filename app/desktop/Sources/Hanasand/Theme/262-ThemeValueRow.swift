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

struct ThemeValueRow: View {
    @Environment(\.desktopTheme) var theme
    let label: String
    let value: String
    let color: Color
    var isAccent = false

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
            Spacer()
            HStack(spacing: 9) {
                Circle()
                    .strokeBorder(isAccent ? Color.white.opacity(0.35) : theme.divider, lineWidth: 1)
                    .background(Circle().fill(color))
                    .frame(width: 16, height: 16)
                Text(value)
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(isAccent ? Color.white : theme.text)
            .padding(.horizontal, 12)
            .frame(width: 180, height: 36, alignment: .leading)
            .background(isAccent ? Color(red: 0.20, green: 0.61, blue: 1.0) : theme.field)
            .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
        }
        .padding(.horizontal, 18)
        .frame(height: 52)
        .overlay(alignment: .bottom) {
            Rectangle().fill(theme.divider).frame(height: 1)
        }
    }
}

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

struct ThemeSliderRow: View {
    @Environment(\.desktopTheme) var theme
    let label: String
    let value: Int

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
            Spacer()
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(theme.field)
                    Capsule()
                        .fill(theme.accent.opacity(0.82))
                        .frame(width: proxy.size.width * CGFloat(min(max(value, 0), 100)) / 100)
                }
            }
                .frame(width: 210)
                .frame(height: 8)
            Text("\(value)")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
                .frame(width: 34, alignment: .trailing)
        }
        .padding(.horizontal, 18)
        .frame(height: 52)
    }
}

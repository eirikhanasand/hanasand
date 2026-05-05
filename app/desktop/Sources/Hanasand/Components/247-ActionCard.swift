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

struct ActionCard: View {
    @EnvironmentObject var model: DesktopAgentModel
    @Environment(\.desktopTheme) var theme
    let action: DesktopAction

    var body: some View {
        Button {
            action.perform(with: model)
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: action.icon)
                        .font(.system(size: 16, weight: .black))
                        .foregroundStyle(theme.accent)
                        .frame(width: 34, height: 34)
                        .background(theme.accentSoft)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    Spacer(minLength: 0)
                    Text(action.badgeLabel)
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(action.isNativeRoute ? theme.accent : theme.textTertiary)
                        .textCase(.uppercase)
                        .padding(.horizontal, 8)
                        .frame(height: 22)
                        .background(action.isNativeRoute ? theme.accentSoft : theme.cardRaised)
                        .clipShape(Capsule())
                }
                Text(action.title)
                    .font(.system(size: 15, weight: .black))
                    .foregroundStyle(theme.text)
                Text(action.subtitle)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(1)
                Spacer(minLength: 0)
                HStack(spacing: 6) {
                    Text(action.footerLabel)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    Image(systemName: action.trailingIcon)
                }
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(theme.textTertiary)
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 132, alignment: .topLeading)
            .background(theme.card)
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(theme.divider.opacity(0.95), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

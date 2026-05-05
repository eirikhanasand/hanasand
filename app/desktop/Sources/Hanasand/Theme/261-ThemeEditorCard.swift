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

struct ThemeEditorCard: View {
    @Environment(\.desktopTheme) var theme
    @EnvironmentObject var model: DesktopAgentModel
    let title: String
    let icon: String
    let accent: String
    let background: String
    let foreground: String
    let isLight: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(title)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(theme.textSecondary)
                Spacer()
                Button("Import") {
                    importTheme()
                }
                    .buttonStyle(.plain)
                    .foregroundStyle(theme.textSecondary)
                Button("Copy theme") {
                    copyTheme()
                }
                    .buttonStyle(.plain)
                    .foregroundStyle(theme.textSecondary)
                HStack(spacing: 10) {
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(isLight ? Color(red: 0.18, green: 0.48, blue: 0.94) : Color(red: 0.55, green: 0.74, blue: 1.0))
                        .frame(width: 26, height: 26)
                        .background(isLight ? Color.white : Color.black.opacity(0.45))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    Text("Hanasand")
                        .font(.system(size: 14, weight: .bold))
                    Spacer()
                    Image(systemName: "chevron.down")
                        .foregroundStyle(theme.textTertiary)
                }
                .padding(.horizontal, 10)
                .frame(width: 260, height: 36)
                .background(theme.cardRaised)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)

            VStack(spacing: 0) {
                ThemeValueRow(label: "Accent", value: accent, color: Color(red: 0.20, green: 0.61, blue: 1.0), isAccent: true)
                ThemeValueRow(label: "Background", value: background, color: isLight ? .white : Color(red: 0.095, green: 0.095, blue: 0.095))
                ThemeValueRow(label: "Foreground", value: foreground, color: isLight ? Color(red: 0.10, green: 0.11, blue: 0.12) : .white)
                ThemeTextRow(label: "Interface font", value: "-apple-system, BlinkMacSystemFont")
                ThemeTextRow(label: "Code font", value: "ui-monospace, SFMono-Regular")
                ThemeToggleRow(label: "Translucent sidebar")
                ThemeSliderRow(label: "Contrast", value: isLight ? 45 : 56)
            }
        }
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    var themePayload: String {
        """
        {
          "name": "\(title)",
          "accent": "\(accent)",
          "background": "\(background)",
          "foreground": "\(foreground)",
          "appearance": "\(isLight ? AppearancePreference.light.rawValue : AppearancePreference.dark.rawValue)"
        }
        """
    }

    func copyTheme() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(themePayload, forType: .string)
        model.recordUIEvent(meta: "Theme", body: "Copied \(title) theme JSON to clipboard.", kind: .command)
    }

    func importTheme() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.json, .plainText, UTType(filenameExtension: "theme")].compactMap { $0 }

        guard panel.runModal() == .OK, let url = panel.url else {
            model.recordUIEvent(meta: "Theme import", body: "Theme import cancelled.")
            return
        }

        do {
            let rawText = try String(contentsOf: url, encoding: .utf8)
            let lowercased = rawText.lowercased()
            let importedPreference: AppearancePreference
            if lowercased.contains(#""appearance": "light""#) || lowercased.contains(#""islight": true"#) || lowercased.contains("appearance=light") {
                importedPreference = .light
            } else if lowercased.contains(#""appearance": "dark""#) || lowercased.contains(#""islight": false"#) || lowercased.contains("appearance=dark") {
                importedPreference = .dark
            } else if lowercased.contains(#""appearance": "system""#) || lowercased.contains("appearance=system") {
                importedPreference = .system
            } else {
                model.recordUIEvent(meta: "Theme import", body: "No supported appearance value was found in \(url.lastPathComponent).", kind: .error)
                return
            }

            model.appearancePreference = importedPreference
            model.recordUIEvent(meta: "Theme import", body: "Imported \(url.lastPathComponent) and switched to \(importedPreference.title).", kind: .change)
        } catch {
            model.recordUIEvent(meta: "Theme import", body: error.localizedDescription, kind: .error)
        }
    }
}

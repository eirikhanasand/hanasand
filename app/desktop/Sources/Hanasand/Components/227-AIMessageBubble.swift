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

struct AIMessageBubble: View {
    @Environment(\.desktopTheme) var theme
    @EnvironmentObject var model: DesktopAgentModel
    let message: AIChatMessage
    @State var isHovered = false
    @State var didCopy = false

    var body: some View {
        if message.isReconnectNotice {
            AIReconnectNoticeView(message: message)
        } else {
            standardMessage
        }
    }

    var standardMessage: some View {
        VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 6) {
            HStack {
                if message.role == .user {
                    Spacer(minLength: 120)
                }
                VStack(alignment: .leading, spacing: 8) {
                    AIMessageContentView(
                        content: message.content,
                        isError: message.isError
                    )

                    if message.role == .assistant {
                        let referencedFiles = AIFileReferenceParser.references(in: message.content, changedFiles: model.changedFileSummary)
                        if !referencedFiles.isEmpty {
                            AIChangedFilesInlinePanel(files: Array(referencedFiles.prefix(6)))
                        }
                    }
                }
                .padding(message.role == .user ? 14 : 0)
                .frame(maxWidth: message.role == .user ? 720 : 900, alignment: .leading)
                .background(message.role == .user ? theme.cardRaised : Color.clear)
                .overlay {
                    if message.role == .user {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(theme.divider, lineWidth: 1)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                if message.role == .assistant {
                    Spacer(minLength: 120)
                }
            }
            if isHovered && !message.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                copyButton
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.12)) {
                isHovered = hovering
            }
        }
    }

    var copyButton: some View {
        Button {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(message.content, forType: .string)
            didCopy = true
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                didCopy = false
            }
        } label: {
            Label(didCopy ? "Copied" : "Copy", systemImage: didCopy ? "checkmark" : "doc.on.doc")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(theme.textTertiary)
                .padding(.horizontal, 9)
                .frame(height: 24)
                .background(theme.card.opacity(0.62))
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

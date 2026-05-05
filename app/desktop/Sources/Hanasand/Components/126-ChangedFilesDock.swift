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

struct ChangedFilesDock: View {
    @EnvironmentObject var model: DesktopAgentModel
    @Environment(\.desktopTheme) var theme

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text(model.changedFileSummaryStatus)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                if !model.changedFileSummary.isEmpty {
                    Text("+\(model.changedFileSummary.filter { $0.status.contains("A") || $0.status.contains("?") }.count)")
                        .foregroundStyle(theme.green)
                    Text("-\(model.changedFileSummary.filter { $0.status.contains("D") }.count)")
                        .foregroundStyle(theme.danger)
                }
                Spacer()
                Button {
                    model.refreshChangedFilesSummary()
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.plain)
                .help("Refresh changed files")
                Button {
                    model.reviewChangedFiles()
                } label: {
                    HStack(spacing: 6) {
                        Text("Review changes")
                        Image(systemName: "arrow.up.forward")
                    }
                }
                .buttonStyle(.plain)
                .foregroundStyle(theme.text)
            }
            .font(.system(size: 12, weight: .semibold))
            .padding(.horizontal, 18)
            .frame(width: 760, height: 34)
            .background(theme.commandBar)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 18, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 18))

            if !model.changedFileSummary.isEmpty {
                VStack(spacing: 0) {
                    ForEach(model.changedFileSummary.prefix(4)) { file in
                        HStack(spacing: 10) {
                            Image(systemName: fileIcon(for: file.status))
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(fileColor(for: file.status))
                                .frame(width: 18)
                            Text(file.path)
                                .font(.system(size: 11, weight: .medium, design: .monospaced))
                                .foregroundStyle(theme.textSecondary)
                                .lineLimit(1)
                                .truncationMode(.middle)
                            Spacer()
                            Text(file.status)
                                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                .foregroundStyle(theme.textTertiary)
                        }
                        .padding(.horizontal, 18)
                        .frame(height: 30)
                        .background(theme.commandPanel.opacity(0.82))
                        if file.id != model.changedFileSummary.prefix(4).last?.id {
                            Rectangle()
                                .fill(theme.divider)
                                .frame(width: 760, height: 1)
                        }
                    }
                }
                .frame(width: 760)
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 0, bottomLeadingRadius: 18, bottomTrailingRadius: 18, topTrailingRadius: 0))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, 10)
        .onAppear {
            model.refreshChangedFilesSummary()
        }
    }

    func fileIcon(for status: String) -> String {
        if status.contains("D") { return "minus.circle" }
        if status.contains("A") || status.contains("?") { return "plus.circle" }
        if status.contains("R") { return "arrow.triangle.2.circlepath" }
        return "pencil.circle"
    }

    func fileColor(for status: String) -> Color {
        if status.contains("D") { return theme.danger }
        if status.contains("A") || status.contains("?") { return theme.green }
        return theme.accent
    }
}

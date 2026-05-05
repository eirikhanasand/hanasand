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

extension IDEWorkspace {

    var terminalPane: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Label("Terminal", systemImage: "terminal")
                    .font(.system(size: 12, weight: .black))
                Text(model.terminal.cwd)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.textTertiary)
                    .lineLimit(1)
                Spacer()
                if model.terminal.isRunning {
                    ProgressView()
                        .scaleEffect(0.55)
                }
                BrowserAgentButton(title: "Copy cwd", icon: "doc.on.doc") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(model.terminal.cwd, forType: .string)
                }
                BrowserAgentButton(title: "Reveal cwd", icon: "folder") {
                    NSWorkspace.shared.open(URL(fileURLWithPath: model.terminal.cwd, isDirectory: true))
                }
                BrowserAgentButton(title: terminalAutoScroll ? "Auto" : "Manual", icon: "arrow.down.to.line") {
                    terminalAutoScroll.toggle()
                }
                BrowserAgentButton(title: "Copy", icon: "doc.on.doc") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(model.terminal.output, forType: .string)
                }
                BrowserAgentButton(title: "Stop", icon: "stop.fill") {
                    model.terminal.stop()
                }
                BrowserAgentButton(title: "Clear", icon: "trash") {
                    model.terminal.clear()
                }
                BrowserAgentButton(title: "Prev", icon: "chevron.up") {
                    model.terminal.previousHistory()
                }
                BrowserAgentButton(title: "Next", icon: "chevron.down") {
                    model.terminal.nextHistory()
                }
                BrowserAgentButton(title: "Run", icon: "play.fill") {
                    model.terminal.run()
                }
            }
            .foregroundStyle(theme.text)
            .padding(.horizontal, 12)
            .frame(height: 34)
            .background(theme.commandBar)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(model.quickCommands) { quickCommand in
                        BrowserAgentButton(title: quickCommand.title, icon: quickCommand.icon) {
                            model.terminal.run(quickCommand.command)
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
            }
            .background(theme.backgroundElevated)

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(model.terminal.output)
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                            .foregroundStyle(theme.textSecondary)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                            .padding(12)
                        Color.clear
                            .frame(height: 1)
                            .id("terminal-bottom")
                    }
                }
                .onChange(of: model.terminal.output) { _, _ in
                    guard terminalAutoScroll else { return }
                    proxy.scrollTo("terminal-bottom", anchor: .bottom)
                }
            }
            .background(Color.black.opacity(0.16))

            HStack(spacing: 8) {
                TextField(
                    "cwd",
                    text: Binding(
                        get: { model.terminal.cwd },
                        set: {
                            model.terminal.cwd = $0
                            model.scanProjectFiles()
                            model.persistWorkspaceState()
                        }
                    )
                )
                    .textFieldStyle(.plain)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.textTertiary)
                    .frame(width: 220)
                Text("$")
                    .font(.system(size: 12, weight: .black, design: .monospaced))
                    .foregroundStyle(theme.accent)
                TextField(
                    "Run command",
                    text: Binding(
                        get: { model.terminal.command },
                        set: { model.terminal.command = $0 }
                    )
                )
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.text)
                    .onSubmit {
                        model.terminal.run()
                        model.scanProjectFiles()
                    }
            }
            .padding(.horizontal, 12)
            .frame(height: 36)
            .background(theme.field)
        }
        .overlay(alignment: .top) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    func openLocalFile() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        if panel.runModal() == .OK, let url = panel.url {
            model.importLocalFile(url)
        }
    }

    func exportCurrentFile() {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = model.selectedFile?.title ?? "scratch.md"
        if panel.runModal() == .OK, let url = panel.url {
            model.exportCurrent(to: url)
        }
    }
}

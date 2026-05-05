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

struct CommandDock: View {
    @EnvironmentObject var model: DesktopAgentModel
    @Environment(\.desktopTheme) var theme
    let commandFocused: FocusState<Bool>.Binding
    @State var draggingQueuedPromptID: UUID?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Text("\(model.aiMessages.count) messages")
                    .foregroundStyle(theme.textSecondary)
                Text(" +\(model.aiTrace.count)")
                    .foregroundStyle(theme.green)
                Text(" -0")
                    .foregroundStyle(theme.danger)
                Spacer()
                Button("Status") {
                    model.runStatusCommand()
                }
                .buttonStyle(.plain)
                .foregroundStyle(theme.text)
            }
            .font(.system(size: 13, weight: .semibold))
            .padding(.horizontal, 18)
            .frame(width: 760, height: 34)
            .background(theme.commandBar)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 22, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 22))

            VStack(spacing: 14) {
                if !model.promptQueue.isEmpty {
                    VStack(spacing: 6) {
                        ForEach(model.promptQueue) { item in
                            HStack(spacing: 8) {
                                Image(systemName: "line.3.horizontal")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(theme.textTertiary)
                                    .frame(width: 16)
                                    .help("Drag to reorder")
                                Text(item.text)
                                    .lineLimit(1)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                Button {
                                    model.forceQueuedPrompt(item)
                                } label: {
                                    Image(systemName: "paperplane")
                                }
                                .buttonStyle(.plain)
                                .help("Send this queued prompt next")
                                Button {
                                    model.moveQueuedPrompt(item, direction: -1)
                                } label: {
                                    Image(systemName: "arrow.up")
                                }
                                .buttonStyle(.plain)
                                .help("Move up")
                                Button {
                                    model.moveQueuedPrompt(item, direction: 1)
                                } label: {
                                    Image(systemName: "arrow.down")
                                }
                                .buttonStyle(.plain)
                                .help("Move down")
                                Button {
                                    model.removeQueuedPrompt(item)
                                } label: {
                                    Image(systemName: "trash")
                                }
                                .buttonStyle(.plain)
                                .help("Remove queued prompt")
                            }
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(theme.textSecondary)
                            .padding(.horizontal, 10)
                            .frame(height: 28)
                            .background(draggingQueuedPromptID == item.id ? theme.accentSoft : theme.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .contentShape(Rectangle())
                            .onDrag {
                                draggingQueuedPromptID = item.id
                                return NSItemProvider(object: item.id.uuidString as NSString)
                            }
                            .onDrop(
                                of: [.text],
                                delegate: QueuedPromptDropDelegate(
                                    target: item,
                                    model: model,
                                    draggingID: $draggingQueuedPromptID
                                )
                            )
                        }
                    }
                    .frame(maxHeight: 146)
                }

                TextField("Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...", text: $model.prompt, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(theme.text)
                    .lineLimit(2...5)
                    .focused(commandFocused)
                    .onSubmit {
                        model.submitAIChatPrompt()
                    }

                HStack(spacing: 10) {
                    CommandDockQuickButton(title: "Queue", icon: "plus") {
                        model.queuePrompt()
                    }
                    CommandDockQuickButton(title: "Send now", icon: "paperplane") {
                        model.submitAIChatPrompt()
                    }
                    CommandDockQuickButton(title: "Dashboard", icon: "gauge.with.dots.needle") {
                        model.recordCommand("open_section_dashboard")
                    }
                    CommandDockQuickButton(title: "AI drill", icon: "graduationcap") {
                        model.submitAppParityTrainingPrompt()
                    }
                    Spacer()
                    ProgressView()
                        .scaleEffect(0.55)
                        .opacity(model.isRunning ? 1 : 0.35)
                    Text(model.status.ok ? "Agent online" : "Agent offline")
                        .foregroundStyle(.secondary)
                    CommandDockQuickButton(title: "Status", icon: "waveform.path.ecg") {
                        model.runStatusCommand()
                    }
                    Button(action: model.submitAIChatPrompt) {
                        Image(systemName: model.isRunning ? "square.fill" : "paperplane.fill")
                            .foregroundStyle(theme.commandPanel)
                            .frame(width: 32, height: 32)
                            .background(canSubmit ? theme.text : theme.textTertiary.opacity(0.45))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .disabled(!canSubmit)
                }
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(theme.textSecondary)
            }
            .padding(.horizontal, 18)
            .padding(.top, 26)
            .padding(.bottom, 22)
            .frame(width: 760)
            .background(theme.commandPanel)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 0, bottomLeadingRadius: 22, bottomTrailingRadius: 22, topTrailingRadius: 0, style: .continuous))

            Button {
                NSWorkspace.shared.open(URL(fileURLWithPath: model.status.cwd, isDirectory: true))
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "desktopcomputer")
                    Text("Working locally")
                    Text(model.status.cwd)
                        .lineLimit(1)
                    Image(systemName: "folder")
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(theme.textSecondary)
            .frame(width: 760, alignment: .leading)
            .padding(.top, 14)
            .help("Reveal working directory")
        }
        .padding(.bottom, 20)
    }

    var canSubmit: Bool {
        !model.prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !model.isRunning
    }
}

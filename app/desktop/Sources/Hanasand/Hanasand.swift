import AppKit
import ApplicationServices
import Combine
import CryptoKit
import Foundation
import Network
import PDFKit
import SwiftUI
import UniformTypeIdentifiers
import WebKit

@main
struct HanasandApp: App {
    @StateObject private var model = DesktopAgentModel()

    var body: some Scene {
        WindowGroup {
            DesktopShell()
                .environmentObject(model)
                .frame(minWidth: 1080, minHeight: 720)
                .task {
                    await model.start()
                }
        }
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(replacing: .sidebar) {
                Button("Toggle Sidebar") {
                    model.sidebarVisible.toggle()
                }
                .keyboardShortcut("s", modifiers: [.command, .option])
            }
            CommandGroup(after: .toolbar) {
                Button("Focus Control") {
                    model.selectedSection = .control
                    model.focusCommand.toggle()
                }
                .keyboardShortcut("k", modifiers: [.command])

                Button("Zoom Window") {
                    model.zoomWindow()
                }
                .keyboardShortcut("=", modifiers: [.command, .option])

                Button("Minimize Window") {
                    model.minimizeWindow()
                }
                .keyboardShortcut("m", modifiers: [.command])

                Button("Toggle Full Screen") {
                    model.toggleFullScreen()
                }
                .keyboardShortcut("f", modifiers: [.command, .control])

                Divider()

                Button("Reset Native Layout") {
                    model.resetNativeLayout()
                }
                .keyboardShortcut("0", modifiers: [.command, .option])
            }
            CommandGroup(after: .newItem) {
                Button("Import Document Pages...") {
                    model.selectedSection = .documents
                    model.importDocumentPages()
                }
                .keyboardShortcut("o", modifiers: [.command])

                Button("Import Images...") {
                    model.selectedSection = .images
                    model.importImagesForReview()
                }
                .keyboardShortcut("i", modifiers: [.command, .shift])

                Button("Choose Upload File...") {
                    model.openNativeDashboard(path: "/dashboard/files", label: "Files")
                    model.chooseUploadFile()
                }
                .keyboardShortcut("u", modifiers: [.command, .option])

                Button("Export Document PDF...") {
                    model.selectedSection = .documents
                    model.exportDocumentPDF()
                }
                .keyboardShortcut("e", modifiers: [.command, .option])
            }
            CommandGroup(after: .pasteboard) {
                Button("Copy Current Context") {
                    model.copyCurrentContext()
                }
                .keyboardShortcut("c", modifiers: [.command, .shift])

                Button("Share Current Context...") {
                    model.shareCurrentContext()
                }
                .keyboardShortcut("s", modifiers: [.command, .shift])
            }
            CommandMenu("Control") {
                Button("Open Control") {
                    model.selectedSection = .control
                    model.focusCommand.toggle()
                }
                .keyboardShortcut("0", modifiers: [.command, .shift])

                Button("Run Prompt") {
                    model.submitPrompt()
                }
                .keyboardShortcut(.return, modifiers: [.command])
                .disabled(model.prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isRunning)

                Button("Approve Pending Action") {
                    model.approvePendingAction()
                }
                .keyboardShortcut(.return, modifiers: [.command, .shift])
                .disabled(model.pendingApproval == nil || model.pendingApproval?.kind == .blocked)

                Button("Cancel Pending Action") {
                    model.cancelPendingApproval()
                }
                .keyboardShortcut(.escape, modifiers: [.command])
                .disabled(model.pendingApproval == nil)

                Divider()

                Button("Refresh This Mac") {
                    Task { await model.refreshLocalStatus() }
                }
                .keyboardShortcut("m", modifiers: [.command, .shift])

                Button("Server Logs") {
                    Task { await model.checkServerLogs() }
                }
                .keyboardShortcut("l", modifiers: [.command, .shift])

                Button("Health Check") {
                    Task { await model.checkServerReachability() }
                }
                .keyboardShortcut("h", modifiers: [.command, .shift])

                Button("Copy Server Diagnostics") {
                    model.copyServerDiagnostics()
                }
                .keyboardShortcut("d", modifiers: [.command, .shift])

                Button("Start Server") {
                    Task { await model.runServerAction(model.settings.serverStartPath) }
                }

                Button("Stop Server...") {
                    model.requestStopServerApproval()
                }

                Divider()

                Button("Remote Tunnel...") {
                    model.requestRemoteTunnelApproval()
                }

                Button("Remote Desktop") {
                    model.openRemoteDesktop()
                }

                Button("VPN") {
                    model.openVPN()
                }
            }
            CommandMenu("Navigate") {
                ForEach(DesktopSection.allCases) { section in
                    Button(section.title) {
                        model.selectedSection = section
                    }
                    .keyboardShortcut(section.shortcutKey, modifiers: [.command, .option])
                }
            }
            CommandMenu("Agent") {
                Button("Run Status") {
                    model.runStatusCommand()
                }
                .keyboardShortcut("r", modifiers: [.command])

                Button("Focus Command") {
                    model.focusCommand.toggle()
                }
                .keyboardShortcut("k", modifiers: [.command])
            }
            CommandMenu("Mail") {
                Button("Open Mail") {
                    model.openNativeDashboard(path: "/dashboard/mail", label: "Mail")
                }
                .keyboardShortcut("1", modifiers: [.command, .shift])

                Button("Refresh Mail") {
                    Task { await model.loadMailOverview() }
                }
                .keyboardShortcut("r", modifiers: [.command, .shift])

                Button("New Message") {
                    model.mailComposerExpanded = true
                }
                .keyboardShortcut("n", modifiers: [.command, .shift])

                Button("Mark Read/Unread") {
                    Task { await model.toggleSelectedMailReadState() }
                }
                .keyboardShortcut("u", modifiers: [.command, .shift])

                Button("Flag/Unflag") {
                    Task { await model.toggleSelectedMailFlagState() }
                }
                .keyboardShortcut("l", modifiers: [.command, .shift])

                Button("Archive") {
                    Task { await model.runSelectedMailAction("archive") }
                }
                .keyboardShortcut("e", modifiers: [.command, .shift])

                Button("Reply") {
                    model.composeReplyToSelectedMail()
                }
                .keyboardShortcut("r", modifiers: [.command, .option])

                Button("Reply All") {
                    model.composeReplyAllToSelectedMail()
                }
                .keyboardShortcut("r", modifiers: [.command, .option, .shift])

                Button("Forward") {
                    model.composeForwardSelectedMail()
                }
                .keyboardShortcut("f", modifiers: [.command, .option])

                Button("Move to Trash") {
                    Task { await model.runSelectedMailAction("trash") }
                }
                .keyboardShortcut(.delete, modifiers: [.command])
            }
            CommandMenu("Documents") {
                Button("Open Documents") {
                    model.selectedSection = .documents
                }
                .keyboardShortcut("d", modifiers: [.command, .option])

                Button("Import Pages...") {
                    model.selectedSection = .documents
                    model.importDocumentPages()
                }
                .keyboardShortcut("o", modifiers: [.command, .option])

                Button("Export PDF...") {
                    model.selectedSection = .documents
                    model.exportDocumentPDF()
                }
                .keyboardShortcut("p", modifiers: [.command, .option])
                .disabled(model.documentPages.isEmpty)

                Button("Reveal Last Export") {
                    model.revealExportedDocument()
                }
                .disabled(model.exportedDocumentPath.isEmpty)

                Divider()

                Button("Clear Pages...") {
                    model.requestClearDocumentsApproval()
                }
                .disabled(model.documentPages.isEmpty)
            }
            CommandMenu("Images") {
                Button("Open Images") {
                    model.selectedSection = .images
                }
                .keyboardShortcut("i", modifiers: [.command, .option])

                Button("Import Images...") {
                    model.selectedSection = .images
                    model.importImagesForReview()
                }
                .keyboardShortcut("i", modifiers: [.command, .shift])

                Button("Keep Current") {
                    model.decideCurrentImage(.keep)
                }
                .keyboardShortcut(.rightArrow, modifiers: [.command])
                .disabled(model.currentImageReviewItem == nil)

                Button("Discard Current") {
                    model.decideCurrentImage(.discard)
                }
                .keyboardShortcut(.leftArrow, modifiers: [.command])
                .disabled(model.currentImageReviewItem == nil)

                Button("Undo Image Decision") {
                    model.undoImageDecision()
                }
                .keyboardShortcut("z", modifiers: [.command, .shift])

                Button("Reveal Current Image") {
                    model.revealCurrentImage()
                }
                .disabled(model.currentImageReviewItem == nil)

                Divider()

                Button("Trash Marked...") {
                    model.requestTrashImagesApproval()
                }
                .disabled(!model.hasDiscardedImages)
            }
        }
    }
}

enum AppearancePreference: String, CaseIterable, Identifiable {
    case light
    case dark
    case system

    var id: String { rawValue }

    var title: String {
        switch self {
        case .light: return "Light"
        case .dark: return "Dark"
        case .system: return "System"
        }
    }

    var icon: String {
        switch self {
        case .light: return "sun.max"
        case .dark: return "moon"
        case .system: return "display"
        }
    }

    var preferredColorScheme: ColorScheme? {
        switch self {
        case .light: return .light
        case .dark: return .dark
        case .system: return nil
        }
    }
}

enum RemoteDesktopProtocol: String, CaseIterable, Identifiable {
    case screenSharing
    case microsoftRDP

    var id: String { rawValue }

    var label: String {
        switch self {
        case .screenSharing: return "Screen Sharing"
        case .microsoftRDP: return "Microsoft RDP"
        }
    }

    var icon: String {
        switch self {
        case .screenSharing: return "display"
        case .microsoftRDP: return "rectangle.connected.to.line.below"
        }
    }
}

enum DesktopSection: String, CaseIterable, Identifiable {
    case command
    case control
    case dashboard
    case browser
    case ide
    case mac
    case mail
    case documents
    case images
    case ai
    case server
    case updates
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .command: return "Command"
        case .control: return "Control"
        case .dashboard: return "Dashboard"
        case .browser: return "Workspace"
        case .ide: return "IDE"
        case .mac: return "This Mac"
        case .mail: return "Mail"
        case .documents: return "Documents"
        case .images: return "Images"
        case .ai: return "Hanasand AI"
        case .server: return "Server"
        case .updates: return "Updates"
        case .settings: return "Settings"
        }
    }

    var icon: String {
        switch self {
        case .command: return "terminal"
        case .control: return "slider.horizontal.3"
        case .dashboard: return "square.grid.2x2"
        case .browser: return "rectangle.3.group"
        case .ide: return "curlybraces.square"
        case .mac: return "desktopcomputer"
        case .mail: return "envelope"
        case .documents: return "doc.viewfinder"
        case .images: return "photo.on.rectangle.angled"
        case .ai: return "sparkles"
        case .server: return "server.rack"
        case .updates: return "arrow.triangle.2.circlepath"
        case .settings: return "gearshape"
        }
    }

    var shortcutKey: KeyEquivalent {
        switch self {
        case .command: return "1"
        case .control: return "2"
        case .dashboard: return "3"
        case .browser: return "4"
        case .ide: return "5"
        case .mac: return "6"
        case .mail: return "7"
        case .documents: return "8"
        case .images: return "9"
        case .ai: return "a"
        case .server: return "r"
        case .updates: return "u"
        case .settings: return ","
        }
    }
}

struct HanasandDesktopSettings: Codable, Equatable {
    static let macMiniTunnelCommand = "ssh -N -L 5900:192.168.1.81:5900 -J tekkom@128.39.140.144 tekkom@192.168.1.81"

    var websiteBaseURL = "https://hanasand.com"
    var apiBaseURL = "https://api.hanasand.com/api"
    var internalAPIBaseURL = "https://internal.hanasand.com/api"
    var beekeeperAPIBaseURL = "https://beekeeper.login.no/api"
    var cdnBaseURL = "https://cdn.hanasand.com/api"
    var authToken = ""
    var userID = ""
    var codexAPIPath = "/tools/ai"
    var aiAPIURL = "https://api.hanasand.com/api/tools/ai"
    var desktopAgentBaseURL = "http://localhost:45731"
    var vpnURLScheme = "ciscoanyconnect://"
    var rdpHost = "localhost:5900"
    var rdpUser = "macmini"
    var remoteDesktopProtocol = RemoteDesktopProtocol.screenSharing.rawValue
    var remoteDesktopTunnelCommand = Self.macMiniTunnelCommand
    var serverBaseURL = "http://128.39.142.158"
    var serverStartPath = "/start"
    var serverStopPath = "/stop"
    var serverLogsPath = "/logs"

    enum CodingKeys: String, CodingKey {
        case websiteBaseURL
        case apiBaseURL
        case internalAPIBaseURL
        case beekeeperAPIBaseURL
        case cdnBaseURL
        case authToken
        case userID
        case codexAPIPath
        case aiAPIURL
        case desktopAgentBaseURL
        case vpnURLScheme
        case rdpHost
        case rdpUser
        case remoteDesktopProtocol
        case remoteDesktopTunnelCommand
        case serverBaseURL
        case serverStartPath
        case serverStopPath
        case serverLogsPath
    }

    init() {}

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        websiteBaseURL = try container.decodeIfPresent(String.self, forKey: .websiteBaseURL) ?? websiteBaseURL
        apiBaseURL = try container.decodeIfPresent(String.self, forKey: .apiBaseURL) ?? apiBaseURL
        internalAPIBaseURL = try container.decodeIfPresent(String.self, forKey: .internalAPIBaseURL) ?? internalAPIBaseURL
        beekeeperAPIBaseURL = try container.decodeIfPresent(String.self, forKey: .beekeeperAPIBaseURL) ?? beekeeperAPIBaseURL
        cdnBaseURL = try container.decodeIfPresent(String.self, forKey: .cdnBaseURL) ?? cdnBaseURL
        authToken = try container.decodeIfPresent(String.self, forKey: .authToken) ?? authToken
        userID = try container.decodeIfPresent(String.self, forKey: .userID) ?? userID
        codexAPIPath = try container.decodeIfPresent(String.self, forKey: .codexAPIPath) ?? codexAPIPath
        aiAPIURL = try container.decodeIfPresent(String.self, forKey: .aiAPIURL) ?? aiAPIURL
        desktopAgentBaseURL = try container.decodeIfPresent(String.self, forKey: .desktopAgentBaseURL) ?? desktopAgentBaseURL
        vpnURLScheme = try container.decodeIfPresent(String.self, forKey: .vpnURLScheme) ?? vpnURLScheme
        rdpHost = try container.decodeIfPresent(String.self, forKey: .rdpHost) ?? rdpHost
        rdpUser = try container.decodeIfPresent(String.self, forKey: .rdpUser) ?? rdpUser
        remoteDesktopProtocol = try container.decodeIfPresent(String.self, forKey: .remoteDesktopProtocol) ?? remoteDesktopProtocol
        remoteDesktopTunnelCommand = try container.decodeIfPresent(String.self, forKey: .remoteDesktopTunnelCommand) ?? remoteDesktopTunnelCommand
        serverBaseURL = try container.decodeIfPresent(String.self, forKey: .serverBaseURL) ?? serverBaseURL
        serverStartPath = try container.decodeIfPresent(String.self, forKey: .serverStartPath) ?? serverStartPath
        serverStopPath = try container.decodeIfPresent(String.self, forKey: .serverStopPath) ?? serverStopPath
        serverLogsPath = try container.decodeIfPresent(String.self, forKey: .serverLogsPath) ?? serverLogsPath
    }
}

extension HanasandDesktopSettings {
    var resolvedAIEndpoint: URL {
        let configured = aiAPIURL.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URL(string: configured), !configured.isEmpty {
            return url
        }

        let path = codexAPIPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return apiBaseURL.normalizedBaseURL.appendingPathComponent(path.isEmpty ? "tools/ai" : path)
    }

    var loopbackSummary: String {
        [
            "website=\(websiteBaseURL)",
            "api=\(apiBaseURL)",
            "internal=\(internalAPIBaseURL)",
            "beekeeper=\(beekeeperAPIBaseURL)",
            "ai=\(resolvedAIEndpoint.absoluteString)",
            "desktopAgent=\(desktopAgentBaseURL)",
            "server=\(serverBaseURL)",
            "auth=\(authToken.isEmpty ? "missing" : "configured")",
            "userId=\(userID.isEmpty ? "missing" : "configured")",
        ].joined(separator: "\n")
    }

    var endpointValidationMessages: [String] {
        [
            validateURLField("Website", websiteBaseURL, allowedSchemes: ["http", "https"]),
            validateURLField("API", apiBaseURL, allowedSchemes: ["http", "https"]),
            validateURLField("Internal API", internalAPIBaseURL, allowedSchemes: ["http", "https"]),
            validateURLField("Beekeeper API", beekeeperAPIBaseURL, allowedSchemes: ["http", "https"]),
            validateURLField("CDN", cdnBaseURL, allowedSchemes: ["http", "https"]),
            validateURLField("AI endpoint", aiAPIURL, allowedSchemes: ["http", "https"]),
            validateURLField("Desktop agent", desktopAgentBaseURL, allowedSchemes: ["http", "https"]),
            validateURLField("Server", serverBaseURL, allowedSchemes: ["http", "https"]),
        ].compactMap { $0 }
    }

    var hasValidEndpoints: Bool {
        endpointValidationMessages.isEmpty
    }

    private func validateURLField(_ label: String, _ rawValue: String, allowedSchemes: Set<String>) -> String? {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed),
              let scheme = url.scheme?.lowercased(),
              allowedSchemes.contains(scheme),
              url.host != nil else {
            return "\(label) needs a valid \(allowedSchemes.sorted().joined(separator: "/")) URL."
        }
        return nil
    }
}

struct DesktopTheme {
    let isLight: Bool
    let background: Color
    let backgroundElevated: Color
    let sidebar: Color
    let sidebarSelected: Color
    let commandPanel: Color
    let commandBar: Color
    let card: Color
    let cardRaised: Color
    let field: Color
    let divider: Color
    let text: Color
    let textSecondary: Color
    let textTertiary: Color
    let accent: Color
    let accentSoft: Color
    let green: Color
    let danger: Color

    init(preference: AppearancePreference, systemScheme: ColorScheme) {
        isLight = preference == .light || (preference == .system && systemScheme == .light)
        if isLight {
            background = Color(red: 0.955, green: 0.955, blue: 0.940)
            backgroundElevated = Color(red: 0.985, green: 0.985, blue: 0.972)
            sidebar = Color(red: 0.895, green: 0.900, blue: 0.875)
            sidebarSelected = Color.black.opacity(0.075)
            commandPanel = Color(red: 0.990, green: 0.990, blue: 0.980)
            commandBar = Color(red: 0.915, green: 0.920, blue: 0.900)
            card = Color(red: 0.930, green: 0.932, blue: 0.912)
            cardRaised = Color(red: 0.980, green: 0.980, blue: 0.965)
            field = Color.white.opacity(0.88)
            divider = Color.black.opacity(0.11)
            text = Color(red: 0.090, green: 0.100, blue: 0.095)
            textSecondary = Color.black.opacity(0.58)
            textTertiary = Color.black.opacity(0.38)
            accent = Color(red: 0.180, green: 0.480, blue: 0.940)
            accentSoft = Color(red: 0.180, green: 0.480, blue: 0.940).opacity(0.14)
            green = Color(red: 0.120, green: 0.560, blue: 0.310)
            danger = Color(red: 0.780, green: 0.190, blue: 0.160)
        } else {
            background = Color(red: 0.035, green: 0.043, blue: 0.038)
            backgroundElevated = Color(red: 0.070, green: 0.083, blue: 0.074)
            sidebar = Color(red: 0.055, green: 0.066, blue: 0.058)
            sidebarSelected = Color(red: 0.94, green: 0.49, blue: 0.20).opacity(0.16)
            commandPanel = Color.white.opacity(0.075)
            commandBar = Color(red: 0.058, green: 0.068, blue: 0.061).opacity(0.96)
            card = Color.white.opacity(0.070)
            cardRaised = Color.white.opacity(0.105)
            field = Color.white.opacity(0.085)
            divider = Color.white.opacity(0.115)
            text = Color(red: 0.965, green: 0.955, blue: 0.915)
            textSecondary = Color.white.opacity(0.68)
            textTertiary = Color.white.opacity(0.43)
            accent = Color(red: 0.94, green: 0.49, blue: 0.20)
            accentSoft = Color(red: 0.94, green: 0.49, blue: 0.20).opacity(0.18)
            green = Color(red: 0.40, green: 0.82, blue: 0.52)
            danger = Color(red: 0.96, green: 0.38, blue: 0.31)
        }
    }
}

private struct DesktopThemeKey: EnvironmentKey {
    static let defaultValue = DesktopTheme(preference: .dark, systemScheme: .dark)
}

extension EnvironmentValues {
    var desktopTheme: DesktopTheme {
        get { self[DesktopThemeKey.self] }
        set { self[DesktopThemeKey.self] = newValue }
    }
}

@MainActor
final class DesktopAgentModel: ObservableObject {
    static var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0"
    }
    static var automaticUpdateCheckInterval: TimeInterval {
        let rawValue = ProcessInfo.processInfo.environment["HANASAND_APP_UPDATE_CHECK_SECONDS"] ?? ""
        if let value = TimeInterval(rawValue), value >= 10 {
            return value
        }
        return 300
    }

    @Published var prompt = ""
    @Published var loginUsername = ""
    @Published var loginPassword = ""
    @Published var loginStatus = ""
    @Published var isLoggingIn = false
    @Published var passwordResetUsername = ""
    @Published var passwordResetCode = ""
    @Published var passwordResetToken = ""
    @Published var passwordResetNewPassword = ""
    @Published var passwordResetConfirmPassword = ""
    @Published var passwordResetStatus = ""
    @Published var passwordResetStep: PasswordResetStep = .idle
    @Published var isResettingPassword = false
    @Published var promptQueue: [QueuedPrompt] = []
    @Published var changedFileSummary: [ChangedFileSummary] = []
    @Published var changedFileSummaryStatus = "Git not checked"
    @Published var events: [AgentEvent] = []
    @Published var status = AgentStatus.ready()
    @Published var selectedProject = "Hanasand Desktop"
    @Published var customProjectTitles: [String] = [] {
        didSet { UserDefaults.standard.set(customProjectTitles, forKey: Self.customProjectsKey) }
    }
    @Published var selectedSection: DesktopSection = .control {
        didSet { UserDefaults.standard.set(selectedSection.rawValue, forKey: Self.selectedSectionKey) }
    }
    @Published var settings: HanasandDesktopSettings {
        didSet { saveSettings() }
    }
    @Published var appearancePreference: AppearancePreference {
        didSet {
            UserDefaults.standard.set(appearancePreference.rawValue, forKey: Self.appearancePreferenceKey)
        }
    }
    @Published var focusCommand = false
    @Published var sidebarVisible = true {
        didSet { UserDefaults.standard.set(sidebarVisible, forKey: Self.sidebarVisibleKey) }
    }
    @Published var isRunning = false
    @Published var currentTaskState = "Idle"
    @Published var runHistory: [ControlRun] = [] {
        didSet { saveRunHistory() }
    }
    @Published var pendingApproval: ControlApproval?
    @Published var updateStatus = AppUpdateStatus.idle
    @Published var updateManifest: AppUpdateManifest?
    @Published var stagedUpdatePath: String?
    @Published var mailSummary = "Ready to load inbox"
    @Published var aiSummary = "Ready to connect"
    @Published var aiMessages: [AIChatMessage] = []
    @Published var aiTrace: [AITraceEvent] = []
    @Published var aiClients: [AIConnectedClient] = []
    @Published var aiSocketConnected = false
    @Published var aiActiveConversationID: String?
    @Published var aiRunStartedAt: Date?
    @Published var aiLastDuration = "No run yet"
    @Published var browserOpenRequest: BrowserOpenRequest?
    @Published var browserActiveAddress = "https://hanasand.com"
    @Published var browserActiveTitle = "Hanasand"
    @Published var ideOpenRequest: IDEOpenRequest?
    @Published var pendingIDEEdit: IDEPendingEdit?
    @Published var serverSummary = "Not checked"
    @Published var serverReachability: [ServerEndpointStatus] = []
    @Published var isCheckingServerReachability = false
    @Published var isRunningServerAction = false
    @Published var serverActionStatus = "No server action running"
    @Published var selectedDashboardPath: String?
    @Published var selectedDashboardTitle = "Dashboard"
    @Published var nativeDashboardPayload = "Select a dashboard card to load native data."
    @Published var nativeDashboardStatus = "Ready"
    @Published var isLoadingNativeDashboard = false
    @Published var backupServices: [DashboardBackupService] = []
    @Published var backupFiles: [DashboardBackupFile] = []
    @Published var notes: [DashboardNote] = []
    @Published var selectedNoteID = ""
    @Published var noteDraftTitle = ""
    @Published var noteDraftContent = ""
    @Published var mailOverview: MailOverviewEnvelope?
    @Published var selectedMailAccountUser = ""
    @Published var selectedMailMessageID = ""
    @Published var selectedMailboxID = ""
    @Published var mailComposeTo = ""
    @Published var mailComposeCc = ""
    @Published var mailComposeBcc = ""
    @Published var mailComposeReplyTo = ""
    @Published var mailComposeSubject = ""
    @Published var mailComposeBody = ""
    @Published var mailComposerExpanded = false
    @Published var mailDraftAttachments: [MailDraftAttachment] = []
    @Published var selectedMailMessageIDs: Set<String> = []
    @Published var mailMoveTargetMailboxName = ""
    @Published var mailNewMailboxName = ""
    @Published var mailFilterName = ""
    @Published var mailFilterContains = ""
    @Published var mailFilterTargetMailbox = ""
    @Published var mailLastSuccessAt: Date?
    @Published var mailBackgroundIssue = ""
    @Published var mailAutoRefreshEnabled = true
    @Published var shares: [DashboardShare] = []
    @Published var shareDraftName = ""
    @Published var shareDraftContent = ""
    @Published var selectedShareID = ""
    @Published var shareEditName = ""
    @Published var shareEditPath = ""
    @Published var shareEditContent = ""
    @Published var shareTrees: [String: [DashboardShareTreeItem]] = [:]
    @Published var articles: [DashboardArticle] = []
    @Published var articleDraftID = ""
    @Published var articleDraftContent = ""
    @Published var selectedArticleID = ""
    @Published var articleEditID = ""
    @Published var articleEditContent = ""
    @Published var thoughts: [DashboardThought] = []
    @Published var thoughtDraftTitle = ""
    @Published var selectedThoughtID = ""
    @Published var thoughtEditTitle = ""
    @Published var profile: DashboardProfile?
    @Published var profileSessions: [DashboardAuthSession] = []
    @Published var profileCertificates: [DashboardCertificate] = []
    @Published var users: [DashboardUser] = []
    @Published var selectedUserID = ""
    @Published var selectedUserRoles: [DashboardUserRoleAssignment] = []
    @Published var roles: [DashboardRole] = []
    @Published var roleDraftID = ""
    @Published var roleDraftName = ""
    @Published var roleDraftDescription = ""
    @Published var selectedRoleID = ""
    @Published var roleEditName = ""
    @Published var roleEditDescription = ""
    @Published var logs: [DashboardLogEntry] = []
    @Published var dockerContainers: [DashboardDockerContainer] = []
    @Published var virtualMachines: [DashboardVM] = []
    @Published var recentTests: [DashboardRecentTest] = []
    @Published var testDraftURL = ""
    @Published var testDraftTimeout = "30"
    @Published var testDraftStages = "30s:5, 1m:15"
    @Published var selectedTestDetail: DashboardRecentTest?
    @Published var serviceStatus: DashboardServiceStatus?
    @Published var linkDraftID = ""
    @Published var linkDraftPath = ""
    @Published var linkLookupID = ""
    @Published var linkLookupResult: DashboardShortcutLink?
    @Published var vulnerabilityReport: DashboardVulnerabilityReport?
    @Published var databaseOverview: DashboardDatabaseOverview?
    @Published var trafficMetrics: DashboardTrafficMetrics?
    @Published var rateLimitOverview: DashboardRateLimitOverview?
    @Published var apiKeys: [DashboardApiKeySummary] = []
    @Published var rateLimitKeyOwnerID = ""
    @Published var rateLimitKeyName = ""
    @Published var rateLimitKeyTier = "starter"
    @Published var rateLimitKeyRoute = ""
    @Published var rateLimitIssuedSecret: String?
    @Published var rateLimitOverrideRoute = ""
    @Published var rateLimitOverrideScope = "anonymous"
    @Published var rateLimitOverrideWindowMs = "60000"
    @Published var rateLimitOverrideMaxRequests = "60"
    @Published var uploadFileURL: URL?
    @Published var uploadName = ""
    @Published var uploadDescription = ""
    @Published var uploadPath = ""
    @Published var uploadType = "application/octet-stream"
    @Published var uploadStatus = "Choose a file to upload to the CDN."
    @Published var uploadedFileURL = ""
    @Published var isUploadingFile = false
    @Published var isCheckingUploadPath = false
    @Published var uploadPathAvailable: Bool?
    @Published var documentPages: [DesktopDocumentPage] = []
    @Published var documentStatus = "Import PDFs or images to build a document bundle."
    @Published var exportedDocumentPath = ""
    @Published var imageReviewItems: [DesktopImageReviewItem] = []
    @Published var imageReviewIndex = 0
    @Published var imageReviewDecisions: [UUID: ImageReviewDecision] = [:]
    @Published var imageReviewHistory: [UUID] = []
    @Published var imageReviewStatus = "Import images to start a deferred delete review."
    @Published var remoteControlSummary = "Ready for app control."
    @Published var remoteControlLastCommand = "None"
    @Published var remoteControlProofToken = "No app proof yet"
    @Published var remoteControlProofAt: Date?
    @Published var remoteControlRequests = 0

    private static let appearancePreferenceKey = "hanasand.desktop.appearancePreference"
    private static let settingsKey = "hanasand.desktop.settings"
    private static let runHistoryKey = "hanasand.desktop.controlRunHistory"
    private static let sidebarVisibleKey = "hanasand.desktop.sidebarVisible"
    private static let selectedSectionKey = "hanasand.desktop.selectedSection"
    private static let customProjectsKey = "hanasand.desktop.customProjects"
    private var server: LoopbackAgentServer?
    private var codexWorkerProcess: Process?
    private var updateTask: Task<Void, Never>?
    private var aiSocketTask: URLSessionWebSocketTask?
    private var aiReceiveTask: Task<Void, Never>?
    private var lastAutoVerifiedPasswordResetCode = ""

    init() {
        let saved = UserDefaults.standard.string(forKey: Self.appearancePreferenceKey)
        appearancePreference = AppearancePreference(rawValue: saved ?? "") ?? .system
        if let data = UserDefaults.standard.data(forKey: Self.settingsKey),
           let decoded = try? JSONDecoder().decode(HanasandDesktopSettings.self, from: data) {
            settings = decoded
        } else {
            settings = HanasandDesktopSettings()
        }
        if UserDefaults.standard.object(forKey: Self.sidebarVisibleKey) != nil {
            sidebarVisible = UserDefaults.standard.bool(forKey: Self.sidebarVisibleKey)
        }
        if let savedSection = UserDefaults.standard.string(forKey: Self.selectedSectionKey),
           let section = DesktopSection(rawValue: savedSection) {
            selectedSection = section
        }
        customProjectTitles = UserDefaults.standard.stringArray(forKey: Self.customProjectsKey) ?? []
        runHistory = Self.loadPersistedRunHistory()
        if let initialSection = ProcessInfo.processInfo.environment["HANASAND_DESKTOP_INITIAL_SECTION"],
           let section = DesktopSection(rawValue: initialSection) {
            selectedSection = section
        }
        if let initialDashboardPath = ProcessInfo.processInfo.environment["HANASAND_DESKTOP_INITIAL_DASHBOARD_PATH"],
           !initialDashboardPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            selectedSection = .dashboard
            selectedDashboardPath = initialDashboardPath
            selectedDashboardTitle = ProcessInfo.processInfo.environment["HANASAND_DESKTOP_INITIAL_DASHBOARD_TITLE"] ?? "Dashboard"
        }
    }

    func start() async {
        guard server == nil else { return }
        let next = LoopbackAgentServer(port: 45731) { [weak self] command in
            Task { @MainActor in
                self?.recordCommand(command)
            }
        }
        do {
            try next.start()
            server = next
            status = AgentStatus.ready(message: "online")
            append(meta: "Agent", body: "http://localhost:45731")
            startRemoteCodexWorkerIfAvailable()
            beginAutomaticUpdateCheck()
            Task { await checkServerReachability(silent: true) }
        } catch {
            status = AgentStatus.ready(ok: false, message: error.localizedDescription)
            append(meta: "Agent error", body: error.localizedDescription, kind: .error)
        }
    }

    func beginAutomaticUpdateCheck() {
        updateTask?.cancel()
        updateTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.checkForUpdates(automatic: true)
                let interval = Self.automaticUpdateCheckInterval
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
            }
        }
    }

    func startRemoteCodexWorkerIfAvailable() {
        guard ProcessInfo.processInfo.environment["HANASAND_DESKTOP_START_CODEX_WORKER"] == "1" else {
            append(meta: "Codex worker", body: "Remote worker is idle. Set HANASAND_DESKTOP_START_CODEX_WORKER=1 to enable local prompt polling.", kind: .note)
            return
        }
        guard codexWorkerProcess?.isRunning != true else { return }
        let scriptPath = "/Users/eirikhanasand/Desktop/personal/hanasand/app/desktop/scripts/codex-remote-worker.sh"
        guard FileManager.default.isExecutableFile(atPath: scriptPath) else {
            append(meta: "Codex worker", body: "Remote Codex worker script is not executable at \(scriptPath).", kind: .error)
            return
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: scriptPath)
        process.currentDirectoryURL = URL(fileURLWithPath: "/Users/eirikhanasand/Desktop/personal/hanasand")
        process.environment = ProcessInfo.processInfo.environment.merging([
            "HANASAND_CODEX_POLL_SECONDS": "2",
        ]) { _, new in new }
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        do {
            try process.run()
            codexWorkerProcess = process
            append(meta: "Codex worker", body: "Remote phone-to-Codex worker is running.", kind: .change)
        } catch {
            append(meta: "Codex worker failed", body: error.localizedDescription, kind: .error)
        }
    }

    func checkForUpdates(automatic: Bool = false) async {
        updateStatus = automatic ? .checking(message: "Checking") : .checking(message: "Checking")

        do {
            let manifest = try await AppUpdateClient().fetchManifest(currentVersion: Self.appVersion)
            updateManifest = manifest

            guard manifest.updateAvailable else {
                if manifest.hasNewerVersion(than: Self.appVersion) {
                    updateStatus = .unavailable(message: "Update feed is live. Version \(manifest.latestVersion) is listed, but no packaged desktop build is published yet.")
                } else {
                    updateStatus = .upToDate(message: "Hanasand Desktop \(Self.appVersion) is current.")
                }
                return
            }

            updateStatus = .downloading(message: "Downloading \(manifest.latestVersion)")
            let stagedPath = try await AppUpdateClient().download(manifest: manifest)
            stagedUpdatePath = stagedPath.path
            updateStatus = .ready(message: "Staged \(manifest.latestVersion)")
            append(meta: "Update", body: stagedPath.lastPathComponent, kind: .change)
        } catch {
            updateStatus = .failed(message: error.localizedDescription)
            if !automatic {
                append(meta: "Update failed", body: error.localizedDescription, kind: .error)
            }
        }
    }

    func revealStagedUpdate() {
        guard let stagedUpdatePath else { return }
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: stagedUpdatePath)])
    }

    func submitPrompt() {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isRunning else { return }
        prompt = ""
        runPrompt(trimmed)
    }

    func queuePrompt() {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        promptQueue.append(QueuedPrompt(text: trimmed))
        prompt = ""
        append(meta: "Queued", body: trimmed, kind: .note)
        if !isRunning {
            runNextQueuedPrompt()
        }
    }

    func runNextQueuedPrompt() {
        guard !isRunning, let next = promptQueue.first else { return }
        promptQueue.removeFirst()
        runPrompt(next.text)
    }

    func forceQueuedPrompt(_ item: QueuedPrompt) {
        guard let index = promptQueue.firstIndex(where: { $0.id == item.id }) else { return }
        let next = promptQueue.remove(at: index)
        if isRunning {
            promptQueue.insert(next, at: 0)
            append(meta: "Queued next", body: next.text, kind: .note)
        } else {
            runPrompt(next.text)
        }
    }

    func moveQueuedPrompt(_ item: QueuedPrompt, direction: Int) {
        guard let index = promptQueue.firstIndex(where: { $0.id == item.id }) else { return }
        let target = index + direction
        guard promptQueue.indices.contains(target) else { return }
        promptQueue.swapAt(index, target)
    }

    func moveQueuedPrompt(_ item: QueuedPrompt, before target: QueuedPrompt) {
        guard item.id != target.id,
              let sourceIndex = promptQueue.firstIndex(where: { $0.id == item.id }) else { return }
        let moving = promptQueue.remove(at: sourceIndex)
        let targetIndex = promptQueue.firstIndex(where: { $0.id == target.id }) ?? promptQueue.endIndex
        promptQueue.insert(moving, at: targetIndex)
    }

    func removeQueuedPrompt(_ item: QueuedPrompt) {
        promptQueue.removeAll { $0.id == item.id }
    }

    private func finishPromptRun() {
        isRunning = false
        currentTaskState = "Idle"
        runNextQueuedPrompt()
    }

    private func runPrompt(_ trimmed: String) {
        guard !trimmed.isEmpty, !isRunning else { return }
        if let approval = approvalForPrompt(trimmed) {
            requestApproval(approval)
            return
        }
        isRunning = true
        currentTaskState = "Running"
        append(meta: "You", body: trimmed, kind: .user)
        recordRun(title: "Prompt", detail: trimmed, kind: .user)

        let lowered = trimmed.lowercased()
        if (lowered.contains("start") || lowered.contains("boot")) && lowered.contains("server") {
            currentTaskState = "Starting server"
            Task { [weak self] in
                guard let self else { return }
                defer { self.finishPromptRun() }
                await self.runServerAction(self.settings.serverStartPath)
            }
        } else if lowered.contains("server") && (lowered.contains("log") || lowered.contains("tail")) {
            currentTaskState = "Loading logs"
            Task { [weak self] in
                guard let self else { return }
                defer { self.finishPromptRun() }
                await self.checkServerLogs()
            }
        } else if lowered == "status" || lowered.contains("status") || lowered.contains("pc") || lowered.contains("this mac") {
            recordCommand("status")
            finishPromptRun()
        } else if lowered == "vpn" || lowered.contains("open vpn") || lowered.contains("connect vpn") || lowered.contains("cisco") {
            openVPN()
            finishPromptRun()
        } else if lowered.contains("mail") || lowered.contains("inbox") {
            selectedSection = .mail
            currentTaskState = "Loading mail"
            Task { [weak self] in
                guard let self else { return }
                defer { self.finishPromptRun() }
                await self.loadMailOverview()
            }
        } else if lowered.contains("note") {
            openNativeDashboard(path: "/dashboard/notes", label: "Notes")
            finishPromptRun()
        } else if lowered.contains("document") || lowered.contains("pdf") || lowered.contains("scan") {
            selectedSection = .documents
            append(meta: "Navigation", body: "Opened Documents.", kind: .command)
            recordRun(title: "Documents", detail: "Opened document workflow", kind: .command)
            finishPromptRun()
        } else if lowered.contains("image") || lowered.contains("photo") {
            selectedSection = .images
            append(meta: "Navigation", body: "Opened Images.", kind: .command)
            recordRun(title: "Images", detail: "Opened image review workflow", kind: .command)
            finishPromptRun()
        } else if lowered.contains("share") {
            openNativeDashboard(path: "/s", label: "Shares")
            finishPromptRun()
        } else if lowered.contains("link") {
            openNativeDashboard(path: "/g", label: "Links")
            finishPromptRun()
        } else if lowered.contains("backup") {
            openNativeDashboard(path: "/dashboard/db/backups", label: "Backups")
            finishPromptRun()
        } else if lowered.contains("vulnerabil") || lowered.contains("security scan") {
            openNativeDashboard(path: "/dashboard/vulnerabilities", label: "Vulnerabilities")
            finishPromptRun()
        } else if lowered.contains("traffic") {
            openNativeDashboard(path: "/dashboard/traffic", label: "Traffic")
            finishPromptRun()
        } else if lowered.contains("server") || lowered.contains("logs") {
            Task { [weak self] in
                guard let self else { return }
                defer { self.finishPromptRun() }
                await self.checkServerLogs()
            }
        } else if lowered.contains("models") {
            Task { [weak self] in
                guard let self else { return }
                defer { self.finishPromptRun() }
                await self.loadAiModels()
            }
        } else if lowered == "update" || lowered.contains("update") {
            recordCommand("update")
            currentTaskState = "Checking updates"
            finishPromptRun()
        } else {
            Task { [weak self] in
                guard let self else { return }
                defer { self.finishPromptRun() }

                do {
                    let response = try await HanasandAIClient(
                        apiURL: settings.resolvedAIEndpoint,
                        token: authTokenForRequests,
                        userId: userIDForRequests
                    ).send(
                        prompt: trimmed,
                        context: status.aiContext
                    )
                    append(meta: response.meta, body: response.body, kind: .command)
                    recordRun(title: response.meta, detail: response.body, kind: .command)
                } catch {
                    append(meta: "AI error", body: error.localizedDescription, kind: .error)
                    recordRun(title: "AI error", detail: error.localizedDescription, kind: .error)
                }
            }
        }
    }

    func runStatusCommand() {
        recordCommand("status")
    }

    private func approvalForPrompt(_ command: String) -> ControlApproval? {
        let lowered = command.lowercased()
        if lowered.contains("rm -rf") || lowered.contains("reset --hard") || lowered.contains("erase all content") {
            return ControlApproval(
                title: "Blocked command",
                detail: "This desktop surface will not run destructive shell commands. Use Terminal after manual review.",
                command: command,
                kind: .blocked
            )
        }
        if lowered == "stop" || lowered.contains("stop server") || lowered.contains("restart server") || lowered.contains("shutdown server") {
            return ControlApproval(
                title: "Approve server stop",
                detail: "This can interrupt active sessions on the Hanasand server.",
                command: command,
                kind: .stopServer
            )
        }
        if lowered.contains("tunnel") || lowered.contains("remote desktop") || lowered.contains("control this mac") {
            return ControlApproval(
                title: "Approve remote tunnel",
                detail: "This opens the configured tunnel command in Terminal.",
                command: command,
                kind: .openTunnel
            )
        }
        if lowered.contains("trash images") || lowered.contains("delete images") || lowered.contains("discard images") {
            return ControlApproval(
                title: "Approve image trash",
                detail: "Moves every image marked discard to macOS Trash.",
                command: command,
                kind: .trashImages
            )
        }
        if lowered.contains("clear documents") || lowered.contains("clear pages") || lowered.contains("delete pages") {
            return ControlApproval(
                title: "Approve document clear",
                detail: "Removes all imported document pages from this local bundle.",
                command: command,
                kind: .clearDocuments
            )
        }
        return nil
    }

    func requestStopServerApproval() {
        requestApproval(ControlApproval(
            title: "Approve server stop",
            detail: "This can interrupt active sessions on the Hanasand server.",
            command: settings.serverStopPath,
            kind: .stopServer
        ))
    }

    func requestRemoteTunnelApproval() {
        requestApproval(ControlApproval(
            title: "Approve remote tunnel",
            detail: "This opens the configured tunnel command in Terminal.",
            command: settings.remoteDesktopTunnelCommand,
            kind: .openTunnel
        ))
    }

    func requestTrashImagesApproval() {
        requestApproval(ControlApproval(
            title: "Approve image trash",
            detail: "Moves every image marked discard to macOS Trash.",
            command: "trash discarded images",
            kind: .trashImages
        ))
    }

    func requestClearDocumentsApproval() {
        requestApproval(ControlApproval(
            title: "Approve document clear",
            detail: "Removes all imported document pages from this local bundle.",
            command: "clear document pages",
            kind: .clearDocuments
        ))
    }

    func requestApproval(_ approval: ControlApproval) {
        pendingApproval = approval
        currentTaskState = approval.kind == .blocked ? "Blocked" : "Waiting for approval"
        append(meta: approval.title, body: approval.detail, kind: approval.kind == .blocked ? .error : .note)
        recordRun(title: approval.title, detail: approval.command, kind: approval.kind == .blocked ? .error : .note)
    }

    func cancelPendingApproval() {
        guard let approval = pendingApproval else { return }
        pendingApproval = nil
        currentTaskState = "Idle"
        append(meta: "Approval cancelled", body: approval.command, kind: .note)
        recordRun(title: "Approval cancelled", detail: approval.command, kind: .note)
    }

    func approvePendingAction() {
        guard let approval = pendingApproval else { return }
        pendingApproval = nil

        if approval.kind == .blocked {
            currentTaskState = "Blocked"
            append(meta: "Blocked", body: approval.command, kind: .error)
            recordRun(title: "Blocked", detail: approval.command, kind: .error)
            return
        }

        currentTaskState = "Approved"
        append(meta: "Approved", body: approval.command, kind: .command)
        recordRun(title: "Approved", detail: approval.command, kind: .command)

        switch approval.kind {
        case .stopServer:
            Task { [weak self] in
                guard let self else { return }
                self.currentTaskState = "Stopping server"
                await self.runServerAction(self.settings.serverStopPath)
                self.currentTaskState = "Idle"
            }
        case .openTunnel:
            openRemoteDesktopTunnel()
            currentTaskState = "Tunnel requested"
        case .trashImages:
            trashDiscardedImages()
            currentTaskState = "Idle"
        case .clearDocuments:
            clearDocumentPages()
            currentTaskState = "Idle"
        case .blocked:
            break
        }
    }

    private func recordRun(title: String, detail: String, kind: AgentEvent.Kind = .command) {
        runHistory.insert(ControlRun(title: title, detail: detail, kind: kind), at: 0)
        if runHistory.count > 24 {
            runHistory.removeLast(runHistory.count - 24)
        }
    }

    private static func loadPersistedRunHistory() -> [ControlRun] {
        guard let data = UserDefaults.standard.data(forKey: runHistoryKey),
              let persisted = try? JSONDecoder().decode([PersistedControlRun].self, from: data) else {
            return []
        }
        return persisted.map(\.controlRun)
    }

    private func saveRunHistory() {
        let persisted = runHistory.map(PersistedControlRun.init)
        if let data = try? JSONEncoder().encode(persisted) {
            UserDefaults.standard.set(data, forKey: Self.runHistoryKey)
        }
    }

    func reuseControlRun(_ run: ControlRun) {
        selectedSection = .control
        prompt = run.detail
        focusCommand.toggle()
        currentTaskState = "Ready"
        append(meta: "Reused", body: run.detail, kind: .note)
    }

    func clearControlRunHistory() {
        runHistory = []
        currentTaskState = "History cleared"
        append(meta: "Run history", body: "Cleared local control-plane history.", kind: .note)
    }

    var serverReachabilitySummary: String {
        guard !serverReachability.isEmpty else { return "Unchecked" }
        let reachable = serverReachability.filter { $0.isReachable == true }.count
        let blocked = serverReachability.filter { $0.isReachable == false }.count
        if blocked > 0 {
            return "\(blocked) blocked"
        }
        return "\(reachable) reachable"
    }

    var serverReachabilityCheckedText: String {
        guard let checkedAt = serverReachability.map(\.checkedAt).max() else { return "Never checked" }
        return "Checked \(DateFormatter.localizedString(from: checkedAt, dateStyle: .none, timeStyle: .short))"
    }

    var isServerBusy: Bool {
        isCheckingServerReachability || isRunningServerAction
    }

    var remoteDesktopProtocolLabel: String {
        (RemoteDesktopProtocol(rawValue: settings.remoteDesktopProtocol) ?? .screenSharing).label
    }

    var remoteDesktopProtocolIcon: String {
        (RemoteDesktopProtocol(rawValue: settings.remoteDesktopProtocol) ?? .screenSharing).icon
    }

    var remoteDesktopTargetSummary: String {
        let host = settings.rdpHost.trimmingCharacters(in: .whitespacesAndNewlines)
        let user = settings.rdpUser.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !host.isEmpty else { return "No target configured" }
        return user.isEmpty ? host : "\(user)@\(host)"
    }

    var remoteControlProofSummary: String {
        guard let remoteControlProofAt else { return remoteControlProofToken }
        let time = DateFormatter.localizedString(from: remoteControlProofAt, dateStyle: .none, timeStyle: .medium)
        return "\(remoteControlProofToken) · \(time)"
    }

    func resetNativeLayout() {
        UserDefaults.standard.removeObject(forKey: "hanasand.desktop.sidebarWidth")
        UserDefaults.standard.removeObject(forKey: "hanasand.desktop.windowFrame")
        sidebarVisible = true
        selectedSection = .control
        currentTaskState = "Layout reset"
        append(meta: "Layout", body: "Reset sidebar, window frame, and active section.", kind: .note)
    }

    func toggleFullScreen() {
        NSApplication.shared.keyWindow?.toggleFullScreen(nil)
    }

    func zoomWindow() {
        NSApplication.shared.keyWindow?.zoom(nil)
    }

    func minimizeWindow() {
        NSApplication.shared.keyWindow?.miniaturize(nil)
    }

    func openMiniBrowser(url: String = "https://www.youtube.com/@fern-tv", title: String = "Fern", minified: Bool = false) {
        MiniBrowserWindowController.shared.open(url: url, title: title, minified: minified)
        selectedSection = .browser
        append(meta: "Mini browser", body: minified ? "Opened minified \(title)." : "Opened floating \(title).", kind: .command)
    }

    func openInlineBrowser(url rawValue: String, title rawTitle: String? = nil, source: String = "Agent") {
        let resolved = BrowserTargetResolver.resolve(rawValue)
        let title = rawTitle?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? rawTitle! : resolved.title
        browserActiveAddress = resolved.url
        browserActiveTitle = title
        browserOpenRequest = BrowserOpenRequest(title: title, url: resolved.url)
        selectedSection = .browser
        append(meta: "Browser", body: "\(source) opened \(resolved.url) in the built-in browser.", kind: .command)
    }

    func popOutBrowser(url rawValue: String? = nil, title rawTitle: String? = nil, minified: Bool = false, source: String = "Agent") {
        let resolved: (url: String, title: String)
        if let rawValue, !rawValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let target = BrowserTargetResolver.resolve(rawValue)
            resolved = (target.url, rawTitle?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? rawTitle! : target.title)
        } else {
            resolved = (browserActiveAddress, rawTitle?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? rawTitle! : browserActiveTitle)
        }
        browserActiveAddress = resolved.url
        browserActiveTitle = resolved.title
        openMiniBrowser(url: resolved.url, title: resolved.title, minified: minified)
        append(meta: "Browser", body: "\(source) popped out \(resolved.url).", kind: .command)
    }

    func openIDEFile(_ rawPath: String, line: Int? = nil, revealDiff: Bool = false, source: String = "Agent") {
        let resolvedPath = resolveWorkspacePath(rawPath)
        ideOpenRequest = IDEOpenRequest(path: resolvedPath, line: line, revealDiff: revealDiff)
        selectedSection = .ide
        append(meta: "IDE", body: "\(source) opened \(resolvedPath)\(line.map { ":\($0)" } ?? "").", kind: .command)
    }

    func createPendingIDEEdit(_ command: IDEEditChatCommand, source: String = "AI chat") {
        let resolvedPath = resolveWorkspacePath(command.path)
        guard FileManager.default.fileExists(atPath: resolvedPath),
              let original = try? String(contentsOfFile: resolvedPath, encoding: .utf8) else {
            aiMessages.append(AIChatMessage(role: .assistant, content: "I could not find \(command.path) to prepare that edit."))
            append(meta: "IDE edit", body: "Missing file \(resolvedPath)", kind: .error)
            return
        }

        let edit = IDEPendingEdit.prepare(command: command, path: resolvedPath, original: original)
        pendingIDEEdit = edit
        aiMessages.append(AIChatMessage(role: .assistant, content: "Prepared an edit preview for \(URL(fileURLWithPath: resolvedPath).lastPathComponent). Review it below, then apply it when ready."))
        append(meta: "IDE edit", body: "\(source) prepared \(edit.title)", kind: .command)
    }

    func applyPendingIDEEdit() {
        guard let edit = pendingIDEEdit else { return }
        do {
            switch edit.kind {
            case .patch:
                let patchURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("hanasand-\(edit.id.uuidString).patch")
                try edit.replacement.write(to: patchURL, atomically: true, encoding: .utf8)
                let result = Self.executeShellWithStatus("git apply \(Self.shellQuoted(patchURL.path))", cwd: FileManager.default.currentDirectoryPath)
                guard result.exitCode == 0 else {
                    aiMessages.append(AIChatMessage(role: .assistant, content: "Patch failed:\n\(result.output)", isError: true))
                    return
                }
            case .replaceLine, .insertAfterLine:
                try edit.updated.write(toFile: edit.path, atomically: true, encoding: .utf8)
            }
            openIDEFile(edit.path, line: edit.line, revealDiff: true, source: "AI edit")
            aiMessages.append(AIChatMessage(role: .assistant, content: "Applied \(edit.title) and opened the file in the IDE."))
            pendingIDEEdit = nil
        } catch {
            aiMessages.append(AIChatMessage(role: .assistant, content: error.localizedDescription, isError: true))
        }
    }

    func discardPendingIDEEdit() {
        pendingIDEEdit = nil
        aiMessages.append(AIChatMessage(role: .assistant, content: "Discarded the pending file edit."))
    }

    func previewChangedFile(_ rawPath: String) {
        let resolvedPath = resolveWorkspacePath(rawPath)
        if FileManager.default.fileExists(atPath: resolvedPath) {
            NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: resolvedPath)])
            append(meta: "Preview", body: "Revealed \(resolvedPath)", kind: .command)
        } else {
            openInlineBrowser(url: rawPath, title: URL(fileURLWithPath: rawPath).lastPathComponent, source: "File preview")
        }
    }

    private func resolveWorkspacePath(_ rawPath: String) -> String {
        let clean = rawPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return clean }
        if clean.hasPrefix("/") { return clean }
        let roots = [
            FileManager.default.currentDirectoryPath,
            "/Users/eirikhanasand/Desktop/personal/hanasand",
            status.cwd,
        ]
        for root in roots where !root.isEmpty {
            let candidate = URL(fileURLWithPath: root, isDirectory: true).appendingPathComponent(clean).path
            if FileManager.default.fileExists(atPath: candidate) {
                return candidate
            }
        }
        return URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true).appendingPathComponent(clean).path
    }

    func recordCommand(_ command: String) {
        recordRun(title: "Command", detail: command, kind: .command)
        if command == "status" {
            status = AgentStatus.ready(message: "status command executed")
            append(meta: "Status", body: "\(status.hostname) · \(status.platform) · \(Int(status.uptimeSeconds / 60)) min", kind: .command)
        } else if command == "remote_desktop_status" {
            showRemoteDesktopStatus(source: "Hanasand app")
        } else if command == "remote_desktop_proof" {
            runRemoteDesktopProof(source: "Hanasand app")
        } else if command == "remote_desktop_connect" {
            selectedSection = .server
            activateForRemoteControl()
            markRemoteDesktopCommand("Connect", detail: "Opening \(remoteDesktopProtocolLabel) for \(remoteDesktopTargetSummary).")
            openRemoteDesktop()
        } else if command == "remote_desktop_tunnel" {
            selectedSection = .server
            activateForRemoteControl()
            markRemoteDesktopCommand("Tunnel approval", detail: "App requested the configured remote desktop tunnel.")
            requestRemoteTunnelApproval()
        } else if command == "remote_desktop_macmini" {
            selectedSection = .server
            activateForRemoteControl()
            configureMacMiniRemoteDesktop()
            markRemoteDesktopCommand("Mac mini profile", detail: "Configured Mac mini Screen Sharing target.")
        } else if command == "mac_control_textedit_proof" {
            openTextEditRemoteProof()
        } else if command == "mac_control_keyboard_proof" {
            typeKeyboardRemoteProof()
        } else if command == "mac_control_full_proof" {
            runFullRemoteControlProof()
        } else if command == "mac_control_authorize" {
            openRemoteControlPermissions()
        } else if command.hasPrefix("codex_prompt:") {
            runRemoteCodexPrompt(Self.commandPayload(after: "codex_prompt:", in: command))
        } else if command.hasPrefix("mac_control_type_text:") {
            typeRemoteText(Self.commandPayload(after: "mac_control_type_text:", in: command))
        } else if command == "mac_control_key_search" {
            pressRemoteSearch()
        } else if command == "mac_control_key_enter" {
            pressRemoteEnter()
        } else if command == "mac_control_pointer_move" {
            movePointerRemoteProof()
        } else if command == "mac_control_pointer_click" {
            clickPointerRemoteProof()
        } else if command.hasPrefix("mac_control_pointer_click_at:") {
            clickPointerRemoteProof(at: Self.normalizedPointerPoint(from: command))
        } else if command == "mac_control_finder" {
            openFinderRemoteProof()
        } else if command == "update" {
            beginAutomaticUpdateCheck()
            append(meta: "Update", body: "/api/app", kind: .command)
        } else if command == "ai_train_app_parity" {
            selectedSection = .ai
            append(meta: "AI training", body: "Queued app-parity drill through the Desktop app runtime.", kind: .command)
            Task { @MainActor in
                await loadAIPage()
                submitAppParityTrainingPrompt()
            }
        } else if command == "ai_audit_desktop_ui" {
            selectedSection = .ai
            append(meta: "AI training", body: "Queued Desktop UI audit through the Desktop app runtime.", kind: .command)
            Task { @MainActor in
                await loadAIPage()
                submitDesktopUIAuditPrompt()
            }
        } else if command == "ai_reload" {
            selectedSection = .ai
            append(meta: "AI", body: "Reloading models and websocket from loopback command.", kind: .command)
            Task { @MainActor in
                await loadAIPage()
            }
        } else if command == "open_section_command" {
            selectedSection = .command
            append(meta: "Navigation", body: "Opened Command section.", kind: .command)
        } else if command == "open_section_control" {
            selectedSection = .control
            append(meta: "Navigation", body: "Opened Control section.", kind: .command)
        } else if command == "open_section_dashboard" {
            selectedSection = .dashboard
            append(meta: "Navigation", body: "Opened Dashboard section.", kind: .command)
        } else if command == "open_section_workspace" {
            selectedSection = .browser
            append(meta: "Navigation", body: "Opened Workspace section.", kind: .command)
        } else if command.hasPrefix("browser_open:") {
            openInlineBrowser(url: Self.commandPayload(after: "browser_open:", in: command) ?? "", source: "Loopback")
        } else if command.hasPrefix("browser_popout:") {
            popOutBrowser(url: Self.commandPayload(after: "browser_popout:", in: command), minified: false, source: "Loopback")
        } else if command == "browser_mini_fern" {
            openMiniBrowser(minified: true)
        } else if command == "browser_popout_fern" {
            openMiniBrowser(minified: false)
        } else if command == "open_section_ide" {
            selectedSection = .ide
            append(meta: "Navigation", body: "Opened IDE section.", kind: .command)
        } else if command == "open_section_mac" {
            selectedSection = .mac
            append(meta: "Navigation", body: "Opened This Mac section.", kind: .command)
        } else if command == "open_section_mail" {
            selectedSection = .mail
            append(meta: "Navigation", body: "Opened Mail section.", kind: .command)
        } else if command == "open_section_documents" {
            selectedSection = .documents
            append(meta: "Navigation", body: "Opened Documents section.", kind: .command)
        } else if command == "open_section_images" {
            selectedSection = .images
            append(meta: "Navigation", body: "Opened Images section.", kind: .command)
        } else if command == "open_section_ai" {
            selectedSection = .ai
            append(meta: "Navigation", body: "Opened Hanasand AI section.", kind: .command)
        } else if command == "open_section_server" {
            selectedSection = .server
            append(meta: "Navigation", body: "Opened Server section.", kind: .command)
        } else if command == "open_section_updates" {
            selectedSection = .updates
            append(meta: "Navigation", body: "Opened Updates section.", kind: .command)
        } else if command == "open_section_settings" {
            selectedSection = .settings
            append(meta: "Navigation", body: "Opened Settings section.", kind: .command)
        } else if command == "dashboard_refresh" {
            selectedSection = .dashboard
            append(meta: "Dashboard", body: "Refreshing selected dashboard panel from loopback command.", kind: .command)
            Task { @MainActor in
                await loadNativeDashboardData()
            }
        } else if command == "open_dashboard_mail" {
            openNativeDashboard(path: "/dashboard/mail", label: "Mail")
            append(meta: "Dashboard", body: "Opened native Mail panel.", kind: .command)
        } else if command == "open_dashboard_articles" {
            openNativeDashboard(path: "/dashboard/articles", label: "Articles")
            append(meta: "Dashboard", body: "Opened native Articles panel.", kind: .command)
        } else if command == "open_dashboard_thoughts" {
            openNativeDashboard(path: "/dashboard/thoughts", label: "Thoughts")
            append(meta: "Dashboard", body: "Opened native Thoughts panel.", kind: .command)
        } else if command == "open_dashboard_shares" {
            openNativeDashboard(path: "/s", label: "Shares")
            append(meta: "Dashboard", body: "Opened native Shares panel.", kind: .command)
        } else if command == "open_dashboard_links" {
            openNativeDashboard(path: "/g", label: "Links")
            append(meta: "Dashboard", body: "Opened native Links panel.", kind: .command)
        } else if command == "open_dashboard_tests" {
            openNativeDashboard(path: "/dashboard/tests", label: "Load Tests")
            append(meta: "Dashboard", body: "Opened native Load Tests panel.", kind: .command)
        } else if command == "open_dashboard_profile" {
            openNativeDashboard(path: "/profile", label: "Profile")
            append(meta: "Dashboard", body: "Opened native Profile panel.", kind: .command)
        } else if command == "open_dashboard_users" {
            openNativeDashboard(path: "/users", label: "Users")
            append(meta: "Dashboard", body: "Opened native Users panel.", kind: .command)
        } else if command == "open_dashboard_roles" {
            openNativeDashboard(path: "/role", label: "Roles")
            append(meta: "Dashboard", body: "Opened native Roles panel.", kind: .command)
        } else if command == "open_dashboard_logs" {
            openNativeDashboard(path: "/dashboard/logs", label: "Logs")
            append(meta: "Dashboard", body: "Opened native Logs panel.", kind: .command)
        } else if command == "open_dashboard_system" {
            openNativeDashboard(path: "/dashboard/system", label: "System")
            append(meta: "Dashboard", body: "Opened native System panel.", kind: .command)
        } else if command == "open_dashboard_vms" {
            openNativeDashboard(path: "/dashboard/vms", label: "VMs")
            append(meta: "Dashboard", body: "Opened native VMs panel.", kind: .command)
        } else if command == "open_dashboard_ai_models" {
            openNativeDashboard(path: "/dashboard/system/ai", label: "AI models")
            append(meta: "Dashboard", body: "Opened native AI models panel.", kind: .command)
        } else if command == "open_dashboard_notes" {
            openNativeDashboard(path: "/dashboard/notes", label: "Notes")
            append(meta: "Dashboard", body: "Opened native Notes panel.", kind: .command)
        } else if command == "open_dashboard_db" {
            openNativeDashboard(path: "/dashboard/db", label: "Databases")
            append(meta: "Dashboard", body: "Opened native Databases panel.", kind: .command)
        } else if command == "open_dashboard_backups" {
            openNativeDashboard(path: "/dashboard/db/backups", label: "Backups")
            append(meta: "Dashboard", body: "Opened native Backups panel.", kind: .command)
        } else if command == "open_dashboard_restore" {
            openNativeDashboard(path: "/dashboard/db/restore", label: "Restore")
            append(meta: "Dashboard", body: "Opened native Restore panel.", kind: .command)
        } else if command == "open_dashboard_vulnerabilities" {
            openNativeDashboard(path: "/dashboard/vulnerabilities", label: "Vulnerabilities")
            append(meta: "Dashboard", body: "Opened native Vulnerabilities panel.", kind: .command)
        } else if command == "open_dashboard_rate_limits" {
            openNativeDashboard(path: "/dashboard/system/rate-limits", label: "Rate limits")
            append(meta: "Dashboard", body: "Opened native Rate limits panel.", kind: .command)
        } else if command == "open_dashboard_traffic" {
            openNativeDashboard(path: "/dashboard/traffic", label: "Traffic")
            append(meta: "Dashboard", body: "Opened native Traffic panel.", kind: .command)
        } else if command == "server_logs" {
            selectedSection = .server
            append(meta: "Server logs", body: "Loading server logs from loopback command.", kind: .command)
            Task { @MainActor in
                await checkServerLogs()
            }
        } else if command == "settings_summary" {
            selectedSection = .settings
            append(meta: "Settings", body: settings.loopbackSummary, kind: .command)
        } else {
            append(meta: "Blocked", body: command, kind: .error)
        }
    }

    func refreshLocalStatus() async {
        currentTaskState = "Checking this Mac"
        do {
            let loaded: AgentStatus = try await requestJSON(settings.desktopAgentBaseURL.normalizedBaseURL.appendingPathComponent("status"))
            status = loaded
            append(meta: "This Mac", body: "\(loaded.hostname) · \(loaded.platform) · \(Int(loaded.uptimeSeconds / 60)) min", kind: .command)
            recordRun(title: "This Mac", detail: loaded.message, kind: .command)
        } catch {
            status = AgentStatus.ready(ok: false, message: error.localizedDescription)
            append(meta: "This Mac", body: error.localizedDescription, kind: .error)
            recordRun(title: "This Mac error", detail: error.localizedDescription, kind: .error)
        }
        currentTaskState = "Idle"
    }

    func loadMailOverview(silent: Bool = false) async {
        guard hasHanasandAuth else {
            mailSummary = "Setup needed."
            if silent {
                mailBackgroundIssue = mailSummary
            } else {
                append(meta: "Mail", body: mailSummary, kind: .error)
            }
            return
        }

        do {
            let overview: MailOverviewEnvelope = try await requestJSON(
                mailOverviewURL(),
                authenticated: true
            )
            mailOverview = overview
            selectedMailAccountUser = overview.mailboxUser ?? selectedMailAccountUser
            selectedMailboxID = overview.selectedMailboxId ?? selectedMailboxID
            selectedMailMessageID = overview.selectedMessage?.id ?? overview.messages.first?.id ?? selectedMailMessageID
            selectedMailMessageIDs = selectedMailMessageIDs.intersection(Set(overview.messages.map(\.id)))
            if let mailboxName = overview.mailboxes.first(where: { $0.id == selectedMailboxID })?.displayName, mailMoveTargetMailboxName.isEmpty {
                mailMoveTargetMailboxName = mailboxName
            }
            mailLastSuccessAt = Date()
            mailBackgroundIssue = ""
            mailSummary = "\(overview.messages.count) messages · \(overview.mailboxes.count) mailboxes"
            if !silent {
                append(meta: "Mail", body: mailSummary, kind: .command)
            }
        } catch {
            if silent {
                mailBackgroundIssue = error.localizedDescription
            } else {
                mailSummary = error.localizedDescription
                append(meta: "Mail", body: error.localizedDescription, kind: .error)
            }
        }
    }

    func selectMailbox(_ mailbox: MailOverviewEnvelope.Mailbox) async {
        selectedMailboxID = mailbox.id
        selectedMailMessageID = ""
        selectedMailMessageIDs = []
        mailMoveTargetMailboxName = mailbox.displayName
        await loadMailOverview()
    }

    func selectMailAccount(_ account: MailOverviewEnvelope.Account) async {
        selectedMailAccountUser = account.id
        selectedMailboxID = ""
        selectedMailMessageID = ""
        selectedMailMessageIDs = []
        mailOverview = nil
        mailSummary = "Loading \(account.address)"
        append(meta: "Mail account", body: account.address, kind: .command)
        await loadMailOverview()
    }

    func selectMailMessage(_ message: MailOverviewEnvelope.Message) async {
        selectedMailMessageID = message.id
        await loadMailOverview()
    }

    func toggleMailSelection(_ message: MailOverviewEnvelope.Message) {
        if selectedMailMessageIDs.contains(message.id) {
            selectedMailMessageIDs.remove(message.id)
        } else {
            selectedMailMessageIDs.insert(message.id)
        }
    }

    func selectAllVisibleMailMessages(_ messages: [MailOverviewEnvelope.Message]) {
        selectedMailMessageIDs = Set(messages.map(\.id))
        mailSummary = "Selected \(selectedMailMessageIDs.count) messages"
    }

    func clearMailSelection() {
        selectedMailMessageIDs = []
        mailSummary = "Cleared selection"
    }

    func runSelectedMailAction(_ action: String) async {
        guard let message = selectedMailMessage else { return }
        await runMailAction(action, message: message)
    }

    func toggleSelectedMailReadState() async {
        guard let message = selectedMailMessage else { return }
        await runMailAction(message.isRead == true ? "unread" : "read", message: message)
    }

    func toggleSelectedMailFlagState() async {
        guard let message = selectedMailMessage else { return }
        await runMailAction(message.isFlagged == true ? "unflag" : "flag", message: message)
    }

    func moveSelectedMail(to mailbox: MailOverviewEnvelope.Mailbox) async {
        let messages = selectedMailMessages
        guard !messages.isEmpty else {
            mailMoveTargetMailboxName = mailbox.displayName
            return
        }
        mailMoveTargetMailboxName = mailbox.displayName
        await runBulkMailAction("move", messages: messages, targetMailboxId: mailbox.id, targetMailboxName: mailbox.displayName)
    }

    func runBulkMailAction(_ action: String, messages: [MailOverviewEnvelope.Message]? = nil, targetMailboxId: String? = nil, targetMailboxName: String? = nil) async {
        let targets = messages ?? selectedMailMessages
        guard !targets.isEmpty else {
            mailSummary = "Select messages first."
            return
        }
        for message in targets {
            await runMailAction(action, message: message, targetMailboxId: targetMailboxId, targetMailboxName: targetMailboxName, reload: false)
        }
        selectedMailMessageIDs = []
        mailSummary = "\(action.capitalized) applied to \(targets.count) messages"
        await loadMailOverview()
    }

    var selectedMailMessage: MailOverviewEnvelope.Message? {
        mailOverview?.selectedMessage
            ?? mailOverview?.messages.first(where: { $0.id == selectedMailMessageID })
            ?? mailOverview?.messages.first
    }

    var selectedMailMessages: [MailOverviewEnvelope.Message] {
        guard let overview = mailOverview else { return [] }
        return overview.messages.filter { selectedMailMessageIDs.contains($0.id) }
    }

    func runMailAction(_ action: String, message: MailOverviewEnvelope.Message, targetMailboxId: String? = nil, targetMailboxName: String? = nil, reload: Bool = true) async {
        guard hasHanasandAuth else {
            mailSummary = "Setup needed."
            append(meta: "Mail action", body: mailSummary, kind: .error)
            return
        }

        do {
            let payload = [
                "mailboxUser": mailOverview?.mailboxUser ?? "",
                "action": action,
                "targetMailboxId": targetMailboxId ?? "",
                "targetMailboxName": targetMailboxName ?? "",
            ]
            let body = try JSONEncoder().encode(payload)
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("mail/message/\(message.id)/action"),
                method: "POST",
                body: body,
                authenticated: true
            )
            mailSummary = "Mail action: \(action)"
            append(meta: "Mail action", body: text.isEmpty ? action : String(text.prefix(240)), kind: .change)
            if reload {
                await loadMailOverview()
            }
        } catch {
            mailSummary = error.localizedDescription
            append(meta: "Mail action failed", body: error.localizedDescription, kind: .error)
        }
    }

    func selectNextMailMessage(offset: Int) async {
        guard let messages = mailOverview?.messages, !messages.isEmpty else { return }
        let currentIndex = messages.firstIndex(where: { $0.id == selectedMailMessageID }) ?? 0
        let nextIndex = min(max(currentIndex + offset, 0), messages.count - 1)
        await selectMailMessage(messages[nextIndex])
    }

    func composeReplyToSelectedMail() {
        guard let message = selectedMailMessage else { return }
        let replyAddress = (message.replyTo?.first ?? message.from.first)?.displayName ?? ""
        mailComposeTo = replyAddress
        mailComposeCc = ""
        mailComposeBcc = ""
        mailComposeReplyTo = ""
        mailComposeSubject = message.subjectLabel.lowercased().hasPrefix("re:") ? message.subjectLabel : "Re: \(message.subjectLabel)"
        mailComposeBody = "\n\nOn \(message.dateLabel), \(message.fromLabel) wrote:\n\(quoteMailBody(message.bodyText))"
        mailDraftAttachments = []
        mailComposerExpanded = true
        mailSummary = "Replying to \(message.fromLabel)"
    }

    func composeReplyAllToSelectedMail() {
        guard let message = selectedMailMessage else { return }
        let currentAddress = mailOverview?.mailboxAddress?.lowercased() ?? ""
        let recipients = (message.from + message.to + (message.cc ?? []))
            .filter { !$0.email.lowercased().isEmpty && $0.email.lowercased() != currentAddress }
        mailComposeTo = uniqueMailAddresses(recipients).map(\.displayName).joined(separator: ", ")
        mailComposeCc = ""
        mailComposeBcc = ""
        mailComposeReplyTo = ""
        mailComposeSubject = message.subjectLabel.lowercased().hasPrefix("re:") ? message.subjectLabel : "Re: \(message.subjectLabel)"
        mailComposeBody = "\n\nOn \(message.dateLabel), \(message.fromLabel) wrote:\n\(quoteMailBody(message.bodyText))"
        mailDraftAttachments = []
        mailComposerExpanded = true
        mailSummary = "Replying all to \(message.subjectLabel)"
    }

    func composeForwardSelectedMail() {
        guard let message = selectedMailMessage else { return }
        mailComposeTo = ""
        mailComposeCc = ""
        mailComposeBcc = ""
        mailComposeReplyTo = ""
        mailComposeSubject = message.subjectLabel.lowercased().hasPrefix("fwd:") ? message.subjectLabel : "Fwd: \(message.subjectLabel)"
        mailComposeBody = "\n\nForwarded message:\nFrom: \(message.fromLabel)\nDate: \(message.dateLabel)\nSubject: \(message.subjectLabel)\n\n\(message.bodyText)"
        mailDraftAttachments = []
        mailComposerExpanded = true
        mailSummary = "Forwarding \(message.subjectLabel)"
    }

    func addRecentRecipientToCompose(_ recipient: MailOverviewEnvelope.RecentRecipient) {
        let value = recipient.displayName
        let trimmed = mailComposeTo.trimmingCharacters(in: .whitespacesAndNewlines)
        mailComposeTo = trimmed.isEmpty ? value : "\(trimmed), \(value)"
        mailComposerExpanded = true
    }

    private func quoteMailBody(_ body: String) -> String {
        body
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map { "> \($0)" }
            .joined(separator: "\n")
    }

    private func uniqueMailAddresses(_ addresses: [MailOverviewEnvelope.MailAddress]) -> [MailOverviewEnvelope.MailAddress] {
        var seen: Set<String> = []
        return addresses.filter { address in
            let key = address.email.lowercased()
            guard !seen.contains(key) else { return false }
            seen.insert(key)
            return true
        }
    }

    func sendComposedMail() async {
        guard hasHanasandAuth else {
            mailSummary = "Setup needed."
            append(meta: "Mail send", body: mailSummary, kind: .error)
            return
        }

        let to = mailComposeTo.trimmingCharacters(in: .whitespacesAndNewlines)
        let subject = mailComposeSubject.trimmingCharacters(in: .whitespacesAndNewlines)
        let bodyText = mailComposeBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !to.isEmpty, !subject.isEmpty || !bodyText.isEmpty || !mailDraftAttachments.isEmpty else {
            mailSummary = "Add a recipient and a subject or message."
            append(meta: "Mail send", body: mailSummary, kind: .error)
            return
        }

        do {
            let payload = MailSendPayload(
                mailboxUser: mailOverview?.mailboxUser,
                to: to,
                cc: mailComposeCc.trimmingCharacters(in: .whitespacesAndNewlines),
                bcc: mailComposeBcc.trimmingCharacters(in: .whitespacesAndNewlines),
                replyTo: mailComposeReplyTo.trimmingCharacters(in: .whitespacesAndNewlines),
                subject: subject,
                textBody: bodyText,
                attachments: mailDraftAttachments.map(\.payload)
            )
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("mail/send"),
                method: "POST",
                body: try JSONEncoder().encode(payload),
                authenticated: true
            )
            mailComposeTo = ""
            mailComposeCc = ""
            mailComposeBcc = ""
            mailComposeReplyTo = ""
            mailComposeSubject = ""
            mailComposeBody = ""
            mailDraftAttachments = []
            mailComposerExpanded = false
            mailSummary = "Message sent"
            append(meta: "Mail sent", body: String(text.prefix(240)), kind: .change)
            await loadMailOverview()
        } catch {
            mailSummary = error.localizedDescription
            append(meta: "Mail send failed", body: error.localizedDescription, kind: .error)
        }
    }

    func addMailAttachment() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        guard panel.runModal() == .OK else { return }

        for url in panel.urls {
            do {
                let data = try Data(contentsOf: url)
                let type = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                mailDraftAttachments.append(MailDraftAttachment(name: url.lastPathComponent, type: type, size: data.count, contentBase64: data.base64EncodedString()))
            } catch {
                append(meta: "Attachment failed", body: error.localizedDescription, kind: .error)
            }
        }
        mailSummary = "\(mailDraftAttachments.count) attachment\(mailDraftAttachments.count == 1 ? "" : "s") ready"
    }

    func removeMailAttachment(_ attachment: MailDraftAttachment) {
        mailDraftAttachments.removeAll { $0.id == attachment.id }
    }

    func downloadMailAttachment(_ attachment: MailOverviewEnvelope.Attachment, from message: MailOverviewEnvelope.Message) async {
        guard let mailboxUser = mailOverview?.mailboxUser else { return }
        do {
            let url = settings.apiBaseURL.normalizedBaseURL
                .appendingAPIPath("mail/blob/\(mailboxUser)/\(attachment.blobId)/\(attachment.name)")
            let (data, response) = try await URLSession.shared.data(for: request(url, authenticated: true))
            try validateHTTP(response)
            let destination = FileManager.default.temporaryDirectory
                .appendingPathComponent("hanasand-mail-\(message.id)")
                .appendingPathComponent(attachment.name)
            try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: destination, options: [.atomic])
            NSWorkspace.shared.open(destination)
            mailSummary = "Opened \(attachment.name)"
        } catch {
            mailSummary = "Attachment failed: \(error.localizedDescription)"
            append(meta: "Attachment failed", body: error.localizedDescription, kind: .error)
        }
    }

    func importDocumentPages() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.pdf, .image]
        guard panel.runModal() == .OK else { return }

        importDocumentURLs(panel.urls)
    }

    func importDocumentURLs(_ urls: [URL]) {
        var imported = 0
        for url in urls {
            if url.pathExtension.lowercased() == "pdf", let pdf = PDFDocument(url: url) {
                for index in 0..<pdf.pageCount {
                    guard let page = pdf.page(at: index) else { continue }
                    let bounds = page.bounds(for: .mediaBox)
                    let image = NSImage(size: bounds.size)
                    image.lockFocus()
                    NSColor.white.setFill()
                    bounds.fill()
                    page.draw(with: .mediaBox, to: NSGraphicsContext.current!.cgContext)
                    image.unlockFocus()
                    documentPages.append(DesktopDocumentPage(title: "\(url.deletingPathExtension().lastPathComponent) p\(index + 1)", image: image, sourceURL: url))
                    imported += 1
                }
            } else if let image = NSImage(contentsOf: url) {
                documentPages.append(DesktopDocumentPage(title: url.lastPathComponent, image: image, sourceURL: url))
                imported += 1
            }
        }
        documentStatus = imported == 0 ? "No supported pages imported." : "Imported \(imported) page\(imported == 1 ? "" : "s")."
    }

    func importDocumentProviders(_ providers: [NSItemProvider]) -> Bool {
        importFileProviders(providers) { [weak self] urls in
            self?.selectedSection = .documents
            self?.importDocumentURLs(urls)
        }
        return !providers.isEmpty
    }

    func moveDocumentPage(_ page: DesktopDocumentPage, direction: Int) {
        guard let index = documentPages.firstIndex(where: { $0.id == page.id }) else { return }
        let target = index + direction
        guard documentPages.indices.contains(target) else { return }
        documentPages.swapAt(index, target)
    }

    func removeDocumentPage(_ page: DesktopDocumentPage) {
        documentPages.removeAll { $0.id == page.id }
        documentStatus = "Removed \(page.title)."
    }

    func revealDocumentPageSource(_ page: DesktopDocumentPage) {
        guard let sourceURL = page.sourceURL else {
            documentStatus = "No source file tracked for \(page.title)."
            return
        }
        NSWorkspace.shared.activateFileViewerSelecting([sourceURL])
    }

    func copyDocumentPageTitle(_ page: DesktopDocumentPage) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(page.title, forType: .string)
        documentStatus = "Copied \(page.title)."
    }

    func rotateDocumentPage(_ page: DesktopDocumentPage, clockwise: Bool = true) {
        guard let index = documentPages.firstIndex(where: { $0.id == page.id }),
              let rotated = documentPages[index].image.rotated(clockwise: clockwise) else {
            documentStatus = "Could not rotate \(page.title)."
            return
        }
        documentPages[index].image = rotated
        documentStatus = "Rotated \(page.title)."
    }

    func clearDocumentPages() {
        documentPages = []
        exportedDocumentPath = ""
        documentStatus = "Cleared document bundle."
    }

    func exportDocumentPDF() {
        guard !documentPages.isEmpty else {
            documentStatus = "Import at least one page before exporting."
            return
        }

        let panel = NSSavePanel()
        panel.allowedContentTypes = [.pdf]
        panel.nameFieldStringValue = "hanasand-document.pdf"
        guard panel.runModal() == .OK, let url = panel.url else { return }

        let pdf = PDFDocument()
        for page in documentPages {
            if let pdfPage = PDFPage(image: page.image) {
                pdf.insert(pdfPage, at: pdf.pageCount)
            }
        }

        if pdf.write(to: url) {
            exportedDocumentPath = url.path
            documentStatus = "Exported \(documentPages.count) pages to \(url.lastPathComponent)."
            NSWorkspace.shared.activateFileViewerSelecting([url])
        } else {
            documentStatus = "Could not export PDF."
        }
    }

    func revealExportedDocument() {
        guard !exportedDocumentPath.isEmpty else {
            documentStatus = "No exported PDF yet."
            return
        }
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: exportedDocumentPath)])
    }

    func importImagesForReview() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.image]
        guard panel.runModal() == .OK else { return }

        importImagesForReview(urls: panel.urls)
    }

    func importImagesForReview(urls: [URL]) {
        imageReviewItems = urls.compactMap { url in
            guard let image = NSImage(contentsOf: url) else { return nil }
            return DesktopImageReviewItem(url: url, image: image)
        }
        imageReviewIndex = 0
        imageReviewDecisions = [:]
        imageReviewHistory = []
        imageReviewStatus = imageReviewItems.isEmpty ? "No images imported." : "Imported \(imageReviewItems.count) images."
    }

    func importImageProviders(_ providers: [NSItemProvider]) -> Bool {
        importFileProviders(providers) { [weak self] urls in
            self?.selectedSection = .images
            self?.importImagesForReview(urls: urls)
        }
        return !providers.isEmpty
    }

    var currentImageReviewItem: DesktopImageReviewItem? {
        guard imageReviewItems.indices.contains(imageReviewIndex) else { return nil }
        return imageReviewItems[imageReviewIndex]
    }

    var hasDiscardedImages: Bool {
        imageReviewDecisions.values.contains(.discard)
    }

    func revealCurrentImage() {
        guard let current = currentImageReviewItem else {
            imageReviewStatus = "No current image."
            return
        }
        NSWorkspace.shared.activateFileViewerSelecting([current.url])
    }

    func copyCurrentImagePath() {
        guard let current = currentImageReviewItem else {
            imageReviewStatus = "No current image."
            return
        }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(current.url.path, forType: .string)
        imageReviewStatus = "Copied \(current.title)."
    }

    func decideCurrentImage(_ decision: ImageReviewDecision) {
        guard let current = currentImageReviewItem else { return }
        imageReviewDecisions[current.id] = decision
        imageReviewHistory.append(current.id)
        imageReviewIndex = min(imageReviewIndex + 1, imageReviewItems.count)
        imageReviewStatus = decision == .keep ? "Kept \(current.title)." : "Marked \(current.title) for deletion."
    }

    func undoImageDecision() {
        guard let last = imageReviewHistory.popLast() else {
            imageReviewStatus = "Nothing to undo."
            return
        }
        imageReviewDecisions.removeValue(forKey: last)
        imageReviewIndex = max(imageReviewIndex - 1, 0)
        imageReviewStatus = "Undid last image decision."
    }

    func restartImageReview() {
        imageReviewIndex = 0
        imageReviewDecisions = [:]
        imageReviewHistory = []
        imageReviewStatus = imageReviewItems.isEmpty ? "Import images to start review." : "Restarted review for \(imageReviewItems.count) images."
    }

    func trashDiscardedImages() {
        let discarded = imageReviewItems.filter { imageReviewDecisions[$0.id] == .discard }
        guard !discarded.isEmpty else {
            imageReviewStatus = "No images marked for deletion."
            return
        }

        var failed: [String] = []
        for item in discarded {
            do {
                var resultingURL: NSURL?
                try FileManager.default.trashItem(at: item.url, resultingItemURL: &resultingURL)
            } catch {
                failed.append(item.title)
            }
        }

        let discardedIDs = Set(discarded.map(\.id))
        imageReviewItems.removeAll { discardedIDs.contains($0.id) }
        imageReviewDecisions = imageReviewDecisions.filter { !discardedIDs.contains($0.key) }
        imageReviewHistory.removeAll { discardedIDs.contains($0) }
        imageReviewIndex = min(imageReviewIndex, imageReviewItems.count)
        imageReviewStatus = failed.isEmpty
            ? "Moved \(discarded.count) image\(discarded.count == 1 ? "" : "s") to Trash."
            : "Moved some images to Trash. Failed: \(failed.prefix(3).joined(separator: ", "))"
    }

    func createMailMailbox() async {
        guard hasHanasandAuth else {
            mailSummary = "Setup needed."
            append(meta: "Mailbox", body: mailSummary, kind: .error)
            return
        }

        let name = mailNewMailboxName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else {
            mailSummary = "Mailbox name is required."
            append(meta: "Mailbox", body: mailSummary, kind: .error)
            return
        }

        do {
            let payload = MailMailboxPayload(mailboxUser: mailOverview?.mailboxUser, name: name, parentId: nil)
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("mail/mailboxes"),
                method: "POST",
                body: try JSONEncoder().encode(payload),
                authenticated: true
            )
            mailNewMailboxName = ""
            mailSummary = "Created mailbox \(name)"
            append(meta: "Mailbox created", body: String(text.prefix(240)), kind: .change)
            await loadMailOverview()
        } catch {
            mailSummary = error.localizedDescription
            append(meta: "Mailbox failed", body: error.localizedDescription, kind: .error)
        }
    }

    func createMailFilter() async {
        guard hasHanasandAuth else {
            mailSummary = "Setup needed."
            append(meta: "Mail filter", body: mailSummary, kind: .error)
            return
        }

        let name = mailFilterName.trimmingCharacters(in: .whitespacesAndNewlines)
        let contains = mailFilterContains.trimmingCharacters(in: .whitespacesAndNewlines)
        let target = mailFilterTargetMailbox.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !contains.isEmpty, !target.isEmpty else {
            mailSummary = "Filter name, match text, and target mailbox are required."
            append(meta: "Mail filter", body: mailSummary, kind: .error)
            return
        }

        do {
            let payload = MailFilterPayload(
                mailboxUser: mailOverview?.mailboxUser,
                name: name,
                enabled: true,
                criteria: .init(field: "from", contains: contains),
                action: .init(type: "move", mailboxName: target, markRead: false)
            )
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("mail/filters"),
                method: "POST",
                body: try JSONEncoder().encode(payload),
                authenticated: true
            )
            mailFilterName = ""
            mailFilterContains = ""
            mailFilterTargetMailbox = ""
            mailSummary = "Created filter \(name)"
            append(meta: "Mail filter created", body: String(text.prefix(240)), kind: .change)
            await loadMailOverview()
        } catch {
            mailSummary = error.localizedDescription
            append(meta: "Mail filter failed", body: error.localizedDescription, kind: .error)
        }
    }

    func deleteMailFilter(_ filter: MailOverviewEnvelope.Filter) async {
        guard hasHanasandAuth else {
            mailSummary = "Setup needed."
            append(meta: "Mail filter", body: mailSummary, kind: .error)
            return
        }

        do {
            var components = URLComponents(url: settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("mail/filters/\(filter.id)"), resolvingAgainstBaseURL: false)
            if let mailboxUser = mailOverview?.mailboxUser, !mailboxUser.isEmpty {
                components?.queryItems = [URLQueryItem(name: "mailboxUser", value: mailboxUser)]
            }
            let text = try await requestPrettyText(
                components?.url ?? settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("mail/filters/\(filter.id)"),
                method: "DELETE",
                authenticated: true
            )
            mailSummary = "Deleted filter \(filter.name)"
            append(meta: "Mail filter deleted", body: text.isEmpty ? filter.name : String(text.prefix(240)), kind: .change)
            await loadMailOverview()
        } catch {
            mailSummary = error.localizedDescription
            append(meta: "Mail filter delete failed", body: error.localizedDescription, kind: .error)
        }
    }

    func createShortcutLink() async {
        let id = linkDraftID.trimmingCharacters(in: .whitespacesAndNewlines)
        let path = linkDraftPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty, isValidShortcutDestination(path) else {
            nativeDashboardStatus = "Add a shortcut id and a valid destination."
            append(meta: "Link", body: nativeDashboardStatus, kind: .error)
            return
        }

        do {
            let payload = ShortcutLinkPayload(path: path)
            let created: DashboardShortcutLink = try await requestJSON(
                settings.cdnBaseURL.normalizedBaseURL.appendingAPIPath("link/\(id)"),
                method: "POST",
                body: try JSONEncoder().encode(payload)
            )
            linkLookupID = created.id
            linkLookupResult = created
            linkDraftID = ""
            linkDraftPath = ""
            nativeDashboardStatus = "Created /g/\(created.id)"
            append(meta: "Link created", body: "\(created.id) -> \(created.path)", kind: .change)
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Link create failed", body: error.localizedDescription, kind: .error)
        }
    }

    func lookupShortcutLink() async {
        let id = linkLookupID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty else {
            nativeDashboardStatus = "Enter a shortcut id first."
            return
        }

        do {
            let link: DashboardShortcutLink = try await requestJSON(
                settings.cdnBaseURL.normalizedBaseURL.appendingAPIPath("link/\(id)")
            )
            linkLookupResult = link
            linkDraftID = link.id
            linkDraftPath = link.path
            nativeDashboardStatus = "Loaded /g/\(link.id)"
            append(meta: "Link loaded", body: "\(link.id) -> \(link.path)", kind: .command)
        } catch {
            linkLookupResult = nil
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Link lookup failed", body: error.localizedDescription, kind: .error)
        }
    }

    func updateShortcutLink() async {
        let id = (linkLookupResult?.id ?? linkDraftID).trimmingCharacters(in: .whitespacesAndNewlines)
        let path = linkDraftPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty, isValidShortcutDestination(path) else {
            nativeDashboardStatus = "Load a shortcut and enter a valid destination."
            append(meta: "Link update", body: nativeDashboardStatus, kind: .error)
            return
        }

        do {
            let payload = ShortcutLinkPayload(path: path)
            let updated: DashboardShortcutLink = try await requestJSON(
                settings.cdnBaseURL.normalizedBaseURL.appendingAPIPath("link/\(id)"),
                method: "PUT",
                body: try JSONEncoder().encode(payload)
            )
            linkLookupResult = updated
            linkLookupID = updated.id
            nativeDashboardStatus = "Updated /g/\(updated.id)"
            append(meta: "Link updated", body: "\(updated.id) -> \(updated.path)", kind: .change)
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Link update failed", body: error.localizedDescription, kind: .error)
        }
    }

    func loadAiModels() async {
        do {
            let models: AIModelsEnvelope = try await requestJSON(
                settings.apiBaseURL.normalizedBaseURL.appendingPathComponent("ai/models"),
                authenticated: hasHanasandAuth
            )
            let connected = models.connected.map { client in
                AIConnectedClient(
                    rawID: client.id,
                    name: client.name,
                    lastSeen: nil,
                    model: client.model
                )
            }
            aiClients = connected.sortedForRuntime
            let names = aiClients.map(\.name).filter { !$0.isEmpty }
            aiSummary = names.isEmpty ? "No connected models" : names.joined(separator: ", ")
            append(meta: "Hanasand AI", body: aiSummary, kind: names.isEmpty ? .error : .command)
        } catch {
            aiSummary = error.localizedDescription
            append(meta: "Hanasand AI", body: error.localizedDescription, kind: .error)
        }
    }

    func loadAIPage() async {
        await loadAiModels()
        connectAISocket()
        if aiTrace.isEmpty {
            appendAITrace(.system, title: "Runtime", detail: "Connected to the Hanasand model pool and ready to stream chat, tools, timings, and file artifacts.")
        }
    }

    func connectAISocket() {
        if aiSocketTask != nil { return }
        guard let url = settings.apiBaseURL.websocketBaseURL?.appendingPathComponent("client/ws/gpt") else {
            aiSummary = "Invalid websocket URL"
            appendAITrace(.error, title: "Socket", detail: "Could not derive a websocket URL from \(settings.apiBaseURL).")
            return
        }

        let task = URLSession.shared.webSocketTask(with: url)
        aiSocketTask = task
        aiSocketConnected = true
        aiSummary = aiClients.isEmpty ? "Connecting to model pool" : aiSummary
        task.resume()
        appendAITrace(.system, title: "Socket", detail: "Listening on \(url.absoluteString).")

        aiReceiveTask?.cancel()
        aiReceiveTask = Task { [weak self] in
            await self?.receiveAISocketMessages()
        }
    }

    func disconnectAISocket() {
        aiReceiveTask?.cancel()
        aiReceiveTask = nil
        aiSocketTask?.cancel(with: .goingAway, reason: nil)
        aiSocketTask = nil
        aiSocketConnected = false
    }

    func submitAIChatPrompt() {
        submitAIChatPrompt(prompt)
    }

    func submitAppParityTrainingPrompt() {
        submitAIChatPrompt(DesktopAITraining.appParityPrompt, maxTokens: 650, temperature: 0.2)
    }

    func submitDesktopUIAuditPrompt() {
        submitAIChatPrompt(DesktopAITraining.desktopUIAuditPrompt, maxTokens: 850, temperature: 0.2)
    }

    private func submitAIChatPrompt(_ rawPrompt: String, maxTokens: Int = 900, temperature: Double = 0.7) {
        let trimmed = rawPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isRunning else { return }
        if rawPrompt == prompt {
            prompt = ""
        }

        if handleLocalAIBrowserCommand(trimmed) {
            return
        }
        if let editCommand = IDEEditChatCommand.parse(trimmed) {
            aiMessages.append(AIChatMessage(role: .user, content: trimmed))
            createPendingIDEEdit(editCommand)
            return
        }
        if handleLocalAIIDECommand(trimmed) {
            return
        }

        isRunning = true

        let userMessage = AIChatMessage(role: .user, content: trimmed)
        aiMessages.append(userMessage)
        let bestClient = aiClients.sortedForRuntime.first

        guard let bestClient else {
            Task { [weak self] in
                guard let self else { return }
                defer { self.isRunning = false }
                await self.sendFallbackAIChat(trimmed)
            }
            return
        }

        guard let socket = aiSocketTask, aiSocketConnected else {
            Task { [weak self] in
                guard let self else { return }
                defer { self.isRunning = false }
                await self.sendFallbackAIChat(trimmed)
            }
            return
        }

        let conversationId = "desktop-\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(8))"
        aiActiveConversationID = conversationId
        aiRunStartedAt = Date()
        aiLastDuration = "Running"
        aiTrace.removeAll()
        appendAITrace(.thought, title: "Run plan", detail: "Selected \(bestClient.name) and sent \(aiMessages.count) visible chat messages plus the desktop app-parity primer to the runtime.")

        let request = AIPromptRequest(
            type: "prompt_request",
            conversationId: conversationId,
            clientName: bestClient.name,
            messages: aiRequestMessages(),
            maxTokens: maxTokens,
            temperature: temperature
        )

        do {
            let data = try JSONEncoder().encode(request)
            guard let text = String(data: data, encoding: .utf8) else {
                throw HanasandAIError.invalidPayload
            }
            socket.send(.string(text)) { [weak self] error in
                guard let self else { return }
                Task { @MainActor in
                    if let error {
                        self.isRunning = false
                        self.appendAITrace(.error, title: "Send failed", detail: error.localizedDescription)
                        self.aiMessages.append(AIChatMessage(role: .assistant, content: error.localizedDescription, isError: true))
                    }
                }
            }
        } catch {
            isRunning = false
            appendAITrace(.error, title: "Request", detail: error.localizedDescription)
            aiMessages.append(AIChatMessage(role: .assistant, content: error.localizedDescription, isError: true))
        }
    }

    private func handleLocalAIBrowserCommand(_ prompt: String) -> Bool {
        guard let command = BrowserChatCommand.parse(prompt) else { return false }

        aiMessages.append(AIChatMessage(role: .user, content: prompt))
        switch command.kind {
        case .open:
            let resolved = BrowserTargetResolver.resolve(command.target)
            openInlineBrowser(url: resolved.url, title: resolved.title, source: "AI chat")
            aiMessages.append(AIChatMessage(role: .assistant, content: "Opened \(resolved.title) in the built-in browser. The Workspace browser has agent controls for inspecting, clicking, typing, scrolling, and popping the page out."))
            appendAITrace(.tool, title: "Browser", detail: "Opened \(resolved.url) from a local AI chat command.")
        case .popOut:
            let resolved = BrowserTargetResolver.resolve(command.target)
            popOutBrowser(url: resolved.url, title: resolved.title, minified: false, source: "AI chat")
            aiMessages.append(AIChatMessage(role: .assistant, content: "Popped out \(resolved.title) in the Hanasand floating browser."))
            appendAITrace(.tool, title: "Browser pop out", detail: "Opened \(resolved.url) in the existing floating browser.")
        case .popOutCurrent:
            popOutBrowser(source: "AI chat")
            aiMessages.append(AIChatMessage(role: .assistant, content: "Popped out the current Workspace browser page."))
            appendAITrace(.tool, title: "Browser pop out", detail: "Opened \(browserActiveAddress) in the existing floating browser.")
        }
        return true
    }

    private func handleLocalAIIDECommand(_ prompt: String) -> Bool {
        guard let command = IDEChatCommand.parse(prompt) else { return false }
        aiMessages.append(AIChatMessage(role: .user, content: prompt))
        openIDEFile(command.path, line: command.line, revealDiff: command.revealDiff, source: "AI chat")
        if let line = command.line {
            aiMessages.append(AIChatMessage(role: .assistant, content: "Opened \(command.path) at line \(line) in the native IDE and highlighted the target line."))
            appendAITrace(.tool, title: "IDE line", detail: "\(command.path):\(line)")
        } else if command.revealDiff {
            aiMessages.append(AIChatMessage(role: .assistant, content: "Opened the inline diff for \(command.path) and loaded the file in the native IDE."))
            appendAITrace(.tool, title: "IDE diff", detail: command.path)
        } else {
            aiMessages.append(AIChatMessage(role: .assistant, content: "Opened \(command.path) in the native IDE."))
            appendAITrace(.tool, title: "IDE file", detail: command.path)
        }
        return true
    }

    private func sendFallbackAIChat(_ prompt: String) async {
        appendAITrace(.system, title: "Fallback", detail: "No live websocket model was available. The desktop app is using the HTTP AI endpoint, but app-parity tool training works best through the live model pool.")
        do {
            let response = try await HanasandAIClient(
                apiURL: settings.resolvedAIEndpoint,
                token: authTokenForRequests,
                userId: userIDForRequests
            ).send(
                prompt: prompt,
                context: ([DesktopAITraining.appParityPrimer] + aiMessages.suffix(8).map { "\($0.role.rawValue): \($0.content)" }).joined(separator: "\n\n")
            )
            aiMessages.append(AIChatMessage(role: .assistant, content: response.body))
            aiSummary = response.meta
            aiLastDuration = "HTTP fallback"
        } catch {
            aiMessages.append(AIChatMessage(role: .assistant, content: error.localizedDescription, isError: true))
            appendAITrace(.error, title: "Fallback failed", detail: error.localizedDescription)
        }
    }

    private func aiRequestMessages() -> [AIPromptRequest.Message] {
        let visibleMessages = aiMessages.suffix(12).map { message in
            AIPromptRequest.Message(role: message.role.rawValue, content: message.content)
        }
        return [AIPromptRequest.Message(role: "system", content: DesktopAITraining.appParityPrimer)] + visibleMessages
    }

    private func receiveAISocketMessages() async {
        guard let socket = aiSocketTask else { return }
        while !Task.isCancelled {
            do {
                let message = try await socket.receive()
                let text: String
                switch message {
                case .string(let value):
                    text = value
                case .data(let data):
                    text = String(data: data, encoding: .utf8) ?? ""
                @unknown default:
                    text = ""
                }
                guard !text.isEmpty else { continue }
                await handleAISocketText(text)
            } catch {
                aiSocketConnected = false
                aiSocketTask = nil
                if !Task.isCancelled {
                    appendAITrace(.error, title: "Socket closed", detail: error.localizedDescription)
                }
                return
            }
        }
    }

    private func handleAISocketText(_ text: String) async {
        guard let data = text.data(using: .utf8),
              let event = try? JSONDecoder().decode(AISocketEvent.self, from: data) else {
            return
        }

        switch event.type {
        case "snapshot":
            aiClients = (event.clients ?? []).sortedForRuntime
            updateAISummaryFromClients()
        case "update":
            if let client = event.client {
                upsertAIClient(client)
                updateAISummaryFromClients()
            }
        case "prompt_started":
            guard isActiveAIEvent(event) else { return }
            appendAITrace(.thought, title: "Thinking", detail: "The runtime accepted the prompt and prepared context for \(event.clientName ?? "the selected model").")
            aiMessages.append(AIChatMessage(id: "\(event.conversationId ?? UUID().uuidString)-assistant", role: .assistant, content: "", isPending: true))
        case "prompt_tool":
            guard isActiveAIEvent(event) else { return }
            let label = event.toolLabel ?? event.toolId ?? "Tool"
            let detail = [event.toolState, event.toolDetail].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.joined(separator: " · ")
            appendAITrace(.tool, title: label, detail: detail.isEmpty ? "Tool event received." : detail)
        case "prompt_delta":
            guard isActiveAIEvent(event) else { return }
            appendToActiveAIResponse(event.delta ?? "")
        case "prompt_complete":
            guard isActiveAIEvent(event) else { return }
            finishActiveAIResponse(content: event.content, artifacts: event.artifacts ?? [], overhead: event.overhead)
        case "prompt_error":
            guard isActiveAIEvent(event) else { return }
            isRunning = false
            aiLastDuration = elapsedAIRunText()
            appendAITrace(.error, title: "Model error", detail: event.error ?? "The model failed to answer this prompt.")
            aiMessages.append(AIChatMessage(role: .assistant, content: event.error ?? "The model failed to answer this prompt.", isError: true))
        default:
            break
        }
    }

    private func isActiveAIEvent(_ event: AISocketEvent) -> Bool {
        guard let active = aiActiveConversationID else { return true }
        return event.conversationId == nil || event.conversationId == active
    }

    private func appendToActiveAIResponse(_ delta: String) {
        guard !delta.isEmpty else { return }
        if let index = aiMessages.lastIndex(where: { $0.isPending && $0.role == .assistant }) {
            aiMessages[index].content += delta
        } else {
            aiMessages.append(AIChatMessage(role: .assistant, content: delta, isPending: true))
        }
    }

    private func finishActiveAIResponse(content: String?, artifacts: [AIArtifact], overhead: AIOverheadSample?) {
        isRunning = false
        aiLastDuration = elapsedAIRunText(overhead: overhead)
        if let content, !content.isEmpty, !aiMessages.contains(where: { $0.role == .assistant && $0.content == content }) {
            aiMessages.append(AIChatMessage(role: .assistant, content: content))
        }
        if let index = aiMessages.lastIndex(where: { $0.isPending && $0.role == .assistant }) {
            if let content, !content.isEmpty, aiMessages[index].content.isEmpty {
                aiMessages[index].content = content
            }
            aiMessages[index].isPending = false
        }

        let toolCount = aiTrace.filter { $0.kind == .tool }.count
        appendAITrace(.thought, title: "Run summary", detail: "Worked for \(aiLastDuration), used \(toolCount) surfaced tool event\(toolCount == 1 ? "" : "s"), and streamed the answer back into chat.")
        if !artifacts.isEmpty {
            for artifact in artifacts.prefix(8) {
                appendAITrace(.file, title: artifact.displayTitle, detail: artifact.displayDetail)
            }
        } else {
            appendAITrace(.file, title: "Files", detail: "No file artifacts or changed-file summaries were reported by this model run.")
        }
    }

    private func elapsedAIRunText(overhead: AIOverheadSample? = nil) -> String {
        if let totalMs = overhead?.stages?["totalMs"] {
            return formatMilliseconds(totalMs)
        }
        guard let aiRunStartedAt else { return "unknown duration" }
        return formatMilliseconds(Date().timeIntervalSince(aiRunStartedAt) * 1000)
    }

    private func appendAITrace(_ kind: AITraceEvent.Kind, title: String, detail: String) {
        aiTrace.append(AITraceEvent(kind: kind, title: title, detail: detail))
        if aiTrace.count > 80 {
            aiTrace.removeFirst(aiTrace.count - 80)
        }
    }

    private func upsertAIClient(_ client: AIConnectedClient) {
        if let index = aiClients.firstIndex(where: { $0.name == client.name }) {
            aiClients[index] = client
        } else {
            aiClients.append(client)
        }
        aiClients = aiClients.sortedForRuntime
    }

    private func updateAISummaryFromClients() {
        let names = aiClients.map(\.name).filter { !$0.isEmpty }
        aiSummary = names.isEmpty ? (aiSocketConnected ? "No connected models" : "Not connected") : names.joined(separator: ", ")
    }

    func openVPN() {
        currentTaskState = "Opening VPN"
        guard let url = URL(string: settings.vpnURLScheme) else {
            append(meta: "VPN", body: "Invalid VPN URL scheme.", kind: .error)
            recordRun(title: "VPN error", detail: "Invalid VPN URL scheme", kind: .error)
            currentTaskState = "Idle"
            return
        }
        NSWorkspace.shared.open(url)
        append(meta: "VPN", body: url.absoluteString, kind: .command)
        recordRun(title: "VPN", detail: url.absoluteString, kind: .command)
        currentTaskState = "Idle"
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            await self?.checkServerReachability(silent: true)
        }
    }

    func openWebsite(path: String, label: String) {
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = settings.websiteBaseURL.normalizedBaseURL.appendingPathComponent(normalizedPath)
        NSWorkspace.shared.open(url)
        append(meta: "Opened \(label)", body: url.absoluteString, kind: .command)
    }

    func recordUIEvent(meta: String, body: String, kind: AgentEvent.Kind = .note) {
        append(meta: meta, body: body, kind: kind)
    }

    func openNativeDashboard(path: String, label: String) {
        selectedDashboardPath = path
        selectedDashboardTitle = label
        selectedSection = .dashboard
        append(meta: "Dashboard", body: "Opened native \(label)", kind: .command)
        recordRun(title: label, detail: path, kind: .command)
        Task { await loadNativeDashboardData() }
    }

    func closeNativeDashboardPage() {
        selectedDashboardPath = nil
        selectedDashboardTitle = "Dashboard"
        nativeDashboardPayload = "Select a dashboard card to load native data."
        nativeDashboardStatus = "Ready"
        backupServices = []
        backupFiles = []
        notes = []
        selectedNoteID = ""
        noteDraftTitle = ""
        noteDraftContent = ""
        vulnerabilityReport = nil
        databaseOverview = nil
        trafficMetrics = nil
    }

    func openURL(_ rawValue: String, label: String) {
        guard let url = URL(string: rawValue) else {
            append(meta: label, body: "Invalid URL: \(rawValue)", kind: .error)
            return
        }
        NSWorkspace.shared.open(url)
        append(meta: "Opened \(label)", body: url.absoluteString, kind: .command)
    }

    func copyCurrentContext() {
        let context = currentShareContext()
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(context, forType: .string)
        append(meta: "Copied", body: context, kind: .command)
        recordRun(title: "Copied context", detail: context, kind: .command)
    }

    func shareCurrentContext() {
        let context = currentShareContext()
        guard let window = NSApplication.shared.keyWindow,
              let contentView = window.contentView else {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(context, forType: .string)
            append(meta: "Share", body: "Copied context because no window was available.", kind: .note)
            return
        }

        let picker = NSSharingServicePicker(items: [context])
        picker.show(relativeTo: contentView.bounds, of: contentView, preferredEdge: .minY)
        append(meta: "Share", body: context, kind: .command)
    }

    private func currentShareContext() -> String {
        switch selectedSection {
        case .control:
            return prompt.isEmpty ? "Hanasand Control: \(currentTaskState)" : prompt
        case .mail:
            return selectedMailMessage?.subject ?? mailSummary
        case .documents:
            return "Hanasand Documents: \(documentPages.count) page\(documentPages.count == 1 ? "" : "s")"
        case .images:
            return "Hanasand Images: \(imageReviewItems.count) image\(imageReviewItems.count == 1 ? "" : "s"), \(imageReviewDecisions.count) decided"
        case .dashboard:
            return "\(selectedDashboardTitle): \(selectedDashboardPath ?? "dashboard")"
        case .server:
            return "Hanasand Server: \(serverSummary)"
        case .mac:
            return "\(status.hostname) \(status.platform) \(status.cwd)"
        case .ai:
            return "Hanasand AI: \(aiSummary)"
        case .updates:
            return "Hanasand Desktop \(Self.appVersion): \(updateStatus.title) \(updateStatus.message)"
        default:
            return "Hanasand \(selectedSection.title)"
        }
    }

    private func importFileProviders(_ providers: [NSItemProvider], completion: @escaping @MainActor ([URL]) -> Void) {
        var urls: [URL] = []
        let group = DispatchGroup()

        for provider in providers {
            group.enter()
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                defer { group.leave() }
                if let url = item as? URL {
                    urls.append(url)
                } else if let data = item as? Data,
                          let value = String(data: data, encoding: .utf8),
                          let url = URL(string: value.trimmingCharacters(in: .whitespacesAndNewlines)) {
                    urls.append(url)
                } else if let value = item as? String,
                          let url = URL(string: value.trimmingCharacters(in: .whitespacesAndNewlines)) {
                    urls.append(url)
                }
            }
        }

        group.notify(queue: .main) {
            Task { @MainActor in
                completion(urls)
            }
        }
    }

    func openServerLogsPage() {
        if settings.serverLogsPath.lowercased().hasPrefix("http"),
           let url = URL(string: settings.serverLogsPath) {
            NSWorkspace.shared.open(url)
            append(meta: "Opened logs", body: url.absoluteString, kind: .command)
            return
        }
        openWebsite(path: "/dashboard/logs", label: "Logs")
    }

    func configureMacMiniRemoteDesktop() {
        settings.rdpHost = "localhost:5900"
        settings.rdpUser = "macmini"
        settings.remoteDesktopProtocol = RemoteDesktopProtocol.screenSharing.rawValue
        settings.remoteDesktopTunnelCommand = HanasandDesktopSettings.macMiniTunnelCommand
        remoteControlSummary = "Mac mini Screen Sharing profile is ready."
        remoteControlLastCommand = "Mac mini profile"
        append(meta: "Remote desktop", body: "Mac mini profile ready. Start the tunnel, then connect.", kind: .change)
    }

    private func activateForRemoteControl() {
        NSApplication.shared.activate(ignoringOtherApps: true)
        NSApplication.shared.windows.first?.makeKeyAndOrderFront(nil)
    }

    private func markRemoteDesktopCommand(_ title: String, detail: String, kind: AgentEvent.Kind = .command) {
        remoteControlRequests += 1
        remoteControlLastCommand = title
        remoteControlSummary = detail
        append(meta: "Remote desktop", body: detail, kind: kind)
        recordRun(title: title, detail: detail, kind: kind)
    }

    func showRemoteDesktopStatus(source: String = "Hanasand app") {
        selectedSection = .server
        activateForRemoteControl()
        markRemoteDesktopCommand(
            "Status from \(source)",
            detail: "\(remoteDesktopProtocolLabel) ready for \(remoteDesktopTargetSummary).",
            kind: .command
        )
        currentTaskState = "Remote status shown"
    }

    func runRemoteDesktopProof(source: String = "Hanasand app") {
        selectedSection = .server
        activateForRemoteControl()
        let token = "APP-\(Int(Date().timeIntervalSince1970))-\(remoteControlRequests + 1)"
        remoteControlProofToken = token
        remoteControlProofAt = Date()
        markRemoteDesktopCommand(
            "Proof from \(source)",
            detail: "Control request reflected on this Mac with proof \(token).",
            kind: .change
        )
        status = AgentStatus.ready(message: "remote desktop proof \(token)")
        currentTaskState = "Remote proof received"
    }

    func openTextEditRemoteProof() {
        selectedSection = .server
        let token = "MAC-\(Int(Date().timeIntervalSince1970))-\(remoteControlRequests + 1)"
        remoteControlProofToken = token
        remoteControlProofAt = Date()
        let proofText = "Hanasand app controlled this Mac at \(DateFormatter.localizedString(from: Date(), dateStyle: .medium, timeStyle: .medium)). Proof: \(token)"
        let escapedText = proofText
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let script = """
        tell application "TextEdit"
            activate
            make new document with properties {text:"\(escapedText)"}
        end tell
        """
        var error: NSDictionary?
        guard NSAppleScript(source: script)?.executeAndReturnError(&error) != nil else {
            activateForRemoteControl()
            markRemoteDesktopCommand(
                "TextEdit proof failed",
                detail: error?.description ?? "Could not open TextEdit proof from the app.",
                kind: .error
            )
            currentTaskState = "Remote proof failed"
            return
        }
        remoteControlRequests += 1
        remoteControlLastCommand = "TextEdit proof"
        remoteControlSummary = "Opened TextEdit from the Hanasand app with proof \(token)."
        append(meta: "Mac control", body: remoteControlSummary, kind: .change)
        recordRun(title: "TextEdit proof", detail: proofText, kind: .change)
        status = AgentStatus.ready(message: "mac control proof \(token)")
        currentTaskState = "Mac controlled from app"
    }

    func openFinderRemoteProof() {
        selectedSection = .server
        NSWorkspace.shared.activateFileViewerSelecting([])
        remoteControlProofAt = Date()
        markRemoteDesktopCommand(
            "Finder proof",
            detail: "Opened Finder from the Hanasand app.",
            kind: .change
        )
        currentTaskState = "Finder opened from app"
    }

    func typeKeyboardRemoteProof() {
        selectedSection = .server
        let token = "KEY-\(Int(Date().timeIntervalSince1970))-\(remoteControlRequests + 1)"
        remoteControlProofToken = token
        remoteControlProofAt = Date()
        let proofText = "Keyboard input from Hanasand app. Proof: \(token)"
        let escapedText = proofText
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let script = """
        tell application "TextEdit"
            activate
            make new document
        end tell
        delay 0.2
        tell application "System Events"
            keystroke "\(escapedText)"
        end tell
        """
        var error: NSDictionary?
        guard NSAppleScript(source: script)?.executeAndReturnError(&error) != nil else {
            activateForRemoteControl()
            markRemoteDesktopCommand(
                "Keyboard proof failed",
                detail: error?.description ?? "Could not type proof. Grant Accessibility permission if macOS asks.",
                kind: .error
            )
            currentTaskState = "Keyboard proof failed"
            return
        }
        remoteControlRequests += 1
        remoteControlLastCommand = "Keyboard proof"
        remoteControlSummary = "Typed into TextEdit from the Hanasand app with proof \(token)."
        append(meta: "Mac input", body: remoteControlSummary, kind: .change)
        recordRun(title: "Keyboard proof", detail: proofText, kind: .change)
        status = AgentStatus.ready(message: "keyboard control proof \(token)")
        currentTaskState = "Keyboard controlled from app"
    }

    func typeRemoteText(_ text: String?) {
        selectedSection = .server
        let value = (text?.removingPercentEncoding ?? text ?? "").trimmingCharacters(in: .newlines)
        guard !value.isEmpty else {
            markRemoteDesktopCommand("Type text failed", detail: "No text was supplied from the Hanasand app.", kind: .error)
            return
        }
        let escapedText = value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let script = """
        tell application "System Events"
            keystroke "\(escapedText)"
        end tell
        """
        var error: NSDictionary?
        guard NSAppleScript(source: script)?.executeAndReturnError(&error) != nil else {
            markRemoteDesktopCommand(
                "Type text failed",
                detail: error?.description ?? "Could not type text. Grant Accessibility permission if macOS asks.",
                kind: .error
            )
            currentTaskState = "Typing failed"
            return
        }
        remoteControlProofAt = Date()
        markRemoteDesktopCommand("Typed text", detail: "Typed text from the Hanasand app.", kind: .change)
        currentTaskState = "Typed from app"
    }

    func runFullRemoteControlProof() {
        selectedSection = .server
        let token = "FULL-\(Int(Date().timeIntervalSince1970))-\(remoteControlRequests + 1)"
        remoteControlProofToken = token
        remoteControlProofAt = Date()
        let firstLine = "Hanasand phone is controlling this Mac."
        let secondLine = "Keyboard + Enter + pointer proof: \(token)"
        let escapedFirst = firstLine
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let escapedSecond = secondLine
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let script = """
        tell application "TextEdit"
            activate
            make new document
        end tell
        delay 0.2
        tell application "System Events"
            keystroke "\(escapedFirst)"
            key code 36
            keystroke "\(escapedSecond)"
        end tell
        delay 0.2
        tell application "TextEdit"
            activate
        end tell
        """
        var error: NSDictionary?
        guard NSAppleScript(source: script)?.executeAndReturnError(&error) != nil else {
            activateForRemoteControl()
            markRemoteDesktopCommand(
                "Full proof failed",
                detail: error?.description ?? "Could not run keyboard proof. Grant Accessibility permission if macOS asks.",
                kind: .error
            )
            currentTaskState = "Full control proof failed"
            return
        }

        let screenFrame = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let target = CGPoint(x: screenFrame.midX, y: screenFrame.midY)
        CGWarpMouseCursorPosition(target)
        if let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: target, mouseButton: .left),
           let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: target, mouseButton: .left) {
            down.post(tap: .cghidEventTap)
            up.post(tap: .cghidEventTap)
        }

        let proofURL = URL(fileURLWithPath: "/tmp/hanasand-full-control-proof.txt")
        try? "\(firstLine)\n\(secondLine)\n".write(to: proofURL, atomically: true, encoding: .utf8)
        NSWorkspace.shared.open(proofURL)
        NSRunningApplication
            .runningApplications(withBundleIdentifier: "com.apple.TextEdit")
            .first?
            .activate(options: [.activateAllWindows])

        remoteControlRequests += 1
        remoteControlLastCommand = "Full control proof"
        remoteControlSummary = "Phone controlled keyboard, Enter, pointer move/click on this Mac with proof \(token)."
        append(meta: "Full Mac control", body: remoteControlSummary, kind: .change)
        recordRun(title: "Full Mac control", detail: "\(firstLine)\n\(secondLine)", kind: .change)
        status = AgentStatus.ready(message: "full control proof \(token)")
        currentTaskState = "Full control from app"
    }

    func openRemoteControlPermissions() {
        selectedSection = .server
        let urls = [
            "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
        ]
        urls.compactMap(URL.init(string:)).forEach { NSWorkspace.shared.open($0) }
        markRemoteDesktopCommand(
            "Authorize Mac",
            detail: "Opened Screen Recording and Accessibility privacy panes for Hanasand.",
            kind: .command
        )
        currentTaskState = "Waiting for macOS permissions"
    }

    func runRemoteCodexPrompt(_ text: String?) {
        selectedSection = .control
        let promptText = (text?.removingPercentEncoding ?? text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !promptText.isEmpty else {
            append(meta: "Codex remote", body: "No prompt was supplied from the Hanasand app.", kind: .error)
            recordRun(title: "Codex remote error", detail: "Missing prompt", kind: .error)
            currentTaskState = "Remote Codex prompt missing"
            return
        }

        let requestedAt = Date()
        let token = "CODEX-\(Int(requestedAt.timeIntervalSince1970))"
        let wrappedPrompt = """
        You are running from the Hanasand phone-to-Mac control path.
        Proof token: \(token)

        User prompt:
        \(promptText)

        Before your final answer, create or overwrite /tmp/hanasand-phone-codex-flow.txt with one short line containing the proof token and a short summary of what you did.
        """
        let queueURL = URL(fileURLWithPath: "/tmp/hanasand-codex-queue", isDirectory: true)
        let promptURL = queueURL.appendingPathComponent("\(token).prompt")
        do {
            try FileManager.default.createDirectory(at: queueURL, withIntermediateDirectories: true)
            try wrappedPrompt.write(to: promptURL, atomically: true, encoding: .utf8)
        } catch {
            append(meta: "Codex queue failed", body: error.localizedDescription, kind: .error)
            recordRun(title: "Codex queue failed", detail: error.localizedDescription, kind: .error)
            currentTaskState = "Codex queue failed"
            return
        }

        remoteControlRequests += 1
        remoteControlProofToken = token
        remoteControlProofAt = requestedAt
        remoteControlLastCommand = "Codex prompt"
        remoteControlSummary = "Phone queued Codex on this Mac with proof \(token)."
        currentTaskState = "Codex queued from phone"
        status = AgentStatus.ready(message: "remote Codex queued \(token)")
        append(meta: "Codex remote", body: "Phone queued Codex proof \(token) at \(promptURL.path).", kind: .command)
        recordRun(title: "Phone Codex", detail: promptText, kind: .command)
    }

    nonisolated private static func runCodexProcess(
        codexPath: String,
        repoPath: String,
        outputURL: URL,
        logURL: URL,
        prompt: String
    ) -> (ok: Bool, message: String) {
        guard FileManager.default.isExecutableFile(atPath: codexPath) else {
            return (false, "Codex CLI was not found at \(codexPath).")
        }

        try? FileManager.default.removeItem(at: outputURL)
        try? FileManager.default.removeItem(at: logURL)
        let promptURL = URL(fileURLWithPath: "/tmp/hanasand-phone-codex-prompt.txt")
        try? prompt.write(to: promptURL, atomically: true, encoding: .utf8)

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.currentDirectoryURL = URL(fileURLWithPath: repoPath)
        process.arguments = [
            "-lc",
            "\(shellQuote(codexPath)) exec --cd \(shellQuote(repoPath)) --sandbox workspace-write --full-auto --output-last-message \(shellQuote(outputURL.path)) - < \(shellQuote(promptURL.path)) > \(shellQuote(logURL.path)) 2>&1",
        ]

        do {
            try process.run()
        } catch {
            return (false, error.localizedDescription)
        }

        let deadline = Date().addingTimeInterval(150)
        while process.isRunning && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.25)
        }
        if process.isRunning {
            process.terminate()
            Thread.sleep(forTimeInterval: 0.5)
            if process.isRunning {
                process.interrupt()
            }
        }
        process.waitUntilExit()

        let lastMessage = (try? String(contentsOf: outputURL, encoding: .utf8))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .flatMap { $0.isEmpty ? nil : $0 }
        let logText = (try? String(contentsOf: logURL, encoding: .utf8))?.trimmingCharacters(in: .whitespacesAndNewlines)

        if process.terminationStatus == SIGTERM || process.terminationStatus == SIGINT {
            return (false, "Codex did not finish within 150 seconds. Log: \(logText ?? "No output.")")
        }

        guard process.terminationStatus == 0 else {
            return (false, logText?.isEmpty == false ? logText! : "Codex exited with status \(process.terminationStatus).")
        }

        return (true, lastMessage ?? logText ?? "Codex completed.")
    }

    nonisolated private static func shellQuote(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\\''"))'"
    }

    func pressRemoteSearch() {
        selectedSection = .server
        let script = """
        tell application "System Events"
            key code 49 using {command down}
        end tell
        """
        var error: NSDictionary?
        guard NSAppleScript(source: script)?.executeAndReturnError(&error) != nil else {
            markRemoteDesktopCommand(
                "Go/Search failed",
                detail: error?.description ?? "Could not press Cmd+Space. Grant Accessibility permission if macOS asks.",
                kind: .error
            )
            currentTaskState = "Go/Search failed"
            return
        }
        remoteControlProofAt = Date()
        markRemoteDesktopCommand("Go/Search", detail: "Pressed Cmd+Space from the Hanasand app.", kind: .change)
        currentTaskState = "Go/Search from app"
    }

    func pressRemoteEnter() {
        selectedSection = .server
        let script = """
        tell application "System Events"
            key code 36
        end tell
        """
        var error: NSDictionary?
        guard NSAppleScript(source: script)?.executeAndReturnError(&error) != nil else {
            markRemoteDesktopCommand(
                "Enter failed",
                detail: error?.description ?? "Could not press Enter. Grant Accessibility permission if macOS asks.",
                kind: .error
            )
            currentTaskState = "Enter failed"
            return
        }
        remoteControlProofAt = Date()
        markRemoteDesktopCommand("Enter", detail: "Pressed Enter from the Hanasand app.", kind: .change)
        currentTaskState = "Enter from app"
    }

    func movePointerRemoteProof() {
        selectedSection = .server
        let screenFrame = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let target = CGPoint(x: screenFrame.midX, y: screenFrame.midY)
        CGWarpMouseCursorPosition(target)
        remoteControlProofAt = Date()
        markRemoteDesktopCommand(
            "Pointer moved",
            detail: "Moved the Mac pointer to \(Int(target.x)), \(Int(target.y)) from the Hanasand app.",
            kind: .change
        )
        currentTaskState = "Pointer moved from app"
    }

    func clickPointerRemoteProof() {
        selectedSection = .server
        let location = NSEvent.mouseLocation
        let point = CGPoint(x: location.x, y: NSScreen.main.map { $0.frame.height - location.y } ?? location.y)
        if let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left),
           let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left) {
            down.post(tap: .cghidEventTap)
            up.post(tap: .cghidEventTap)
            remoteControlProofAt = Date()
            markRemoteDesktopCommand(
                "Pointer clicked",
                detail: "Clicked the Mac pointer from the Hanasand app.",
                kind: .change
            )
            currentTaskState = "Pointer clicked from app"
        } else {
            markRemoteDesktopCommand(
                "Pointer click failed",
                detail: "macOS did not allow pointer click injection.",
                kind: .error
            )
            currentTaskState = "Pointer click failed"
        }
    }

    func clickPointerRemoteProof(at normalizedPoint: CGPoint?) {
        selectedSection = .server
        guard let normalizedPoint else {
            clickPointerRemoteProof()
            return
        }

        let width = CGFloat(CGDisplayPixelsWide(CGMainDisplayID()))
        let height = CGFloat(CGDisplayPixelsHigh(CGMainDisplayID()))
        let x = min(max(normalizedPoint.x, 0), 1) * max(width, 1)
        let y = min(max(normalizedPoint.y, 0), 1) * max(height, 1)
        let point = CGPoint(x: x, y: y)
        CGWarpMouseCursorPosition(point)

        if let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left),
           let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left) {
            down.post(tap: .cghidEventTap)
            up.post(tap: .cghidEventTap)
            remoteControlProofAt = Date()
            markRemoteDesktopCommand(
                "Preview clicked",
                detail: "Clicked \(Int(x)), \(Int(y)) on the Mac from the phone preview.",
                kind: .change
            )
            currentTaskState = "Preview click from app"
        } else {
            markRemoteDesktopCommand(
                "Preview click failed",
                detail: "macOS did not allow pointer click injection.",
                kind: .error
            )
            currentTaskState = "Preview click failed"
        }
    }

    private static func normalizedPointerPoint(from command: String) -> CGPoint? {
        let parts = command.split(separator: ":").map(String.init)
        guard parts.count == 3,
              let x = Double(parts[1]),
              let y = Double(parts[2]) else { return nil }
        return CGPoint(x: x, y: y)
    }

    private static func commandPayload(after prefix: String, in command: String) -> String? {
        guard command.hasPrefix(prefix) else { return nil }
        return String(command.dropFirst(prefix.count))
    }

    private static func shellQuoted(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\\''"))'"
    }

    func openRemoteDesktopTunnel() {
        currentTaskState = "Opening tunnel"
        let command = settings.remoteDesktopTunnelCommand.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !command.isEmpty else {
            remoteControlSummary = "Configure a tunnel command first."
            remoteControlLastCommand = "Tunnel error"
            append(meta: "Remote desktop", body: "Configure a tunnel command first.", kind: .error)
            recordRun(title: "Tunnel error", detail: "Missing tunnel command", kind: .error)
            currentTaskState = "Idle"
            return
        }

        let escapedCommand = command
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let script = """
        tell application "Terminal"
            activate
            do script "\(escapedCommand)"
        end tell
        """
        var error: NSDictionary?
        guard NSAppleScript(source: script)?.executeAndReturnError(&error) != nil else {
            append(meta: "Remote desktop", body: error?.description ?? "Could not open tunnel terminal.", kind: .error)
            recordRun(title: "Tunnel error", detail: error?.description ?? "Could not open tunnel terminal.", kind: .error)
            currentTaskState = "Idle"
            return
        }
        remoteControlSummary = "Tunnel command opened in Terminal."
        remoteControlLastCommand = "Tunnel"
        append(meta: "Remote desktop", body: "Tunnel command opened in Terminal.", kind: .command)
        recordRun(title: "Tunnel", detail: command, kind: .command)
        currentTaskState = "Tunnel requested"
    }

    func openRemoteDesktop(protocol override: RemoteDesktopProtocol? = nil) {
        currentTaskState = "Opening remote desktop"
        let host = settings.rdpHost.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !host.isEmpty else {
            remoteControlSummary = "Configure a remote host first."
            remoteControlLastCommand = "Connect error"
            append(meta: "Remote desktop", body: "Configure a remote host first.", kind: .error)
            recordRun(title: "Remote desktop error", detail: "Missing remote host", kind: .error)
            currentTaskState = "Idle"
            return
        }

        let protocolKind = override ?? RemoteDesktopProtocol(rawValue: settings.remoteDesktopProtocol) ?? .screenSharing
        let user = settings.rdpUser.trimmingCharacters(in: .whitespacesAndNewlines)
        let target = user.isEmpty ? host : "\(user)@\(host)"
        let urlString: String
        switch protocolKind {
        case .screenSharing:
            let allowed = CharacterSet.urlUserAllowed
                .union(.urlHostAllowed)
                .union(CharacterSet(charactersIn: ":@[]"))
            let encodedTarget = target.addingPercentEncoding(withAllowedCharacters: allowed) ?? target
            urlString = "vnc://\(encodedTarget)"
        case .microsoftRDP:
            let allowed = CharacterSet.urlQueryAllowed.union(CharacterSet(charactersIn: ":@"))
            let encodedTarget = target.addingPercentEncoding(withAllowedCharacters: allowed) ?? target
            urlString = "rdp://full%20address=s:\(encodedTarget)"
        }

        guard let url = URL(string: urlString) else {
            remoteControlSummary = "Invalid remote target."
            remoteControlLastCommand = "Connect error"
            append(meta: "Remote desktop", body: "Invalid remote target.", kind: .error)
            recordRun(title: "Remote desktop error", detail: "Invalid remote target", kind: .error)
            currentTaskState = "Idle"
            return
        }
        NSWorkspace.shared.open(url)
        remoteControlSummary = "\(protocolKind.label) opened for \(target)."
        remoteControlLastCommand = "Connect"
        append(meta: protocolKind.label, body: target, kind: .command)
        recordRun(title: protocolKind.label, detail: target, kind: .command)
        currentTaskState = "Idle"
    }

    func runServerAction(_ path: String) async {
        guard !isRunningServerAction else { return }
        isRunningServerAction = true
        serverActionStatus = "Preparing \(path)"
        currentTaskState = "Running server action"
        defer {
            isRunningServerAction = false
            currentTaskState = "Idle"
        }
        guard await ensureServerReachableForAction("Server action") else {
            serverActionStatus = "Blocked"
            return
        }
        serverActionStatus = "Running \(path)"
        do {
            let text = try await requestText(
                settings.serverBaseURL.normalizedBaseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))),
                method: "POST",
                authenticated: hasHanasandAuth
            )
            serverSummary = text.isEmpty ? "Done" : String(text.prefix(900))
            serverActionStatus = "Completed \(path)"
            append(meta: "Server", body: serverSummary, kind: .command)
            recordRun(title: "Server", detail: path, kind: .command)
        } catch {
            serverSummary = friendlyServerError(error, target: settings.serverBaseURL)
            serverActionStatus = "Failed \(path)"
            append(meta: "Server", body: serverSummary, kind: .error)
            recordRun(title: "Server error", detail: serverSummary, kind: .error)
        }
    }

    func checkServerLogs() async {
        guard !isRunningServerAction else { return }
        isRunningServerAction = true
        serverActionStatus = "Preparing logs"
        currentTaskState = "Loading logs"
        defer {
            isRunningServerAction = false
            currentTaskState = "Idle"
        }
        guard await ensureServerReachableForAction("Server logs") else {
            serverActionStatus = "Logs blocked"
            return
        }
        serverActionStatus = "Loading logs"
        do {
            let url = serverLogsURL()
            let text = try await requestText(
                url,
                authenticated: hasHanasandAuth
            )
            serverSummary = text.isEmpty ? "No logs returned" : String(text.prefix(900))
            serverActionStatus = "Logs loaded"
            append(meta: "Server logs", body: serverSummary, kind: .command)
            recordRun(title: "Server logs", detail: serverSummary, kind: .command)
        } catch {
            serverSummary = friendlyServerError(error, target: settings.serverLogsPath)
            serverActionStatus = "Logs failed"
            append(meta: "Server logs", body: serverSummary, kind: .error)
            recordRun(title: "Server logs error", detail: serverSummary, kind: .error)
        }
    }

    func checkServerReachability(silent: Bool = false) async {
        guard !isCheckingServerReachability else { return }
        isCheckingServerReachability = true
        serverActionStatus = "Checking reachability"
        currentTaskState = "Checking server"
        defer {
            isCheckingServerReachability = false
            if !isRunningServerAction {
                serverActionStatus = "Health check complete"
            }
            currentTaskState = "Idle"
        }

        let vpnTarget = settings.vpnURLScheme.trimmingCharacters(in: .whitespacesAndNewlines)
        let vpnStatus = ServerEndpointStatus(
            title: "VPN",
            target: vpnTarget.isEmpty ? "Not configured" : vpnTarget,
            isReachable: vpnTarget.isEmpty ? false : nil,
            detail: vpnTarget.isEmpty ? "Configure the VPN URL scheme before using internal controls." : "macOS cannot confirm Cisco VPN state directly; use the internal/API checks below.",
            checkedAt: Date()
        )

        async let internalStatus = pingServerEndpoint(
            title: "Internal API",
            url: settings.internalAPIBaseURL.normalizedBaseURL,
            authenticated: hasHanasandAuth
        )
        async let managementStatus = pingServerEndpoint(
            title: "Management plane",
            url: settings.serverBaseURL.normalizedBaseURL,
            authenticated: hasHanasandAuth
        )
        async let logsStatus = pingServerEndpoint(
            title: "Logs",
            url: serverLogsURL(),
            authenticated: hasHanasandAuth
        )

        serverReachability = await [vpnStatus, internalStatus, managementStatus, logsStatus]
        let reachableCount = serverReachability.filter { $0.isReachable == true }.count
        let blocked = serverReachability.filter { $0.isReachable == false }
        if blocked.isEmpty {
            serverSummary = "\(reachableCount) reachable"
        } else {
            serverSummary = "\(blocked.count) blocked"
        }
        if !silent {
            append(meta: "Server health", body: serverSummary, kind: blocked.isEmpty ? .command : .error)
            recordRun(title: "Server health", detail: serverSummary, kind: blocked.isEmpty ? .command : .error)
        }
    }

    func copyServerDiagnostics() {
        let text = serverDiagnosticsText()
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        append(meta: "Server diagnostics", body: "Copied health report.", kind: .command)
        recordRun(title: "Server diagnostics", detail: text, kind: .command)
    }

    private func serverDiagnosticsText() -> String {
        let lines = serverReachability.isEmpty
            ? ["No reachability checks have been run yet."]
            : serverReachability.map { status in
                "- \(status.title): \(status.stateLabel) | \(status.target) | \(status.detail)"
            }
        return ([
            "Hanasand Server Diagnostics",
            "Summary: \(serverSummary)",
            "Last check: \(serverReachabilityCheckedText)",
            "VPN: \(settings.vpnURLScheme)",
            "Internal API: \(settings.internalAPIBaseURL)",
            "Management plane: \(settings.serverBaseURL)",
            "Logs: \(serverLogsURL().absoluteString)",
            "Auth: \(hasHanasandAuth ? "configured" : "missing")",
            "",
        ] + lines).joined(separator: "\n")
    }

    private func ensureServerReachableForAction(_ label: String) async -> Bool {
        await checkServerReachability(silent: true)
        let management = serverReachability.first { $0.title == "Management plane" }
        guard management?.isReachable == true else {
            let detail = management?.detail ?? "Management plane has not been checked."
            serverSummary = "\(label) blocked. Connect VPN or verify \(settings.serverBaseURL). \(detail)"
            append(meta: label, body: serverSummary, kind: .error)
            recordRun(title: "\(label) blocked", detail: serverSummary, kind: .error)
            return false
        }
        return true
    }

    private func serverLogsURL() -> URL {
        let logsPath = settings.serverLogsPath.trimmingCharacters(in: .whitespacesAndNewlines)
        return logsPath.lowercased().hasPrefix("http")
            ? URL(string: logsPath).or(settings.serverBaseURL.normalizedBaseURL)
            : settings.serverBaseURL.normalizedBaseURL.appendingPathComponent(logsPath.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
    }

    private func pingServerEndpoint(title: String, url: URL, authenticated: Bool) async -> ServerEndpointStatus {
        var request = request(url, authenticated: authenticated)
        request.timeoutInterval = 5
        request.httpMethod = "GET"
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            if let http = response as? HTTPURLResponse {
                let reachable = http.statusCode < 500
                let detail: String
                if (200..<300).contains(http.statusCode) {
                    detail = "HTTP \(http.statusCode)"
                } else if [401, 403].contains(http.statusCode) {
                    detail = "HTTP \(http.statusCode). Endpoint is reachable, but auth is required."
                } else {
                    detail = "HTTP \(http.statusCode). Endpoint answered but may not be healthy."
                }
                return ServerEndpointStatus(title: title, target: url.absoluteString, isReachable: reachable, detail: detail, checkedAt: Date())
            }
            return ServerEndpointStatus(title: title, target: url.absoluteString, isReachable: true, detail: "Endpoint responded.", checkedAt: Date())
        } catch {
            return ServerEndpointStatus(title: title, target: url.absoluteString, isReachable: false, detail: friendlyServerError(error, target: url.absoluteString), checkedAt: Date())
        }
    }

    private func friendlyServerError(_ error: Error, target: String) -> String {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet:
                return "Mac offline."
            case .cannotFindHost, .dnsLookupFailed:
                return "Host unresolved. Check VPN/DNS."
            case .cannotConnectToHost, .networkConnectionLost:
                return "Connection failed. Check VPN or server."
            case .timedOut:
                return "Timed out. Check VPN/internal route."
            case .appTransportSecurityRequiresSecureConnection:
                return "Blocked by App Transport Security."
            default:
                return urlError.localizedDescription
            }
        }
        return error.localizedDescription
    }

    func loadNativeDashboardData() async {
        guard let path = selectedDashboardPath else { return }
        guard let endpoint = nativeEndpoint(for: path) else {
            nativeDashboardStatus = "Native controls"
            nativeDashboardPayload = nativeFallbackDescription(for: path)
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Loading \(endpoint.label)"
        defer { isLoadingNativeDashboard = false }

        do {
            let text = try await requestPrettyText(
                endpoint.baseURL.appendingAPIPath(endpoint.path),
                authenticated: endpoint.authenticated,
                userAgent: endpoint.userAgent
            )
            nativeDashboardStatus = "Loaded \(endpoint.label)"
            nativeDashboardPayload = text.isEmpty ? "No data returned." : String(text.prefix(24_000))
            updateTypedDashboardState(from: text, path: path)
            if path == "/profile" {
                await loadProfileSecurityData()
            } else if path == "/dashboard/system/rate-limits" {
                await loadRateLimitApiKeys()
            } else if path == "/users" || path == "/dashboard/management" {
                await loadDashboardRolesForUserManagement()
                await loadSelectedUserRoles()
            }
        } catch {
            nativeDashboardStatus = error.localizedDescription
            nativeDashboardPayload = "Could not load \(endpoint.label): \(error.localizedDescription)"
        }
    }

    func loadDashboardRolesForUserManagement() async {
        guard hasHanasandAuth else {
            roles = []
            return
        }

        do {
            roles = try await requestJSON(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("roles"),
                authenticated: true
            )
        } catch {
            append(meta: "Roles", body: error.localizedDescription, kind: .error)
        }
    }

    func loadRateLimitApiKeys() async {
        guard hasHanasandAuth else {
            apiKeys = []
            return
        }

        do {
            let envelope: DashboardApiKeysEnvelope = try await requestJSON(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("rate-limit/keys"),
                authenticated: true
            )
            apiKeys = envelope.apiKeys
        } catch {
            apiKeys = []
            append(meta: "API keys", body: error.localizedDescription, kind: .error)
        }
    }

    func setRateLimitApiKey(_ key: DashboardApiKeySummary, enabled: Bool) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            append(meta: "API key", body: nativeDashboardStatus, kind: .error)
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = enabled ? "Enabling API key" : "Disabling API key"
        defer { isLoadingNativeDashboard = false }

        do {
            let payload = DashboardApiKeyUpdatePayload(key: key, enabled: enabled)
            let body = try JSONEncoder().encode(payload)
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("rate-limit/keys/\(key.id)"),
                method: "PUT",
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = enabled ? "Enabled \(key.name)" : "Disabled \(key.name)"
            append(meta: "API key", body: text.isEmpty ? nativeDashboardStatus : String(text.prefix(240)), kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "API key", body: error.localizedDescription, kind: .error)
        }
    }

    func deleteRateLimitApiKey(_ key: DashboardApiKeySummary) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            append(meta: "API key", body: nativeDashboardStatus, kind: .error)
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Deleting API key"
        defer { isLoadingNativeDashboard = false }

        do {
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("rate-limit/keys/\(key.id)"),
                method: "DELETE",
                authenticated: true
            )
            nativeDashboardStatus = "Deleted \(key.name)"
            append(meta: "API key", body: text.isEmpty ? nativeDashboardStatus : String(text.prefix(240)), kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "API key", body: error.localizedDescription, kind: .error)
        }
    }

    func issueRateLimitApiKey() async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            append(meta: "API key", body: nativeDashboardStatus, kind: .error)
            return
        }

        let ownerID = rateLimitKeyOwnerID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? userIDForRequests
            : rateLimitKeyOwnerID.trimmingCharacters(in: .whitespacesAndNewlines)
        let name = rateLimitKeyName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !ownerID.isEmpty, !name.isEmpty else {
            nativeDashboardStatus = "Owner and key name are required."
            append(meta: "API key", body: nativeDashboardStatus, kind: .error)
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Issuing API key"
        rateLimitIssuedSecret = nil
        defer { isLoadingNativeDashboard = false }

        do {
            let payload = DashboardApiKeyCreatePayload(
                ownerId: ownerID,
                name: name,
                tier: rateLimitKeyTier.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "starter" : rateLimitKeyTier,
                description: nil,
                enabled: true,
                expiresAt: nil,
                scope: makeRateLimitDraftScope()
            )
            let body = try JSONEncoder().encode(payload)
            let envelope: DashboardApiKeyCreateEnvelope = try await requestJSON(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("rate-limit/keys"),
                method: "POST",
                body: body,
                authenticated: true
            )
            apiKeys.insert(envelope.apiKey, at: 0)
            rateLimitIssuedSecret = envelope.secret
            rateLimitKeyName = ""
            nativeDashboardStatus = "Issued \(envelope.apiKey.name)"
            append(meta: "API key", body: "Issued \(envelope.apiKey.name). Copy the secret now; it is only shown once.", kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "API key", body: error.localizedDescription, kind: .error)
        }
    }

    func setRateLimitEnforcement(enabled: Bool) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            append(meta: "Rate limits", body: nativeDashboardStatus, kind: .error)
            return
        }
        guard let overview = rateLimitOverview else {
            nativeDashboardStatus = "Load rate-limit settings first."
            append(meta: "Rate limits", body: nativeDashboardStatus, kind: .error)
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = enabled ? "Enabling rate limits" : "Pausing rate limits"
        defer { isLoadingNativeDashboard = false }

        do {
            let payload = DashboardRateLimitSettingsPayload(settings: overview.settings, enabled: enabled)
            let body = try JSONEncoder().encode(payload)
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("rate-limit/settings"),
                method: "PUT",
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = enabled ? "Rate limits enabled" : "Rate limits paused"
            append(meta: "Rate limits", body: text.isEmpty ? nativeDashboardStatus : String(text.prefix(240)), kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Rate limits", body: error.localizedDescription, kind: .error)
        }
    }

    func setRateLimitDefault(scope: String, maxRequests: Int) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            append(meta: "Rate limits", body: nativeDashboardStatus, kind: .error)
            return
        }
        guard let overview = rateLimitOverview,
              let currentRule = overview.settings.defaults[scope] else {
            nativeDashboardStatus = "Load rate-limit settings first."
            append(meta: "Rate limits", body: nativeDashboardStatus, kind: .error)
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Saving \(scope) limit"
        defer { isLoadingNativeDashboard = false }

        do {
            let nextRule = DashboardRateLimitRulePayload(
                windowMs: currentRule.windowMs,
                maxRequests: min(max(maxRequests, 1), 1_000_000)
            )
            let payload = DashboardRateLimitSettingsPayload(
                settings: overview.settings,
                enabled: overview.settings.enabled,
                defaultOverrides: [scope: nextRule]
            )
            let body = try JSONEncoder().encode(payload)
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("rate-limit/settings"),
                method: "PUT",
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = "Saved \(scope) limit"
            append(meta: "Rate limits", body: text.isEmpty ? nativeDashboardStatus : String(text.prefix(240)), kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Rate limits", body: error.localizedDescription, kind: .error)
        }
    }

    func setRateLimitOverride(_ override: DashboardRateLimitOverride, enabled: Bool? = nil, remove: Bool = false) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            append(meta: "Rate limits", body: nativeDashboardStatus, kind: .error)
            return
        }
        guard let overview = rateLimitOverview else {
            nativeDashboardStatus = "Load rate-limit settings first."
            append(meta: "Rate limits", body: nativeDashboardStatus, kind: .error)
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = remove ? "Removing route override" : "Saving route override"
        defer { isLoadingNativeDashboard = false }

        do {
            let nextOverrides = overview.settings.overrides.compactMap { current -> DashboardRateLimitOverridePayload? in
                guard current.id == override.id else {
                    return DashboardRateLimitOverridePayload(override: current)
                }
                if remove {
                    return nil
                }
                return DashboardRateLimitOverridePayload(override: current, enabled: enabled ?? current.enabled)
            }
            let payload = DashboardRateLimitSettingsPayload(
                settings: overview.settings,
                enabled: overview.settings.enabled,
                overridePayloads: nextOverrides
            )
            let body = try JSONEncoder().encode(payload)
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("rate-limit/settings"),
                method: "PUT",
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = remove ? "Removed route override" : "Saved route override"
            append(meta: "Rate limits", body: text.isEmpty ? nativeDashboardStatus : String(text.prefix(240)), kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Rate limits", body: error.localizedDescription, kind: .error)
        }
    }

    func addRateLimitOverride() async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            append(meta: "Rate limits", body: nativeDashboardStatus, kind: .error)
            return
        }
        guard let overview = rateLimitOverview else {
            nativeDashboardStatus = "Load rate-limit settings first."
            append(meta: "Rate limits", body: nativeDashboardStatus, kind: .error)
            return
        }

        let routeText = rateLimitOverrideRoute.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallbackRoute = overview.routes.first.map { "\($0.method) \($0.route)" } ?? "GET /api/"
        let selected = routeText.isEmpty ? fallbackRoute : routeText
        let parts = selected.split(separator: " ", maxSplits: 1).map(String.init)
        let method = (parts.first ?? "GET").uppercased()
        let route = parts.count > 1 ? parts[1] : selected
        let normalizedRoute = route.hasPrefix("/") ? route : "/\(route)"
        guard normalizedRoute.hasPrefix("/api") else {
            nativeDashboardStatus = "Override route must stay under /api."
            append(meta: "Rate limits", body: nativeDashboardStatus, kind: .error)
            return
        }

        let scope = ["anonymous", "authenticated", "internal"].contains(rateLimitOverrideScope)
            ? rateLimitOverrideScope
            : "anonymous"
        let windowMs = min(max(Int(rateLimitOverrideWindowMs) ?? 60_000, 1_000), 86_400_000)
        let maxRequests = min(max(Int(rateLimitOverrideMaxRequests) ?? 60, 1), 1_000_000)

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Adding route override"
        defer { isLoadingNativeDashboard = false }

        do {
            let next = DashboardRateLimitOverridePayload(
                id: "desktop_\(UUID().uuidString)",
                enabled: true,
                method: method.isEmpty ? "GET" : method,
                route: normalizedRoute,
                scope: scope,
                windowMs: windowMs,
                maxRequests: maxRequests
            )
            let payload = DashboardRateLimitSettingsPayload(
                settings: overview.settings,
                enabled: overview.settings.enabled,
                overridePayloads: overview.settings.overrides.map(DashboardRateLimitOverridePayload.init) + [next]
            )
            let body = try JSONEncoder().encode(payload)
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("rate-limit/settings"),
                method: "PUT",
                body: body,
                authenticated: true
            )
            rateLimitOverrideRoute = ""
            nativeDashboardStatus = "Added route override"
            append(meta: "Rate limits", body: text.isEmpty ? nativeDashboardStatus : String(text.prefix(240)), kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Rate limits", body: error.localizedDescription, kind: .error)
        }
    }

    private func makeRateLimitDraftScope() -> DashboardApiKeyScopePayload {
        let routeText = rateLimitKeyRoute.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallbackRoute = rateLimitOverview?.routes.first.map { "\($0.method) \($0.route)" } ?? "GET /api/"
        let selected = routeText.isEmpty ? fallbackRoute : routeText
        let parts = selected.split(separator: " ", maxSplits: 1).map(String.init)
        let method = (parts.first ?? "GET").uppercased()
        let route = parts.count > 1 ? parts[1] : selected
        return DashboardApiKeyScopePayload(
            id: "desktop_\(UUID().uuidString)",
            enabled: true,
            method: method.isEmpty ? "GET" : method,
            route: route.hasPrefix("/") ? route : "/\(route)",
            limits: rateLimitPresetLimits(for: rateLimitKeyTier)
        )
    }

    private func rateLimitPresetLimits(for tier: String) -> DashboardApiKeyScopePayload.Limits {
        let presets = rateLimitOverview?.tierPresets ?? []
        let selected = presets.first { $0.id == tier } ?? presets.first { $0.id == "starter" } ?? presets.first
        return DashboardApiKeyScopePayload.Limits(
            perSecond: selected?.defaultLimits.perSecond ?? 2,
            perMinute: selected?.defaultLimits.perMinute ?? 60,
            perHour: selected?.defaultLimits.perHour ?? 1_000,
            perDay: selected?.defaultLimits.perDay ?? 10_000
        )
    }

    private func loadProfileSecurityData() async {
        guard hasHanasandAuth else {
            profileSessions = []
            profileCertificates = []
            return
        }

        profileCertificates = (try? await requestJSON(
            settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("certificates/user/\(userIDForRequests)"),
            authenticated: true
        )) ?? []

        let sessionsEnvelope: DashboardSessionsEnvelope? = try? await requestJSON(
            settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("auth/sessions"),
            authenticated: true
        )
        profileSessions = sessionsEnvelope?.sessions ?? []
    }

    func revokeProfileSession(_ session: DashboardAuthSession) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Revoking session"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("auth/sessions/\(session.tokenID)"),
                method: "DELETE",
                authenticated: true
            )
            nativeDashboardStatus = "Revoked session \(session.tokenID)"
            append(meta: "Session revoked", body: "\(session.deviceLabel) · \(session.ip ?? "unknown IP")", kind: .change)
            await loadProfileSecurityData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Session revoke failed", body: error.localizedDescription, kind: .error)
        }
    }

    func revokeOtherProfileSessions() async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Revoking other sessions"
        defer { isLoadingNativeDashboard = false }

        do {
            let body = (try? JSONEncoder().encode(["keep_current": true])) ?? Data("{}".utf8)
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("auth/sessions/revoke"),
                method: "POST",
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = "Revoked other sessions"
            append(meta: "Sessions revoked", body: String(text.prefix(240)), kind: .change)
            await loadProfileSecurityData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Session revoke failed", body: error.localizedDescription, kind: .error)
        }
    }

    func deleteProfileCertificate(_ certificate: DashboardCertificate) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Deleting certificate"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("certificates/\(certificate.id)"),
                method: "DELETE",
                authenticated: true
            )
            nativeDashboardStatus = "Deleted certificate \(certificate.name)"
            append(meta: "Certificate deleted", body: certificate.name, kind: .change)
            await loadProfileSecurityData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Certificate delete failed", body: error.localizedDescription, kind: .error)
        }
    }

    func restartDockerContainer(_ container: DashboardDockerContainer) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Restarting \(container.displayName)"
        defer { isLoadingNativeDashboard = false }

        do {
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("restart/\(container.id)"),
                authenticated: true
            )
            nativeDashboardStatus = "Restart requested for \(container.displayName)"
            append(meta: "Docker restart", body: text.isEmpty ? container.id : String(text.prefix(240)), kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Docker restart failed", body: error.localizedDescription, kind: .error)
        }
    }

    func runVirtualMachineAction(_ vm: DashboardVM, action: String) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            append(meta: "VM action failed", body: nativeDashboardStatus, kind: .error)
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "\(action.capitalized) \(vm.name)"
        defer { isLoadingNativeDashboard = false }

        do {
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("vm/\(vm.name)/\(action)"),
                method: "POST",
                authenticated: true
            )
            nativeDashboardStatus = "\(action.capitalized) requested for \(vm.name)"
            append(meta: "VM \(action)", body: text.isEmpty ? vm.name : String(text.prefix(240)), kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "VM \(action) failed", body: error.localizedDescription, kind: .error)
        }
    }

    func chooseUploadFile() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowedContentTypes = [.image, .movie, .pdf, .plainText, .json, .data]

        guard panel.runModal() == .OK, let url = panel.url else {
            uploadStatus = "File selection cancelled."
            return
        }

        selectUploadFile(url)
    }

    func selectUploadFile(_ url: URL) {
        uploadFileURL = url
        uploadName = url.lastPathComponent
        uploadType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        if uploadPath.isEmpty {
            uploadPath = url.deletingPathExtension().lastPathComponent.slugifiedPath
        }
        uploadPathAvailable = nil
        uploadedFileURL = ""
        uploadStatus = "Ready to upload \(url.lastPathComponent)."
    }

    func resetUploadDraft() {
        uploadFileURL = nil
        uploadName = ""
        uploadDescription = ""
        uploadPath = ""
        uploadType = "application/octet-stream"
        uploadPathAvailable = nil
        uploadedFileURL = ""
        uploadStatus = "Choose a file to upload to the CDN."
    }

    func copyUploadedFileURL() {
        guard !uploadedFileURL.isEmpty else {
            uploadStatus = "No uploaded URL to copy yet."
            return
        }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(uploadedFileURL, forType: .string)
        uploadStatus = "Copied uploaded file URL."
        append(meta: "Upload", body: "Copied \(uploadedFileURL)", kind: .command)
    }

    func openUploadedFileURL() {
        guard let url = URL(string: uploadedFileURL), !uploadedFileURL.isEmpty else {
            uploadStatus = "No uploaded URL to open yet."
            return
        }
        NSWorkspace.shared.open(url)
        uploadStatus = "Opened uploaded file."
        append(meta: "Upload", body: url.absoluteString, kind: .command)
    }

    func selectUploadProviders(_ providers: [NSItemProvider]) -> Bool {
        importFileProviders(providers) { [weak self] urls in
            guard let first = urls.first else { return }
            self?.selectUploadFile(first)
        }
        return !providers.isEmpty
    }

    func checkUploadPath() async {
        let safePath = uploadPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !safePath.isEmpty else {
            uploadPathAvailable = nil
            uploadStatus = "Custom path is optional. Leave it blank to use the generated file id."
            return
        }

        isCheckingUploadPath = true
        defer { isCheckingUploadPath = false }

        do {
            var components = URLComponents(url: settings.cdnBaseURL.normalizedBaseURL.appendingPathComponent("files/check"), resolvingAgainstBaseURL: false)
            components?.queryItems = [URLQueryItem(name: "path", value: safeUploadPathWithExtension())]
            let text = try await requestPrettyText(components?.url ?? settings.cdnBaseURL.normalizedBaseURL.appendingPathComponent("files/check"))
            let exists = text.localizedCaseInsensitiveContains(#""exists": true"#) || text.localizedCaseInsensitiveContains(#""exists":true"#)
            uploadPathAvailable = !exists
            uploadStatus = exists ? "That path is already taken." : "Path is available."
        } catch {
            uploadPathAvailable = false
            uploadStatus = "Could not check path: \(error.localizedDescription)"
        }
    }

    func uploadSelectedFile() async {
        guard let fileURL = uploadFileURL else {
            uploadStatus = "Choose a file first."
            return
        }

        if uploadPathAvailable == false {
            uploadStatus = "Choose an available path before uploading."
            return
        }

        isUploadingFile = true
        defer { isUploadingFile = false }

        do {
            let boundary = "Boundary-\(UUID().uuidString)"
            let body = try multipartUploadBody(fileURL: fileURL, boundary: boundary)
            var request = URLRequest(url: settings.cdnBaseURL.normalizedBaseURL.appendingPathComponent("files"))
            request.httpMethod = "POST"
            request.timeoutInterval = 90
            request.httpBody = body
            request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
            request.setValue("application/json", forHTTPHeaderField: "Accept")

            let (data, response) = try await URLSession.shared.data(for: request)
            try validateHTTP(response)
            let uploaded = try JSONDecoder().decode(UploadedFileResponse.self, from: data)
            let destination = uploadedURL(for: uploaded)
            uploadedFileURL = destination
            uploadStatus = "Uploaded \(uploadName) successfully."
            append(meta: "Upload", body: destination, kind: .change)
        } catch {
            uploadStatus = "Upload failed: \(error.localizedDescription)"
            append(meta: "Upload", body: error.localizedDescription, kind: .error)
        }
    }

    private func safeUploadPathWithExtension() -> String {
        let safePath = uploadPath.slugifiedPath
        let ext = uploadFileURL?.pathExtension.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !ext.isEmpty, !safePath.lowercased().hasSuffix(".\(ext.lowercased())") else { return safePath }
        return "\(safePath).\(ext.lowercased())"
    }

    private func uploadedURL(for uploaded: UploadedFileResponse) -> String {
        let base = settings.cdnBaseURL.normalizedBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if !uploadPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "\(base)/files/path/\(uploadPath.slugifiedPath)"
        }
        return "\(base)/files/\(uploaded.id)"
    }

    private func multipartUploadBody(fileURL: URL, boundary: String) throws -> Data {
        var body = Data()
        let fileData = try Data(contentsOf: fileURL)
        let fields: [(String, String)] = [
            ("name", uploadName.isEmpty ? fileURL.lastPathComponent : uploadName),
            ("description", uploadDescription),
            ("path", uploadPath.isEmpty ? "" : uploadPath.slugifiedPath),
            ("type", uploadType.isEmpty ? "application/octet-stream" : uploadType),
        ].filter { !$0.1.isEmpty }

        for (name, value) in fields {
            body.appendMultipartBoundary(boundary)
            body.appendUTF8("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
            body.appendUTF8("\(value)\r\n")
        }

        body.appendMultipartBoundary(boundary)
        body.appendUTF8("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileURL.lastPathComponent)\"\r\n")
        body.appendUTF8("Content-Type: \(uploadType.isEmpty ? "application/octet-stream" : uploadType)\r\n\r\n")
        body.append(fileData)
        body.appendUTF8("\r\n")
        body.appendUTF8("--\(boundary)--\r\n")
        return body
    }

    func runNativeDashboardMutation(_ mutation: NativeDashboardMutation) async {
        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Running \(mutation.label)"
        defer { isLoadingNativeDashboard = false }

        do {
            let text = try await requestPrettyText(
                mutation.baseURL(settings: settings).appendingAPIPath(mutation.path),
                method: "POST",
                body: mutation.body,
                authenticated: true,
                userAgent: mutation.userAgent
            )
            nativeDashboardStatus = text.isEmpty ? "Completed \(mutation.label)" : String(text.prefix(240))
            append(meta: mutation.label, body: nativeDashboardStatus, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: mutation.label, body: error.localizedDescription, kind: .error)
        }
    }

    private func append(meta: String, body: String, kind: AgentEvent.Kind = .note) {
        events.append(AgentEvent(meta: meta, body: body, kind: kind))
        if events.count > 80 {
            events.removeFirst(events.count - 80)
        }
    }

    var hasHanasandAuth: Bool {
        !authTokenForRequests.isEmpty && !userIDForRequests.isEmpty
    }

    func loginToHanasand() async {
        let username = loginUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        let password = loginPassword
        guard !username.isEmpty, !password.isEmpty, !isLoggingIn else {
            loginStatus = "Enter username and password."
            return
        }

        isLoggingIn = true
        loginStatus = "Signing in"
        defer { isLoggingIn = false }

        do {
            let url = settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("auth/login/\(username.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? username)")
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 15
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Hanasand Desktop/\(Self.appVersion)", forHTTPHeaderField: "User-Agent")
            request.httpBody = try JSONEncoder().encode(HanasandLoginRequest(password: password))

            let (data, response) = try await URLSession.shared.data(for: request)
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 200
            let decoded = try? JSONDecoder().decode(HanasandLoginResponse.self, from: data)

            guard (200..<300).contains(statusCode), let token = decoded?.token, !token.isEmpty else {
                let message = decoded?.error
                    ?? String(data: data, encoding: .utf8)
                    ?? "Login failed."
                loginStatus = message
                return
            }

            settings.authToken = token
            settings.userID = decoded?.id ?? username
            loginUsername = ""
            loginPassword = ""
            loginStatus = ""
            append(meta: "Login", body: "Signed in as \(settings.userID).", kind: .change)
        } catch {
            loginStatus = error.localizedDescription
        }
    }

    func beginPasswordReset() {
        let username = loginUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        passwordResetUsername = username
        passwordResetCode = ""
        passwordResetToken = ""
        passwordResetNewPassword = ""
        passwordResetConfirmPassword = ""
        passwordResetStatus = ""
        lastAutoVerifiedPasswordResetCode = ""
        passwordResetStep = .code
    }

    func cancelPasswordReset() {
        passwordResetCode = ""
        passwordResetToken = ""
        passwordResetNewPassword = ""
        passwordResetConfirmPassword = ""
        passwordResetStatus = ""
        lastAutoVerifiedPasswordResetCode = ""
        passwordResetStep = .idle
    }

    func updatePasswordResetCode(_ rawValue: String) {
        let clean = String(rawValue.filter(\.isNumber).prefix(6))
        if passwordResetCode != clean {
            passwordResetCode = clean
        }
        if clean.count < 6 {
            lastAutoVerifiedPasswordResetCode = ""
            return
        }
        autoVerifyPasswordResetCodeIfReady()
    }

    private func autoVerifyPasswordResetCodeIfReady() {
        let username = passwordResetUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        let code = passwordResetCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard passwordResetStep == .code, !username.isEmpty, code.count == 6, !isResettingPassword else { return }
        guard lastAutoVerifiedPasswordResetCode != code else { return }
        lastAutoVerifiedPasswordResetCode = code
        Task { await verifyPasswordResetCode() }
    }

    func requestPasswordResetCode() async {
        let username = passwordResetUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !username.isEmpty, !isResettingPassword else {
            passwordResetStatus = "Type your username first."
            return
        }

        isResettingPassword = true
        passwordResetStatus = "Sending code"
        defer { isResettingPassword = false }

        do {
            let url = settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("auth/password-reset/request")
            let body = try JSONEncoder().encode(PasswordResetRequestPayload(id: username))
            let response: PasswordResetResponse = try await passwordResetJSON(url, body: body)
            if let error = response.error, !error.isEmpty {
                passwordResetStatus = error
                return
            }

            passwordResetUsername = username
            passwordResetCode = ""
            passwordResetToken = ""
            lastAutoVerifiedPasswordResetCode = ""
            passwordResetStep = .code
            passwordResetStatus = "Check your mail for the 6 digit code."
        } catch {
            passwordResetStatus = error.localizedDescription
        }
    }

    func verifyPasswordResetCode() async {
        let username = passwordResetUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        let code = passwordResetCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !username.isEmpty, code.count == 6, !isResettingPassword else {
            passwordResetStatus = "Enter the 6 digit code."
            return
        }

        isResettingPassword = true
        passwordResetStatus = "Checking code"
        defer { isResettingPassword = false }

        do {
            let url = settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("auth/password-reset/verify")
            let body = try JSONEncoder().encode(PasswordResetVerifyPayload(id: username, code: code))
            let response: PasswordResetVerifyResponse = try await passwordResetJSON(url, body: body)
            guard let token = response.resetToken, !token.isEmpty else {
                lastAutoVerifiedPasswordResetCode = ""
                passwordResetStatus = response.error ?? "Invalid reset code."
                return
            }

            passwordResetToken = token
            passwordResetNewPassword = ""
            passwordResetConfirmPassword = ""
            passwordResetStep = .newPassword
            passwordResetStatus = "Code accepted."
        } catch {
            lastAutoVerifiedPasswordResetCode = ""
            passwordResetStatus = error.localizedDescription
        }
    }

    func completePasswordReset() async {
        let username = passwordResetUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !username.isEmpty, !passwordResetToken.isEmpty, !isResettingPassword else {
            passwordResetStatus = "Reset session expired. Send a new code."
            return
        }
        guard passwordResetNewPassword == passwordResetConfirmPassword else {
            passwordResetStatus = "Passwords do not match."
            return
        }
        guard !passwordResetNewPassword.isEmpty else {
            passwordResetStatus = "Enter a new password."
            return
        }

        isResettingPassword = true
        passwordResetStatus = "Setting password"
        defer { isResettingPassword = false }

        do {
            let url = settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("auth/password-reset/complete")
            let body = try JSONEncoder().encode(PasswordResetCompletePayload(
                id: username,
                resetToken: passwordResetToken,
                password: passwordResetNewPassword
            ))
            let response: PasswordResetResponse = try await passwordResetJSON(url, body: body)
            if let error = response.error, !error.isEmpty {
                passwordResetStatus = error
                return
            }

            loginUsername = username
            loginPassword = ""
            passwordResetCode = ""
            passwordResetToken = ""
            passwordResetNewPassword = ""
            passwordResetConfirmPassword = ""
            passwordResetStep = .idle
            loginStatus = "Password reset. Log in with the new one."
            passwordResetStatus = ""
        } catch {
            passwordResetStatus = error.localizedDescription
        }
    }

    private func passwordResetJSON<T: Decodable>(_ url: URL, body: Data) async throws -> T {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Hanasand Desktop/\(Self.appVersion)", forHTTPHeaderField: "User-Agent")
        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)
        let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 200
        if (200..<300).contains(statusCode) {
            return try JSONDecoder().decode(T.self, from: data)
        }

        if let decoded = try? JSONDecoder().decode(PasswordResetResponse.self, from: data),
           let error = decoded.error,
           !error.isEmpty {
            throw PasswordResetRequestError.message(error)
        }

        throw PasswordResetRequestError.message("Password reset endpoint returned HTTP \(statusCode).")
    }

    private var authTokenForRequests: String {
        let configured = settings.authToken.trimmingCharacters(in: .whitespacesAndNewlines)
        if !configured.isEmpty {
            return configured
        }
        let environment = ProcessInfo.processInfo.environment
        return environment["HANASAND_API_TOKEN"] ?? environment["HANASAND_AUTH_TOKEN"] ?? ""
    }

    private var userIDForRequests: String {
        let configured = settings.userID.trimmingCharacters(in: .whitespacesAndNewlines)
        if !configured.isEmpty {
            return configured
        }
        return ProcessInfo.processInfo.environment["HANASAND_USER_ID"] ?? ""
    }

    private func saveSettings() {
        guard let data = try? JSONEncoder().encode(settings) else { return }
        UserDefaults.standard.set(data, forKey: Self.settingsKey)
    }

    private func request(_ url: URL, method: String = "GET", body: Data? = nil, authenticated: Bool = false, userAgent: String? = nil) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 12
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let userAgent {
            request.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        }
        if authenticated {
            request.setValue("Bearer \(authTokenForRequests)", forHTTPHeaderField: "Authorization")
            request.setValue(userIDForRequests, forHTTPHeaderField: "id")
        }
        return request
    }

    private func mailOverviewURL() -> URL {
        var components = URLComponents(url: settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("mail/overview"), resolvingAgainstBaseURL: false)
        var items: [URLQueryItem] = []
        if !selectedMailAccountUser.isEmpty {
            items.append(URLQueryItem(name: "mailboxUser", value: selectedMailAccountUser))
        }
        if !selectedMailboxID.isEmpty {
            items.append(URLQueryItem(name: "mailboxId", value: selectedMailboxID))
        }
        if !selectedMailMessageID.isEmpty {
            items.append(URLQueryItem(name: "messageId", value: selectedMailMessageID))
        }
        if !items.isEmpty {
            components?.queryItems = items
        }
        return components?.url ?? settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("mail/overview")
    }

    private func requestJSON<T: Decodable>(_ url: URL, method: String = "GET", body: Data? = nil, authenticated: Bool = false) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request(url, method: method, body: body, authenticated: authenticated))
        try validateHTTP(response)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func isValidShortcutDestination(_ path: String) -> Bool {
        let clean = path.trimmingCharacters(in: .whitespacesAndNewlines)
        return clean.contains("http") || (clean.contains(".") && clean.count > 2) || clean.contains(":")
    }

    private func requestText(_ url: URL, method: String = "GET", authenticated: Bool = false) async throws -> String {
        let (data, response) = try await URLSession.shared.data(for: request(url, method: method, authenticated: authenticated))
        try validateHTTP(response)
        return String(data: data, encoding: .utf8) ?? ""
    }

    private func requestPrettyText(_ url: URL, method: String = "GET", body: Data? = nil, authenticated: Bool = false, userAgent: String? = nil) async throws -> String {
        let (data, response) = try await URLSession.shared.data(for: request(url, method: method, body: body, authenticated: authenticated, userAgent: userAgent))
        try validateHTTP(response)
        if let object = try? JSONSerialization.jsonObject(with: data),
           let prettyData = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys]),
           let pretty = String(data: prettyData, encoding: .utf8) {
            return pretty
        }
        return String(data: data, encoding: .utf8) ?? ""
    }

    private func updateTypedDashboardState(from text: String, path: String) {
        guard let data = text.data(using: .utf8) else { return }
        let decoder = JSONDecoder()
        switch path {
        case "/dashboard":
            serviceStatus = try? decoder.decode(DashboardServiceStatus.self, from: data)
        case "/dashboard/db":
            databaseOverview = try? decoder.decode(DashboardDatabaseOverview.self, from: data)
        case "/dashboard/mail":
            if let overview = try? decoder.decode(MailOverviewEnvelope.self, from: data) {
                mailOverview = overview
                selectedMailAccountUser = overview.mailboxUser ?? selectedMailAccountUser
                selectedMailboxID = overview.selectedMailboxId ?? selectedMailboxID
                selectedMailMessageID = overview.selectedMessage?.id ?? overview.messages.first?.id ?? selectedMailMessageID
                mailSummary = "\(overview.messages.count) messages · \(overview.mailboxes.count) mailboxes"
            }
        case "/dashboard/db/backups":
            backupServices = (try? decoder.decode([DashboardBackupService].self, from: data)) ?? []
        case "/dashboard/db/restore":
            backupFiles = (try? decoder.decode([DashboardBackupFile].self, from: data)) ?? []
        case "/dashboard/notes":
            notes = (try? decoder.decode([DashboardNote].self, from: data)) ?? []
            if selectedNoteID.isEmpty || !notes.contains(where: { $0.id == selectedNoteID }) {
                selectedNoteID = notes.first?.id ?? ""
            }
            loadSelectedNoteIntoDraft()
        case "/s":
            shares = (try? decoder.decode([DashboardShare].self, from: data)) ?? []
        case "/dashboard/articles":
            articles = (try? decoder.decode([DashboardArticle].self, from: data)) ?? []
            if selectedArticleID.isEmpty || !articles.contains(where: { $0.id == selectedArticleID }) {
                selectedArticleID = articles.first?.id ?? ""
                if let article = articles.first {
                    loadArticleIntoEditor(article)
                }
            }
        case "/dashboard/thoughts":
            thoughts = (try? decoder.decode([DashboardThought].self, from: data)) ?? []
            if selectedThoughtID.isEmpty || !thoughts.contains(where: { $0.id == selectedThoughtID }) {
                selectedThoughtID = thoughts.first?.id ?? ""
                if let thought = thoughts.first {
                    loadThoughtIntoEditor(thought)
                }
            }
        case "/dashboard/system/ai":
            if let envelope = try? decoder.decode(AIModelsEnvelope.self, from: data) {
                aiClients = envelope.connected.map { client in
                    AIConnectedClient(
                        rawID: client.id,
                        name: client.name,
                        lastSeen: client.lastSeen,
                        model: client.model
                    )
                }.sortedForRuntime
            }
        case "/profile":
            profile = try? decoder.decode(DashboardProfile.self, from: data)
        case "/users", "/dashboard/management":
            users = (try? decoder.decode([DashboardUser].self, from: data)) ?? []
            if selectedUserID.isEmpty || !users.contains(where: { $0.id == selectedUserID }) {
                selectedUserID = users.first?.id ?? ""
            }
        case "/role":
            roles = (try? decoder.decode([DashboardRole].self, from: data)) ?? []
            if selectedRoleID.isEmpty || !roles.contains(where: { $0.id == selectedRoleID }) {
                selectedRoleID = roles.first?.id ?? ""
                if let role = roles.first {
                    loadRoleIntoEditor(role)
                }
            }
        case "/dashboard/logs":
            if let envelope = try? decoder.decode(DashboardLogsEnvelope.self, from: data) {
                logs = envelope.logs
            } else {
                logs = (try? decoder.decode([DashboardLogEntry].self, from: data)) ?? []
            }
        case "/dashboard/system":
            if let envelope = try? decoder.decode(DashboardDockerEnvelope.self, from: data) {
                dockerContainers = envelope.resolvedContainers
            } else {
                dockerContainers = (try? decoder.decode([DashboardDockerContainer].self, from: data)) ?? []
            }
        case "/dashboard/vms":
            if let envelope = try? decoder.decode(DashboardVMEnvelope.self, from: data) {
                virtualMachines = envelope.resolvedVMs
            } else {
                virtualMachines = (try? decoder.decode([DashboardVM].self, from: data)) ?? []
            }
        case "/dashboard/tests":
            recentTests = (try? decoder.decode([DashboardRecentTest].self, from: data)) ?? []
        case "/dashboard/vulnerabilities":
            vulnerabilityReport = try? decoder.decode(DashboardVulnerabilityReport.self, from: data)
        case "/dashboard/traffic":
            trafficMetrics = try? decoder.decode(DashboardTrafficMetrics.self, from: data)
        case "/dashboard/system/rate-limits":
            rateLimitOverview = try? decoder.decode(DashboardRateLimitOverview.self, from: data)
        default:
            break
        }
    }

    private func validateHTTP(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            throw DashboardRequestError.httpStatus(http.statusCode)
        }
    }

    var realProjects: [ProjectItem] {
        let saved = customProjectTitles.map { ProjectItem(title: $0, state: selectedProject == $0 ? .active : .normal) }
        return [
            .folder("Current"),
            .init(title: URL(fileURLWithPath: status.cwd).lastPathComponent, state: status.ok ? .live : .normal),
        ] + saved
    }

    func createProject() {
        let base = "Project"
        var index = customProjectTitles.count + 1
        var title = "\(base) \(index)"
        while customProjectTitles.contains(title) {
            index += 1
            title = "\(base) \(index)"
        }
        customProjectTitles.append(title)
        selectedProject = title
        selectedSection = .command
        append(meta: "Project", body: "Created \(title).", kind: .change)
    }

    func reviewChangedFiles() {
        selectedSection = .ide
        refreshChangedFilesSummary()
    }

    func refreshChangedFilesSummary() {
        let cwd = status.cwd
        changedFileSummaryStatus = "Checking Git"
        Task {
            let result = await Task.detached {
                Self.executeShellWithStatus("git status --porcelain", cwd: cwd)
            }.value
            await MainActor.run {
                guard result.exitCode == 0 else {
                    changedFileSummary = []
                    changedFileSummaryStatus = "No Git repository here"
                    return
                }
                let changes = result.output
                    .components(separatedBy: .newlines)
                    .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                    .map { line -> ChangedFileSummary in
                        let status = String(line.prefix(2)).trimmingCharacters(in: .whitespaces)
                        let rawPath = String(line.dropFirst(min(3, line.count)))
                        let path = rawPath.components(separatedBy: " -> ").last ?? rawPath
                        return ChangedFileSummary(id: path, status: status.isEmpty ? "M" : status, path: path)
                    }
                changedFileSummary = changes
                changedFileSummaryStatus = changes.isEmpty ? "Working tree clean" : "\(changes.count) files changed"
            }
        }
    }

    nonisolated private static func executeShellWithStatus(_ command: String, cwd: String) -> (output: String, exitCode: Int32) {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lc", command]
        process.currentDirectoryURL = URL(fileURLWithPath: cwd)
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        do {
            try process.run()
            process.waitUntilExit()
            let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            return (output, process.terminationStatus)
        } catch {
            return ("", 1)
        }
    }

    nonisolated private static func executeShell(_ command: String, cwd: String) -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lc", command]
        process.currentDirectoryURL = URL(fileURLWithPath: cwd)
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        do {
            try process.run()
            process.waitUntilExit()
            return String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        } catch {
            return ""
        }
    }

    var dashboardActions: [DesktopAction] {
        [
            .route("Overview", "Main dashboard and service overview.", "gauge.with.dots.needle", "/dashboard"),
            .route("Mail", "Open Mail.", "envelope", "/dashboard/mail"),
            .route("Notes", "Shared notes and operational memory.", "note.text", "/dashboard/notes"),
            .route("Traffic", "Live traffic, records, and maps.", "point.3.connected.trianglepath.dotted", "/dashboard/traffic"),
            .route("AI Metrics", "Model pool and system AI telemetry.", "sparkles", "/dashboard/system/ai"),
            .route("Rate Limits", "API pressure, route overrides, and keys.", "gauge.with.needle", "/dashboard/system/rate-limits"),
            .route("System", "Infrastructure and VM controls.", "gearshape.2", "/dashboard/system"),
            .route("VMs", "Remote machines and access details.", "display.2", "/dashboard/vms"),
            .route("Shares", "Shares and hosted files.", "folder.badge.gearshape", "/s"),
            .route("Links", "Create and inspect /g shortcut links.", "link", "/g"),
            .route("Load Tests", "Recent public load-test runs.", "speedometer", "/dashboard/tests"),
            .route("Articles", "Draft and publish articles.", "text.alignleft", "/dashboard/articles"),
            .route("Thoughts", "Ideas, writing, and thought board.", "brain.head.profile", "/dashboard/thoughts"),
            .route("Profile", "Account, VMs, sessions, and certificates.", "person.crop.circle", "/profile"),
        ]
    }

    var adminActions: [DesktopAction] {
        [
            .route("Logs", "Runtime logs and diagnostics.", "exclamationmark.triangle", "/dashboard/logs"),
            .route("Database", "Database overview and operations.", "externaldrive.connected.to.line.below", "/dashboard/db"),
            .route("Backups", "Database backup status.", "externaldrive.badge.timemachine", "/dashboard/db/backups"),
            .route("Restore", "Browse and restore database backups.", "arrow.counterclockwise.circle", "/dashboard/db/restore"),
            .route("Vulnerabilities", "Security image scans and findings.", "shield.lefthalf.filled.badge.checkmark", "/dashboard/vulnerabilities"),
            .route("Management", "Admin management console.", "checkmark.shield", "/dashboard/management"),
            .route("Users", "User administration.", "person.2", "/users"),
            .route("Roles", "Role administration.", "person.badge.key", "/role"),
        ]
    }

    var quickAppActions: [DesktopAction] {
        [
            .url("Hanasand", "Open the public website.", "safari", settings.websiteBaseURL),
            .route("Upload", "Native CDN file uploader.", "arrow.up.doc", "/upload"),
            .url("GitHub", "Open source repositories.", "chevron.left.forwardslash.chevron.right", "https://github.com/eirikhanasand"),
            .url("LinkedIn", "Open LinkedIn profile.", "person.text.rectangle", "https://linkedin.com/in/eirikhanasand"),
            .url("Mail", "Compose an email.", "paperplane", "mailto:eirik.hanasand@gmail.com"),
            .url("Discord", "Open Discord profile.", "bubble.left.and.bubble.right", "https://discordapp.com/users/376827396764073997"),
        ]
    }

    private struct NativeEndpoint {
        let label: String
        let baseURL: URL
        let path: String
        let authenticated: Bool
        let userAgent: String?
    }

    private func nativeEndpoint(for dashboardPath: String) -> NativeEndpoint? {
        let cleanPath = dashboardPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let api = settings.apiBaseURL.normalizedBaseURL
        let internalAPI = settings.internalAPIBaseURL.normalizedBaseURL
        let beekeeper = settings.beekeeperAPIBaseURL.normalizedBaseURL
        let auth = hasHanasandAuth

        switch cleanPath {
        case "dashboard", "dashboard/overview":
            return NativeEndpoint(label: "system status", baseURL: api, path: "status", authenticated: auth, userAgent: nil)
        case "dashboard/mail":
            return NativeEndpoint(label: "mail overview", baseURL: api, path: "mail/overview", authenticated: true, userAgent: nil)
        case "dashboard/notes":
            return NativeEndpoint(label: "notes", baseURL: api, path: "notes", authenticated: true, userAgent: nil)
        case "dashboard/traffic":
            return NativeEndpoint(label: "traffic metrics", baseURL: beekeeper, path: "traffic/metrics", authenticated: true, userAgent: nil)
        case "dashboard/system":
            return NativeEndpoint(label: "docker metrics", baseURL: api, path: "docker", authenticated: auth, userAgent: nil)
        case "dashboard/system/ai":
            return NativeEndpoint(label: "AI models", baseURL: api, path: "ai/models", authenticated: auth, userAgent: nil)
        case "dashboard/system/rate-limits":
            return NativeEndpoint(label: "rate limits", baseURL: api, path: "rate-limit/settings", authenticated: true, userAgent: nil)
        case "dashboard/vms":
            let userPath = userIDForRequests.isEmpty ? "vms" : "vms/access/\(userIDForRequests)"
            return NativeEndpoint(label: "virtual machines", baseURL: api, path: userPath, authenticated: auth, userAgent: nil)
        case "dashboard/tests":
            return NativeEndpoint(label: "recent tests", baseURL: api, path: "tests/recent", authenticated: auth, userAgent: nil)
        case "dashboard/logs":
            return NativeEndpoint(label: "logs", baseURL: api, path: "logs", authenticated: true, userAgent: nil)
        case "dashboard/db":
            return NativeEndpoint(label: "database overview", baseURL: internalAPI, path: "db", authenticated: true, userAgent: "hanasand_internal")
        case "dashboard/db/backups":
            return NativeEndpoint(label: "backup services", baseURL: internalAPI, path: "backup", authenticated: true, userAgent: "hanasand_internal")
        case "dashboard/db/restore":
            return NativeEndpoint(label: "backup files", baseURL: internalAPI, path: "backup/files", authenticated: true, userAgent: "hanasand_internal")
        case "dashboard/vulnerabilities":
            return NativeEndpoint(label: "vulnerabilities", baseURL: internalAPI, path: "vulnerabilities", authenticated: true, userAgent: "hanasand_internal")
        case "dashboard/management", "users":
            return NativeEndpoint(label: "users", baseURL: api, path: "users", authenticated: true, userAgent: nil)
        case "role":
            return NativeEndpoint(label: "roles", baseURL: api, path: "roles", authenticated: true, userAgent: nil)
        case "dashboard/articles":
            return NativeEndpoint(label: "articles", baseURL: api, path: "articles", authenticated: auth, userAgent: nil)
        case "dashboard/thoughts":
            return NativeEndpoint(label: "thoughts", baseURL: api, path: "thoughts", authenticated: auth, userAgent: nil)
        case "profile":
            guard !userIDForRequests.isEmpty else { return nil }
            return NativeEndpoint(label: "profile", baseURL: api, path: "user/full/\(userIDForRequests)", authenticated: true, userAgent: nil)
        case "s":
            guard !userIDForRequests.isEmpty else { return nil }
            return NativeEndpoint(label: "shares", baseURL: settings.cdnBaseURL.normalizedBaseURL, path: "share/user/\(userIDForRequests)", authenticated: true, userAgent: nil)
        case "g":
            return nil
        default:
            return nil
        }
    }

    private func nativeFallbackDescription(for dashboardPath: String) -> String {
        switch dashboardPath {
        case "/g":
            return "Native shortcut controls are ready. Create a /g link, inspect an existing shortcut, or update its destination."
        case "/upload", "/dashboard/files":
            return "Native uploader is ready. Choose a file, optionally reserve a path, then upload directly to the CDN."
        case "/profile":
            return "Configure auth token and user id in Settings to load the native profile data."
        case "/s":
            return "Configure auth token and user id in Settings to load and create shares natively."
        default:
            return "No direct API-backed native panel is registered for \(dashboardPath) yet."
        }
    }

    func selectNote(_ note: DashboardNote?) {
        selectedNoteID = note?.id ?? ""
        loadSelectedNoteIntoDraft()
    }

    func newNoteDraft() {
        selectedNoteID = ""
        noteDraftTitle = ""
        noteDraftContent = ""
    }

    func saveNoteDraft() async {
        let title = noteDraftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let content = noteDraftContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty || !content.isEmpty else {
            nativeDashboardStatus = "Write something first."
            return
        }

        let payload = ["title": title, "content": content, "source": "desktop"]
        let body = (try? JSONEncoder().encode(payload)) ?? Data("{}".utf8)
        let isUpdate = !selectedNoteID.isEmpty
        let path = isUpdate ? "notes/\(selectedNoteID)" : "notes"
        let method = isUpdate ? "PUT" : "POST"

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath(path),
                method: method,
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = "Saved note."
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
        }
    }

    func deleteSelectedNote() async {
        guard !selectedNoteID.isEmpty else { return }
        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("notes/\(selectedNoteID)"),
                method: "DELETE",
                authenticated: true
            )
            nativeDashboardStatus = "Deleted note."
            selectedNoteID = ""
            noteDraftTitle = ""
            noteDraftContent = ""
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
        }
    }

    private func loadSelectedNoteIntoDraft() {
        guard let selected = notes.first(where: { $0.id == selectedNoteID }) else {
            noteDraftTitle = ""
            noteDraftContent = ""
            return
        }
        noteDraftTitle = selected.title
        noteDraftContent = selected.content
    }

    func createNativeShare() async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        let name = shareDraftName.trimmingCharacters(in: .whitespacesAndNewlines)
        let content = shareDraftContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else {
            nativeDashboardStatus = "Add share content first."
            return
        }

        let id = "desktop-\(UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(12).lowercased())"
        let normalizedName = name.isEmpty ? "desktop-share-\(id.suffix(6))" : name
        let payload = CreateSharePayload(
            id: id,
            includeTree: true,
            name: normalizedName,
            path: normalizedName.slugifiedPath,
            content: content,
            parent: nil,
            type: "share"
        )
        let body = (try? JSONEncoder().encode(payload)) ?? Data("{}".utf8)

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Creating share"
        defer { isLoadingNativeDashboard = false }

        do {
            let text = try await requestPrettyText(
                settings.cdnBaseURL.normalizedBaseURL.appendingAPIPath("share"),
                method: "POST",
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = "Created \(normalizedName)"
            nativeDashboardPayload = text
            shareDraftName = ""
            shareDraftContent = ""
            append(meta: "Share created", body: normalizedName, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Share failed", body: error.localizedDescription, kind: .error)
        }
    }

    func openShare(_ share: DashboardShare) {
        let target = share.path?.trimmingCharacters(in: .whitespacesAndNewlines)
        openWebsite(path: "/s/\((target?.isEmpty == false ? target : share.id) ?? share.id)", label: share.displayName)
    }

    func loadShareIntoEditor(_ share: DashboardShare) {
        selectedShareID = share.id
        shareEditName = share.name ?? ""
        shareEditPath = share.path ?? ""
        shareEditContent = share.content ?? ""
        nativeDashboardStatus = "Editing \(share.displayName)"
    }

    func updateSelectedShare() async {
        guard !selectedShareID.isEmpty else {
            nativeDashboardStatus = "Select a share first."
            return
        }
        let body = (try? JSONEncoder().encode([
            "name": shareEditName.trimmingCharacters(in: .whitespacesAndNewlines),
            "path": shareEditPath.trimmingCharacters(in: .whitespacesAndNewlines),
            "content": shareEditContent,
        ])) ?? Data("{}".utf8)

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Updating share"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.cdnBaseURL.normalizedBaseURL.appendingAPIPath("share/\(selectedShareID)"),
                method: "PUT",
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = "Updated share."
            append(meta: "Share updated", body: selectedShareID, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
        }
    }

    func toggleNativeShareLock(_ share: DashboardShare) async {
        isLoadingNativeDashboard = true
        nativeDashboardStatus = share.locked == true ? "Unlocking share" : "Locking share"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.cdnBaseURL.normalizedBaseURL.appendingAPIPath("share/lock/\(share.id)"),
                authenticated: true
            )
            nativeDashboardStatus = share.locked == true ? "Unlocked share." : "Locked share."
            append(meta: "Share lock toggled", body: share.id, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
        }
    }

    func loadNativeShareTree(_ share: DashboardShare) async {
        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Loading share tree"
        defer { isLoadingNativeDashboard = false }

        do {
            let tree: [DashboardShareTreeItem] = try await requestJSON(
                settings.cdnBaseURL.normalizedBaseURL.appendingAPIPath("share/tree/\(share.id)"),
                authenticated: true
            )
            shareTrees[share.id] = tree
            nativeDashboardStatus = tree.isEmpty ? "No tree entries returned." : "Loaded \(tree.count) tree entries."
        } catch {
            nativeDashboardStatus = error.localizedDescription
        }
    }

    func deleteNativeShare(_ share: DashboardShare) async {
        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Deleting share"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.cdnBaseURL.normalizedBaseURL.appendingAPIPath("share/\(share.id)"),
                method: "DELETE",
                authenticated: true
            )
            if selectedShareID == share.id {
                selectedShareID = ""
                shareEditName = ""
                shareEditPath = ""
                shareEditContent = ""
            }
            nativeDashboardStatus = "Deleted share."
            append(meta: "Share deleted", body: share.id, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
        }
    }

    func createNativeArticle() async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        let content = articleDraftContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else {
            nativeDashboardStatus = "Write article markdown first."
            return
        }

        let explicitID = articleDraftID.trimmingCharacters(in: .whitespacesAndNewlines)
        let heading = content.split(separator: "\n").first { $0.hasPrefix("# ") }
            .map { String($0.dropFirst(2)).trimmingCharacters(in: .whitespacesAndNewlines) }
        let baseID = explicitID.isEmpty ? (heading ?? "desktop-article") : explicitID
        let id = baseID.slugifiedPath + (baseID.hasSuffix(".md") ? "" : ".md")
        let body = (try? JSONEncoder().encode(["content": content])) ?? Data("{}".utf8)

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Creating article"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("article/\(id)"),
                method: "POST",
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = "Created \(id)"
            articleDraftID = ""
            articleDraftContent = ""
            append(meta: "Article created", body: id, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Article failed", body: error.localizedDescription, kind: .error)
        }
    }

    func loadArticleIntoEditor(_ article: DashboardArticle) {
        selectedArticleID = article.id
        articleEditID = article.id
        articleEditContent = article.content ?? ""
        if article.content == nil {
            Task { await loadArticleContent(article) }
        }
    }

    func loadArticleContent(_ article: DashboardArticle) async {
        do {
            let loaded: DashboardArticle = try await requestJSON(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("article/\(article.id)"),
                authenticated: false
            )
            guard selectedArticleID == article.id else { return }
            articleEditID = loaded.id
            articleEditContent = loaded.content ?? articleEditContent
            if let index = articles.firstIndex(where: { $0.id == article.id }) {
                articles[index] = loaded
            }
            nativeDashboardStatus = "Loaded \(loaded.id)"
        } catch {
            nativeDashboardStatus = error.localizedDescription
        }
    }

    func updateSelectedArticle() async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        let id = (articleEditID.isEmpty ? selectedArticleID : articleEditID).trimmingCharacters(in: .whitespacesAndNewlines)
        let content = articleEditContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty else {
            nativeDashboardStatus = "Select an article first."
            return
        }
        guard !content.isEmpty else {
            nativeDashboardStatus = "Article content cannot be empty."
            return
        }

        let body = (try? JSONEncoder().encode(["content": content])) ?? Data("{}".utf8)
        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Saving article"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("article/\(id)"),
                method: "PUT",
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = "Saved \(id)"
            append(meta: "Article saved", body: id, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Article save failed", body: error.localizedDescription, kind: .error)
        }
    }

    func deleteSelectedArticle(_ article: DashboardArticle) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Deleting article"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("article/\(article.id)"),
                method: "DELETE",
                authenticated: true
            )
            if selectedArticleID == article.id {
                selectedArticleID = ""
                articleEditID = ""
                articleEditContent = ""
            }
            nativeDashboardStatus = "Deleted \(article.id)"
            append(meta: "Article deleted", body: article.id, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Article delete failed", body: error.localizedDescription, kind: .error)
        }
    }

    func openArticle(_ article: DashboardArticle) {
        openWebsite(path: "/articles/\(article.id.replacingOccurrences(of: ".md", with: ""))", label: article.title)
    }

    func openUserProfile(_ user: DashboardUser) {
        openWebsite(path: "/profile/\(user.id)", label: user.displayName)
    }

    func selectDashboardUser(_ user: DashboardUser) {
        selectedUserID = user.id
        Task { await loadSelectedUserRoles() }
    }

    func loadSelectedUserRoles() async {
        guard !selectedUserID.isEmpty else {
            selectedUserRoles = []
            return
        }

        do {
            selectedUserRoles = try await requestJSON(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("roles/user/\(selectedUserID)"),
                authenticated: true
            )
            nativeDashboardStatus = "Loaded roles for \(selectedUserID)"
        } catch {
            selectedUserRoles = []
            nativeDashboardStatus = error.localizedDescription
        }
    }

    func setDashboardUser(_ user: DashboardUser, active: Bool) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        let body = (try? JSONEncoder().encode(UserActivePayload(active: active))) ?? Data("{}".utf8)
        isLoadingNativeDashboard = true
        nativeDashboardStatus = active ? "Activating user" : "Deactivating user"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("user/\(user.id)/active"),
                method: "PUT",
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = active ? "Activated \(user.id)" : "Deactivated \(user.id)"
            append(meta: active ? "User activated" : "User deactivated", body: user.id, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "User status failed", body: error.localizedDescription, kind: .error)
        }
    }

    func setRole(_ role: DashboardRole, assigned: Bool, for user: DashboardUser) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        let body = (try? JSONEncoder().encode(RoleAssignmentPayload(role_id: role.id))) ?? Data("{}".utf8)
        let action = assigned ? "assign" : "unassign"
        isLoadingNativeDashboard = true
        nativeDashboardStatus = assigned ? "Assigning role" : "Removing role"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("role/\(action)/\(user.id)"),
                method: "POST",
                body: body,
                authenticated: true
            )
            selectedUserID = user.id
            nativeDashboardStatus = assigned ? "Assigned \(role.id)" : "Removed \(role.id)"
            append(meta: assigned ? "Role assigned" : "Role removed", body: "\(role.id) · \(user.id)", kind: .change)
            await loadSelectedUserRoles()
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Role assignment failed", body: error.localizedDescription, kind: .error)
        }
    }

    func deleteDashboardUser(_ user: DashboardUser) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Deleting user"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("user/\(user.id)"),
                method: "DELETE",
                authenticated: true
            )
            if selectedUserID == user.id {
                selectedUserID = ""
                selectedUserRoles = []
            }
            nativeDashboardStatus = "Deleted \(user.id)"
            append(meta: "User deleted", body: user.id, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "User delete failed", body: error.localizedDescription, kind: .error)
        }
    }

    func loadRoleIntoEditor(_ role: DashboardRole) {
        selectedRoleID = role.id
        roleEditName = role.name ?? role.id
        roleEditDescription = role.description ?? ""
    }

    func createNativeRole() async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        let name = roleDraftName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else {
            nativeDashboardStatus = "Write a role name first."
            return
        }

        let explicitID = roleDraftID.trimmingCharacters(in: .whitespacesAndNewlines)
        let id = explicitID.isEmpty ? name.slugifiedPath : explicitID.slugifiedPath
        let payload = [
            "id": id,
            "name": name,
            "description": roleDraftDescription.trimmingCharacters(in: .whitespacesAndNewlines),
            "created_by": userIDForRequests,
        ]
        let body = (try? JSONEncoder().encode(payload)) ?? Data("{}".utf8)

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Creating role"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("role"),
                method: "POST",
                body: body,
                authenticated: true
            )
            roleDraftID = ""
            roleDraftName = ""
            roleDraftDescription = ""
            nativeDashboardStatus = "Created \(id)"
            append(meta: "Role created", body: id, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Role create failed", body: error.localizedDescription, kind: .error)
        }
    }

    func updateSelectedRole() async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        let name = roleEditName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !selectedRoleID.isEmpty else {
            nativeDashboardStatus = "Select a role first."
            return
        }
        guard !name.isEmpty else {
            nativeDashboardStatus = "Role name cannot be empty."
            return
        }

        let payload = [
            "name": name,
            "description": roleEditDescription.trimmingCharacters(in: .whitespacesAndNewlines),
        ]
        let body = (try? JSONEncoder().encode(payload)) ?? Data("{}".utf8)

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Saving role"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("role/\(selectedRoleID)"),
                method: "PUT",
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = "Saved \(selectedRoleID)"
            append(meta: "Role saved", body: selectedRoleID, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Role save failed", body: error.localizedDescription, kind: .error)
        }
    }

    func deleteNativeRole(_ role: DashboardRole) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Deleting role"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("role/\(role.id)"),
                method: "DELETE",
                authenticated: true
            )
            if selectedRoleID == role.id {
                selectedRoleID = ""
                roleEditName = ""
                roleEditDescription = ""
            }
            nativeDashboardStatus = "Deleted \(role.id)"
            append(meta: "Role deleted", body: role.id, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Role delete failed", body: error.localizedDescription, kind: .error)
        }
    }

    func createNativeThought() async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        let title = thoughtDraftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else {
            nativeDashboardStatus = "Write a thought title first."
            return
        }

        let payload = ["title": title, "id": userIDForRequests]
        let body = (try? JSONEncoder().encode(payload)) ?? Data("{}".utf8)

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Creating thought"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("thoughts"),
                method: "POST",
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = "Created thought"
            thoughtDraftTitle = ""
            append(meta: "Thought created", body: title, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Thought failed", body: error.localizedDescription, kind: .error)
        }
    }

    func loadThoughtIntoEditor(_ thought: DashboardThought) {
        selectedThoughtID = thought.id
        thoughtEditTitle = thought.title
    }

    func updateSelectedThought() async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        let title = thoughtEditTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !selectedThoughtID.isEmpty else {
            nativeDashboardStatus = "Select a thought first."
            return
        }
        guard !title.isEmpty else {
            nativeDashboardStatus = "Thought title cannot be empty."
            return
        }

        let body = (try? JSONEncoder().encode(["title": title])) ?? Data("{}".utf8)
        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Saving thought"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("thought/\(selectedThoughtID)"),
                method: "PUT",
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = "Saved thought"
            append(meta: "Thought saved", body: selectedThoughtID, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Thought save failed", body: error.localizedDescription, kind: .error)
        }
    }

    func deleteSelectedThought(_ thought: DashboardThought) async {
        guard hasHanasandAuth else {
            nativeDashboardStatus = "Configure auth token and user id first."
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Deleting thought"
        defer { isLoadingNativeDashboard = false }

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("thought/\(thought.id)"),
                method: "DELETE",
                authenticated: true
            )
            if selectedThoughtID == thought.id {
                selectedThoughtID = ""
                thoughtEditTitle = ""
            }
            nativeDashboardStatus = "Deleted thought"
            append(meta: "Thought deleted", body: thought.id, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Thought delete failed", body: error.localizedDescription, kind: .error)
        }
    }

    func createNativeLoadTest() async {
        let rawTarget = testDraftURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !rawTarget.isEmpty else {
            nativeDashboardStatus = "Add a URL to test first."
            return
        }
        let target = rawTarget.contains("://") ? rawTarget : "https://\(rawTarget)"
        guard let scheme = URL(string: target)?.scheme?.lowercased(),
              ["http", "https"].contains(scheme) else {
            nativeDashboardStatus = "Load tests need an http or https URL."
            return
        }

        let timeout = Int(testDraftTimeout.trimmingCharacters(in: .whitespacesAndNewlines))
        let payload = CreateLoadTestPayload(
            url: target,
            timeout: timeout,
            stages: parseLoadTestStages(testDraftStages)
        )
        let body = (try? JSONEncoder().encode(payload)) ?? Data("{}".utf8)

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Creating load test"
        defer { isLoadingNativeDashboard = false }

        do {
            let created: DashboardRecentTest = try await requestJSON(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("test"),
                method: "POST",
                body: body,
                authenticated: hasHanasandAuth
            )
            selectedTestDetail = created
            testDraftURL = ""
            nativeDashboardStatus = "Created test \(created.id). Starting run."
            append(meta: "Load test created", body: created.displayURL, kind: .change)
            await rerunLoadTest(created)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Load test failed", body: error.localizedDescription, kind: .error)
        }
    }

    func rerunLoadTest(_ test: DashboardRecentTest) async {
        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Starting test \(test.id)"
        defer { isLoadingNativeDashboard = false }

        do {
            let text = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("test/\(test.id)/rerun"),
                method: "POST",
                body: Data("{}".utf8),
                authenticated: hasHanasandAuth
            )
            nativeDashboardStatus = text.isEmpty ? "Started test \(test.id)." : String(text.prefix(180))
            append(meta: "Load test rerun", body: test.id, kind: .change)
            await loadLoadTestDetail(test)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: "Load test rerun failed", body: error.localizedDescription, kind: .error)
        }
    }

    func loadLoadTestDetail(_ test: DashboardRecentTest) async {
        do {
            selectedTestDetail = try await requestJSON(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("test/\(test.id)"),
                authenticated: false
            )
            nativeDashboardStatus = "Loaded test \(test.id)."
        } catch {
            nativeDashboardStatus = error.localizedDescription
        }
    }

    func copyLoadTestLink(_ test: DashboardRecentTest) {
        let url = settings.websiteBaseURL.normalizedBaseURL.appendingPathComponent("test/\(test.id)").absoluteString
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(url, forType: .string)
        nativeDashboardStatus = "Copied \(url)"
    }

    private func parseLoadTestStages(_ rawValue: String) -> [LoadTestStagePayload]? {
        let stages = rawValue
            .split(separator: ",")
            .compactMap { segment -> LoadTestStagePayload? in
                let parts = segment.split(separator: ":", maxSplits: 1).map {
                    String($0).trimmingCharacters(in: .whitespacesAndNewlines)
                }
                guard parts.count == 2, let target = Int(parts[1]), !parts[0].isEmpty else {
                    return nil
                }
                return LoadTestStagePayload(duration: parts[0], target: target)
            }
        return stages.isEmpty ? nil : stages
    }
}

struct DesktopAction: Identifiable {
    enum Kind {
        case route(String)
        case url(String)
        case task
    }

    let id = UUID()
    let title: String
    let subtitle: String
    let icon: String
    let kind: Kind
    let task: ((DesktopAgentModel) -> Void)?

    static func route(_ title: String, _ subtitle: String, _ icon: String, _ path: String) -> DesktopAction {
        DesktopAction(title: title, subtitle: subtitle, icon: icon, kind: .route(path), task: nil)
    }

    static func url(_ title: String, _ subtitle: String, _ icon: String, _ url: String) -> DesktopAction {
        DesktopAction(title: title, subtitle: subtitle, icon: icon, kind: .url(url), task: nil)
    }

    static func task(_ title: String, _ subtitle: String, _ icon: String, action: @escaping (DesktopAgentModel) -> Void) -> DesktopAction {
        DesktopAction(title: title, subtitle: subtitle, icon: icon, kind: .task, task: action)
    }

    @MainActor
    func perform(with model: DesktopAgentModel) {
        switch kind {
        case .route(let path):
            model.openNativeDashboard(path: path, label: title)
        case .url(let url):
            model.openURL(url, label: title)
        case .task:
            task?(model)
        }
    }

    var badgeLabel: String {
        switch kind {
        case .route:
            return "Native"
        case .url:
            return "Web"
        case .task:
            return "Action"
        }
    }

    var footerLabel: String {
        switch kind {
        case .route(let path):
            return path
        case .url:
            return "Opens outside app"
        case .task:
            return "Runs in app"
        }
    }

    var trailingIcon: String {
        switch kind {
        case .route:
            return "arrow.right"
        case .url:
            return "arrow.up.forward"
        case .task:
            return "bolt.fill"
        }
    }

    var isNativeRoute: Bool {
        if case .route = kind {
            return true
        }
        return false
    }
}

enum NativeDashboardMutation {
    case runBackup
    case restoreBackup(service: String, file: String)
    case runVulnerabilityScan

    var label: String {
        switch self {
        case .runBackup: return "backup"
        case .restoreBackup: return "backup restore"
        case .runVulnerabilityScan: return "vulnerability scan"
        }
    }

    var path: String {
        switch self {
        case .runBackup: return "backup"
        case .restoreBackup: return "backup/restore"
        case .runVulnerabilityScan: return "vulnerabilities/scan"
        }
    }

    var body: Data {
        switch self {
        case .runBackup, .runVulnerabilityScan:
            return Data("{}".utf8)
        case .restoreBackup(let service, let file):
            let payload = ["service": service, "file": file]
            return (try? JSONEncoder().encode(payload)) ?? Data("{}".utf8)
        }
    }

    var userAgent: String? {
        "hanasand_internal"
    }

    func baseURL(settings: HanasandDesktopSettings) -> URL {
        settings.internalAPIBaseURL.normalizedBaseURL
    }
}

struct DashboardBackupService: Decodable, Identifiable {
    let id: String
    let name: String
    let status: String
    let error: String?
    let dbSize: String?
    let totalStorage: String?
    let lastBackup: String?
    let nextBackup: String?
}

struct DashboardBackupFile: Decodable, Identifiable {
    var id: String { "\(service)-\(file)-\(location ?? "unknown")" }
    let service: String
    let file: String
    let mtime: String?
    let size: String?
    let location: String?
}

struct DashboardNote: Decodable, Identifiable {
    let id: String
    let title: String
    let content: String
    let source: String
    let ownerID: String?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case content
        case source
        case ownerID = "owner_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct DashboardShare: Decodable, Identifiable {
    let id: String
    let name: String?
    let path: String?
    let alias: String?
    let type: String?
    let timestamp: String?
    let updatedAt: String?
    let createdAt: String?
    let content: String?
    let locked: Bool?
    let wordCount: Int?
    let estimatedMinutes: Int?

    var displayName: String {
        let candidates = [name, path, alias, id]
        return candidates.compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.first { !$0.isEmpty } ?? id
    }

    var subtitle: String {
        [type, alias, path].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    var updatedLabel: String {
        formatDateText(updatedAt, fallback: formatDateText(timestamp, fallback: createdAt ?? "No timestamp"))
    }

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case path
        case alias
        case type
        case timestamp
        case updatedAt = "updated_at"
        case createdAt = "created_at"
        case content
        case locked
        case wordCount
        case estimatedMinutes
    }
}

struct CreateSharePayload: Encodable {
    let id: String
    let includeTree: Bool
    let name: String
    let path: String
    let content: String
    let parent: String?
    let type: String
}

struct UploadedFileResponse: Decodable {
    let id: String
    let name: String?
    let path: String?
}

struct DesktopDocumentPage: Identifiable, Hashable {
    let id = UUID()
    var title: String
    var image: NSImage
    var sourceURL: URL?
}

enum ImageReviewDecision: String {
    case keep
    case discard
}

struct DesktopImageReviewItem: Identifiable, Hashable {
    let id = UUID()
    var url: URL
    var image: NSImage

    var title: String { url.lastPathComponent }
    var sizeLabel: String {
        "\(Int(image.size.width))x\(Int(image.size.height))"
    }
}

struct ControlRun: Identifiable {
    let id = UUID()
    let title: String
    let detail: String
    let date: Date
    let kind: AgentEvent.Kind

    init(title: String, detail: String, date: Date = Date(), kind: AgentEvent.Kind) {
        self.title = title
        self.detail = detail
        self.date = date
        self.kind = kind
    }
}

private struct PersistedControlRun: Codable {
    let title: String
    let detail: String
    let date: Date
    let kind: String

    init(_ run: ControlRun) {
        title = run.title
        detail = run.detail
        date = run.date
        kind = run.kind.persistenceValue
    }

    var controlRun: ControlRun {
        ControlRun(
            title: title,
            detail: detail,
            date: date,
            kind: AgentEvent.Kind(persistenceValue: kind)
        )
    }
}

enum ControlApprovalKind: String {
    case stopServer
    case openTunnel
    case trashImages
    case clearDocuments
    case blocked
}

struct ControlApproval: Identifiable {
    let id = UUID()
    let title: String
    let detail: String
    let command: String
    let kind: ControlApprovalKind
}

struct ServerEndpointStatus: Identifiable {
    let id = UUID()
    let title: String
    let target: String
    let isReachable: Bool?
    let detail: String
    let checkedAt: Date

    var stateLabel: String {
        switch isReachable {
        case .some(true):
            return "Reachable"
        case .some(false):
            return "Blocked"
        case .none:
            return "Unknown"
        }
    }
}

struct DashboardShareTreeItem: Decodable, Identifiable {
    let id: String
    let name: String
    let alias: String?
    let parent: String?
    let type: String?
    let children: [DashboardShareTreeItem]?
}

struct DashboardLogsEnvelope: Decodable {
    let logs: [DashboardLogEntry]
}

struct DashboardLogEntry: Decodable, Identifiable {
    let id: String
    let service: String
    let host: String?
    let level: String
    let message: String
    let metadata: JSONValue?
    let createdAt: String
    let source: String?

    var createdLabel: String {
        formatDateText(createdAt, fallback: createdAt)
    }

    var isError: Bool {
        level == "error" || level == "fatal"
    }

    enum CodingKeys: String, CodingKey {
        case id
        case service
        case host
        case level
        case message
        case metadata
        case createdAt = "created_at"
        case source
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let stringID = try? container.decode(String.self, forKey: .id) {
            id = stringID
        } else if let intID = try? container.decode(Int.self, forKey: .id) {
            id = String(intID)
        } else {
            id = UUID().uuidString
        }
        service = (try? container.decode(String.self, forKey: .service)) ?? "unknown"
        host = try? container.decode(String.self, forKey: .host)
        level = (try? container.decode(String.self, forKey: .level)) ?? "info"
        message = (try? container.decode(String.self, forKey: .message)) ?? ""
        metadata = try? container.decode(JSONValue.self, forKey: .metadata)
        createdAt = (try? container.decode(String.self, forKey: .createdAt)) ?? ""
        source = try? container.decode(String.self, forKey: .source)
    }
}

struct DashboardDockerEnvelope: Decodable {
    let resolvedContainers: [DashboardDockerContainer]

    enum CodingKeys: String, CodingKey {
        case data
        case containers
    }

    init(from decoder: Decoder) throws {
        if let list = try? [DashboardDockerContainer](from: decoder) {
            resolvedContainers = list
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let list = try? container.decode([DashboardDockerContainer].self, forKey: .data) {
            resolvedContainers = list
        } else if let list = try? container.decode([DashboardDockerContainer].self, forKey: .containers) {
            resolvedContainers = list
        } else {
            resolvedContainers = []
        }
    }
}

struct DashboardDockerContainer: Decodable, Identifiable {
    let id: String
    let name: String?
    let status: String?
    let cpu: Double?
    let memory: Double?
    let createdAt: String?

    var displayName: String {
        let clean = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return clean.isEmpty ? String(id.prefix(12)) : clean
    }

    var statusLabel: String {
        (status ?? "unknown").capitalized
    }

    var cpuLabel: String {
        guard let cpu else { return "Unknown" }
        return "\(String(format: "%.1f", cpu))%"
    }

    var memoryLabel: String {
        guard let memory else { return "Unknown" }
        return "\(String(format: "%.0f", memory)) MB"
    }

    var createdLabel: String {
        guard let createdAt else { return "No timestamp" }
        return formatDateText(createdAt, fallback: createdAt)
    }

    var isRunning: Bool {
        (status ?? "").localizedCaseInsensitiveContains("running")
    }

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case status
        case cpu
        case memory
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let stringID = try? container.decode(String.self, forKey: .id) {
            id = stringID
        } else if let intID = try? container.decode(Int.self, forKey: .id) {
            id = String(intID)
        } else {
            id = UUID().uuidString
        }
        name = try? container.decode(String.self, forKey: .name)
        status = try? container.decode(String.self, forKey: .status)
        if let value = try? container.decode(Double.self, forKey: .cpu) {
            cpu = value
        } else if let string = try? container.decode(String.self, forKey: .cpu) {
            cpu = Double(string.trimmingCharacters(in: CharacterSet(charactersIn: "% ")))
        } else {
            cpu = nil
        }
        if let value = try? container.decode(Double.self, forKey: .memory) {
            memory = value
        } else if let string = try? container.decode(String.self, forKey: .memory) {
            memory = Double(string.replacingOccurrences(of: "MB", with: "").trimmingCharacters(in: .whitespacesAndNewlines))
        } else {
            memory = nil
        }
        createdAt = try? container.decode(String.self, forKey: .createdAt)
    }
}

struct DashboardVMEnvelope: Decodable {
    let resolvedVMs: [DashboardVM]

    enum CodingKeys: String, CodingKey {
        case data
        case vms
    }

    init(from decoder: Decoder) throws {
        if let list = try? [DashboardVM](from: decoder) {
            resolvedVMs = list
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let list = try? container.decode([DashboardVM].self, forKey: .data) {
            resolvedVMs = list
        } else if let list = try? container.decode([DashboardVM].self, forKey: .vms) {
            resolvedVMs = list
        } else {
            resolvedVMs = []
        }
    }
}

struct DashboardVM: Decodable, Identifiable {
    let name: String
    let owner: String?
    let createdBy: String?
    let accessUsers: [String]?
    let status: String?
    let type: String?
    let architecture: String?
    let created: String?
    let lastUsed: String?
    let description: String?
    let cpuLimit: String?
    let memoryLimit: String?
    let ipv4: String?
    let lastChecked: String?

    var id: String { name }

    var statusLabel: String {
        (status ?? "unknown").capitalized
    }

    var ownerLabel: String {
        owner ?? createdBy ?? "Unknown owner"
    }

    var createdLabel: String {
        guard let created else { return "No timestamp" }
        return formatDateText(created, fallback: created)
    }

    var lastUsedLabel: String {
        guard let lastUsed else { return "No activity" }
        return formatDateText(lastUsed, fallback: lastUsed)
    }

    var tags: [String] {
        [type, architecture, ipv4].compactMap { value in
            let clean = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return clean.isEmpty ? nil : clean
        }
    }

    enum CodingKeys: String, CodingKey {
        case name
        case owner
        case createdBy = "created_by"
        case accessUsers = "access_users"
        case status
        case type
        case architecture
        case created
        case lastUsed = "last_used"
        case description = "config_image_description"
        case cpuLimit = "limits_cpu"
        case memoryLimit = "limits_memory"
        case ipv4 = "device_eth0_ipv4_address"
        case lastChecked = "last_checked"
    }
}

struct DashboardRecentTest: Decodable, Identifiable {
    let id: String
    let url: String
    let timeout: Int?
    let status: String
    let logs: [String]?
    let errors: [String]?
    let createdAt: String?
    let finishedAt: String?
    let exitCode: Int?
    let visits: Int?
    let summary: JSONValue?
    let latestRunSummary: JSONValue?
    let previousRunSummary: JSONValue?
    let latestRunNumber: Int?
    let p95DeltaMs: Double?

    var createdLabel: String {
        formatDateText(createdAt, fallback: "No timestamp")
    }

    var finishedLabel: String {
        formatDateText(finishedAt, fallback: finishedAt == nil ? "Not finished" : "No timestamp")
    }

    var statusLabel: String {
        status.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "unknown" : status
    }

    var displayURL: String {
        url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "No URL" : url
    }

    var activeSummary: JSONValue? {
        latestRunSummary ?? summary
    }

    var requestCount: Int? {
        activeSummary?.numberValue(for: ["requests"]).map(Int.init)
    }

    var p95Milliseconds: Double? {
        activeSummary?.numberValue(for: ["duration", "p95"])
    }

    var failureRatePercent: Double? {
        activeSummary?.numberValue(for: ["failureRate"]).map { $0 * 100 }
    }

    var p95DeltaLabel: String? {
        guard let p95DeltaMs, p95DeltaMs != 0 else { return nil }
        return "\(p95DeltaMs >= 0 ? "faster" : "slower") \(Int(abs(p95DeltaMs).rounded()))ms"
    }

    enum CodingKeys: String, CodingKey {
        case id
        case url
        case timeout
        case status
        case logs
        case errors
        case createdAt = "created_at"
        case finishedAt = "finished_at"
        case exitCode = "exit_code"
        case visits
        case summary
        case latestRunSummary = "latest_run_summary"
        case previousRunSummary = "previous_run_summary"
        case latestRunNumber = "latest_run_number"
        case p95DeltaMs = "p95_delta_ms"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let stringID = try? container.decode(String.self, forKey: .id) {
            id = stringID
        } else if let intID = try? container.decode(Int.self, forKey: .id) {
            id = String(intID)
        } else {
            id = UUID().uuidString
        }
        url = (try? container.decode(String.self, forKey: .url)) ?? ""
        timeout = try? container.decode(Int.self, forKey: .timeout)
        status = (try? container.decode(String.self, forKey: .status)) ?? "unknown"
        logs = try? container.decode([String].self, forKey: .logs)
        errors = try? container.decode([String].self, forKey: .errors)
        createdAt = try? container.decode(String.self, forKey: .createdAt)
        finishedAt = try? container.decode(String.self, forKey: .finishedAt)
        exitCode = try? container.decode(Int.self, forKey: .exitCode)
        visits = try? container.decode(Int.self, forKey: .visits)
        summary = try? container.decode(JSONValue.self, forKey: .summary)
        latestRunSummary = try? container.decode(JSONValue.self, forKey: .latestRunSummary)
        previousRunSummary = try? container.decode(JSONValue.self, forKey: .previousRunSummary)
        latestRunNumber = try? container.decode(Int.self, forKey: .latestRunNumber)
        p95DeltaMs = try? container.decode(Double.self, forKey: .p95DeltaMs)
    }
}

struct DashboardShortcutLink: Decodable, Identifiable {
    let id: String
    let path: String
    let visits: Int?
    let timestamp: String?

    var timestampLabel: String {
        formatDateText(timestamp, fallback: "No timestamp")
    }
}

struct ShortcutLinkPayload: Encodable {
    let path: String
}

struct CreateLoadTestPayload: Encodable {
    let url: String
    let timeout: Int?
    let stages: [LoadTestStagePayload]?
}

struct LoadTestStagePayload: Encodable {
    let duration: String
    let target: Int
}

struct DashboardServiceStatus: Decodable {
    let overall: String
    let generatedAt: String?
    let checks: [ServiceCheck]

    enum CodingKeys: String, CodingKey {
        case overall
        case generatedAt = "generated_at"
        case checks
    }

    var generatedLabel: String {
        formatDateText(generatedAt, fallback: "No timestamp")
    }
}

struct ServiceCheck: Decodable, Identifiable {
    let service: String
    let checkName: String
    let status: String
    let latencyMs: Double?
    let message: String?
    let checkedAt: String?
    let uptime30d: String?

    enum CodingKeys: String, CodingKey {
        case service
        case checkName = "check_name"
        case status
        case latencyMs = "latency_ms"
        case message
        case checkedAt = "checked_at"
        case uptime30d = "uptime_30d"
    }

    var id: String {
        "\(service)-\(checkName)"
    }

    var statusLabel: String {
        status.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "unknown" : status
    }

    var checkLabel: String {
        checkName.replacingOccurrences(of: "_", with: " ")
    }

    var latencyLabel: String {
        guard let latencyMs else { return "Unknown" }
        return "\(Int(latencyMs.rounded())) ms"
    }

    var uptimeLabel: String {
        guard let uptime30d, !uptime30d.isEmpty else { return "0%" }
        return "\(uptime30d)%"
    }

    var checkedLabel: String {
        formatDateText(checkedAt, fallback: "No timestamp")
    }
}

enum JSONValue: Decodable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            self = .null
        }
    }

    var pretty: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return value.rounded() == value ? String(Int(value)) : String(value)
        case .bool(let value):
            return value ? "true" : "false"
        case .object(let value):
            let lines = value.sorted { $0.key < $1.key }.map { key, child in "\(key): \(child.pretty)" }
            return lines.joined(separator: "\n")
        case .array(let value):
            return value.map(\.pretty).joined(separator: "\n")
        case .null:
            return "null"
        }
    }

    func numberValue(for path: [String]) -> Double? {
        guard let head = path.first else {
            if case .number(let value) = self { return value }
            return nil
        }
        guard case .object(let object) = self, let child = object[head] else {
            return nil
        }
        return child.numberValue(for: Array(path.dropFirst()))
    }
}

struct DashboardArticle: Decodable, Identifiable {
    struct Metadata: Decodable {
        let image: String?
        let description: String?
        let wordCount: Int?
        let estimatedMinutes: Int?
    }

    let id: String
    let size: Int?
    let created: String?
    let modified: String?
    let metadata: Metadata?
    let title: String
    let content: String?

    var publishedLabel: String {
        formatDateText(modified, fallback: formatDateText(created, fallback: "No timestamp"))
    }

    var readingLabel: String {
        guard let minutes = metadata?.estimatedMinutes else { return "No estimate" }
        return "\(minutes) min read"
    }
}

struct DashboardThought: Decodable, Identifiable {
    let id: String
    let title: String
    let createdAt: String?
    let createdBy: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case createdAt = "created_at"
        case createdBy = "created_by"
        case updatedAt = "updated_at"
    }

    var updatedLabel: String {
        formatDateText(updatedAt, fallback: formatDateText(createdAt, fallback: "No timestamp"))
    }
}

struct DashboardRole: Decodable, Identifiable {
    let id: String
    let name: String?
    let description: String?
    let priority: Int?
    let createdBy: String?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case priority
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var displayName: String { name?.isEmpty == false ? name! : id }
}

struct DashboardUserRoleAssignment: Decodable, Identifiable {
    let id: String
    let name: String?
    let priority: Int?
    let assignedBy: String?
    let assignedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case priority
        case assignedBy = "assigned_by"
        case assignedAt = "assigned_at"
    }

    var displayName: String { name?.isEmpty == false ? name! : id }
}

struct UserActivePayload: Encodable {
    let active: Bool
}

struct RoleAssignmentPayload: Encodable {
    let role_id: String
}

struct DashboardUser: Decodable, Identifiable {
    let id: String
    let name: String?
    let avatar: String?
    let active: Bool?
    let deactivatedAt: String?
    let deactivatedBy: String?
    let highestRoleID: String?
    let highestRoleName: String?
    let highestRolePriority: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case avatar
        case active
        case deactivatedAt = "deactivated_at"
        case deactivatedBy = "deactivated_by"
        case highestRoleID = "highest_role_id"
        case highestRoleName = "highest_role_name"
        case highestRolePriority = "highest_role_priority"
    }

    var displayName: String { name?.isEmpty == false ? name! : id }
    var roleLabel: String { highestRoleName ?? highestRoleID ?? "No role" }
}

struct DashboardProfile: Decodable, Identifiable {
    let id: String
    let name: String?
    let avatar: String?
    let active: Bool?
    let roles: [DashboardRole]?
    let token: String?
    let expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case avatar
        case active
        case roles
        case token
        case expiresAt = "expires_at"
    }

    var displayName: String { name?.isEmpty == false ? name! : id }
}

struct DashboardCertificate: Decodable, Identifiable {
    let id: String
    let publicKey: String
    let name: String
    let owner: String?
    let createdAt: String?
    let createdBy: String?

    enum CodingKeys: String, CodingKey {
        case id
        case publicKey = "public_key"
        case name
        case owner
        case createdAt = "created_at"
        case createdBy = "created_by"
    }

    var keySuffix: String {
        publicKey.split(separator: " ").last.map(String.init) ?? publicKey
    }

    var isManaged: Bool {
        publicKey.hasSuffix("Hanasand API")
    }
}

struct DashboardAuthSession: Decodable, Identifiable {
    var id: Int { tokenID }
    let tokenID: Int
    let userID: String?
    let ip: String?
    let userAgent: String?
    let createdAt: String?
    let lastSeenAt: String?
    let revokedAt: String?

    enum CodingKeys: String, CodingKey {
        case tokenID = "token_id"
        case userID = "id"
        case ip
        case userAgent = "user_agent"
        case createdAt = "created_at"
        case lastSeenAt = "last_seen_at"
        case revokedAt = "revoked_at"
    }

    var deviceLabel: String {
        let agent = userAgent ?? ""
        if agent.range(of: "mobile|iphone|android", options: .regularExpression) != nil {
            return "Mobile"
        }
        if agent.range(of: "curl|node|monitor|playwright", options: .regularExpression) != nil {
            return "Automation"
        }
        return "Desktop"
    }
}

struct DashboardSessionsEnvelope: Decodable {
    let sessions: [DashboardAuthSession]
}

struct DashboardSeverityCount: Decodable {
    let critical: Int
    let high: Int
    let medium: Int
    let low: Int
    let unknown: Int
}

struct DashboardVulnerabilityReport: Decodable {
    let generatedAt: String?
    let imageCount: Int
    let images: [DashboardImageVulnerabilityReport]
    let scanStatus: DashboardScanStatus
}

struct DashboardImageVulnerabilityReport: Decodable, Identifiable {
    var id: String { image }
    let image: String
    let scannedAt: String
    let totalVulnerabilities: Int
    let severity: DashboardSeverityCount
    let scanError: String?
}

struct DashboardScanStatus: Decodable {
    let isRunning: Bool
    let startedAt: String?
    let finishedAt: String?
    let lastSuccessAt: String?
    let lastError: String?
    let totalImages: Int?
    let completedImages: Int
    let currentImage: String?
}

struct DashboardDatabaseOverview: Decodable {
    let generatedAt: String
    let clusterCount: Int
    let databaseCount: Int
    let totalSizeBytes: Int
    let activeQueries: Int
    let averageQuerySeconds: Double?
    let clusters: [DashboardDatabaseCluster]
}

struct DashboardDatabaseCluster: Decodable, Identifiable {
    let id: String
    let name: String
    let engine: String?
    let version: String?
    let host: String?
    let activeQueries: Int
    let totalSizeBytes: Int
    let databaseCount: Int
    let error: String?
    let databases: [DashboardDatabase]
}

struct DashboardDatabase: Decodable, Identifiable {
    var id: String { name }
    let name: String
    let sizeBytes: Int
    let tableCount: Int
    let activeConnections: Int?
}

struct DashboardTrafficMetrics: Decodable {
    struct Metric: Decodable, Identifiable {
        var id: String { key }
        let key: String
        let count: Int
    }

    let totalRequests: Int
    let avgRequestTime: Double
    let errorRate: Double
    let topDomains: [Metric]

    enum CodingKeys: String, CodingKey {
        case totalRequests = "total_requests"
        case avgRequestTime = "avg_request_time"
        case errorRate = "error_rate"
        case topDomains = "top_domains"
    }
}

struct DashboardRateLimitOverview: Decodable {
    let settings: DashboardRateLimitSettings
    let routes: [DashboardRateLimitRoute]
    let tierPresets: [DashboardApiKeyTierDefinition]?
}

struct DashboardRateLimitSettings: Decodable {
    let enabled: Bool
    let defaults: [String: DashboardRateLimitRule]
    let overrides: [DashboardRateLimitOverride]
    let updatedAt: String?
    let updatedBy: String?
}

struct DashboardRateLimitRule: Decodable {
    let windowMs: Int
    let maxRequests: Int

    var summary: String {
        "\(maxRequests) / \(formatMilliseconds(Double(windowMs)))"
    }
}

struct DashboardRateLimitOverride: Decodable, Identifiable {
    let id: String
    let enabled: Bool
    let method: String
    let route: String
    let scope: String
    let windowMs: Int
    let maxRequests: Int

    var summary: String {
        "\(method) \(route) · \(scope) · \(maxRequests) / \(formatMilliseconds(Double(windowMs)))"
    }
}

struct DashboardRateLimitRoute: Decodable, Identifiable {
    var id: String { "\(method) \(route)" }
    let method: String
    let route: String
}

struct DashboardApiKeysEnvelope: Decodable {
    let apiKeys: [DashboardApiKeySummary]
}

struct DashboardApiKeyCreateEnvelope: Decodable {
    let apiKey: DashboardApiKeySummary
    let secret: String?
}

struct DashboardRateLimitSettingsPayload: Encodable {
    let enabled: Bool
    let defaults: [String: DashboardRateLimitRulePayload]
    let overrides: [DashboardRateLimitOverridePayload]

    init(
        settings: DashboardRateLimitSettings,
        enabled: Bool,
        defaultOverrides: [String: DashboardRateLimitRulePayload] = [:],
        overridePayloads: [DashboardRateLimitOverridePayload]? = nil
    ) {
        self.enabled = enabled
        self.defaults = settings.defaults.reduce(into: [:]) { result, entry in
            result[entry.key] = defaultOverrides[entry.key] ?? DashboardRateLimitRulePayload(rule: entry.value)
        }
        self.overrides = overridePayloads ?? settings.overrides.map(DashboardRateLimitOverridePayload.init)
    }
}

struct DashboardRateLimitRulePayload: Encodable {
    let windowMs: Int
    let maxRequests: Int

    init(rule: DashboardRateLimitRule) {
        self.windowMs = rule.windowMs
        self.maxRequests = rule.maxRequests
    }

    init(windowMs: Int, maxRequests: Int) {
        self.windowMs = windowMs
        self.maxRequests = maxRequests
    }
}

struct DashboardRateLimitOverridePayload: Encodable {
    let id: String
    let enabled: Bool
    let method: String
    let route: String
    let scope: String
    let windowMs: Int
    let maxRequests: Int

    init(override: DashboardRateLimitOverride) {
        self.id = override.id
        self.enabled = override.enabled
        self.method = override.method
        self.route = override.route
        self.scope = override.scope
        self.windowMs = override.windowMs
        self.maxRequests = override.maxRequests
    }

    init(override: DashboardRateLimitOverride, enabled: Bool) {
        self.id = override.id
        self.enabled = enabled
        self.method = override.method
        self.route = override.route
        self.scope = override.scope
        self.windowMs = override.windowMs
        self.maxRequests = override.maxRequests
    }

    init(id: String, enabled: Bool, method: String, route: String, scope: String, windowMs: Int, maxRequests: Int) {
        self.id = id
        self.enabled = enabled
        self.method = method
        self.route = route
        self.scope = scope
        self.windowMs = windowMs
        self.maxRequests = maxRequests
    }
}

struct DashboardApiKeyTierDefinition: Decodable, Identifiable {
    let id: String
    let label: String
    let description: String
    let defaultLimits: DashboardApiKeyPeriodLimits
}

struct DashboardApiKeyPeriodLimits: Decodable {
    let perSecond: Int?
    let perMinute: Int?
    let perHour: Int?
    let perDay: Int?

    var summary: String {
        [
            perSecond.map { "\($0)/s" },
            perMinute.map { "\($0)/m" },
            perHour.map { "\($0)/h" },
            perDay.map { "\($0)/d" },
        ].compactMap { $0 }.joined(separator: " · ")
    }
}

struct DashboardApiKeyScopeRule: Decodable, Identifiable {
    let id: String
    let enabled: Bool
    let method: String
    let route: String
    let limits: DashboardApiKeyPeriodLimits
}

struct DashboardApiKeySummary: Decodable, Identifiable {
    let id: String
    let ownerId: String
    let name: String
    let tier: String
    let description: String?
    let enabled: Bool
    let keyPrefix: String
    let createdAt: String?
    let updatedAt: String?
    let expiresAt: String?
    let lastUsedAt: String?
    let scopes: [DashboardApiKeyScopeRule]

    var statusLabel: String {
        enabled ? "Enabled" : "Disabled"
    }

    var createdLabel: String {
        formatDateText(createdAt, fallback: "No timestamp")
    }

    var lastUsedLabel: String {
        formatDateText(lastUsedAt, fallback: "Never used")
    }
}

struct DashboardApiKeyUpdatePayload: Encodable {
    let ownerId: String
    let name: String
    let tier: String
    let description: String?
    let enabled: Bool
    let expiresAt: String?
    let scopes: [DashboardApiKeyScopePayload]

    init(key: DashboardApiKeySummary, enabled: Bool) {
        self.ownerId = key.ownerId
        self.name = key.name
        self.tier = key.tier
        self.description = key.description
        self.enabled = enabled
        self.expiresAt = key.expiresAt
        self.scopes = key.scopes.map { DashboardApiKeyScopePayload(scope: $0) }
    }
}

struct DashboardApiKeyScopePayload: Encodable {
    struct Limits: Encodable {
        let perSecond: Int?
        let perMinute: Int?
        let perHour: Int?
        let perDay: Int?
    }

    let id: String
    let enabled: Bool
    let method: String
    let route: String
    let limits: Limits

    init(scope: DashboardApiKeyScopeRule) {
        self.id = scope.id
        self.enabled = scope.enabled
        self.method = scope.method
        self.route = scope.route
        self.limits = Limits(
            perSecond: scope.limits.perSecond,
            perMinute: scope.limits.perMinute,
            perHour: scope.limits.perHour,
            perDay: scope.limits.perDay
        )
    }

    init(id: String, enabled: Bool, method: String, route: String, limits: Limits) {
        self.id = id
        self.enabled = enabled
        self.method = method
        self.route = route
        self.limits = limits
    }
}

struct DashboardApiKeyCreatePayload: Encodable {
    let ownerId: String
    let name: String
    let tier: String
    let description: String?
    let enabled: Bool
    let expiresAt: String?
    let scopes: [DashboardApiKeyScopePayload]

    init(
        ownerId: String,
        name: String,
        tier: String,
        description: String?,
        enabled: Bool,
        expiresAt: String?,
        scope: DashboardApiKeyScopePayload
    ) {
        self.ownerId = ownerId
        self.name = name
        self.tier = tier
        self.description = description
        self.enabled = enabled
        self.expiresAt = expiresAt
        self.scopes = [scope]
    }
}

struct AIModelMetrics: Codable, Equatable {
    let conversationId: String?
    let status: String?
    let currentTokens: Int?
    let maxTokens: Int?
    let promptTokens: Int?
    let generatedTokens: Int?
    let contextTokens: Int?
    let contextMaxTokens: Int?
    let tps: Double?
    let lastUpdated: String?
    let lastError: String?
}

struct AIConnectedClient: Codable, Identifiable, Equatable {
    var id: String { name }
    let rawID: String?
    let name: String
    let lastSeen: String?
    let model: AIModelMetrics?

    enum CodingKeys: String, CodingKey {
        case rawID = "id"
        case name
        case lastSeen
        case model
    }

    var statusText: String {
        let status = model?.status?.capitalized ?? "Connected"
        let tps = model?.tps ?? 0
        return tps > 0 ? "\(status) · \(String(format: "%.1f", tps)) TPS" : status
    }
}

extension Array where Element == AIConnectedClient {
    var sortedForRuntime: [AIConnectedClient] {
        sorted { lhs, rhs in
            let leftTPS = lhs.model?.tps ?? 0
            let rightTPS = rhs.model?.tps ?? 0
            if leftTPS == rightTPS {
                return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }
            return leftTPS > rightTPS
        }
    }
}

struct AIChatMessage: Identifiable, Equatable {
    enum Role: String {
        case user
        case assistant
    }

    let id: String
    let role: Role
    var content: String
    var createdAt: Date
    var isPending: Bool
    var isError: Bool

    init(id: String = UUID().uuidString, role: Role, content: String, createdAt: Date = Date(), isPending: Bool = false, isError: Bool = false) {
        self.id = id
        self.role = role
        self.content = content
        self.createdAt = createdAt
        self.isPending = isPending
        self.isError = isError
    }

    static let seed = [
        AIChatMessage(role: .assistant, content: "Ask a question and I will route it to the fastest connected Hanasand model. Tool use, timing, and file artifacts will appear in the run trace.")
    ]
}

enum DesktopAITraining {
    static let appParityPrimer = """
    You are running inside the Hanasand Desktop app, not a standalone script. If the user asks for website-to-app parity, native app work, Nucleus/Hanasand desktop app work, or share functionality, first ground yourself in the repository:
    - Read agents/START_HERE.md.
    - Read agents/DESKTOP_APP_DEVELOPMENT.md.
    - For share work, read agents/training-scenarios/share-functionality-port.md.
    - Trace the website implementation, API helpers, backend endpoints, native app footholds, auth/session handling, and existing tests before proposing or editing.
    - Prefer implementing in the real desktop/app/web surfaces the user uses, then verify through those surfaces. Do not ask the user to provide endpoint names or file paths that can be discovered locally.
    """

    static let appParityPrompt = """
    Desktop app training drill: implement the share functionality from the website into the Hanasand/Nucleus app as if this request came from the real Hanasand Desktop app or login.no AI surface.

    Produce the exact practical plan you would execute next. You must cite the repository evidence you would inspect, identify the website share helpers and backend routes, identify the native app insertion points, cover auth/session behavior, and include concrete verification through the app/website path. Do not rely on scripts as the user-facing path.
    """

    static let desktopUIAuditPrompt = """
    Desktop app improvement drill: review the Hanasand Desktop Swift app and identify the highest-impact UI gaps, unimplemented buttons, placeholder pages, or web fallbacks that should become native.

    Keep this bounded: inspect app/desktop/Sources/Hanasand/Hanasand.swift and return exactly five actionable findings with exact line references. Prefer fixes for clickable controls that do not do useful work, unsafe destructive buttons, web fallbacks pretending to be native, or missing Desktop app loopback commands. Do not continue searching after those five findings.
    """
}

struct AITraceEvent: Identifiable, Equatable {
    enum Kind {
        case system
        case thought
        case tool
        case file
        case error

        var icon: String {
            switch self {
            case .system: return "antenna.radiowaves.left.and.right"
            case .thought: return "brain.head.profile"
            case .tool: return "wrench.and.screwdriver"
            case .file: return "doc.text"
            case .error: return "exclamationmark.triangle"
            }
        }
    }

    let id = UUID()
    let kind: Kind
    let title: String
    let detail: String
    let createdAt = Date()
}

struct AIArtifact: Decodable, Equatable {
    let label: String?
    let path: String?
    let content: String?
    let summary: String?

    var displayTitle: String {
        label ?? path ?? "Artifact"
    }

    var displayDetail: String {
        summary ?? path ?? content?.prefix(220).description ?? "File artifact produced by the model."
    }
}

struct AIOverheadSample: Decodable, Equatable {
    let stages: [String: Double]?
}

struct AISocketEvent: Decodable {
    let type: String
    let clients: [AIConnectedClient]?
    let client: AIConnectedClient?
    let conversationId: String?
    let clientName: String?
    let delta: String?
    let content: String?
    let error: String?
    let toolId: String?
    let toolLabel: String?
    let toolState: String?
    let toolDetail: String?
    let artifacts: [AIArtifact]?
    let overhead: AIOverheadSample?
}

struct AIPromptRequest: Encodable {
    struct Message: Encodable {
        let role: String
        let content: String
    }

    let type: String
    let conversationId: String
    let clientName: String
    let messages: [Message]
    let maxTokens: Int
    let temperature: Double
}

struct HanasandAIResponse {
    let meta: String
    let body: String
}

struct HanasandLoginRequest: Encodable {
    let password: String
}

enum PasswordResetStep {
    case idle
    case code
    case newPassword
}

struct PasswordResetRequestPayload: Encodable {
    let id: String
}

struct PasswordResetVerifyPayload: Encodable {
    let id: String
    let code: String
}

struct PasswordResetCompletePayload: Encodable {
    let id: String
    let resetToken: String
    let password: String
}

struct PasswordResetVerifyResponse: Decodable {
    let resetToken: String?
    let error: String?
}

struct PasswordResetResponse: Decodable {
    let ok: Bool?
    let error: String?
}

struct HanasandLoginResponse: Decodable {
    let id: String?
    let token: String?
    let expiresAt: String?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case id
        case token
        case expiresAt = "expires_at"
        case error
    }
}

struct HanasandAIClient {
    private let session: URLSession
    private let apiURL: URL
    private let token: String
    private let userId: String

    init(apiURL configuredURL: URL? = nil, token configuredToken: String = "", userId configuredUserId: String = "", session: URLSession = .shared) {
        self.session = session
        let environment = ProcessInfo.processInfo.environment
        let configured = environment["HANASAND_AI_API"] ?? "https://api.hanasand.com/api/tools/ai"
        apiURL = configuredURL ?? URL(string: configured) ?? URL(string: "https://api.hanasand.com/api/tools/ai")!
        token = configuredToken.isEmpty ? (environment["HANASAND_API_TOKEN"] ?? environment["HANASAND_AUTH_TOKEN"] ?? "") : configuredToken
        userId = configuredUserId.isEmpty ? (environment["HANASAND_USER_ID"] ?? "") : configuredUserId
    }

    func send(prompt: String, context: String) async throws -> HanasandAIResponse {
        var request = URLRequest(url: apiURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if !userId.isEmpty {
            request.setValue(userId, forHTTPHeaderField: "id")
        }
        request.httpBody = try JSONEncoder().encode(AIRequest(prompt: prompt, context: context))

        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 200
        let payload = try? JSONDecoder().decode(AIToolPayload.self, from: data)

        guard (200..<300).contains(status) else {
            if status == 401 && token.isEmpty {
                throw HanasandAIError.missingToken(apiURL.absoluteString)
            }
            throw HanasandAIError.httpStatus(status, payload?.error)
        }

        let text = payload?.message
            ?? payload?.suggestion
            ?? payload?.error
            ?? String(data: data, encoding: .utf8)
            ?? "No response."
        let meta = payload?.status == "configured_later" ? "Hanasand AI" : "Hanasand AI"

        return HanasandAIResponse(meta: meta, body: text)
    }

    private struct AIRequest: Encodable {
        let prompt: String
        let context: String
    }

    private struct AIToolPayload: Decodable {
        let status: String?
        let message: String?
        let suggestion: String?
        let error: String?
    }
}

enum HanasandAIError: LocalizedError {
    case invalidPayload
    case missingToken(String)
    case httpStatus(Int, String?)

    var errorDescription: String? {
        switch self {
        case .invalidPayload:
            return "Could not encode the Hanasand AI request."
        case .missingToken(let endpoint):
            return "The Hanasand AI endpoint is configured at \(endpoint), but it requires auth. Add a token in Settings or launch with HANASAND_API_TOKEN/HANASAND_AUTH_TOKEN."
        case .httpStatus(let status, let error):
            return error ?? "The Hanasand AI endpoint returned HTTP \(status)."
        }
    }
}

struct MailOverviewEnvelope: Decodable {
    struct MailAddress: Decodable, Hashable {
        let email: String
        let name: String?

        var displayName: String {
            let cleanName = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return cleanName.isEmpty ? email : "\(cleanName) <\(email)>"
        }
    }

    struct Mailbox: Decodable, Identifiable {
        let id: String
        let name: String
        let role: String?
        let parentId: String?
        let unreadEmails: Int?
        let totalEmails: Int?

        enum CodingKeys: String, CodingKey {
            case id
            case name
            case role
            case parentId
            case unreadEmails
            case totalEmails
        }

        var displayName: String {
            name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? id : name
        }

        var countLabel: String {
            if let unreadEmails, unreadEmails > 0 {
                return "\(unreadEmails) unread"
            }
            if let totalEmails {
                return "\(totalEmails) total"
            }
            return role ?? "folder"
        }
    }

    struct Attachment: Decodable, Identifiable {
        let blobId: String
        let name: String
        let type: String?
        let size: Int?
        let disposition: String?
        let cid: String?
        let isInline: Bool?

        var id: String { blobId }
    }

    struct Message: Decodable, Identifiable {
        let id: String
        let threadId: String?
        let mailboxIds: [String]?
        let subject: String
        let preview: String?
        let receivedAt: String?
        let sentAt: String?
        let from: [MailAddress]
        let to: [MailAddress]
        let cc: [MailAddress]?
        let bcc: [MailAddress]?
        let replyTo: [MailAddress]?
        let hasAttachment: Bool?
        let isRead: Bool?
        let isFlagged: Bool?
        let isAnswered: Bool?
        let isDraft: Bool?
        let isJunk: Bool?
        let isDeleted: Bool?
        let textBody: String?
        let htmlBody: String?
        let attachments: [Attachment]?

        enum CodingKeys: String, CodingKey {
            case id
            case threadId
            case mailboxIds
            case subject
            case preview
            case receivedAt
            case sentAt
            case from
            case to
            case cc
            case bcc
            case replyTo
            case hasAttachment
            case isRead
            case isFlagged
            case isAnswered
            case isDraft
            case isJunk
            case isDeleted
            case textBody
            case htmlBody
            case attachments
        }

        var subjectLabel: String {
            subject.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "(No subject)" : subject
        }

        var fromLabel: String {
            from.first?.displayName ?? "Unknown sender"
        }

        var dateLabel: String {
            formatDateText(receivedAt, fallback: formatDateText(sentAt, fallback: "No timestamp"))
        }

        var bodyText: String {
            let text = textBody?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !text.isEmpty { return text }
            return preview?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        }

        var hasHTMLBody: Bool {
            !(htmlBody?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
        }

        func renderedHTML(mailboxUser: String?, apiBaseURL: URL) -> String {
            var html = htmlBody?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if html.isEmpty {
                html = "<pre>\(bodyText.htmlEscaped)</pre>"
            }
            if let mailboxUser {
                for attachment in attachments ?? [] {
                    guard let cid = attachment.cid, !cid.isEmpty else { continue }
                    let url = apiBaseURL
                        .appendingAPIPath("mail/blob/\(mailboxUser)/\(attachment.blobId)/\(attachment.name)")
                        .absoluteString
                    html = html.replacingOccurrences(of: "cid:\(cid)", with: url)
                    html = html.replacingOccurrences(of: "cid:<\(cid)>", with: url)
                }
            }
            return """
            <!doctype html>
            <html>
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <style>
                :root { color-scheme: dark; }
                html, body {
                  margin: 0;
                  padding: 0;
                  background: #0d100d;
                  color: #edf2e7;
                  font: 14px -apple-system, BlinkMacSystemFont, "Aptos", sans-serif;
                  line-height: 1.65;
                }
                body { padding: 24px; overflow-wrap: anywhere; }
                img, iframe, video { max-width: 100%; height: auto; border-radius: 14px; }
                a { color: #f4a261; }
                table { max-width: 100%; border-collapse: collapse; }
                pre, code { white-space: pre-wrap; word-break: break-word; }
              </style>
            </head>
            <body>\(html)</body>
            </html>
            """
        }
    }

    struct Account: Decodable, Identifiable {
        let id: String
        let name: String?
        let address: String
    }

    struct Health: Decodable {
        struct Check: Decodable, Identifiable {
            let id: String
            let label: String?
            let status: String?
            let detail: String?
        }

        let status: String
        let checkedAt: String?
        let queueDepth: Int?
        let smtpBannerLatencyMs: Int?
        let checks: [Check]?
    }

    struct Settings: Decodable {
        let host: String?
        let smtpHost: String?
        let smtpPort: Int?
        let imapHost: String?
        let imapPort: Int?
        let managesievePort: Int?
        let username: String?
        let address: String?
    }

    struct Filter: Decodable, Identifiable {
        struct Criteria: Decodable {
            let field: String?
            let contains: String?
        }

        struct Action: Decodable {
            let type: String?
            let mailboxName: String?
            let markRead: Bool?
        }

        let id: Int
        let name: String
        let enabled: Bool?
        let criteria: Criteria?
        let action: Action?
        let createdAt: String?
        let updatedAt: String?

        enum CodingKeys: String, CodingKey {
            case id
            case name
            case enabled
            case criteria
            case action
            case createdAt = "created_at"
            case updatedAt = "updated_at"
        }

        var ruleLabel: String {
            let field = criteria?.field ?? "from"
            let contains = criteria?.contains ?? "anything"
            let target = action?.mailboxName ?? "mailbox"
            return "\(field) contains \(contains) -> \(target)"
        }
    }

    struct RecentRecipient: Decodable, Identifiable {
        let email: String
        let name: String?
        let useCount: Int?
        let lastUsedAt: String?

        var id: String { email }

        var displayName: String {
            let cleanName = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return cleanName.isEmpty ? email : "\(cleanName) <\(email)>"
        }
    }

    let mailboxUser: String?
    let mailboxAddress: String?
    let accessibleAccounts: [Account]?
    let mailboxes: [Mailbox]
    let selectedMailboxId: String?
    let messages: [Message]
    let selectedMessage: Message?
    let filters: [Filter]?
    let recentRecipients: [RecentRecipient]?
    let health: Health?
    let settings: Settings?
}

struct MailSendPayload: Encodable {
    let mailboxUser: String?
    let to: String
    let cc: String?
    let bcc: String?
    let replyTo: String?
    let subject: String
    let textBody: String
    let attachments: [MailDraftAttachment.Payload]
}

struct MailDraftAttachment: Identifiable, Hashable {
    struct Payload: Encodable {
        let name: String
        let type: String
        let contentBase64: String
        let size: Int
    }

    let id = UUID()
    let name: String
    let type: String
    let size: Int
    let contentBase64: String

    var payload: Payload {
        Payload(name: name, type: type, contentBase64: contentBase64, size: size)
    }
}

struct MailMailboxPayload: Encodable {
    let mailboxUser: String?
    let name: String
    let parentId: String?
}

struct MailFilterPayload: Encodable {
    struct Criteria: Encodable {
        let field: String
        let contains: String
    }

    struct Action: Encodable {
        let type: String
        let mailboxName: String
        let markRead: Bool
    }

    let mailboxUser: String?
    let name: String
    let enabled: Bool
    let criteria: Criteria
    let action: Action
}

struct AIModelsEnvelope: Decodable {
    struct Client: Decodable {
        let id: String?
        let name: String
        let lastSeen: String?
        let model: AIModelMetrics?
    }

    let connected: [Client]
}

enum AppUpdateStatus {
    case idle
    case checking(message: String)
    case downloading(message: String)
    case ready(message: String)
    case upToDate(message: String)
    case unavailable(message: String)
    case failed(message: String)

    var title: String {
        switch self {
        case .idle: return "Ready"
        case .checking: return "Checking"
        case .downloading: return "Downloading"
        case .ready: return "Update staged"
        case .upToDate: return "Up to date"
        case .unavailable: return "No package"
        case .failed: return "Update failed"
        }
    }

    var message: String {
        switch self {
        case .idle: return "Idle"
        case .checking(let message), .downloading(let message), .ready(let message), .upToDate(let message), .unavailable(let message), .failed(let message):
            return message
        }
    }

    var isBusy: Bool {
        switch self {
        case .checking, .downloading: return true
        default: return false
        }
    }
}

struct AppUpdateManifest: Decodable {
    let app: String
    let platform: String
    let installedVersion: String
    let latestVersion: String
    let updateAvailable: Bool
    let channel: String
    let releasedAt: String
    let notes: String
    let downloadURL: URL
    let packageSize: Int?
    let sha256: String?

    enum CodingKeys: String, CodingKey {
        case app
        case platform
        case installedVersion = "installed_version"
        case latestVersion = "latest_version"
        case updateAvailable = "update_available"
        case channel
        case releasedAt = "released_at"
        case notes
        case downloadURL = "download_url"
        case packageSize = "package_size"
        case sha256
    }

    func hasNewerVersion(than currentVersion: String) -> Bool {
        let latestParts = latestVersion.semanticVersionParts
        let currentParts = currentVersion.semanticVersionParts
        let count = max(latestParts.count, currentParts.count)

        for index in 0..<count {
            let latestValue = index < latestParts.count ? latestParts[index] : 0
            let currentValue = index < currentParts.count ? currentParts[index] : 0
            if latestValue != currentValue {
                return latestValue > currentValue
            }
        }

        return false
    }
}

private extension String {
    var semanticVersionParts: [Int] {
        split(separator: ".").map { part in
            let numericPrefix = part.prefix { $0.isNumber }
            return Int(numericPrefix) ?? 0
        }
    }
}

struct AppUpdateClient {
    private let session: URLSession
    private let apiURL: URL

    init(session: URLSession = .shared) {
        self.session = session
        let configured = ProcessInfo.processInfo.environment["HANASAND_APP_UPDATE_API"] ?? "https://hanasand.com/api/app"
        apiURL = URL(string: configured) ?? URL(string: "https://hanasand.com/api/app")!
    }

    func fetchManifest(currentVersion: String) async throws -> AppUpdateManifest {
        var components = URLComponents(url: apiURL, resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "platform", value: "macos"),
            URLQueryItem(name: "version", value: currentVersion),
        ]
        guard let url = components?.url else {
            throw UpdateError.invalidURL
        }

        let (data, response) = try await session.data(from: url)
        try validate(response: response)
        return try JSONDecoder().decode(AppUpdateManifest.self, from: data)
    }

    func download(manifest: AppUpdateManifest) async throws -> URL {
        let (temporaryURL, response) = try await session.download(from: manifest.downloadURL)
        try validate(response: response)

        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = support.appendingPathComponent("Hanasand/Updates", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        let ext = manifest.downloadURL.pathExtension.isEmpty ? "bin" : manifest.downloadURL.pathExtension
        let destination = directory.appendingPathComponent("Hanasand-\(manifest.latestVersion).\(ext)")
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: temporaryURL, to: destination)

        if let expected = manifest.sha256 {
            let actual = try sha256(for: destination)
            guard actual.caseInsensitiveCompare(expected) == .orderedSame else {
                throw UpdateError.checksumMismatch
            }
        }

        return destination
    }

    private func validate(response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            throw UpdateError.httpStatus(http.statusCode)
        }
    }

    private func sha256(for url: URL) throws -> String {
        let data = try Data(contentsOf: url)
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

enum UpdateError: LocalizedError {
    case invalidURL
    case httpStatus(Int)
    case checksumMismatch

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "The app update URL is invalid."
        case .httpStatus(let status):
            return "The Hanasand app update endpoint returned HTTP \(status)."
        case .checksumMismatch:
            return "The downloaded update did not match the API checksum."
        }
    }
}

enum DashboardRequestError: LocalizedError {
    case httpStatus(Int)

    var errorDescription: String? {
        switch self {
        case .httpStatus(401):
            return "Auth required. Add a valid token in Settings."
        case .httpStatus(403):
            return "Access denied for this dashboard route."
        case .httpStatus(let status):
            return "Dashboard endpoint returned HTTP \(status)."
        }
    }
}

enum PasswordResetRequestError: LocalizedError {
    case message(String)

    var errorDescription: String? {
        switch self {
        case .message(let message):
            return message
        }
    }
}

struct DesktopShell: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.colorScheme) private var colorScheme
    @AppStorage("hanasand.desktop.sidebarWidth") private var sidebarWidth = 260.0
    @FocusState private var commandFocused: Bool

    var body: some View {
        let theme = DesktopTheme(preference: model.appearancePreference, systemScheme: colorScheme)

        Group {
            if model.hasHanasandAuth {
                HStack(spacing: 0) {
                    if model.sidebarVisible {
                        Sidebar()
                            .frame(width: sidebarWidth)
                            .transition(.move(edge: .leading).combined(with: .opacity))
                        SidebarResizeHandle(width: $sidebarWidth)
                    }
                    MainWorkspace(commandFocused: $commandFocused)
                }
            } else {
                HanasandLoginGate()
            }
        }
        .background(theme.background)
        .foregroundStyle(theme.text)
        .environment(\.desktopTheme, theme)
        .preferredColorScheme(model.appearancePreference.preferredColorScheme)
        .background(WindowFrameRestorer(storageKey: "hanasand.desktop.windowFrame"))
        .toolbar {
            ToolbarItemGroup {
                Button {
                    withAnimation(.spring(response: 0.24, dampingFraction: 0.9)) {
                        model.sidebarVisible.toggle()
                    }
                } label: {
                    Image(systemName: "sidebar.left")
                }
                .help("Toggle Sidebar")

                Button {
                    model.selectedSection = .control
                    model.focusCommand.toggle()
                } label: {
                    Image(systemName: "command")
                }
                .help("Open Control")

                Button {
                    model.copyCurrentContext()
                } label: {
                    Image(systemName: "doc.on.doc")
                }
                .help("Copy Current Context")
            }
            ToolbarItemGroup(placement: .primaryAction) {
                Button {
                    Task { await model.refreshLocalStatus() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .help("Refresh This Mac")

                Button {
                    Task { await model.checkServerLogs() }
                } label: {
                    Image(systemName: "doc.text.magnifyingglass")
                }
                .help("Server Logs")
            }
        }
        .onChange(of: model.focusCommand) {
            commandFocused = true
        }
    }
}

private struct PasswordResetCodeBoxes: View {
    @Environment(\.desktopTheme) private var theme
    @Binding var code: String
    let isBusy: Bool
    @FocusState private var codeFieldFocused: Bool

    private var characters: [Character] {
        Array(code)
    }

    var body: some View {
        ZStack {
            HStack(spacing: 8) {
                ForEach(0..<6, id: \.self) { index in
                    codeBox(at: index)
                }
            }

            TextField("", text: $code)
                .textFieldStyle(.plain)
                .font(.system(size: 1))
                .foregroundStyle(.clear)
                .accentColor(.clear)
                .frame(width: 1, height: 1)
                .opacity(0.01)
                .focused($codeFieldFocused)
                .disabled(isBusy)
        }
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .onTapGesture {
            codeFieldFocused = true
        }
        .onAppear {
            DispatchQueue.main.async {
                codeFieldFocused = true
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("6 digit code")
        .accessibilityValue("\(code.count) digits entered")
    }

    private func codeBox(at index: Int) -> some View {
        let value = index < characters.count ? String(characters[index]) : ""
        let activeIndex = min(code.count, 5)
        let isActive = codeFieldFocused && (index == activeIndex || code.count == 6)

        return Text(value)
            .font(.system(size: 18, weight: .semibold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(theme.text)
            .frame(width: 40, height: 46)
            .background(theme.field)
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(isActive ? theme.accent : theme.divider, lineWidth: isActive ? 1.4 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .shadow(color: .black.opacity(0.14), radius: 8, x: 0, y: 5)
    }
}

struct HanasandLoginGate: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @FocusState private var focusedField: Field?

    private enum Field {
        case username
        case password
        case resetUsername
        case resetCode
        case resetPassword
        case resetConfirm
    }

    var body: some View {
        ZStack {
            theme.background
            VStack(alignment: .leading, spacing: 18) {
                masthead
                loginCard
                if model.passwordResetStep != .idle {
                    recoveryCard
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .frame(width: 430, alignment: .leading)
        }
        .onAppear {
            focusedField = .username
        }
    }

    private var masthead: some View {
        VStack(spacing: 10) {
            Text("Hanasand")
                .font(.system(size: 56, weight: .semibold, design: .serif))
                .kerning(0.5)
                .foregroundStyle(theme.text)
            Rectangle()
                .fill(theme.text.opacity(0.22))
                .frame(width: 56, height: 1)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.bottom, 16)
    }

    private var loginCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                authTextField("Username", text: $model.loginUsername, field: .username) {
                    focusedField = .password
                }
                authSecureField("Password", text: $model.loginPassword, field: .password) {
                    Task { await model.loginToHanasand() }
                }
            }

            HStack(alignment: .center, spacing: 14) {
                primaryButton(
                    title: model.isLoggingIn ? "Logging in" : "Log in",
                    busy: model.isLoggingIn,
                    action: { Task { await model.loginToHanasand() } }
                )
                .disabled(model.isLoggingIn)

                Spacer(minLength: 10)

                if model.passwordResetStep == .idle {
                    Button {
                        withAnimation(.spring(response: 0.28, dampingFraction: 0.88)) {
                            model.beginPasswordReset()
                            focusedField = .resetUsername
                        }
                    } label: {
                        Text("Forgot password?")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(theme.textTertiary)
                    }
                    .buttonStyle(.plain)
                }
            }

            if !model.loginStatus.isEmpty {
                statusText(model.loginStatus, isSuccess: false)
            }
        }
        .padding(18)
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: .black.opacity(theme.isLight ? 0.08 : 0.28), radius: 28, x: 0, y: 18)
    }

    private var recoveryCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Account recovery")
                        .font(.system(size: 18, weight: .semibold, design: .serif))
                        .foregroundStyle(theme.text)
                    Text(recoveryDetail)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(theme.textTertiary)
                }
                Spacer()
                Button {
                    withAnimation(.spring(response: 0.24, dampingFraction: 0.9)) {
                        model.cancelPasswordReset()
                        focusedField = .username
                    }
                } label: {
                    Text("Never mind")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(theme.textTertiary)
                }
                .buttonStyle(.plain)
            }

            if model.passwordResetStep == .code {
                HStack(spacing: 10) {
                    authTextField("Username", text: $model.passwordResetUsername, field: .resetUsername) {
                        Task { await model.requestPasswordResetCode() }
                        focusedField = .resetCode
                    }

                    secondaryButton(
                        title: model.isResettingPassword ? "Sending" : "Send code",
                        busy: model.isResettingPassword,
                        action: {
                            Task {
                                await model.requestPasswordResetCode()
                                focusedField = .resetCode
                            }
                        }
                    )
                    .disabled(model.isResettingPassword)
                }

                PasswordResetCodeBoxes(
                    code: Binding(
                        get: { model.passwordResetCode },
                        set: { model.updatePasswordResetCode($0) }
                    ),
                    isBusy: model.isResettingPassword
                )
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 2)
            }

            if model.passwordResetStep == .newPassword {
                authSecureField("New password", text: $model.passwordResetNewPassword, field: .resetPassword) {
                    focusedField = .resetConfirm
                }

                authSecureField("Confirm new password", text: $model.passwordResetConfirmPassword, field: .resetConfirm) {
                    Task { await model.completePasswordReset() }
                }

                primaryButton(
                    title: model.isResettingPassword ? "Setting" : "Set password",
                    busy: model.isResettingPassword,
                    action: { Task { await model.completePasswordReset() } }
                )
                .disabled(model.isResettingPassword)
            }

            if !model.passwordResetStatus.isEmpty {
                statusText(model.passwordResetStatus, isSuccess: recoveryStatusLooksHelpful)
            }
        }
        .padding(18)
        .background(theme.backgroundElevated.opacity(theme.isLight ? 0.92 : 0.62))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(theme.accent.opacity(0.32), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: .black.opacity(theme.isLight ? 0.08 : 0.22), radius: 24, x: 0, y: 16)
    }

    private var recoveryDetail: String {
        model.passwordResetStep == .newPassword
            ? "Choose a new password after confirming your code."
            : "We will send a one-time code to continue."
    }

    private var recoveryStatusLooksHelpful: Bool {
        let status = model.passwordResetStatus.lowercased()
        return status.contains("check") || status.contains("accepted")
    }

    private func authTextField(
        _ placeholder: String,
        text: Binding<String>,
        field: Field,
        onSubmit: @escaping () -> Void
    ) -> some View {
        TextField(placeholder, text: text)
            .textFieldStyle(.plain)
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(theme.text)
            .focused($focusedField, equals: field)
            .onSubmit(onSubmit)
            .padding(.horizontal, 16)
            .frame(height: 46)
            .background(theme.field)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(focusedField == field ? theme.accent.opacity(0.75) : theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func authSecureField(
        _ placeholder: String,
        text: Binding<String>,
        field: Field,
        onSubmit: @escaping () -> Void
    ) -> some View {
        SecureField(placeholder, text: text)
            .textFieldStyle(.plain)
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(theme.text)
            .focused($focusedField, equals: field)
            .onSubmit(onSubmit)
            .padding(.horizontal, 16)
            .frame(height: 46)
            .background(theme.field)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(focusedField == field ? theme.accent.opacity(0.75) : theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func primaryButton(title: String, busy: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if busy {
                    ProgressView()
                        .scaleEffect(0.58)
                }
                Text(title)
            }
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(theme.background)
            .padding(.horizontal, 20)
            .frame(height: 42)
            .background(theme.text)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func secondaryButton(title: String, busy: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if busy {
                    ProgressView()
                        .scaleEffect(0.58)
                }
                Text(title)
            }
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(theme.text)
            .padding(.horizontal, 16)
            .frame(height: 46)
            .background(theme.cardRaised)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func statusText(_ value: String, isSuccess: Bool) -> some View {
        Text(value)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(isSuccess ? theme.textTertiary : theme.danger)
            .lineLimit(3)
            .fixedSize(horizontal: false, vertical: true)
    }
}

struct WindowFrameRestorer: NSViewRepresentable {
    let storageKey: String

    func makeCoordinator() -> Coordinator {
        Coordinator(storageKey: storageKey)
    }

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            guard let window = view.window else { return }
            context.coordinator.attach(to: window)
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async {
            guard let window = nsView.window else { return }
            context.coordinator.attach(to: window)
        }
    }

    final class Coordinator {
        private let storageKey: String
        private weak var window: NSWindow?
        private var observers: [NSObjectProtocol] = []

        init(storageKey: String) {
            self.storageKey = storageKey
        }

        deinit {
            observers.forEach(NotificationCenter.default.removeObserver)
        }

        func attach(to window: NSWindow) {
            guard self.window !== window else { return }
            observers.forEach(NotificationCenter.default.removeObserver)
            observers = []
            self.window = window

            if let saved = UserDefaults.standard.string(forKey: storageKey) {
                let frame = NSRectFromString(saved)
                if !frame.isEmpty, let screenFrame = window.screen?.visibleFrame, screenFrame.intersects(frame) {
                    window.setFrame(frame, display: true)
                }
            }

            let save: (Notification) -> Void = { [weak self, weak window] _ in
                guard let self, let window else { return }
                UserDefaults.standard.set(NSStringFromRect(window.frame), forKey: self.storageKey)
            }

            observers.append(NotificationCenter.default.addObserver(
                forName: NSWindow.didMoveNotification,
                object: window,
                queue: .main,
                using: save
            ))
            observers.append(NotificationCenter.default.addObserver(
                forName: NSWindow.didResizeNotification,
                object: window,
                queue: .main,
                using: save
            ))
        }
    }
}

struct SidebarResizeHandle: View {
    @Environment(\.desktopTheme) private var theme
    @Binding var width: Double
    @State private var dragStartWidth: Double?

    var body: some View {
        Rectangle()
            .fill(theme.divider.opacity(0.6))
            .frame(width: 5)
            .overlay(
                Rectangle()
                    .fill(theme.accent.opacity(0.0))
                    .frame(width: 2)
            )
            .contentShape(Rectangle())
            .gesture(
                DragGesture()
                    .onChanged { value in
                        let start = dragStartWidth ?? width
                        dragStartWidth = start
                        width = min(max(start + value.translation.width, 210), 380)
                    }
                    .onEnded { _ in
                        dragStartWidth = nil
                    }
            )
            .onHover { hovering in
                if hovering {
                    NSCursor.resizeLeftRight.push()
                } else {
                    NSCursor.pop()
                }
            }
            .help("Drag to resize sidebar")
    }
}

struct Sidebar: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 18) {
                HanasandLogo()
                    .frame(width: 34, height: 34)
                Text("Hanasand")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(theme.text)
                Spacer()
                Image(systemName: "chevron.left")
                    .foregroundStyle(.secondary)
                Image(systemName: "chevron.right")
                    .foregroundStyle(.tertiary)
            }
            .font(.system(size: 15, weight: .semibold))
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 24)

            ScrollView {
                VStack(alignment: .leading, spacing: 17) {
                    ForEach([DesktopSection.command, .control, .dashboard, .browser, .ide, .mac, .mail, .documents, .images, .ai, .server, .updates], id: \.id) { section in
                        NavRow(icon: section.icon, title: section.title, isSelected: model.selectedSection == section)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                model.selectedSection = section
                            }
                    }
                }
                .padding(.horizontal, 16)

                HStack {
                    Text("Projects")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: "line.3.horizontal.decrease")
                    Button {
                        model.createProject()
                    } label: {
                        Image(systemName: "folder.badge.plus")
                    }
                    .buttonStyle(.plain)
                    .help("Create project")
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 16)
                .padding(.top, 34)
                .padding(.bottom, 14)

                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(model.realProjects) { project in
                        ProjectRow(project: project, isSelected: model.selectedSection == .command && model.selectedProject == project.title)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                model.selectedSection = .command
                                model.selectedProject = project.title
                            }
                        }
                }
            }
            .padding(.horizontal, 8)

            Spacer(minLength: 16)

            NavRow(icon: DesktopSection.settings.icon, title: DesktopSection.settings.title, isSelected: model.selectedSection == .settings)
                .contentShape(Rectangle())
                .onTapGesture {
                    model.selectedSection = .settings
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 20)
        }
        .background(theme.sidebar)
    }
}

struct MainWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    let commandFocused: FocusState<Bool>.Binding

    var body: some View {
        switch model.selectedSection {
        case .command:
            VStack(spacing: 0) {
                TopBar()
                Transcript()
                ChangedFilesDock()
                CommandDock(commandFocused: commandFocused)
            }
            .background(theme.background)
        case .control:
            ControlPlaneWorkspace(commandFocused: commandFocused)
        case .dashboard:
            DashboardWorkspace()
        case .browser:
            BrowserWorkspace()
        case .ide:
            IDEWorkspace()
        case .mac:
            MacWorkspace()
        case .mail:
            MailWorkspace()
        case .documents:
            DocumentWorkspace()
        case .images:
            ImageReviewWorkspace()
        case .ai:
            AIWorkspace(commandFocused: commandFocused)
        case .server:
            ServerWorkspace()
        case .updates:
            UpdatesWorkspace()
        case .settings:
            SettingsWorkspace()
        }
    }
}

struct TopBar: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        HStack(spacing: 12) {
            Text(model.selectedSection == .command ? model.selectedProject : model.selectedSection.title)
                .font(.system(size: 13, weight: .black))
                .foregroundStyle(theme.text)
            Text("Desktop")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(theme.textTertiary)
            Button {
                model.recordCommand("open_section_dashboard")
            } label: {
                Image(systemName: "ellipsis")
                    .foregroundStyle(.secondary)
                    .frame(width: 24, height: 24)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help("Open Dashboard")
            .accessibilityLabel("Open Dashboard")
            Spacer()
            AgentStatusPill(status: model.status)
            UpdateStatusPill(status: model.updateStatus)
            TopBarIconButton(icon: "terminal", label: "Command", active: model.selectedSection == .command) {
                model.recordCommand("open_section_command")
            }
            TopBarIconButton(icon: "folder", label: "IDE", active: model.selectedSection == .ide) {
                model.recordCommand("open_section_ide")
            }
            TopBarIconButton(icon: "gearshape", label: "Settings", active: model.selectedSection == .settings) {
                model.recordCommand("open_section_settings")
            }
        }
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(theme.textSecondary)
        .padding(.horizontal, 16)
        .frame(height: 48)
        .background(theme.commandBar)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }
}

struct TopBarIconButton: View {
    @Environment(\.desktopTheme) private var theme
    let icon: String
    let label: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if active {
                    Circle()
                        .fill(theme.accent)
                        .frame(width: 6, height: 6)
                }
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .bold))
                Text(label)
                    .font(.system(size: 12, weight: .bold))
            }
            .foregroundStyle(active ? theme.text : theme.textSecondary)
            .frame(height: 28)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(label)
        .accessibilityLabel(label)
    }
}

struct Transcript: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 26) {
                    if model.events.isEmpty {
                        EmptyTranscript()
                    } else {
                        ForEach(model.events) { event in
                            EventBlock(event: event)
                                .id(event.id)
                        }
                    }
                }
                .padding(.horizontal, 210)
                .padding(.top, 52)
                .padding(.bottom, 190)
            }
            .onChange(of: model.events.count) {
                if let last = model.events.last {
                    withAnimation(.snappy(duration: 0.18)) {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }
}

struct EventBlock: View {
    @Environment(\.desktopTheme) private var theme
    let event: AgentEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(event.body)
                .font(.system(size: 16, weight: .semibold))
                .lineSpacing(5)
                .foregroundStyle(event.kind == .error ? theme.danger : theme.text)
                .textSelection(.enabled)
            Text(event.meta)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(event.kind == .change ? theme.green : theme.textSecondary)
        }
    }
}

struct EmptyTranscript: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Ready")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(theme.text)
            HStack(spacing: 12) {
                AgentFact(label: "Host", value: model.status.hostname)
                AgentFact(label: "Platform", value: model.status.platform)
                AgentFact(label: "Agent", value: model.status.ok ? "Online" : "Offline")
            }
        }
        .padding(18)
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct AgentFact: View {
    @Environment(\.desktopTheme) private var theme
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(theme.textTertiary)
            Text(value)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(theme.cardRaised)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct ChangedFilesDock: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

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

    private func fileIcon(for status: String) -> String {
        if status.contains("D") { return "minus.circle" }
        if status.contains("A") || status.contains("?") { return "plus.circle" }
        if status.contains("R") { return "arrow.triangle.2.circlepath" }
        return "pencil.circle"
    }

    private func fileColor(for status: String) -> Color {
        if status.contains("D") { return theme.danger }
        if status.contains("A") || status.contains("?") { return theme.green }
        return theme.accent
    }
}

struct CommandDock: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    let commandFocused: FocusState<Bool>.Binding
    @State private var draggingQueuedPromptID: UUID?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Text("\(model.events.count) entries")
                    .foregroundStyle(theme.textSecondary)
                Text(" +\(model.events.filter { $0.kind == .change }.count * 70)")
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

                TextField("Command", text: $model.prompt, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(theme.text)
                    .lineLimit(2...5)
                    .focused(commandFocused)
                    .onSubmit {
                        model.submitPrompt()
                    }

                HStack(spacing: 10) {
                    CommandDockQuickButton(title: "Queue", icon: "plus") {
                        model.queuePrompt()
                    }
                    CommandDockQuickButton(title: "Send now", icon: "paperplane") {
                        model.submitPrompt()
                    }
                    CommandDockQuickButton(title: "Dashboard", icon: "gauge.with.dots.needle") {
                        model.recordCommand("open_section_dashboard")
                    }
                    CommandDockQuickButton(title: "AI drill", icon: "graduationcap") {
                        model.recordCommand("ai_train_app_parity")
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
                    Button(action: model.submitPrompt) {
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

    private var canSubmit: Bool {
        !model.prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !model.isRunning
    }
}

struct CommandDockQuickButton: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .semibold))
                Text(title)
            }
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(theme.textSecondary)
            .padding(.horizontal, 8)
            .frame(height: 26)
            .background(theme.cardRaised.opacity(0.82))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .help(title)
    }
}

struct DashboardWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        if model.selectedDashboardPath == nil {
            FeatureWorkspace(title: "Dashboard", subtitle: "Native Hanasand controls and API previews.") {
                DashboardSectionHeader(title: "Workspace", subtitle: "Open native panels where implemented, with API-backed previews for the rest.")
                ActionGrid(actions: model.dashboardActions)
                DashboardSectionHeader(title: "Administration", subtitle: "API-backed operational views.")
                ActionGrid(actions: model.adminActions)
                DashboardSectionHeader(title: "Web and external", subtitle: "These intentionally leave the app or use hosted flows.")
                ActionGrid(actions: model.quickAppActions)
            }
        } else {
            NativeDashboardDetail()
        }
    }
}

struct NativeDashboardDetail: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        FeatureWorkspace(title: model.selectedDashboardTitle, subtitle: model.nativeDashboardStatus) {
            HStack(spacing: 10) {
                ActionButton(title: "Back", icon: "chevron.left") {
                    model.closeNativeDashboardPage()
                }
                ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                    Task { await model.loadNativeDashboardData() }
                }
                if model.isLoadingNativeDashboard {
                    ProgressView()
                        .scaleEffect(0.70)
                }
            }

            HStack(spacing: 12) {
                FeatureCard(title: "Surface", value: model.selectedDashboardPath ?? "dashboard", icon: "rectangle.3.group")
                FeatureCard(title: "Mode", value: "Native desktop", icon: "macwindow")
                FeatureCard(title: "Auth", value: model.nativeDashboardStatus.localizedCaseInsensitiveContains("401") ? "Rejected" : "Settings/env", icon: "key")
            }

            nativeDashboardBody
        }
        .task(id: model.selectedDashboardPath) {
            await model.loadNativeDashboardData()
        }
    }

    @ViewBuilder
    private var nativeDashboardBody: some View {
        switch model.selectedDashboardPath {
        case "/dashboard":
            DashboardOverviewNativePanel()
        case "/g":
            LinksNativePanel()
        case "/dashboard/tests":
            RecentTestsNativePanel()
        case "/dashboard/mail":
            MailNativePanel()
        case "/dashboard/system":
            SystemNativePanel()
        case "/dashboard/vms":
            VMsNativePanel()
        case "/dashboard/logs":
            LogsNativePanel()
        case "/dashboard/system/ai":
            AIModelsNativePanel()
        case "/dashboard/system/rate-limits":
            RateLimitsNativePanel()
        case "/profile":
            ProfileNativePanel()
        case "/dashboard/management", "/users":
            UsersNativePanel()
        case "/role":
            RolesNativePanel()
        case "/s":
            SharesNativePanel()
        case "/dashboard/articles":
            ArticlesNativePanel()
        case "/dashboard/thoughts":
            ThoughtsNativePanel()
        case "/dashboard/notes":
            NotesNativePanel()
        case "/dashboard/db":
            DatabaseNativePanel()
        case "/dashboard/db/backups":
            BackupNativePanel()
        case "/dashboard/db/restore":
            RestoreNativePanel()
        case "/dashboard/vulnerabilities":
            VulnerabilityNativePanel()
        case "/dashboard/traffic":
            TrafficNativePanel()
        case "/upload", "/dashboard/files":
            UploadNativePanel()
        default:
            NativeRouteFallbackPanel()
        }
    }
}

struct NativeRouteFallbackPanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        NativeGroupPanel(title: "Native panel not mapped yet", subtitle: model.selectedDashboardPath ?? "Unknown route") {
            VStack(alignment: .leading, spacing: 12) {
                Text("This route is not part of the native dashboard set yet. You can jump back to the dashboard, open the workspace browser, or keep reviewing the available native panels.")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 10) {
                    ActionButton(title: "Dashboard", icon: "square.grid.2x2") {
                        model.closeNativeDashboardPage()
                    }
                    ActionButton(title: "Open browser", icon: "globe") {
                        let path = model.selectedDashboardPath ?? "/dashboard"
                        model.openInlineBrowser(url: path, title: model.selectedDashboardTitle, source: "Dashboard")
                    }
                    ActionButton(title: "Settings", icon: "gearshape") {
                        model.selectedSection = .settings
                    }
                }
            }
        }
    }
}

struct DashboardOverviewNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var searchText = ""
    @State private var selectedStatus = "all"

    private let columns = [
        GridItem(.adaptive(minimum: 260), spacing: 12, alignment: .top),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                FeatureCard(title: "Overall", value: status?.overall.capitalized ?? "Unknown", icon: statusIcon(status?.overall ?? "unknown"))
                FeatureCard(title: "Checks", value: "\(status?.checks.count ?? 0)", icon: "checklist")
                FeatureCard(title: "Down", value: "\(status?.checks.filter { $0.statusLabel.lowercased() == "down" }.count ?? 0)", icon: "xmark.octagon")
                FeatureCard(title: "Generated", value: status?.generatedLabel ?? "Unknown", icon: "clock")
            }

            HStack(spacing: 10) {
                SearchFieldRow(placeholder: "Search services or checks", text: $searchText)
                ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                    Task { await model.loadNativeDashboardData() }
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(statuses, id: \.self) { value in
                        FilterChip(title: value.capitalized, active: selectedStatus == value) {
                            selectedStatus = value
                        }
                    }
                }
            }

            if status == nil {
                NativeEmptyState(title: "Status not loaded", message: "Use Refresh to load service status checks.")
            } else if filteredChecks.isEmpty {
                NativeGroupPanel(title: "No matching checks", subtitle: "Adjust service search or status filters.") {
                    Text("Service checks are loaded, but none match the active filters.")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                }
            } else {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                    ForEach(groupedChecks, id: \.service) { group in
                        serviceCard(service: group.service, checks: group.checks)
                    }
                }
            }
        }
    }

    private var status: DashboardServiceStatus? {
        model.serviceStatus
    }

    private var statuses: [String] {
        ["all"] + Array(Set((status?.checks ?? []).map { $0.statusLabel.lowercased() })).sorted()
    }

    private var filteredChecks: [ServiceCheck] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return (status?.checks ?? []).filter { check in
            let statusMatch = selectedStatus == "all" || check.statusLabel.lowercased() == selectedStatus
            let searchable = [
                check.service,
                check.checkLabel,
                check.statusLabel,
                check.message ?? "",
            ].joined(separator: " ").lowercased()
            return statusMatch && (query.isEmpty || searchable.contains(query))
        }
    }

    private var groupedChecks: [(service: String, checks: [ServiceCheck])] {
        Dictionary(grouping: filteredChecks, by: \.service)
            .map { (service: $0.key, checks: $0.value.sorted { $0.checkName < $1.checkName }) }
            .sorted { $0.service < $1.service }
    }

    private func serviceCard(service: String, checks: [ServiceCheck]) -> some View {
        let worstStatus = checks.contains { $0.statusLabel.lowercased() == "down" }
            ? "down"
            : checks.contains { $0.statusLabel.lowercased() == "degraded" }
                ? "degraded"
                : "up"

        return NativeGroupPanel(title: service, subtitle: "\(checks.count) checks") {
            HStack(spacing: 10) {
                FeatureCard(title: "Status", value: worstStatus.capitalized, icon: statusIcon(worstStatus))
                FeatureCard(title: "Avg latency", value: averageLatencyLabel(checks), icon: "timer")
                FeatureCard(title: "Uptime", value: averageUptimeLabel(checks), icon: "arrow.up.heart")
            }

            LazyVStack(alignment: .leading, spacing: 8) {
                ForEach(checks) { check in
                    HStack(alignment: .top, spacing: 10) {
                        Circle()
                            .fill(statusColor(check.statusLabel))
                            .frame(width: 9, height: 9)
                            .padding(.top, 5)
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 8) {
                                Text(check.checkLabel)
                                    .font(.system(size: 12, weight: .black))
                                    .foregroundStyle(theme.text)
                                    .lineLimit(1)
                                Text(check.statusLabel.uppercased())
                                    .font(.system(size: 10, weight: .black))
                                    .foregroundStyle(statusColor(check.statusLabel))
                            }
                            Text([check.latencyLabel, check.uptimeLabel, check.checkedLabel].joined(separator: " · "))
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(theme.textTertiary)
                                .lineLimit(1)
                            if let message = check.message, !message.isEmpty {
                                Text(message)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(theme.textSecondary)
                                    .lineLimit(2)
                            }
                        }
                        Spacer()
                    }
                    .padding(10)
                    .background(theme.cardRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
    }

    private func averageLatencyLabel(_ checks: [ServiceCheck]) -> String {
        let values = checks.compactMap(\.latencyMs)
        guard !values.isEmpty else { return "Unknown" }
        return "\(Int((values.reduce(0, +) / Double(values.count)).rounded())) ms"
    }

    private func averageUptimeLabel(_ checks: [ServiceCheck]) -> String {
        let values = checks.compactMap { Double($0.uptime30d ?? "") }
        guard !values.isEmpty else { return "0%" }
        return "\(String(format: "%.1f", values.reduce(0, +) / Double(values.count)))%"
    }

    private func statusIcon(_ value: String) -> String {
        switch value.lowercased() {
        case "up": return "checkmark.circle"
        case "degraded": return "exclamationmark.triangle"
        case "down": return "xmark.octagon"
        default: return "questionmark.circle"
        }
    }

    private func statusColor(_ value: String) -> Color {
        switch value.lowercased() {
        case "up": return theme.green
        case "degraded": return theme.accent
        case "down": return theme.danger
        default: return theme.textTertiary
        }
    }
}

struct SearchFieldRow: View {
    @Environment(\.desktopTheme) private var theme
    let placeholder: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(theme.textTertiary)
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(theme.text)
            Spacer()
            if !text.isEmpty {
                Button("Clear") {
                    text = ""
                }
                .buttonStyle(.plain)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(theme.accent)
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 40)
        .background(theme.field)
        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
    }
}

struct MiniMetricCard: View {
    @Environment(\.desktopTheme) private var theme
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(theme.textTertiary)
                .textCase(.uppercase)
            Text(value)
                .font(.system(size: 13, weight: .black, design: .monospaced))
                .foregroundStyle(theme.text)
                .lineLimit(1)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.cardRaised)
        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
    }
}

struct MailNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var searchText = ""
    @State private var showAccountSetup = false
    @State private var now = Date()
    @FocusState private var searchFocused: Bool

    private var overview: MailOverviewEnvelope? { model.mailOverview }
    private var selectedMessage: MailOverviewEnvelope.Message? { model.selectedMailMessage }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            headerBar

            if let overview {
                HStack(alignment: .top, spacing: 0) {
                    mailboxSidebar(overview)
                        .frame(width: 238)

                    Divider()
                        .overlay(theme.divider)
                        .padding(.horizontal, 10)

                    threadedMessageList(overview)
                        .frame(minWidth: 330, idealWidth: 390, maxWidth: 440)

                    Divider()
                        .overlay(theme.divider)
                        .padding(.horizontal, 10)

                    messageReader(overview)
                        .frame(maxWidth: .infinity)
                }
                .frame(minHeight: 590)

                mailSyncBanner

                if model.mailComposerExpanded {
                    composeSheet(overview)
                }
        } else {
            NativeGroupPanel(title: "Connect Mail", subtitle: "Inbox, compose, accounts") {
                    HStack(spacing: 10) {
                        ActionButton(title: "Load inbox", icon: "tray.full") {
                            Task { await model.loadMailOverview() }
                        }
                        ActionButton(title: "Setup", icon: "gearshape") {
                            showAccountSetup.toggle()
                        }
                    }
                    NativeEmptyState(title: "No mailbox", message: "Add API settings, then Load inbox.")
                }
            }
        }
        .focusable()
        .onKeyPress(.downArrow) {
            Task { await model.selectNextMailMessage(offset: 1) }
            return .handled
        }
        .onKeyPress(.upArrow) {
            Task { await model.selectNextMailMessage(offset: -1) }
            return .handled
        }
        .task {
            if model.mailOverview == nil {
                await model.loadMailOverview()
            }
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 10_000_000_000)
                now = Date()
                guard model.mailAutoRefreshEnabled, model.mailOverview != nil else { continue }
                await model.loadMailOverview(silent: true)
            }
        }
    }

    private var headerBar: some View {
        NativeGroupPanel(title: "Mail", subtitle: model.mailSummary) {
            HStack(spacing: 12) {
                FeatureCard(title: "Messages", value: "\(overview?.messages.count ?? 0)", icon: "envelope")
                FeatureCard(title: "Unread", value: "\(overview?.messages.filter { $0.isRead != true }.count ?? 0)", icon: "envelope.badge")
                FeatureCard(title: "Selected", value: "\(model.selectedMailMessageIDs.count)", icon: "checkmark.circle")
                FeatureCard(title: "Status", value: overview?.health?.status.capitalized ?? "Offline", icon: connectionIcon)
            }

            HStack(spacing: 10) {
                SearchFieldRow(placeholder: "Search mail", text: $searchText)
                    .focused($searchFocused)
                ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                    Task { await model.loadMailOverview() }
                }
                ActionButton(title: "Compose", icon: "square.and.pencil") {
                    model.mailComposerExpanded.toggle()
                }
                Button {
                    model.mailAutoRefreshEnabled.toggle()
                } label: {
                    Label(model.mailAutoRefreshEnabled ? "Live" : "Paused", systemImage: model.mailAutoRefreshEnabled ? "arrow.triangle.2.circlepath" : "pause.circle")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(model.mailAutoRefreshEnabled ? theme.green : theme.textSecondary)
                        .padding(.horizontal, 12)
                        .frame(height: 38)
                        .background(theme.cardRaised)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                ActionButton(title: "Setup", icon: "gearshape") {
                    showAccountSetup.toggle()
                }
            }

            if showAccountSetup {
                accountSetupPanel
            }
        }
    }

    @ViewBuilder
    private var mailSyncBanner: some View {
        if let last = model.mailLastSuccessAt {
            let age = now.timeIntervalSince(last)
            if age > 300 || !model.mailBackgroundIssue.isEmpty {
                NativeGroupPanel(title: "Mail sync", subtitle: model.mailAutoRefreshEnabled ? "Background refresh" : "Paused") {
                    HStack(spacing: 10) {
                        Image(systemName: model.mailBackgroundIssue.isEmpty ? "clock.badge.exclamationmark" : "exclamationmark.triangle")
                            .foregroundStyle(model.mailBackgroundIssue.isEmpty ? theme.accent : theme.danger)
                        Text(model.mailBackgroundIssue.isEmpty ? "Last refreshed \(relativeAge(age)) ago." : "Background sync issue: \(model.mailBackgroundIssue)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(theme.textSecondary)
                        Spacer()
                        ActionButton(title: "Refresh now", icon: "arrow.clockwise") {
                            Task { await model.loadMailOverview() }
                        }
                    }
                }
            }
        }
    }

    private func relativeAge(_ seconds: TimeInterval) -> String {
        if seconds < 60 { return "\(max(0, Int(seconds)))s" }
        if seconds < 3600 { return "\(Int(seconds / 60))m" }
        return "\(Int(seconds / 3600))h"
    }

    private var connectionIcon: String {
        switch overview?.health?.status.lowercased() {
        case "healthy": return "checkmark.icloud"
        case "warning": return "exclamationmark.icloud"
        case "error": return "xmark.icloud"
        default: return "icloud.slash"
        }
    }

    private var accountSetupPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                CompactInfoCard(title: "Account", lines: [overview?.mailboxAddress ?? (model.selectedMailAccountUser.isEmpty ? "No mailbox selected" : model.selectedMailAccountUser)])
                CompactInfoCard(title: "IMAP", lines: [mailServerLine(kind: "imap")])
                CompactInfoCard(title: "SMTP", lines: [mailServerLine(kind: "smtp")])
            }
            if let health = overview?.health {
                HStack(spacing: 10) {
                    CompactInfoCard(title: "Connection", lines: [health.status.capitalized, health.checkedAt.map { formatDateText($0, fallback: $0) } ?? "Not checked"])
                    CompactInfoCard(title: "Queue", lines: ["\(health.queueDepth ?? 0) pending", health.smtpBannerLatencyMs.map { "SMTP \($0) ms" } ?? "SMTP latency unknown"])
                }
                if let checks = health.checks, !checks.isEmpty {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 10)], spacing: 10) {
                        ForEach(checks) { check in
                            CompactInfoCard(title: check.label ?? check.id, lines: [check.status?.capitalized ?? "Unknown", check.detail ?? "No detail"])
                        }
                    }
                }
            }
            Text("External mailbox connection is currently server-managed. Add/rotate accounts through Hanasand user provisioning; this client switches any mailbox exposed by the API.")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(theme.textTertiary)
        }
    }

    private func mailServerLine(kind: String) -> String {
        guard let settings = overview?.settings else { return "Not configured" }
        if kind == "imap" {
            return "\(settings.imapHost ?? settings.host ?? "imap"):\(settings.imapPort ?? 0)"
        }
        return "\(settings.smtpHost ?? settings.host ?? "smtp"):\(settings.smtpPort ?? 0)"
    }

    private func mailboxSidebar(_ overview: MailOverviewEnvelope) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            NativeGroupPanel(title: "Mailboxes", subtitle: overview.mailboxAddress ?? overview.mailboxUser ?? "Account") {
                LazyVStack(alignment: .leading, spacing: 7) {
                    ForEach(overview.mailboxes) { mailbox in
                        mailboxButton(mailbox, selected: mailbox.id == model.selectedMailboxID || mailbox.id == overview.selectedMailboxId)
                    }
                }
            }

            if let accounts = overview.accessibleAccounts, !accounts.isEmpty {
                NativeGroupPanel(title: "Accounts", subtitle: "Switch mailbox") {
                    LazyVStack(alignment: .leading, spacing: 7) {
                        ForEach(accounts.prefix(10)) { account in
                            accountButton(account, currentUser: overview.mailboxUser)
                        }
                    }
                }
            }

            mailboxTools(overview)
            filtersPanel(overview)
        }
    }

    private func mailboxButton(_ mailbox: MailOverviewEnvelope.Mailbox, selected: Bool) -> some View {
        Button {
            Task { await model.selectMailbox(mailbox) }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: mailboxIcon(mailbox))
                    .frame(width: 18)
                    .foregroundStyle(selected ? theme.accent : theme.textTertiary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(mailbox.displayName)
                        .font(.system(size: 12, weight: .black))
                        .foregroundStyle(theme.text)
                        .lineLimit(1)
                    Text(mailbox.countLabel)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                }
                Spacer()
                if let unread = mailbox.unreadEmails, unread > 0 {
                    Text("\(unread)")
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(theme.background)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(theme.accent)
                        .clipShape(Capsule())
                }
            }
            .padding(10)
            .background(selected ? theme.accentSoft : theme.cardRaised)
            .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button("Move selected here") {
                Task { await model.moveSelectedMail(to: mailbox) }
            }
            Button("Refresh") {
                Task { await model.selectMailbox(mailbox) }
            }
        }
    }

    private func mailboxIcon(_ mailbox: MailOverviewEnvelope.Mailbox) -> String {
        switch mailbox.role?.lowercased() {
        case "inbox": return "tray.full"
        case "archive": return "archivebox"
        case "trash": return "trash"
        case "junk": return "exclamationmark.octagon"
        case "sent": return "paperplane"
        case "drafts": return "doc.text"
        default: return mailbox.parentId == nil ? "folder" : "folder.fill"
        }
    }

    private func accountButton(_ account: MailOverviewEnvelope.Account, currentUser: String?) -> some View {
        let isActive = account.id == currentUser || account.id == model.selectedMailAccountUser
        return Button {
            Task { await model.selectMailAccount(account) }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: isActive ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isActive ? theme.accent : theme.textTertiary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(account.name ?? account.id)
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(theme.text)
                        .lineLimit(1)
                    Text(account.address)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                        .lineLimit(1)
                }
                Spacer()
            }
            .padding(9)
            .background(isActive ? theme.accentSoft : theme.cardRaised)
            .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func threadedMessageList(_ overview: MailOverviewEnvelope) -> some View {
        NativeGroupPanel(title: "Messages", subtitle: "\(filteredMessages.count) visible · \(threadCount) threads") {
            HStack(spacing: 8) {
                ActionButton(title: "All", icon: "checkmark.circle") {
                    model.selectAllVisibleMailMessages(filteredMessages)
                }
                ActionButton(title: "Clear", icon: "xmark.circle") {
                    model.clearMailSelection()
                }
                ActionButton(title: "Archive", icon: "archivebox") {
                    Task { await model.runBulkMailAction("archive") }
                }
                ActionButton(title: "Read", icon: "envelope.open") {
                    Task { await model.runBulkMailAction("read") }
                }
                ActionButton(title: "Unread", icon: "envelope.badge") {
                    Task { await model.runBulkMailAction("unread") }
                }
                ActionButton(title: "Trash", icon: "trash", tone: .danger) {
                    Task { await model.runBulkMailAction("trash") }
                }
            }

            if filteredMessages.isEmpty {
                NativeEmptyState(title: "No matching mail", message: "Try another mailbox or search term.")
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 7) {
                            ForEach(filteredMessages.prefix(120)) { message in
                                messageRow(message)
                                    .id(message.id)
                            }
                        }
                    }
                    .frame(minHeight: 470)
                    .onChange(of: model.selectedMailMessageID) { _, id in
                        withAnimation(.easeInOut(duration: 0.18)) {
                            proxy.scrollTo(id, anchor: .center)
                        }
                    }
                }
            }
        }
    }

    private var threadCount: Int {
        Set(filteredMessages.map { $0.threadId ?? $0.id }).count
    }

    private func messageRow(_ message: MailOverviewEnvelope.Message) -> some View {
        let isSelected = message.id == selectedMessage?.id
        let isChecked = model.selectedMailMessageIDs.contains(message.id)
        return Button {
            Task { await model.selectMailMessage(message) }
        } label: {
            HStack(alignment: .top, spacing: 9) {
                Button {
                    model.toggleMailSelection(message)
                } label: {
                    Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(isChecked ? theme.accent : theme.textTertiary)
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 7) {
                        Circle()
                            .fill(message.isRead == true ? theme.textTertiary.opacity(0.35) : theme.accent)
                            .frame(width: 7, height: 7)
                        Text(message.fromLabel)
                            .font(.system(size: 12, weight: .black))
                            .foregroundStyle(theme.text)
                            .lineLimit(1)
                        if message.hasAttachment == true || !(message.attachments ?? []).isEmpty {
                            Image(systemName: "paperclip")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(theme.textTertiary)
                        }
                        if message.isFlagged == true {
                            Image(systemName: "flag.fill")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(theme.accent)
                        }
                        Spacer()
                        Text(message.dateLabel)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(theme.textTertiary)
                    }
                    Text(message.subjectLabel)
                        .font(.system(size: 13, weight: message.isRead == true ? .semibold : .black))
                        .foregroundStyle(theme.text)
                        .lineLimit(1)
                    Text(message.preview ?? "")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                        .lineLimit(2)
                }
            }
            .padding(11)
            .background(isSelected ? theme.accentSoft : (isChecked ? theme.card.opacity(0.95) : theme.cardRaised))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(isSelected ? theme.accent.opacity(0.55) : Color.clear, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(message.isRead == true ? "Mark unread" : "Mark read") {
                Task { await model.runMailAction(message.isRead == true ? "unread" : "read", message: message) }
            }
            Button(message.isFlagged == true ? "Unflag" : "Flag") {
                Task { await model.runMailAction(message.isFlagged == true ? "unflag" : "flag", message: message) }
            }
            Button("Archive") {
                Task { await model.runMailAction("archive", message: message) }
            }
            Button(message.isJunk == true ? "Not spam" : "Spam") {
                Task { await model.runMailAction(message.isJunk == true ? "ham" : "junk", message: message) }
            }
            if message.isDeleted == true {
                Button("Restore") {
                    Task { await model.runMailAction("restore", message: message) }
                }
            }
            Button("Move to trash") {
                Task { await model.runMailAction("trash", message: message) }
            }
        }
    }

    private func messageReader(_ overview: MailOverviewEnvelope) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if let message = selectedMessage {
                NativeGroupPanel(title: message.subjectLabel, subtitle: message.fromLabel) {
                    HStack(spacing: 8) {
                        ActionButton(title: message.isRead == true ? "Unread" : "Read", icon: message.isRead == true ? "envelope.badge" : "envelope.open") {
                            Task { await model.runMailAction(message.isRead == true ? "unread" : "read", message: message) }
                        }
                        ActionButton(title: message.isFlagged == true ? "Unflag" : "Flag", icon: "flag") {
                            Task { await model.runMailAction(message.isFlagged == true ? "unflag" : "flag", message: message) }
                        }
                        ActionButton(title: "Reply", icon: "arrowshape.turn.up.left") {
                            model.composeReplyToSelectedMail()
                        }
                        ActionButton(title: "Reply all", icon: "arrowshape.turn.up.left.2") {
                            model.composeReplyAllToSelectedMail()
                        }
                        ActionButton(title: "Forward", icon: "arrowshape.turn.up.right") {
                            model.composeForwardSelectedMail()
                        }
                        Menu {
                            ForEach(overview.mailboxes) { mailbox in
                                Button(mailbox.displayName) {
                                    Task { await model.runMailAction("move", message: message, targetMailboxId: mailbox.id, targetMailboxName: mailbox.displayName) }
                                }
                            }
                        } label: {
                            Label("Move", systemImage: "folder")
                        }
                        .buttonStyle(.borderless)
                        ActionButton(title: "Archive", icon: "archivebox") {
                            Task { await model.runMailAction("archive", message: message) }
                        }
                        ActionButton(title: message.isJunk == true ? "Not spam" : "Spam", icon: message.isJunk == true ? "checkmark.shield" : "exclamationmark.octagon") {
                            Task { await model.runMailAction(message.isJunk == true ? "ham" : "junk", message: message) }
                        }
                        if message.isDeleted == true {
                            ActionButton(title: "Restore", icon: "arrow.uturn.backward") {
                                Task { await model.runMailAction("restore", message: message) }
                            }
                        }
                        ActionButton(title: "Trash", icon: "trash", tone: .danger) {
                            Task { await model.runMailAction("trash", message: message) }
                        }
                    }

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 10)], spacing: 10) {
                        CompactInfoCard(title: "To", lines: message.to.isEmpty ? ["No recipient listed"] : message.to.map(\.displayName))
                        if let cc = message.cc, !cc.isEmpty {
                            CompactInfoCard(title: "Cc", lines: cc.map(\.displayName))
                        }
                        CompactInfoCard(title: "Date", lines: [message.dateLabel])
                        CompactInfoCard(title: "Thread", lines: [message.threadId ?? message.id])
                    }

                    if message.hasHTMLBody {
                        MailHTMLBodyView(html: message.renderedHTML(mailboxUser: overview.mailboxUser, apiBaseURL: model.settings.apiBaseURL.normalizedBaseURL))
                            .frame(minHeight: 380)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    } else {
                        ScrollView {
                            Text(message.bodyText.isEmpty ? "No plain text body returned." : message.bodyText)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(theme.textSecondary)
                                .textSelection(.enabled)
                                .lineSpacing(4)
                                .frame(maxWidth: .infinity, alignment: .topLeading)
                                .padding(14)
                        }
                        .frame(minHeight: 315)
                        .background(theme.backgroundElevated.opacity(0.72))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }

                    if let attachments = message.attachments, !attachments.isEmpty {
                        attachmentPanel(attachments, message: message)
                    }
                }
            } else {
                NativeGroupPanel(title: "No message selected", subtitle: "Select a message from the list") {
                    NativeEmptyState(title: "Mail ready", message: "Pick a message, use arrow keys to navigate, or press Command-Shift-N to compose.")
                }
            }
        }
    }

    private func attachmentPanel(_ attachments: [MailOverviewEnvelope.Attachment], message: MailOverviewEnvelope.Message) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Attachments")
                .font(.system(size: 12, weight: .black))
                .foregroundStyle(theme.textTertiary)
                .textCase(.uppercase)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), spacing: 8)], spacing: 8) {
                ForEach(attachments) { attachment in
                    Button {
                        Task { await model.downloadMailAttachment(attachment, from: message) }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "paperclip")
                            VStack(alignment: .leading, spacing: 2) {
                                Text(attachment.name)
                                    .font(.system(size: 12, weight: .bold))
                                    .lineLimit(1)
                                Text("\(attachment.type ?? "file") · \(formatBytes(attachment.size ?? 0))")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(theme.textTertiary)
                            }
                            Spacer()
                        }
                        .foregroundStyle(theme.text)
                        .padding(10)
                        .background(theme.cardRaised)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func composeSheet(_ overview: MailOverviewEnvelope) -> some View {
        NativeGroupPanel(title: "Compose", subtitle: overview.settings?.smtpHost ?? overview.mailboxAddress ?? "SMTP") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 230), spacing: 10)], spacing: 10) {
                mailField("To", text: $model.mailComposeTo, placeholder: "name@example.com")
                mailField("Cc", text: $model.mailComposeCc, placeholder: "optional")
                mailField("Bcc", text: $model.mailComposeBcc, placeholder: "optional")
                mailField("Reply-To", text: $model.mailComposeReplyTo, placeholder: "optional")
            }
            mailField("Subject", text: $model.mailComposeSubject, placeholder: "Subject")
            if let recipients = overview.recentRecipients, !recipients.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(recipients.prefix(12)) { recipient in
                            Button {
                                model.addRecentRecipientToCompose(recipient)
                            } label: {
                                Label(recipient.displayName, systemImage: "person.crop.circle.badge.plus")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(theme.textSecondary)
                                    .padding(.horizontal, 10)
                                    .frame(height: 30)
                                    .background(theme.cardRaised)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            TextField("Message", text: $model.mailComposeBody, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(theme.text)
                .lineLimit(6...12)
                .padding(11)
                .background(theme.field)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            if !model.mailDraftAttachments.isEmpty {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 8)], spacing: 8) {
                    ForEach(model.mailDraftAttachments) { attachment in
                        HStack(spacing: 8) {
                            Image(systemName: "paperclip")
                            VStack(alignment: .leading, spacing: 2) {
                                Text(attachment.name)
                                    .font(.system(size: 12, weight: .bold))
                                    .lineLimit(1)
                                Text("\(attachment.type) · \(formatBytes(attachment.size))")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(theme.textTertiary)
                            }
                            Spacer()
                            Button("Remove") { model.removeMailAttachment(attachment) }
                                .buttonStyle(.plain)
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(theme.danger)
                        }
                        .padding(10)
                        .background(theme.cardRaised)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
            }

            HStack(spacing: 10) {
                ActionButton(title: "Attach", icon: "paperclip") {
                    model.addMailAttachment()
                }
                ActionButton(title: "Send", icon: "paperplane.fill") {
                    Task { await model.sendComposedMail() }
                }
                ActionButton(title: "Discard", icon: "xmark.circle", tone: .danger) {
                    model.mailComposerExpanded = false
                    model.mailDraftAttachments = []
                }
                Spacer()
                Text(overview.settings.map { "\($0.smtpHost ?? "SMTP"):\($0.smtpPort ?? 0)" } ?? "Ready")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
            }
        }
    }

    private func mailField(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 11, weight: .black))
                .foregroundStyle(theme.textTertiary)
            TextField(placeholder, text: text)
                .textFieldStyle(.plain)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(theme.text)
                .padding(11)
                .background(theme.field)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private func mailboxTools(_ overview: MailOverviewEnvelope) -> some View {
        NativeGroupPanel(title: "Folders", subtitle: "Create and move quickly") {
            HStack(spacing: 8) {
                TextField("New mailbox", text: $model.mailNewMailboxName)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.text)
                    .padding(10)
                    .background(theme.field)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                ActionButton(title: "Create", icon: "folder.badge.plus") {
                    Task { await model.createMailMailbox() }
                }
            }
            Menu {
                ForEach(overview.mailboxes) { mailbox in
                    Button(mailbox.displayName) {
                        Task { await model.moveSelectedMail(to: mailbox) }
                    }
                }
            } label: {
                Label("Move selected", systemImage: "folder")
            }
            .disabled(model.selectedMailMessageIDs.isEmpty)
        }
    }

    private func filtersPanel(_ overview: MailOverviewEnvelope) -> some View {
        NativeGroupPanel(title: "Rules", subtitle: "\(overview.filters?.count ?? 0) filters") {
            VStack(alignment: .leading, spacing: 8) {
                TextField("Rule name", text: $model.mailFilterName)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.text)
                    .padding(10)
                    .background(theme.field)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                TextField("Sender contains", text: $model.mailFilterContains)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.text)
                    .padding(10)
                    .background(theme.field)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                TextField("Move to mailbox", text: $model.mailFilterTargetMailbox)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.text)
                    .padding(10)
                    .background(theme.field)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                ActionButton(title: "Add rule", icon: "line.3.horizontal.decrease.circle") {
                    Task { await model.createMailFilter() }
                }
            }

            ForEach((overview.filters ?? []).prefix(4)) { filter in
                HStack(spacing: 8) {
                    Image(systemName: filter.enabled == false ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
                        .foregroundStyle(filter.enabled == false ? theme.textTertiary : theme.accent)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(filter.name)
                            .font(.system(size: 11, weight: .black))
                            .foregroundStyle(theme.text)
                        Text(filter.ruleLabel)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(theme.textTertiary)
                            .lineLimit(2)
                    }
                    Spacer()
                    Button("Delete") {
                        Task { await model.deleteMailFilter(filter) }
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(theme.danger)
                }
                .padding(9)
                .background(theme.cardRaised)
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
            }
        }
    }

    private var filteredMessages: [MailOverviewEnvelope.Message] {
        guard let messages = overview?.messages else { return [] }
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return messages }
        return messages.filter { message in
            [
                message.subjectLabel,
                message.fromLabel,
                message.preview ?? "",
                message.bodyText,
            ].joined(separator: " ").lowercased().contains(query)
        }
    }
}

struct MailHTMLBodyView: NSViewRepresentable {
    let html: String

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.setValue(false, forKey: "drawsBackground")
        view.loadHTMLString(html, baseURL: nil)
        return view
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        nsView.loadHTMLString(html, baseURL: nil)
    }
}

struct RateLimitsNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var searchText = ""
    @State private var deletingApiKey: DashboardApiKeySummary?

    private let columns = [
        GridItem(.adaptive(minimum: 260), spacing: 12, alignment: .top),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                FeatureCard(title: "Runtime", value: overview?.settings.enabled == true ? "Enabled" : "Paused", icon: "gauge.with.needle")
                FeatureCard(title: "Routes", value: "\(overview?.routes.count ?? 0)", icon: "point.3.connected.trianglepath.dotted")
                FeatureCard(title: "Overrides", value: "\(overview?.settings.overrides.count ?? 0)", icon: "slider.horizontal.3")
                FeatureCard(title: "API keys", value: "\(model.apiKeys.count)", icon: "key.horizontal")
            }

            HStack(spacing: 10) {
                SearchFieldRow(placeholder: "Search keys, routes, owners, or scopes", text: $searchText)
                ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                    Task { await model.loadNativeDashboardData() }
                }
            }

            if let overview {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                    defaultsPanel(overview)
                    overridesPanel(overview)
                    presetsPanel(overview)
                }

                apiKeysPanel
                issueKeyPanel(overview)
                routesPanel(overview)
            } else {
                NativeGroupPanel(title: "Load rate limits", subtitle: "This native panel reads /rate-limit/settings and /rate-limit/keys.") {
                    HStack(spacing: 10) {
                        ActionButton(title: "Load settings", icon: "gauge.with.needle") {
                            Task { await model.loadNativeDashboardData() }
                        }
                    }
                    NativeEmptyState(title: "Rate limits not loaded", message: "Use Load settings to fetch rate-limit settings and API keys.")
                }
            }
        }
        .task {
            if model.rateLimitOverview == nil {
                await model.loadNativeDashboardData()
            }
        }
        .alert("Delete API key?", isPresented: Binding(
            get: { deletingApiKey != nil },
            set: { if !$0 { deletingApiKey = nil } }
        )) {
            Button("Cancel", role: .cancel) {
                deletingApiKey = nil
            }
            Button("Delete", role: .destructive) {
                if let deletingApiKey {
                    Task { await model.deleteRateLimitApiKey(deletingApiKey) }
                }
                deletingApiKey = nil
            }
        } message: {
            Text(deletingApiKey.map { "\($0.name) will stop working immediately." } ?? "This key will stop working immediately.")
        }
    }

    private var overview: DashboardRateLimitOverview? {
        model.rateLimitOverview
    }

    private func issueKeyPanel(_ overview: DashboardRateLimitOverview) -> some View {
        NativeGroupPanel(title: "Issue API key", subtitle: "Create a scoped token without leaving the Desktop app.") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 10)], alignment: .leading, spacing: 10) {
                nativeTextField("Owner user ID", text: $model.rateLimitKeyOwnerID, placeholder: "Defaults to settings user id")
                nativeTextField("Key name", text: $model.rateLimitKeyName, placeholder: "Desktop automation")
                nativeTextField("Tier", text: $model.rateLimitKeyTier, placeholder: "starter")
                nativeTextField("Scope route", text: $model.rateLimitKeyRoute, placeholder: overview.routes.first.map { "\($0.method) \($0.route)" } ?? "GET /api/")
            }

            HStack(spacing: 10) {
                ActionButton(title: "Issue key", icon: "key.horizontal") {
                    Task { await model.issueRateLimitApiKey() }
                }
                if let secret = model.rateLimitIssuedSecret, !secret.isEmpty {
                    ActionButton(title: "Copy secret", icon: "doc.on.doc") {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(secret, forType: .string)
                    }
                    Text("Secret is shown once.")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                }
            }

            if let secret = model.rateLimitIssuedSecret, !secret.isEmpty {
                Text(secret)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
                    .padding(10)
                    .background(theme.field)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
    }

    private func nativeTextField(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 10, weight: .black))
                .foregroundStyle(theme.textTertiary)
                .textCase(.uppercase)
            TextField(placeholder, text: text)
                .textFieldStyle(.plain)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(theme.text)
                .padding(11)
                .background(theme.field)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private func defaultsPanel(_ overview: DashboardRateLimitOverview) -> some View {
        NativeGroupPanel(title: "Defaults", subtitle: overview.settings.updatedBy ?? "Global policy") {
            HStack(spacing: 10) {
                ActionButton(title: overview.settings.enabled ? "Pause enforcement" : "Enable enforcement", icon: overview.settings.enabled ? "pause.circle" : "play.circle") {
                    Task { await model.setRateLimitEnforcement(enabled: !overview.settings.enabled) }
                }
                Text(overview.settings.enabled ? "Requests are currently being limited." : "Limits are configured but enforcement is paused.")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
            }

            LazyVStack(alignment: .leading, spacing: 8) {
                ForEach(overview.settings.defaults.keys.sorted(), id: \.self) { key in
                    if let rule = overview.settings.defaults[key] {
                        defaultLimitRow(scope: key, rule: rule, active: overview.settings.enabled)
                    }
                }
            }

            if let updatedAt = overview.settings.updatedAt {
                Text("Updated \(formatDateText(updatedAt, fallback: updatedAt))")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
            }
        }
    }

    private func defaultLimitRow(scope: String, rule: DashboardRateLimitRule, active: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: scope == "anonymous" ? "person.crop.circle.badge.questionmark" : "person.badge.key")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(active ? theme.accent : theme.textTertiary)
                .frame(width: 30, height: 30)
                .background(active ? theme.accentSoft : theme.cardRaised)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(scope.capitalized)
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
                Text(rule.summary)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(2)
            }

            Spacer()

            HStack(spacing: 6) {
                ActionButton(title: "Half", icon: "minus.circle") {
                    Task { await model.setRateLimitDefault(scope: scope, maxRequests: max(rule.maxRequests / 2, 1)) }
                }
                ActionButton(title: "Double", icon: "plus.circle") {
                    Task { await model.setRateLimitDefault(scope: scope, maxRequests: min(rule.maxRequests * 2, 1_000_000)) }
                }
            }
        }
        .padding(10)
        .background(theme.cardRaised)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func overridesPanel(_ overview: DashboardRateLimitOverview) -> some View {
        NativeGroupPanel(title: "Overrides", subtitle: "\(overview.settings.overrides.count) route rules") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), spacing: 10)], alignment: .leading, spacing: 10) {
                nativeTextField("Route", text: $model.rateLimitOverrideRoute, placeholder: overview.routes.first.map { "\($0.method) \($0.route)" } ?? "GET /api/")
                nativeTextField("Scope", text: $model.rateLimitOverrideScope, placeholder: "anonymous")
                nativeTextField("Window ms", text: $model.rateLimitOverrideWindowMs, placeholder: "60000")
                nativeTextField("Requests", text: $model.rateLimitOverrideMaxRequests, placeholder: "60")
            }

            HStack(spacing: 10) {
                ActionButton(title: "Add override", icon: "plus.circle") {
                    Task { await model.addRateLimitOverride() }
                }
                Text("Scopes: anonymous, authenticated, internal.")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
            }

            if overview.settings.overrides.isEmpty {
                Text("No route overrides are configured.")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
            } else {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(overview.settings.overrides.prefix(12)) { override in
                        overrideRow(override)
                    }
                }
            }
        }
    }

    private func overrideRow(_ override: DashboardRateLimitOverride) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: override.enabled ? "checkmark.shield" : "pause.circle")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(override.enabled ? theme.accent : theme.textTertiary)
                .frame(width: 30, height: 30)
                .background(override.enabled ? theme.accentSoft : theme.cardRaised)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text("\(override.method) \(override.route)")
                    .font(.system(size: 12, weight: .black, design: .monospaced))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
                Text("\(override.scope) · \(override.maxRequests) / \(formatMilliseconds(Double(override.windowMs)))")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(2)
            }

            Spacer()

            HStack(spacing: 6) {
                ActionButton(title: override.enabled ? "Disable" : "Enable", icon: override.enabled ? "pause.circle" : "play.circle") {
                    Task { await model.setRateLimitOverride(override, enabled: !override.enabled) }
                }
                ActionButton(title: "Remove", icon: "trash", tone: .danger) {
                    Task { await model.setRateLimitOverride(override, remove: true) }
                }
            }
        }
        .padding(10)
        .background(theme.cardRaised)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func presetsPanel(_ overview: DashboardRateLimitOverview) -> some View {
        NativeGroupPanel(title: "Tier presets", subtitle: "\(overview.tierPresets?.count ?? 0) templates") {
            let presets = overview.tierPresets ?? []
            if presets.isEmpty {
                Text("No API-key tiers returned by the server.")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
            } else {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(presets) { preset in
                        rateRow(
                            icon: "rectangle.stack.badge.person.crop",
                            title: preset.label,
                            subtitle: "\(preset.defaultLimits.summary.isEmpty ? "No limits" : preset.defaultLimits.summary) · \(preset.description)",
                            active: true
                        )
                    }
                }
            }
        }
    }

    private var apiKeysPanel: some View {
        NativeGroupPanel(title: "API keys", subtitle: "\(filteredKeys.count) visible") {
            if model.apiKeys.isEmpty {
                Text("No API keys returned by the server.")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
            } else if filteredKeys.isEmpty {
                Text("No API keys match the active search.")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
            } else {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
                    ForEach(filteredKeys) { key in
                        apiKeyCard(key)
                    }
                }
            }
        }
    }

    private func routesPanel(_ overview: DashboardRateLimitOverview) -> some View {
        NativeGroupPanel(title: "Protected routes", subtitle: "\(filteredRoutes(overview).count) visible") {
            let routes = filteredRoutes(overview)
            if routes.isEmpty {
                Text("No routes match the current search.")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 8)], alignment: .leading, spacing: 8) {
                    ForEach(routes.prefix(80)) { route in
                        HStack(spacing: 8) {
                            Text(route.method)
                                .font(.system(size: 10, weight: .black, design: .monospaced))
                                .foregroundStyle(theme.accent)
                                .frame(width: 48, alignment: .leading)
                            Text(route.route)
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .foregroundStyle(theme.textSecondary)
                                .lineLimit(1)
                            Spacer()
                        }
                        .padding(9)
                        .background(theme.cardRaised)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
            }
        }
    }

    private func apiKeyCard(_ key: DashboardApiKeySummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: key.enabled ? "key.horizontal.fill" : "key.slash")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(key.enabled ? theme.accent : theme.textTertiary)
                    .frame(width: 34, height: 34)
                    .background(key.enabled ? theme.accentSoft : theme.cardRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(key.name)
                        .font(.system(size: 13, weight: .black))
                        .foregroundStyle(theme.text)
                        .lineLimit(1)
                    Text("\(key.ownerId) · \(key.tier) · \(key.keyPrefix)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                        .lineLimit(1)
                }
                Spacer()
                Text(key.statusLabel)
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(key.enabled ? theme.green : theme.textTertiary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(key.enabled ? theme.green.opacity(0.12) : theme.cardRaised)
                    .clipShape(Capsule())
            }

            if let description = key.description, !description.isEmpty {
                Text(description)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(2)
            }

            HStack(spacing: 8) {
                MiniMetricCard(label: "Created", value: key.createdLabel)
                MiniMetricCard(label: "Last used", value: key.lastUsedLabel)
                MiniMetricCard(label: "Scopes", value: "\(key.scopes.count)")
            }

            if !key.scopes.isEmpty {
                LazyVStack(alignment: .leading, spacing: 6) {
                    ForEach(key.scopes.prefix(5)) { scope in
                        Text("\(scope.enabled ? "On" : "Off") · \(scope.method) \(scope.route) · \(scope.limits.summary.isEmpty ? "No limits" : scope.limits.summary)")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundStyle(scope.enabled ? theme.textSecondary : theme.textTertiary)
                            .lineLimit(1)
                    }
                }
            }

            HStack(spacing: 8) {
                ActionButton(title: key.enabled ? "Disable" : "Enable", icon: key.enabled ? "pause.circle" : "play.circle") {
                    Task { await model.setRateLimitApiKey(key, enabled: !key.enabled) }
                }
                ActionButton(title: "Delete", icon: "trash") {
                    deletingApiKey = key
                }
            }
        }
        .padding(13)
        .background(theme.cardRaised)
        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
    }

    private func rateRow(icon: String, title: String, subtitle: String, active: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(active ? theme.accent : theme.textTertiary)
                .frame(width: 30, height: 30)
                .background(active ? theme.accentSoft : theme.cardRaised)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(2)
            }
            Spacer()
        }
        .padding(10)
        .background(theme.cardRaised)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var filteredKeys: [DashboardApiKeySummary] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return model.apiKeys }
        return model.apiKeys.filter { key in
            let scopeText = key.scopes.map { "\($0.method) \($0.route) \($0.limits.summary)" }.joined(separator: " ")
            return [
                key.id,
                key.ownerId,
                key.name,
                key.tier,
                key.keyPrefix,
                key.description ?? "",
                scopeText,
            ].joined(separator: " ").lowercased().contains(query)
        }
    }

    private func filteredRoutes(_ overview: DashboardRateLimitOverview) -> [DashboardRateLimitRoute] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return overview.routes }
        return overview.routes.filter { "\($0.method) \($0.route)".lowercased().contains(query) }
    }
}

struct RecentTestsNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var searchText = ""
    @State private var selectedStatus = "all"

    private let columns = [
        GridItem(.adaptive(minimum: 280), spacing: 12, alignment: .top),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                FeatureCard(title: "Tests", value: "\(model.recentTests.count)", icon: "speedometer")
                FeatureCard(title: "Done", value: "\(model.recentTests.filter { $0.statusLabel.lowercased() == "done" }.count)", icon: "checkmark.circle")
                FeatureCard(title: "Running", value: "\(model.recentTests.filter { $0.statusLabel.lowercased() == "running" }.count)", icon: "waveform.path.ecg")
                FeatureCard(title: "Visits", value: "\(model.recentTests.reduce(0) { $0 + ($1.visits ?? 0) })", icon: "eye")
            }

            HStack(spacing: 10) {
                SearchFieldRow(placeholder: "Search tests by URL, id, or status", text: $searchText)
                ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                    Task { await model.loadNativeDashboardData() }
                }
            }

            NativeGroupPanel(title: "Start a load test", subtitle: "Create and run a check without opening the website.") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 10)], alignment: .leading, spacing: 10) {
                    testField("Target URL", text: $model.testDraftURL, placeholder: "https://example.com")
                    testField("Timeout seconds", text: $model.testDraftTimeout, placeholder: "30")
                    testField("Stages", text: $model.testDraftStages, placeholder: "30s:5, 1m:15")
                }
                HStack(spacing: 10) {
                    ActionButton(title: "Create and run", icon: "play.circle") {
                        Task { await model.createNativeLoadTest() }
                    }
                    Text("Stages use duration:target pairs.")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                }
            }

            if let detail = model.selectedTestDetail {
                selectedTestPanel(detail)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(statuses, id: \.self) { status in
                        FilterChip(title: status.capitalized, active: selectedStatus == status) {
                            selectedStatus = status
                        }
                    }
                }
            }

            if model.recentTests.isEmpty {
                NativeEmptyState(title: "No recent tests loaded", message: "Use Refresh to load load-test runs.")
            } else if filteredTests.isEmpty {
                NativeGroupPanel(title: "No matching tests", subtitle: "Adjust status or search filters.") {
                    Text("Recent tests are loaded, but none match the active filters.")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                }
            } else {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                    ForEach(filteredTests) { test in
                        testCard(test)
                    }
                }
            }
        }
    }

    private func testField(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 10, weight: .black))
                .foregroundStyle(theme.textTertiary)
                .textCase(.uppercase)
            TextField(placeholder, text: text)
                .textFieldStyle(.plain)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(theme.text)
                .padding(11)
                .background(theme.field)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private func selectedTestPanel(_ test: DashboardRecentTest) -> some View {
        NativeGroupPanel(title: "Selected test", subtitle: "Test \(test.id)") {
            HStack(spacing: 10) {
                FeatureCard(title: "Status", value: test.statusLabel.capitalized, icon: "waveform.path.ecg")
                FeatureCard(title: "Timeout", value: test.timeout.map { "\($0)s" } ?? "Default", icon: "timer")
                FeatureCard(title: "Finished", value: test.finishedLabel, icon: "checkmark.seal")
            }

            Text(test.displayURL)
                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                .foregroundStyle(theme.textSecondary)
                .lineLimit(2)

            HStack(spacing: 8) {
                ActionButton(title: "Refresh detail", icon: "arrow.clockwise") {
                    Task { await model.loadLoadTestDetail(test) }
                }
                ActionButton(title: "Rerun", icon: "play.fill") {
                    Task { await model.rerunLoadTest(test) }
                }
                ActionButton(title: "Copy link", icon: "doc.on.doc") {
                    model.copyLoadTestLink(test)
                }
                ActionButton(title: "Open", icon: "arrow.up.right") {
                    model.openWebsite(path: "/test/\(test.id)", label: "Test \(test.id)")
                }
            }

            if let summary = test.activeSummary {
                Text(summary.pretty)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(8)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(theme.backgroundElevated.opacity(0.72))
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
            }
        }
    }

    private var statuses: [String] {
        ["all"] + Array(Set(model.recentTests.map { $0.statusLabel.lowercased() })).sorted()
    }

    private var filteredTests: [DashboardRecentTest] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return model.recentTests.filter { test in
            let statusMatch = selectedStatus == "all" || test.statusLabel.lowercased() == selectedStatus
            let searchable = [
                test.id,
                test.displayURL,
                test.statusLabel,
            ].joined(separator: " ").lowercased()
            return statusMatch && (query.isEmpty || searchable.contains(query))
        }
    }

    private func testCard(_ test: DashboardRecentTest) -> some View {
        NativeGroupPanel(title: test.displayURL, subtitle: "Test \(test.id)") {
            HStack(spacing: 10) {
                FeatureCard(title: "Status", value: test.statusLabel.capitalized, icon: test.statusLabel.lowercased() == "done" ? "checkmark.circle" : "waveform.path.ecg")
                FeatureCard(title: "p95", value: test.p95Milliseconds.map { "\(Int($0.rounded())) ms" } ?? "Unknown", icon: "timer")
                FeatureCard(title: "Requests", value: test.requestCount.map(String.init) ?? "0", icon: "arrow.left.arrow.right")
            }

            HStack(spacing: 8) {
                if let failureRate = test.failureRatePercent {
                    Text("fail \(String(format: "%.1f", failureRate))%")
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(failureRate > 1 ? theme.danger : theme.green)
                        .padding(.horizontal, 9)
                        .frame(height: 24)
                        .background(theme.cardRaised)
                        .clipShape(Capsule())
                }
                if let delta = test.p95DeltaLabel {
                    Text(delta)
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle((test.p95DeltaMs ?? 0) >= 0 ? theme.green : theme.danger)
                        .padding(.horizontal, 9)
                        .frame(height: 24)
                        .background(theme.cardRaised)
                        .clipShape(Capsule())
                }
                Text("\(test.visits ?? 0) visits")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(theme.textSecondary)
                    .padding(.horizontal, 9)
                    .frame(height: 24)
                    .background(theme.cardRaised)
                    .clipShape(Capsule())
                Spacer()
            }

            HStack(spacing: 8) {
                Image(systemName: "calendar")
                Text(test.createdLabel)
                Spacer()
                ActionButton(title: "Details", icon: "doc.text.magnifyingglass") {
                    Task { await model.loadLoadTestDetail(test) }
                }
                ActionButton(title: "Rerun", icon: "play.fill") {
                    Task { await model.rerunLoadTest(test) }
                }
                ActionButton(title: "Copy", icon: "doc.on.doc") {
                    model.copyLoadTestLink(test)
                }
            }
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(theme.textSecondary)

            if let errors = test.errors, !errors.isEmpty {
                Text(errors.prefix(2).joined(separator: "\n"))
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.danger)
                    .lineLimit(3)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(theme.backgroundElevated.opacity(0.72))
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
            }
        }
    }
}

struct LinksNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                FeatureCard(title: "Route", value: "/g", icon: "link")
                FeatureCard(title: "CDN", value: model.settings.cdnBaseURL, icon: "network")
                FeatureCard(title: "Loaded", value: model.linkLookupResult?.id ?? "None", icon: "doc.text.magnifyingglass")
            }

            NativeGroupPanel(title: "Create shortcut", subtitle: "Create a public hanasand.com/g/:id redirect.") {
                HStack(spacing: 10) {
                    linkField("Shortcut id", text: $model.linkDraftID)
                        .frame(maxWidth: 220)
                    linkField("Destination URL or path", text: $model.linkDraftPath)
                    ActionButton(title: "Create", icon: "plus.circle") {
                        Task { await model.createShortcutLink() }
                    }
                }
            }

            NativeGroupPanel(title: "Lookup and update", subtitle: "Inspect link stats or change the destination.") {
                HStack(spacing: 10) {
                    linkField("Shortcut id", text: $model.linkLookupID)
                        .frame(maxWidth: 220)
                    ActionButton(title: "Lookup", icon: "magnifyingglass") {
                        Task { await model.lookupShortcutLink() }
                    }
                    ActionButton(title: "Update", icon: "square.and.pencil") {
                        Task { await model.updateShortcutLink() }
                    }
                }

                if let link = model.linkLookupResult {
                    linkResultCard(link)
                } else {
                    Text("No shortcut loaded yet.")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                }
            }
        }
    }

    private func linkField(_ placeholder: String, text: Binding<String>) -> some View {
        TextField(placeholder, text: text)
            .textFieldStyle(.plain)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(theme.text)
            .padding(11)
            .background(theme.field)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func linkResultCard(_ link: DashboardShortcutLink) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                FeatureCard(title: "Shortcut", value: "/g/\(link.id)", icon: "link")
                FeatureCard(title: "Visits", value: "\(link.visits ?? 0)", icon: "eye")
                FeatureCard(title: "Created", value: link.timestampLabel, icon: "clock")
            }

            Text(link.path)
                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                .foregroundStyle(theme.textSecondary)
                .textSelection(.enabled)
                .lineLimit(3)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(theme.backgroundElevated.opacity(0.72))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            HStack(spacing: 10) {
                ActionButton(title: "Copy public link", icon: "doc.on.doc") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString("\(model.settings.websiteBaseURL.normalizedBaseURL.appendingPathComponent("g").appendingPathComponent(link.id))", forType: .string)
                }
                ActionButton(title: "Open shortcut", icon: "arrow.up.right") {
                    model.openWebsite(path: "/g/\(link.id)", label: link.id)
                }
                ActionButton(title: "Open destination", icon: "safari") {
                    if let url = URL(string: link.path), url.scheme != nil {
                        NSWorkspace.shared.open(url)
                    }
                }
                Spacer()
            }
        }
    }
}

struct SystemNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var searchText = ""
    @State private var restartCandidate: DashboardDockerContainer?

    private let columns = [
        GridItem(.adaptive(minimum: 250), spacing: 12, alignment: .top),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                FeatureCard(title: "Containers", value: "\(model.dockerContainers.count)", icon: "shippingbox")
                FeatureCard(title: "Running", value: "\(model.dockerContainers.filter(\.isRunning).count)", icon: "play.circle")
                FeatureCard(title: "Stopped", value: "\(model.dockerContainers.filter { !$0.isRunning }.count)", icon: "pause.circle")
            }

            HStack(spacing: 10) {
                SearchFieldRow(placeholder: "Search containers by name, status, or id", text: $searchText)
                ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                    Task { await model.loadNativeDashboardData() }
                }
            }

            if model.dockerContainers.isEmpty {
                NativeEmptyState(title: "No containers loaded", message: "Use Refresh to load Docker metrics from the API. Configure auth in Settings if this stays empty.")
            } else if filteredContainers.isEmpty {
                NativeGroupPanel(title: "No matching containers", subtitle: "Adjust the search field.") {
                    Text("Docker data is loaded, but none of the containers match the active search.")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                }
            } else {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                    ForEach(filteredContainers) { container in
                        dockerContainerCard(container)
                    }
                }
            }
        }
        .confirmationDialog(
            "Restart Docker container?",
            isPresented: Binding(
                get: { restartCandidate != nil },
                set: { if !$0 { restartCandidate = nil } }
            ),
            titleVisibility: .visible
        ) {
            if let container = restartCandidate {
                Button("Restart \(container.displayName)", role: .destructive) {
                    Task { await model.restartDockerContainer(container) }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            if let container = restartCandidate {
                Text("This sends the same restart request as the website for \(container.displayName).")
            }
        }
    }

    private var filteredContainers: [DashboardDockerContainer] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return model.dockerContainers }
        return model.dockerContainers.filter { container in
            [
                container.id,
                container.displayName,
                container.statusLabel,
                container.createdAt ?? "",
            ].joined(separator: " ").lowercased().contains(query)
        }
    }

    private func dockerContainerCard(_ container: DashboardDockerContainer) -> some View {
        NativeGroupPanel(title: container.displayName, subtitle: String(container.id.prefix(18))) {
            HStack(spacing: 10) {
                FeatureCard(title: "Status", value: container.statusLabel, icon: container.isRunning ? "checkmark.circle" : "pause.circle")
                FeatureCard(title: "CPU", value: container.cpuLabel, icon: "cpu")
                FeatureCard(title: "Memory", value: container.memoryLabel, icon: "memorychip")
            }

            HStack(spacing: 8) {
                Image(systemName: "clock")
                Text(container.createdLabel)
                Spacer()
                ActionButton(title: "Restart", icon: "arrow.clockwise") {
                    restartCandidate = container
                }
            }
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(theme.textSecondary)
        }
    }
}

struct VMsNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var searchText = ""
    @State private var selectedStatus = "all"

    private let columns = [
        GridItem(.adaptive(minimum: 280), spacing: 12, alignment: .top),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                FeatureCard(title: "VMs", value: "\(model.virtualMachines.count)", icon: "display.2")
                FeatureCard(title: "Running", value: "\(model.virtualMachines.filter { ($0.status ?? "").lowercased() == "running" }.count)", icon: "play.circle")
                FeatureCard(title: "Stopped", value: "\(model.virtualMachines.filter { ($0.status ?? "").lowercased() == "stopped" }.count)", icon: "pause.circle")
            }

            HStack(spacing: 10) {
                SearchFieldRow(placeholder: "Search VMs by name, owner, IP, status, or tags", text: $searchText)
                ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                    Task { await model.loadNativeDashboardData() }
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(statuses, id: \.self) { status in
                        FilterChip(title: status.capitalized, active: selectedStatus == status) {
                            selectedStatus = status
                        }
                    }
                }
            }

            if model.virtualMachines.isEmpty {
                NativeEmptyState(title: "No VMs loaded", message: "Use Refresh to load VM access data. Configure auth and user id in Settings if this stays empty.")
            } else if filteredVMs.isEmpty {
                NativeGroupPanel(title: "No matching VMs", subtitle: "Adjust status or search filters.") {
                    Text("VM data is loaded, but no machines match the active filters.")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                }
            } else {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                    ForEach(filteredVMs) { vm in
                        vmCard(vm)
                    }
                }
            }
        }
    }

    private var statuses: [String] {
        let values = Set(model.virtualMachines.map { ($0.status ?? "unknown").lowercased() })
        return ["all"] + values.sorted()
    }

    private var filteredVMs: [DashboardVM] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return model.virtualMachines.filter { vm in
            let statusMatch = selectedStatus == "all" || (vm.status ?? "unknown").lowercased() == selectedStatus
            let searchable = [
                vm.name,
                vm.ownerLabel,
                vm.statusLabel,
                vm.description ?? "",
                vm.ipv4 ?? "",
                vm.tags.joined(separator: " "),
            ].joined(separator: " ").lowercased()
            return statusMatch && (query.isEmpty || searchable.contains(query))
        }
    }

    private func vmCard(_ vm: DashboardVM) -> some View {
        NativeGroupPanel(title: vm.name, subtitle: vm.ownerLabel) {
            HStack(spacing: 10) {
                FeatureCard(title: "Status", value: vm.statusLabel, icon: vm.statusLabel.lowercased() == "running" ? "checkmark.circle" : "circle.dashed")
                FeatureCard(title: "CPU", value: vm.cpuLimit ?? "Unknown", icon: "cpu")
                FeatureCard(title: "Memory", value: vm.memoryLimit ?? "Unknown", icon: "memorychip")
            }

            if let description = vm.description, !description.isEmpty {
                Text(description)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(2)
            }

            HStack(spacing: 8) {
                Image(systemName: "calendar")
                Text("Created \(vm.createdLabel)")
                Spacer()
                Image(systemName: "clock.arrow.circlepath")
                Text(vm.lastUsedLabel)
            }
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(theme.textTertiary)

            if !vm.tags.isEmpty {
                HStack(spacing: 8) {
                    ForEach(vm.tags.prefix(4), id: \.self) { tag in
                        Text(tag)
                            .font(.system(size: 11, weight: .black))
                            .foregroundStyle(theme.textSecondary)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 5)
                            .background(theme.cardRaised)
                            .clipShape(Capsule())
                    }
                }
            }

            HStack(spacing: 8) {
                ActionButton(title: "Start", icon: "play.circle") {
                    Task { await model.runVirtualMachineAction(vm, action: "start") }
                }
                ActionButton(title: "Restart", icon: "arrow.clockwise") {
                    Task { await model.runVirtualMachineAction(vm, action: "restart") }
                }
                ActionButton(title: "Stop", icon: "stop.circle", tone: .danger) {
                    Task { await model.runVirtualMachineAction(vm, action: "stop") }
                }
            }
        }
    }
}

struct SharesNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var deletingShare: DashboardShare?

    private let summaryColumns = [
        GridItem(.adaptive(minimum: 190), spacing: 12, alignment: .top),
    ]

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 12) {
                NativeGroupPanel(title: "Create share", subtitle: "Fast native share creation") {
                    TextField("Name", text: $model.shareDraftName)
                        .textFieldStyle(.plain)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(theme.text)
                        .padding(12)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    TextEditor(text: $model.shareDraftContent)
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundStyle(theme.text)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .frame(minHeight: 210)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    HStack {
                        Text(model.shareDraftContent.isEmpty ? "Paste or write content." : "\(model.shareDraftContent.count) chars")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(theme.textTertiary)
                        Spacer()
                        ActionButton(title: "Create", icon: "plus") {
                            Task { await model.createNativeShare() }
                        }
                        .disabled(model.isLoadingNativeDashboard)
                    }
                }

                NativeGroupPanel(title: "Edit selected", subtitle: model.selectedShareID.isEmpty ? "Choose a share from the list." : model.selectedShareID) {
                    TextField("Name", text: $model.shareEditName)
                        .textFieldStyle(.plain)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(theme.text)
                        .padding(12)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    TextField("Path", text: $model.shareEditPath)
                        .textFieldStyle(.plain)
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundStyle(theme.text)
                        .padding(12)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    TextEditor(text: $model.shareEditContent)
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundStyle(theme.text)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .frame(minHeight: 170)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    HStack {
                        Text(model.selectedShareID.isEmpty ? "No share selected." : "\(model.shareEditContent.count) chars")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(theme.textTertiary)
                        Spacer()
                        ActionButton(title: "Save edits", icon: "checkmark") {
                            Task { await model.updateSelectedShare() }
                        }
                        .disabled(model.selectedShareID.isEmpty || model.isLoadingNativeDashboard)
                    }
                }
            }
            .frame(width: 380)

            VStack(alignment: .leading, spacing: 12) {
                LazyVGrid(columns: summaryColumns, alignment: .leading, spacing: 12) {
                    FeatureCard(title: "Shares", value: "\(model.shares.count)", icon: "folder.badge.gearshape")
                    FeatureCard(title: "CDN", value: "Native", icon: "network")
                }

                HStack {
                    Text(model.shares.isEmpty ? "Load or create shares from the CDN-backed workspace." : "Recent shares")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                    Spacer()
                    ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                        Task { await model.loadNativeDashboardData() }
                    }
                }

                if model.shares.isEmpty {
                    NativeEmptyState(title: "No shares loaded", message: "Create a share or refresh the CDN-backed share list.")
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 12)], spacing: 12) {
                        ForEach(model.shares) { share in
                            VStack(alignment: .leading, spacing: 12) {
                                HStack(alignment: .top, spacing: 10) {
                                    Image(systemName: share.locked == true ? "lock.fill" : "doc.text")
                                        .font(.system(size: 15, weight: .bold))
                                        .foregroundStyle(share.locked == true ? theme.danger : theme.accent)
                                        .frame(width: 34, height: 34)
                                        .background(theme.cardRaised)
                                        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                                    VStack(alignment: .leading, spacing: 5) {
                                        Text(share.displayName)
                                            .font(.system(size: 14, weight: .black))
                                            .foregroundStyle(theme.text)
                                            .lineLimit(1)
                                        Text(share.subtitle.isEmpty ? share.id : share.subtitle)
                                            .font(.system(size: 11, weight: .semibold))
                                            .foregroundStyle(theme.textTertiary)
                                            .lineLimit(1)
                                    }
                                    Spacer()
                                }

                                HStack(spacing: 8) {
                                    Label(share.updatedLabel, systemImage: "clock")
                                    if let wordCount = share.wordCount {
                                        Label("\(wordCount) words", systemImage: "text.word.spacing")
                                    }
                                }
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(theme.textSecondary)
                                .lineLimit(1)

                                HStack(spacing: 12) {
                                    Button("Open") {
                                        model.openShare(share)
                                    }
                                    .buttonStyle(.plain)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(theme.accent)

                                    Button("Edit") {
                                        model.loadShareIntoEditor(share)
                                    }
                                    .buttonStyle(.plain)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(theme.textSecondary)

                                    Button(share.locked == true ? "Unlock" : "Lock") {
                                        Task { await model.toggleNativeShareLock(share) }
                                    }
                                    .buttonStyle(.plain)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(share.locked == true ? theme.danger : theme.textSecondary)

                                    Button("Tree") {
                                        Task { await model.loadNativeShareTree(share) }
                                    }
                                    .buttonStyle(.plain)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(theme.textSecondary)

                                    Button("Delete") {
                                        deletingShare = share
                                    }
                                    .buttonStyle(.plain)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(theme.danger)

                                    Spacer()
                                    Text(share.id)
                                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                        .foregroundStyle(theme.textTertiary)
                                        .lineLimit(1)
                                }

                                if let tree = model.shareTrees[share.id], !tree.isEmpty {
                                    Text(treePreview(tree))
                                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                        .foregroundStyle(theme.textTertiary)
                                        .lineLimit(8)
                                        .padding(10)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .background(theme.backgroundElevated.opacity(0.72))
                                        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                                }
                            }
                            .padding(13)
                            .background(theme.card)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(theme.divider, lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }
                }
            }
        }
        .alert("Delete share?", isPresented: Binding(
            get: { deletingShare != nil },
            set: { if !$0 { deletingShare = nil } }
        )) {
            Button("Cancel", role: .cancel) {
                deletingShare = nil
            }
            Button("Delete", role: .destructive) {
                if let deletingShare {
                    Task { await model.deleteNativeShare(deletingShare) }
                }
                deletingShare = nil
            }
        } message: {
            Text(deletingShare?.displayName ?? "This share will be removed.")
        }
    }

    private func treePreview(_ items: [DashboardShareTreeItem], depth: Int = 0) -> String {
        items.prefix(10).map { item in
            let marker = item.type == "folder" ? ">" : "-"
            let line = "\(String(repeating: "  ", count: depth))\(marker) \(item.name)"
            guard let children = item.children, !children.isEmpty else { return line }
            return line + "\n" + treePreview(children, depth: depth + 1)
        }.joined(separator: "\n")
    }
}

struct ArticlesNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var deletingArticle: DashboardArticle?

    private let columns = [
        GridItem(.adaptive(minimum: 270), spacing: 12, alignment: .top),
    ]

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 12) {
                NativeGroupPanel(title: "Create article", subtitle: "Markdown article through the API") {
                    TextField("article-id.md or heading slug", text: $model.articleDraftID)
                        .textFieldStyle(.plain)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(theme.text)
                        .padding(12)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    TextEditor(text: $model.articleDraftContent)
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundStyle(theme.text)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .frame(minHeight: 220)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    HStack {
                        Text(model.articleDraftContent.isEmpty ? "Start with a markdown heading." : "\(model.articleDraftContent.count) chars")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(theme.textTertiary)
                        Spacer()
                        ActionButton(title: "Create", icon: "plus") {
                            Task { await model.createNativeArticle() }
                        }
                        .disabled(model.isLoadingNativeDashboard)
                    }
                }

                NativeGroupPanel(title: "Edit article", subtitle: model.selectedArticleID.isEmpty ? "Choose an article from the list." : model.selectedArticleID) {
                    TextField("Article id", text: $model.articleEditID)
                        .textFieldStyle(.plain)
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundStyle(theme.text)
                        .padding(12)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    TextEditor(text: $model.articleEditContent)
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundStyle(theme.text)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .frame(minHeight: 280)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    HStack {
                        Text(model.selectedArticleID.isEmpty ? "No article selected." : "\(model.articleEditContent.count) chars")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(theme.textTertiary)
                        Spacer()
                        ActionButton(title: "Save", icon: "checkmark") {
                            Task { await model.updateSelectedArticle() }
                        }
                        .disabled(model.selectedArticleID.isEmpty || model.isLoadingNativeDashboard)
                    }
                }
            }
            .frame(width: 410)

            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    FeatureCard(title: "Articles", value: "\(model.articles.count)", icon: "text.alignleft")
                    FeatureCard(title: "Source", value: "Git", icon: "chevron.left.forwardslash.chevron.right")
                }
                HStack {
                    Text(model.articles.isEmpty ? "No articles loaded yet." : "Published articles")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                    Spacer()
                    ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                        Task { await model.loadNativeDashboardData() }
                    }
                }

                if model.articles.isEmpty {
                    NativeEmptyState(title: "No articles loaded", message: "Create an article or refresh the API-backed article list.")
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                        ForEach(model.articles) { article in
                            VStack(alignment: .leading, spacing: 10) {
                                Text(article.title)
                                    .font(.system(size: 15, weight: .black))
                                    .foregroundStyle(theme.text)
                                    .lineLimit(2)
                                Text(article.metadata?.description ?? article.id)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(theme.textSecondary)
                                    .lineLimit(3)
                                HStack(spacing: 8) {
                                    Label(article.readingLabel, systemImage: "book")
                                    Label(article.publishedLabel, systemImage: "clock")
                                }
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(theme.textTertiary)
                                .lineLimit(1)
                                HStack {
                                    Button("Open") {
                                        model.openArticle(article)
                                    }
                                    .buttonStyle(.plain)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(theme.accent)
                                    Button("Edit") {
                                        model.loadArticleIntoEditor(article)
                                    }
                                    .buttonStyle(.plain)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(theme.textSecondary)
                                    Button("Delete") {
                                        deletingArticle = article
                                    }
                                    .buttonStyle(.plain)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(theme.danger)
                                    Spacer()
                                    Text(article.id)
                                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                        .foregroundStyle(theme.textTertiary)
                                        .lineLimit(1)
                                }
                            }
                            .padding(13)
                            .background(theme.card)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(theme.divider, lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }
                }
            }
        }
        .alert("Delete article?", isPresented: Binding(
            get: { deletingArticle != nil },
            set: { if !$0 { deletingArticle = nil } }
        )) {
            Button("Cancel", role: .cancel) {
                deletingArticle = nil
            }
            Button("Delete", role: .destructive) {
                if let deletingArticle {
                    Task { await model.deleteSelectedArticle(deletingArticle) }
                }
                deletingArticle = nil
            }
        } message: {
            Text(deletingArticle?.title ?? "This article will be removed.")
        }
    }
}

struct ThoughtsNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var deletingThought: DashboardThought?

    private let columns = [
        GridItem(.adaptive(minimum: 230), spacing: 12, alignment: .top),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                FeatureCard(title: "Thoughts", value: "\(model.thoughts.count)", icon: "brain.head.profile")
                FeatureCard(title: "Mode", value: "Native", icon: "macwindow")
            }

            NativeGroupPanel(title: "Create thought", subtitle: "Small idea, saved directly") {
                HStack(spacing: 10) {
                    TextField("Thought title", text: $model.thoughtDraftTitle)
                        .textFieldStyle(.plain)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(theme.text)
                        .padding(12)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    ActionButton(title: "Create", icon: "plus") {
                        Task { await model.createNativeThought() }
                    }
                    .disabled(model.isLoadingNativeDashboard)
                    ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                        Task { await model.loadNativeDashboardData() }
                    }
                }
            }

            NativeGroupPanel(title: "Edit thought", subtitle: model.selectedThoughtID.isEmpty ? "Choose a thought below." : model.selectedThoughtID) {
                HStack(spacing: 10) {
                    TextField("Thought title", text: $model.thoughtEditTitle)
                        .textFieldStyle(.plain)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(theme.text)
                        .padding(12)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    ActionButton(title: "Save", icon: "checkmark") {
                        Task { await model.updateSelectedThought() }
                    }
                    .disabled(model.selectedThoughtID.isEmpty || model.isLoadingNativeDashboard)
                }
            }

            if model.thoughts.isEmpty {
                NativeEmptyState(title: "No thoughts loaded", message: "Create a thought or refresh the API-backed thought list.")
            } else {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                    ForEach(model.thoughts) { thought in
                        VStack(alignment: .leading, spacing: 9) {
                            Text(thought.title)
                                .font(.system(size: 14, weight: .black))
                                .foregroundStyle(theme.text)
                                .lineLimit(3)
                            HStack(spacing: 8) {
                                Label(thought.updatedLabel, systemImage: "clock")
                                if let creator = thought.createdBy, !creator.isEmpty {
                                    Label(creator, systemImage: "person.crop.circle")
                                }
                            }
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(theme.textTertiary)
                            .lineLimit(1)
                            HStack(spacing: 12) {
                                Button("Open") {
                                    model.openWebsite(path: "/thoughts/\(thought.id)", label: thought.title)
                                }
                                .buttonStyle(.plain)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(theme.accent)

                                Button("Edit") {
                                    model.loadThoughtIntoEditor(thought)
                                }
                                .buttonStyle(.plain)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(theme.textSecondary)

                                Button("Delete") {
                                    deletingThought = thought
                                }
                                .buttonStyle(.plain)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(theme.danger)
                            }
                        }
                        .padding(13)
                        .background(theme.card)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(theme.divider, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                }
            }
        }
        .alert("Delete thought?", isPresented: Binding(
            get: { deletingThought != nil },
            set: { if !$0 { deletingThought = nil } }
        )) {
            Button("Cancel", role: .cancel) {
                deletingThought = nil
            }
            Button("Delete", role: .destructive) {
                if let deletingThought {
                    Task { await model.deleteSelectedThought(deletingThought) }
                }
                deletingThought = nil
            }
        } message: {
            Text(deletingThought?.title ?? "This thought will be removed.")
        }
    }
}

struct ProfileNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var pendingSessionRevoke: DashboardAuthSession?
    @State private var pendingCertificateDelete: DashboardCertificate?
    @State private var confirmRevokeOtherSessions = false

    var body: some View {
        if let profile = model.profile {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    FeatureCard(title: "User", value: profile.displayName, icon: "person.crop.circle")
                    FeatureCard(title: "Status", value: profile.active == false ? "Inactive" : "Active", icon: profile.active == false ? "person.crop.circle.badge.xmark" : "checkmark.circle")
                    FeatureCard(title: "Roles", value: "\(profile.roles?.count ?? 0)", icon: "person.badge.key")
                    FeatureCard(title: "Sessions", value: "\(model.profileSessions.filter { $0.revokedAt == nil }.count)", icon: "desktopcomputer")
                    FeatureCard(title: "Certificates", value: "\(model.profileCertificates.count)", icon: "lock.shield")
                }

                NativeGroupPanel(title: "Account", subtitle: profile.id) {
                    CompactInfoCard(title: "Identity", lines: [
                        "Name: \(profile.displayName)",
                        "ID: \(profile.id)",
                        "Avatar: \(profile.avatar ?? "none")",
                    ])
                    if let roles = profile.roles, !roles.isEmpty {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 10)], spacing: 10) {
                            ForEach(roles) { role in
                                CompactInfoCard(
                                    title: role.displayName,
                                    lines: [
                                        role.description ?? role.id,
                                        "Priority: \(role.priority.map(String.init) ?? "unknown")",
                                    ]
                                )
                            }
                        }
                    } else {
                        CompactInfoCard(title: "Roles", lines: ["No roles returned for this session."])
                    }
                }

                NativeGroupPanel(title: "Security", subtitle: "Active sessions and SSH certificates") {
                    HStack(spacing: 12) {
                        FeatureCard(title: "Token expiry", value: profile.expiresAt.map { formatDateText($0, fallback: $0) } ?? "No expiry", icon: "key")
                        FeatureCard(title: "Active sessions", value: "\(model.profileSessions.filter { $0.revokedAt == nil }.count)", icon: "laptopcomputer")
                        FeatureCard(title: "Managed certs", value: "\(model.profileCertificates.filter { $0.isManaged }.count)", icon: "checkmark.shield")
                    }
                    HStack(spacing: 10) {
                        ActionButton(title: "Refresh security", icon: "arrow.clockwise") {
                            Task { await model.loadNativeDashboardData() }
                        }
                        ActionButton(title: "Logout others", icon: "rectangle.portrait.and.arrow.right", tone: .danger) {
                            confirmRevokeOtherSessions = true
                        }
                        .disabled(model.profileSessions.filter { $0.revokedAt == nil }.count <= 1)
                    }

                    if model.profileSessions.isEmpty {
                        CompactInfoCard(title: "Sessions", lines: ["No session records returned."])
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 10)], spacing: 10) {
                            ForEach(model.profileSessions) { session in
                                VStack(alignment: .leading, spacing: 10) {
                                    CompactInfoCard(
                                        title: "\(session.deviceLabel) \(session.revokedAt == nil ? "active" : "revoked")",
                                        lines: [
                                            "IP: \(session.ip ?? "unknown")",
                                            "Last seen: \(formatDateText(session.lastSeenAt, fallback: "unknown"))",
                                            session.userAgent ?? "Unknown client",
                                        ]
                                    )
                                    if session.revokedAt == nil {
                                        HStack {
                                            Spacer()
                                            ActionButton(title: "Revoke", icon: "xmark.shield", tone: .danger) {
                                                pendingSessionRevoke = session
                                            }
                                            .disabled(model.isLoadingNativeDashboard)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if model.profileCertificates.isEmpty {
                        CompactInfoCard(title: "Certificates", lines: ["No certificates returned."])
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 10)], spacing: 10) {
                            ForEach(model.profileCertificates) { certificate in
                                VStack(alignment: .leading, spacing: 10) {
                                    CompactInfoCard(
                                        title: certificate.name,
                                        lines: [
                                            certificate.isManaged ? "Managed by Hanasand API" : "User managed",
                                            "Owner: \(certificate.owner ?? "unknown")",
                                            "Key: \(certificate.keySuffix)",
                                        ]
                                    )
                                    HStack {
                                        Spacer()
                                        ActionButton(title: "Delete", icon: "trash", tone: .danger) {
                                            pendingCertificateDelete = certificate
                                        }
                                        .disabled(model.isLoadingNativeDashboard)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .alert("Revoke session?", isPresented: sessionRevokePresented) {
                Button("Revoke", role: .destructive) {
                    guard let pendingSessionRevoke else { return }
                    Task { await model.revokeProfileSession(pendingSessionRevoke) }
                }
                Button("Cancel", role: .cancel) {
                    pendingSessionRevoke = nil
                }
            } message: {
                Text("This will immediately revoke the selected \(pendingSessionRevoke?.deviceLabel ?? "device") session.")
            }
            .alert("Delete certificate?", isPresented: certificateDeletePresented) {
                Button("Delete", role: .destructive) {
                    guard let pendingCertificateDelete else { return }
                    Task { await model.deleteProfileCertificate(pendingCertificateDelete) }
                }
                Button("Cancel", role: .cancel) {
                    pendingCertificateDelete = nil
                }
            } message: {
                Text("This removes \(pendingCertificateDelete?.name ?? "the selected certificate") from the account.")
            }
            .alert("Logout other devices?", isPresented: $confirmRevokeOtherSessions) {
                Button("Logout others", role: .destructive) {
                    Task { await model.revokeOtherProfileSessions() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This keeps the current token and revokes other active sessions for this account.")
            }
        } else {
            NativeEmptyState(title: "Profile not loaded", message: "Configure auth token and user id in Settings, then refresh this native profile panel.")
        }
    }

    private var sessionRevokePresented: Binding<Bool> {
        Binding(
            get: { pendingSessionRevoke != nil },
            set: { visible in
                if !visible {
                    pendingSessionRevoke = nil
                }
            }
        )
    }

    private var certificateDeletePresented: Binding<Bool> {
        Binding(
            get: { pendingCertificateDelete != nil },
            set: { visible in
                if !visible {
                    pendingCertificateDelete = nil
                }
            }
        )
    }
}

struct UsersNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var searchText = ""
    @State private var pendingStatusUser: DashboardUser?
    @State private var pendingDeleteUser: DashboardUser?

    private let columns = [
        GridItem(.adaptive(minimum: 250), spacing: 12, alignment: .top),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                FeatureCard(title: "Users", value: "\(model.users.count)", icon: "person.2")
                FeatureCard(title: "Active", value: "\(model.users.filter { $0.active != false }.count)", icon: "checkmark.circle")
                FeatureCard(title: "Inactive", value: "\(model.users.filter { $0.active == false }.count)", icon: "person.crop.circle.badge.xmark")
            }
            SearchFieldRow(placeholder: "Filter users by name, id, or role", text: $searchText)

            if model.users.isEmpty {
                NativeEmptyState(title: "No users loaded", message: "Use Refresh from this dashboard or configure auth in Settings to load user administration data.")
            } else {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                    ForEach(filteredUsers) { user in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(spacing: 10) {
                                Image(systemName: user.active == false ? "person.crop.circle.badge.xmark" : "person.crop.circle")
                                    .font(.system(size: 17, weight: .bold))
                                    .foregroundStyle(user.active == false ? theme.danger : theme.accent)
                                    .frame(width: 38, height: 38)
                                    .background(theme.cardRaised)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(user.displayName)
                                        .font(.system(size: 14, weight: .black))
                                        .foregroundStyle(theme.text)
                                        .lineLimit(1)
                                    Text(user.id)
                                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                        .foregroundStyle(theme.textTertiary)
                                        .lineLimit(1)
                                }
                            }
                            CompactInfoCard(title: "Role", lines: [
                                user.roleLabel,
                                "Priority: \(user.highestRolePriority.map(String.init) ?? "unknown")",
                            ])
                            HStack {
                                Button("Open profile") {
                                    model.openUserProfile(user)
                                }
                                .buttonStyle(.plain)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(theme.accent)
                                Button("Roles") {
                                    model.selectDashboardUser(user)
                                }
                                .buttonStyle(.plain)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(theme.textSecondary)
                                Button(user.active == false ? "Activate" : "Deactivate") {
                                    pendingStatusUser = user
                                }
                                .buttonStyle(.plain)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(user.active == false ? theme.green : theme.danger)
                                Button("Delete") {
                                    pendingDeleteUser = user
                                }
                                .buttonStyle(.plain)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(theme.danger)
                                Spacer()
                                Text(user.active == false ? "Inactive" : "Active")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(user.active == false ? theme.danger : theme.green)
                            }
                        }
                        .padding(13)
                        .background(theme.card)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(theme.divider, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                }
            }

            if let selectedUser {
                userRolesPanel(selectedUser)
            }
        }
        .task(id: model.selectedUserID) {
            await model.loadSelectedUserRoles()
        }
        .alert(statusAlertTitle, isPresented: Binding(
            get: { pendingStatusUser != nil },
            set: { if !$0 { pendingStatusUser = nil } }
        )) {
            Button("Cancel", role: .cancel) {
                pendingStatusUser = nil
            }
            Button(statusActionTitle, role: pendingStatusUser?.active == false ? nil : .destructive) {
                if let pendingStatusUser {
                    Task { await model.setDashboardUser(pendingStatusUser, active: pendingStatusUser.active == false) }
                }
                pendingStatusUser = nil
            }
        } message: {
            Text(pendingStatusUser?.active == false ? "This will reactivate the selected account." : "This will deactivate the account and revoke its active sessions.")
        }
        .alert("Delete user?", isPresented: Binding(
            get: { pendingDeleteUser != nil },
            set: { if !$0 { pendingDeleteUser = nil } }
        )) {
            Button("Cancel", role: .cancel) {
                pendingDeleteUser = nil
            }
            Button("Delete", role: .destructive) {
                if let pendingDeleteUser {
                    Task { await model.deleteDashboardUser(pendingDeleteUser) }
                }
                pendingDeleteUser = nil
            }
        } message: {
            Text("This permanently removes \(pendingDeleteUser?.displayName ?? "the selected user"). Prefer deactivate unless deletion is intentional.")
        }
    }

    private var selectedUser: DashboardUser? {
        model.users.first { $0.id == model.selectedUserID }
    }

    private var statusAlertTitle: String {
        pendingStatusUser?.active == false ? "Activate user?" : "Deactivate user?"
    }

    private var statusActionTitle: String {
        pendingStatusUser?.active == false ? "Activate" : "Deactivate"
    }

    private func userRolesPanel(_ user: DashboardUser) -> some View {
        NativeGroupPanel(title: "Roles for \(user.displayName)", subtitle: user.id) {
            if model.roles.isEmpty {
                Text("Load roles before assigning access.")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 230), spacing: 10)], alignment: .leading, spacing: 10) {
                    ForEach(model.roles.sorted { ($0.priority ?? 0) < ($1.priority ?? 0) }) { role in
                        let assigned = model.selectedUserRoles.contains { $0.id == role.id }
                        Button {
                            Task { await model.setRole(role, assigned: !assigned, for: user) }
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: assigned ? "checkmark.circle.fill" : "circle")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundStyle(assigned ? theme.green : theme.textTertiary)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(role.displayName)
                                        .font(.system(size: 12, weight: .black))
                                        .foregroundStyle(theme.text)
                                        .lineLimit(1)
                                    Text(role.description ?? role.id)
                                        .font(.system(size: 10, weight: .semibold))
                                        .foregroundStyle(theme.textSecondary)
                                        .lineLimit(1)
                                }
                                Spacer()
                                Text("\(role.priority ?? 0)")
                                    .font(.system(size: 10, weight: .black, design: .monospaced))
                                    .foregroundStyle(theme.accent)
                            }
                            .padding(11)
                            .background(assigned ? theme.accentSoft : theme.cardRaised)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(model.isLoadingNativeDashboard)
                    }
                }
            }
        }
    }

    private var filteredUsers: [DashboardUser] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return model.users }
        return model.users.filter { user in
            [
                user.id,
                user.name ?? "",
                user.highestRoleName ?? "",
                user.highestRoleID ?? "",
            ].joined(separator: " ").lowercased().contains(query)
        }
    }
}

struct RolesNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var searchText = ""
    @State private var deletingRole: DashboardRole?

    private let columns = [
        GridItem(.adaptive(minimum: 260), spacing: 12, alignment: .top),
    ]

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 12) {
                NativeGroupPanel(title: "Create role", subtitle: "User-admin role management") {
                    TextField("Role id, optional", text: $model.roleDraftID)
                        .textFieldStyle(.plain)
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundStyle(theme.text)
                        .padding(12)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    TextField("Role name", text: $model.roleDraftName)
                        .textFieldStyle(.plain)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(theme.text)
                        .padding(12)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    TextField("Description", text: $model.roleDraftDescription, axis: .vertical)
                        .textFieldStyle(.plain)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(theme.text)
                        .lineLimit(2...5)
                        .padding(12)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    HStack {
                        Text(model.roleDraftName.isEmpty ? "Name creates the slug when id is empty." : model.roleDraftName.slugifiedPath)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(theme.textTertiary)
                        Spacer()
                        ActionButton(title: "Create", icon: "plus") {
                            Task { await model.createNativeRole() }
                        }
                        .disabled(model.isLoadingNativeDashboard)
                    }
                }

                NativeGroupPanel(title: "Edit role", subtitle: model.selectedRoleID.isEmpty ? "Choose a role from the list." : model.selectedRoleID) {
                    TextField("Role name", text: $model.roleEditName)
                        .textFieldStyle(.plain)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(theme.text)
                        .padding(12)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    TextField("Description", text: $model.roleEditDescription, axis: .vertical)
                        .textFieldStyle(.plain)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(theme.text)
                        .lineLimit(2...5)
                        .padding(12)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    HStack {
                        Text(model.selectedRoleID.isEmpty ? "No role selected." : "Priority stays managed by the API.")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(theme.textTertiary)
                        Spacer()
                        ActionButton(title: "Save", icon: "checkmark") {
                            Task { await model.updateSelectedRole() }
                        }
                        .disabled(model.selectedRoleID.isEmpty || model.isLoadingNativeDashboard)
                    }
                }
            }
            .frame(width: 360)

            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    FeatureCard(title: "Roles", value: "\(model.roles.count)", icon: "person.badge.key")
                    FeatureCard(title: "Highest priority", value: "\(model.roles.compactMap { $0.priority }.max() ?? 0)", icon: "arrow.up.circle")
                }

                HStack(spacing: 10) {
                    SearchFieldRow(placeholder: "Filter roles by name, id, or description", text: $searchText)
                    ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                        Task { await model.loadNativeDashboardData() }
                    }
                }

                if model.roles.isEmpty {
                    NativeEmptyState(title: "No roles loaded", message: "Use Refresh to load roles. System-admin auth is required for native role administration.")
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                        ForEach(filteredRoles) { role in
                            VStack(alignment: .leading, spacing: 10) {
                                HStack {
                                    Text(role.displayName)
                                        .font(.system(size: 15, weight: .black))
                                        .foregroundStyle(theme.text)
                                        .lineLimit(1)
                                    Spacer()
                                    Text("\(role.priority ?? 0)")
                                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                                        .foregroundStyle(theme.accent)
                                        .padding(.horizontal, 9)
                                        .frame(height: 26)
                                        .background(theme.accentSoft)
                                        .clipShape(Capsule())
                                }
                                Text(role.description ?? role.id)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(theme.textSecondary)
                                    .lineLimit(3)
                                Text("Updated \(formatDateText(role.updatedAt, fallback: role.createdAt ?? "unknown"))")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(theme.textTertiary)
                                HStack(spacing: 12) {
                                    Button("Edit") {
                                        model.loadRoleIntoEditor(role)
                                    }
                                    .buttonStyle(.plain)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(theme.accent)

                                    Button("Delete") {
                                        deletingRole = role
                                    }
                                    .buttonStyle(.plain)
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(theme.danger)

                                    Spacer()
                                    Text(role.id)
                                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                        .foregroundStyle(theme.textTertiary)
                                        .lineLimit(1)
                                }
                            }
                            .padding(13)
                            .background(role.id == model.selectedRoleID ? theme.accentSoft : theme.card)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(theme.divider, lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }
                }
            }
        }
        .alert("Delete role?", isPresented: Binding(
            get: { deletingRole != nil },
            set: { if !$0 { deletingRole = nil } }
        )) {
            Button("Cancel", role: .cancel) {
                deletingRole = nil
            }
            Button("Delete", role: .destructive) {
                if let deletingRole {
                    Task { await model.deleteNativeRole(deletingRole) }
                }
                deletingRole = nil
            }
        } message: {
            Text("This removes \(deletingRole?.displayName ?? "the selected role"). Users relying on it may lose access.")
        }
    }

    private var filteredRoles: [DashboardRole] {
        let sorted = model.roles.sorted { ($0.priority ?? 0) > ($1.priority ?? 0) }
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return sorted }
        return sorted.filter { role in
            [
                role.id,
                role.name ?? "",
                role.description ?? "",
                role.createdBy ?? "",
            ].joined(separator: " ").lowercased().contains(query)
        }
    }
}

struct LogsNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var searchText = ""
    @State private var selectedService = "all"
    @State private var selectedLevel = "all"
    @State private var expandedIDs: Set<String> = []

    private let columns = [
        GridItem(.adaptive(minimum: 220), spacing: 12, alignment: .top),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                FeatureCard(title: "Logs", value: "\(model.logs.count)", icon: "doc.text.magnifyingglass")
                FeatureCard(title: "Errors", value: "\(model.logs.filter(\.isError).count)", icon: "exclamationmark.triangle")
                FeatureCard(title: "Services", value: "\(services.count)", icon: "server.rack")
                FeatureCard(title: "Native", value: "\(model.logs.filter { $0.source == "native" }.count)", icon: "lock.shield")
            }

            HStack(spacing: 10) {
                SearchFieldRow(placeholder: "Search logs by service, host, message, or metadata", text: $searchText)
                ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                    Task { await model.loadNativeDashboardData() }
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    FilterChip(title: "All services", active: selectedService == "all") {
                        selectedService = "all"
                    }
                    ForEach(services.prefix(12), id: \.self) { service in
                        FilterChip(title: service, active: selectedService == service) {
                            selectedService = service
                        }
                    }
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(["all", "fatal", "error", "warn", "info", "debug"], id: \.self) { level in
                        FilterChip(title: level.capitalized, active: selectedLevel == level) {
                            selectedLevel = level
                        }
                    }
                }
            }

            if model.logs.isEmpty {
                NativeEmptyState(title: "No logs loaded", message: "Use Refresh to load application logs. Try the Logs dashboard after configuring auth in Settings.")
            } else if filteredLogs.isEmpty {
                NativeGroupPanel(title: "No matching logs", subtitle: "Adjust service, level, or search filters.") {
                    Text("The native log viewer has data loaded, but none of the entries match the active filters.")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                }
            } else {
                LazyVStack(alignment: .leading, spacing: 10) {
                    ForEach(filteredLogs.prefix(120)) { log in
                        logRow(log)
                    }
                }
            }
        }
    }

    private var services: [String] {
        Array(Set(model.logs.map(\.service))).sorted()
    }

    private var filteredLogs: [DashboardLogEntry] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return model.logs.filter { log in
            let serviceMatch = selectedService == "all" || log.service == selectedService
            let levelMatch = selectedLevel == "all" || log.level == selectedLevel
            let searchable = [
                log.service,
                log.host ?? "",
                log.level,
                log.message,
                log.source ?? "",
                log.metadata?.pretty ?? "",
            ].joined(separator: " ").lowercased()
            return serviceMatch && levelMatch && (query.isEmpty || searchable.contains(query))
        }
    }

    @ViewBuilder
    private func logRow(_ log: DashboardLogEntry) -> some View {
        let isOpen = expandedIDs.contains(log.id)
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: log.isError ? "exclamationmark.triangle.fill" : "terminal")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(log.isError ? theme.danger : theme.accent)
                    .frame(width: 34, height: 34)
                    .background(theme.cardRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))

                Button {
                    if isOpen {
                        expandedIDs.remove(log.id)
                    } else {
                        expandedIDs.insert(log.id)
                    }
                } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            Text(log.service)
                                .font(.system(size: 12, weight: .black))
                                .foregroundStyle(theme.text)
                            Text(log.level.uppercased())
                                .font(.system(size: 10, weight: .black))
                                .foregroundStyle(log.isError ? theme.danger : theme.textTertiary)
                            if let source = log.source {
                                Text(source)
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(theme.textTertiary)
                            }
                        }
                        Text(log.message.isEmpty ? "No message" : log.message)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(theme.textSecondary)
                            .lineLimit(isOpen ? nil : 2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .buttonStyle(.plain)

                Spacer()
                VStack(alignment: .trailing, spacing: 5) {
                    Text(log.createdLabel)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                    if let host = log.host, !host.isEmpty {
                        Text(host)
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundStyle(theme.textTertiary)
                            .lineLimit(1)
                    }
                }
            }

            if isOpen, let metadata = log.metadata {
                Text(metadata.pretty)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.textTertiary)
                    .textSelection(.enabled)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(theme.backgroundElevated.opacity(0.72))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .padding(13)
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(log.isError ? theme.danger.opacity(0.45) : theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct FilterChip: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(active ? theme.background : theme.textSecondary)
                .padding(.horizontal, 11)
                .frame(height: 30)
                .background(active ? theme.accent : theme.field)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}


struct AIModelsNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    private let columns = [
        GridItem(.adaptive(minimum: 260), spacing: 12, alignment: .top),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                FeatureCard(title: "Clients", value: "\(model.aiClients.count)", icon: "cpu")
                FeatureCard(title: "Ready", value: "\(model.aiClients.filter { ($0.model?.status ?? "").localizedCaseInsensitiveContains("ready") }.count)", icon: "checkmark.circle")
                FeatureCard(title: "Fastest", value: model.aiClients.sortedForRuntime.first?.name ?? "None", icon: "speedometer")
            }

            HStack(spacing: 10) {
                ActionButton(title: "Refresh models", icon: "arrow.clockwise") {
                    Task { await model.loadNativeDashboardData() }
                }
                ActionButton(title: "Open AI chat", icon: "sparkles") {
                    model.selectedSection = .ai
                }
            }

            if model.aiClients.isEmpty {
                NativeEmptyState(title: "No AI clients loaded", message: "Use Refresh models to load connected model clients, or open AI chat to reconnect the runtime.")
            } else {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                    ForEach(model.aiClients.sortedForRuntime) { client in
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(spacing: 10) {
                                Image(systemName: "cpu")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundStyle(theme.accent)
                                    .frame(width: 38, height: 38)
                                    .background(theme.accentSoft)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(client.name)
                                        .font(.system(size: 14, weight: .black))
                                        .foregroundStyle(theme.text)
                                        .lineLimit(1)
                                    Text(client.statusText)
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(theme.textTertiary)
                                        .lineLimit(1)
                                }
                            }

                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 8)], spacing: 8) {
                                MiniMetricCard(label: "TPS", value: String(format: "%.1f", client.model?.tps ?? 0))
                                MiniMetricCard(label: "Generated", value: "\(client.model?.generatedTokens ?? 0)")
                                MiniMetricCard(label: "Context", value: "\(client.model?.contextTokens ?? 0)")
                                MiniMetricCard(label: "Max", value: "\(client.model?.contextMaxTokens ?? 0)")
                            }

                            if let error = client.model?.lastError, !error.isEmpty {
                                Text(error)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(theme.danger)
                                    .lineLimit(3)
                            }
                        }
                        .padding(13)
                        .background(theme.card)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(theme.divider, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                }
            }
        }
    }
}

struct NotesNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 10) {
                ActionButton(title: "New note", icon: "plus") {
                    model.newNoteDraft()
                }
                ForEach(model.notes) { note in
                    Button {
                        model.selectNote(note)
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(note.title.isEmpty ? "Untitled" : note.title)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(theme.text)
                                .lineLimit(1)
                            Text(formatDateText(note.updatedAt, fallback: note.source))
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(theme.textTertiary)
                                .lineLimit(1)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(model.selectedNoteID == note.id ? theme.sidebarSelected : theme.cardRaised)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
                if model.notes.isEmpty {
                    CompactInfoCard(title: "No notes", lines: ["Create the first shared desktop note."])
                }
            }
            .frame(width: 260, alignment: .topLeading)

            VStack(alignment: .leading, spacing: 12) {
                TextField("Title", text: $model.noteDraftTitle)
                    .textFieldStyle(.plain)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(theme.text)
                    .padding(14)
                    .background(theme.field)
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))

                TextEditor(text: $model.noteDraftContent)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(theme.text)
                    .scrollContentBackground(.hidden)
                    .padding(10)
                    .frame(minHeight: 360)
                    .background(theme.field)
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))

                HStack {
                    Text(model.selectedNoteID.isEmpty ? "New note" : "Editing note")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                    Spacer()
                    if !model.selectedNoteID.isEmpty {
                        ActionButton(title: "Delete", icon: "trash", tone: .danger) {
                            Task { await model.deleteSelectedNote() }
                        }
                    }
                    ActionButton(title: "Save", icon: "checkmark") {
                        Task { await model.saveNoteDraft() }
                    }
                }
            }
        }
    }
}

struct DatabaseNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        if let overview = model.databaseOverview {
            HStack(spacing: 12) {
                FeatureCard(title: "Clusters", value: "\(overview.clusterCount)", icon: "server.rack")
                FeatureCard(title: "Databases", value: "\(overview.databaseCount)", icon: "externaldrive")
                FeatureCard(title: "Storage", value: formatBytes(overview.totalSizeBytes), icon: "internaldrive")
                FeatureCard(title: "Active queries", value: "\(overview.activeQueries)", icon: "play.circle")
            }
            ForEach(overview.clusters) { cluster in
                NativeGroupPanel(title: cluster.name.isEmpty ? cluster.id : cluster.name, subtitle: [cluster.engine, cluster.version, cluster.host].compactMap { $0 }.joined(separator: " · ")) {
                    if let error = cluster.error, !error.isEmpty {
                        Text(error)
                            .foregroundStyle(.red)
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), spacing: 12)], spacing: 12) {
                            ForEach(cluster.databases) { database in
                                CompactInfoCard(
                                    title: database.name,
                                    lines: [
                                        "Tables: \(database.tableCount)",
                                        "Connections: \(database.activeConnections ?? 0)",
                                        "Size: \(formatBytes(database.sizeBytes))",
                                    ]
                                )
                            }
                        }
                    }
                }
            }
        } else {
            NativeEmptyState(title: "Database overview not loaded", message: "Use Refresh to load database clusters from the internal API. Internal auth and network access are required.")
        }
    }
}

struct BackupNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        HStack(spacing: 10) {
            ActionButton(title: "Run backup now", icon: "externaldrive.badge.timemachine") {
                Task { await model.runNativeDashboardMutation(.runBackup) }
            }
            ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                Task { await model.loadNativeDashboardData() }
            }
        }
        if model.backupServices.isEmpty {
            NativeEmptyState(title: "No backup services loaded", message: "Use Refresh to load backup status from the internal API, or run a backup when internal access is available.")
        } else {
            ForEach(model.backupServices) { backup in
                NativeGroupPanel(title: backup.name, subtitle: backup.id) {
                    HStack(spacing: 12) {
                        FeatureCard(title: "Status", value: backup.status, icon: backup.status.lowercased().contains("up") ? "checkmark.circle" : "xmark.octagon")
                        FeatureCard(title: "Database", value: backup.dbSize ?? "Unknown", icon: "internaldrive")
                        FeatureCard(title: "Storage", value: backup.totalStorage ?? "Unknown", icon: "tray.full")
                    }
                    HStack(spacing: 12) {
                        CompactInfoCard(title: "Last backup", lines: [formatDateText(backup.lastBackup, fallback: "Never")])
                        CompactInfoCard(title: "Next backup", lines: [formatDateText(backup.nextBackup, fallback: "Not scheduled")])
                        CompactInfoCard(title: "Restore", lines: ["Open restore files from the restore endpoint before executing destructive restore."])
                    }
                    if let error = backup.error, !error.isEmpty {
                        CompactInfoCard(title: "Error", lines: [error])
                    }
                }
            }
        }
    }
}

struct RestoreNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                ActionButton(title: "Refresh files", icon: "arrow.clockwise") {
                    Task { await model.loadNativeDashboardData() }
                }
            }
            if model.backupFiles.isEmpty {
                NativeEmptyState(title: "No restore files loaded", message: "Use Refresh files to load backup artifacts before attempting a restore.")
            } else {
                NativeGroupPanel(title: "Backup files", subtitle: "\(model.backupFiles.count) restore candidates") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 12)], spacing: 12) {
                        ForEach(model.backupFiles) { backup in
                            VStack(alignment: .leading, spacing: 12) {
                                CompactInfoCard(
                                    title: backup.service,
                                    lines: [
                                        backup.file,
                                        backup.location ?? "unknown location",
                                        backup.size ?? "unknown size",
                                        formatDateText(backup.mtime, fallback: "unknown modified time"),
                                    ]
                                )
                                ActionButton(title: "Restore", icon: "arrow.counterclockwise", tone: .danger) {
                                    confirmRestore(backup)
                                }
                            }
                            .padding(12)
                            .background(Color.black.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }
                }
            }
        }
    }

    private func confirmRestore(_ backup: DashboardBackupFile) {
        let alert = NSAlert()
        alert.messageText = "Restore \(backup.service)?"
        alert.informativeText = "This will restore \(backup.file). Continue only if this is the intended rollback target."
        alert.alertStyle = .critical
        alert.addButton(withTitle: "Restore")
        alert.addButton(withTitle: "Cancel")

        guard alert.runModal() == .alertFirstButtonReturn else { return }
        Task {
            await model.runNativeDashboardMutation(.restoreBackup(service: backup.service, file: backup.file))
        }
    }
}

struct VulnerabilityNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        HStack(spacing: 10) {
            ActionButton(title: model.vulnerabilityReport?.scanStatus.isRunning == true ? "Scan running" : "Run scan", icon: "shield.lefthalf.filled.badge.checkmark") {
                Task { await model.runNativeDashboardMutation(.runVulnerabilityScan) }
            }
            .disabled(model.vulnerabilityReport?.scanStatus.isRunning == true)
            ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                Task { await model.loadNativeDashboardData() }
            }
        }

        if let report = model.vulnerabilityReport {
            let totals = report.images.reduce(DashboardSeverityCount(critical: 0, high: 0, medium: 0, low: 0, unknown: 0)) { partial, image in
                DashboardSeverityCount(
                    critical: partial.critical + image.severity.critical,
                    high: partial.high + image.severity.high,
                    medium: partial.medium + image.severity.medium,
                    low: partial.low + image.severity.low,
                    unknown: partial.unknown + image.severity.unknown
                )
            }
            HStack(spacing: 12) {
                FeatureCard(title: "Images", value: "\(report.imageCount)", icon: "shippingbox")
                FeatureCard(title: "Critical", value: "\(totals.critical)", icon: "exclamationmark.octagon")
                FeatureCard(title: "High", value: "\(totals.high)", icon: "exclamationmark.triangle")
                FeatureCard(title: "Scan", value: report.scanStatus.isRunning ? "\(report.scanStatus.completedImages)/\(report.scanStatus.totalImages ?? report.imageCount)" : "Idle", icon: "waveform.path.ecg")
            }
            ForEach(report.images) { image in
                NativeGroupPanel(title: image.image, subtitle: "Scanned \(formatDateText(image.scannedAt, fallback: image.scannedAt))") {
                    HStack(spacing: 12) {
                        FeatureCard(title: "Findings", value: "\(image.totalVulnerabilities)", icon: "shield")
                        FeatureCard(title: "Critical", value: "\(image.severity.critical)", icon: "flame")
                        FeatureCard(title: "High", value: "\(image.severity.high)", icon: "bolt.trianglebadge.exclamationmark")
                        FeatureCard(title: "Medium", value: "\(image.severity.medium)", icon: "exclamationmark.circle")
                    }
                    if let scanError = image.scanError, !scanError.isEmpty {
                        CompactInfoCard(title: "Scan error", lines: [scanError])
                    }
                }
            }
        } else {
            NativeEmptyState(title: "Vulnerability report not loaded", message: "Use Refresh or Run scan to load native vulnerability findings from the internal scanner.")
        }
    }
}

struct TrafficNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        if let metrics = model.trafficMetrics {
            HStack(spacing: 12) {
                FeatureCard(title: "Requests", value: "\(metrics.totalRequests)", icon: "arrow.left.arrow.right")
                FeatureCard(title: "Avg request", value: "\(String(format: "%.2f", metrics.avgRequestTime))s", icon: "timer")
                FeatureCard(title: "Error rate", value: "\(String(format: "%.2f", metrics.errorRate))%", icon: "exclamationmark.triangle")
            }
            NativeGroupPanel(title: "Top domains", subtitle: "Live traffic breakdown") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), spacing: 12)], spacing: 12) {
                    ForEach(metrics.topDomains) { domain in
                        CompactInfoCard(title: domain.key, lines: ["\(domain.count) requests"])
                    }
                }
            }
        } else {
            NativeEmptyState(title: "Traffic metrics not loaded", message: "Use Refresh to load traffic metrics from Beekeeper. VPN/internal connectivity may be required.")
        }
    }
}

struct UploadNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var isDropTargeted = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                ActionButton(title: "Choose file", icon: "doc.badge.plus") {
                    model.chooseUploadFile()
                }
                ActionButton(title: "Check path", icon: "checkmark.seal") {
                    Task { await model.checkUploadPath() }
                }
                .disabled(model.uploadPath.isEmpty || model.isCheckingUploadPath)
                ActionButton(title: model.isUploadingFile ? "Uploading" : "Upload", icon: "arrow.up.doc") {
                    Task { await model.uploadSelectedFile() }
                }
                .disabled(model.uploadFileURL == nil || model.isUploadingFile)
                ActionButton(title: "Reset", icon: "arrow.counterclockwise") {
                    model.resetUploadDraft()
                }
                if model.isUploadingFile || model.isCheckingUploadPath {
                    ProgressView()
                        .scaleEffect(0.75)
                }
            }

            HStack(spacing: 12) {
                FeatureCard(title: "File", value: model.uploadFileURL?.lastPathComponent ?? "None", icon: "doc")
                FeatureCard(title: "Type", value: model.uploadType, icon: "tag")
                FeatureCard(title: "Path", value: uploadPathStatus, icon: "point.topleft.down.curvedto.point.bottomright.up")
            }

            NativeGroupPanel(title: isDropTargeted ? "Drop file to upload" : "CDN upload", subtitle: "Native /files upload contract") {
                VStack(alignment: .leading, spacing: 10) {
                    field("Name", text: $model.uploadName, placeholder: "Filename shown on the CDN")
                    field("Path", text: $model.uploadPath, placeholder: "optional-short-path")
                        .onChange(of: model.uploadPath) { _, _ in
                            model.uploadPathAvailable = nil
                        }
                    field("MIME type", text: $model.uploadType, placeholder: "image/png")
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Description")
                            .font(.system(size: 11, weight: .black))
                            .foregroundStyle(theme.textTertiary)
                        TextEditor(text: $model.uploadDescription)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(theme.text)
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 74)
                            .padding(8)
                            .background(theme.field)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }

                    Text(model.uploadStatus)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(statusColor)

                    if !model.uploadedFileURL.isEmpty {
                        HStack(spacing: 10) {
                            Text(model.uploadedFileURL)
                                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                .foregroundStyle(theme.textSecondary)
                                .textSelection(.enabled)
                                .lineLimit(1)
                            Spacer()
                            ActionButton(title: "Open", icon: "arrow.up.right.square") {
                                model.openUploadedFileURL()
                            }
                            ActionButton(title: "Copy URL", icon: "doc.on.doc") {
                                model.copyUploadedFileURL()
                            }
                        }
                        .padding(10)
                        .background(Color.black.opacity(0.14))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
            }
            .onDrop(of: [UTType.fileURL.identifier], isTargeted: $isDropTargeted) { providers in
                model.selectUploadProviders(providers)
            }
        }
    }

    private var uploadPathStatus: String {
        if model.uploadPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Generated"
        }
        if model.uploadPathAvailable == true {
            return "Available"
        }
        if model.uploadPathAvailable == false {
            return "Taken"
        }
        return "Unchecked"
    }

    private var statusColor: Color {
        if model.uploadStatus.localizedCaseInsensitiveContains("failed") || model.uploadStatus.localizedCaseInsensitiveContains("taken") {
            return theme.danger
        }
        if model.uploadStatus.localizedCaseInsensitiveContains("uploaded") || model.uploadStatus.localizedCaseInsensitiveContains("available") {
            return theme.green
        }
        return theme.textSecondary
    }

    private func field(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 11, weight: .black))
                .foregroundStyle(theme.textTertiary)
            TextField(placeholder, text: text)
                .textFieldStyle(.plain)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(theme.text)
                .padding(.horizontal, 10)
                .frame(height: 34)
                .background(theme.field)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }
}

struct NativeEmptyState: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let message: String

    var body: some View {
        NativeGroupPanel(title: title, subtitle: "") {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "tray")
                    .font(.system(size: 16, weight: .black))
                    .foregroundStyle(theme.accent)
                    .frame(width: 38, height: 38)
                    .background(theme.accentSoft)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                Text(message)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer()
            }
        }
    }
}

struct NativeGroupPanel<Content: View>: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 16, weight: .black))
                    .foregroundStyle(theme.text)
                    .textSelection(.enabled)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                        .lineLimit(1)
                        .textSelection(.enabled)
                }
            }
            content
        }
        .padding(14)
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(
                    LinearGradient(colors: [theme.divider.opacity(1.5), theme.divider.opacity(0.45)], startPoint: .topLeading, endPoint: .bottomTrailing),
                    lineWidth: 1
                )
        )
        .shadow(color: .black.opacity(theme.isLight ? 0.05 : 0.20), radius: 18, x: 0, y: 10)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct CompactInfoCard: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let lines: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.system(size: 11, weight: .black))
                .foregroundStyle(theme.textTertiary)
                .textCase(.uppercase)
            ForEach(lines, id: \.self) { line in
                Text(line)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(2)
                    .textSelection(.enabled)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(theme.cardRaised)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(theme.divider.opacity(0.85), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct DashboardSectionHeader: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(theme.text)
            Text(subtitle)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(theme.textTertiary)
        }
        .padding(.top, 4)
    }
}

struct IDELaunchpadWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        FeatureWorkspace(title: "IDE", subtitle: "Code and files.") {
            HStack(spacing: 12) {
                FeatureCard(title: "Workspace", value: model.status.cwd, icon: "folder")
                FeatureCard(title: "Agent", value: model.status.ok ? "Online" : "Offline", icon: "terminal")
            }
            ActionGrid(actions: [
                .route("AI Workspace", "Models, repositories, conversations, and previews.", "sparkles", "/dashboard/system/ai"),
                .route("Shares", "Shares and hosted files.", "folder.badge.gearshape", "/s"),
                .route("Links", "Create and inspect /g shortcut links.", "link", "/g"),
                .route("Load Tests", "Recent public load-test runs.", "speedometer", "/dashboard/tests"),
                .task("Reveal working directory", "Open the active local folder in Finder.", "folder") { model in
                    NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: model.status.cwd)])
                },
            ])
        }
    }
}

struct ControlPlaneWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    let commandFocused: FocusState<Bool>.Binding

    var body: some View {
        FeatureWorkspace(title: "Control", subtitle: model.currentTaskState) {
            NativeGroupPanel(title: "Command", subtitle: "") {
                HStack(alignment: .center, spacing: 12) {
                    TextField("Prompt Codex or type a command", text: $model.prompt, axis: .vertical)
                        .focused(commandFocused)
                        .textFieldStyle(.plain)
                        .font(.system(size: 21, weight: .semibold))
                        .lineLimit(1...5)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .onSubmit { model.submitPrompt() }
                    ActionButton(title: model.isRunning ? "Running" : "Run", icon: model.isRunning ? "circle.dotted" : "paperplane.fill") {
                        model.submitPrompt()
                    }
                    .disabled(model.isRunning)
                }

                HStack(spacing: 10) {
                    ControlStateChip(title: "State", value: model.currentTaskState, icon: model.isRunning ? "bolt.horizontal.circle" : "checkmark.circle")
                    ControlStateChip(title: "Mac", value: model.status.ok ? "Ready" : "Offline", icon: "desktopcomputer")
                    ControlStateChip(title: "Server", value: model.serverReachabilitySummary, icon: "server.rack")
                    ControlStateChip(title: "Health", value: model.serverReachabilityCheckedText, icon: "heart.text.square")
                    ControlStateChip(title: "Action", value: model.serverActionStatus, icon: model.isServerBusy ? "circle.dotted" : "bolt.circle")
                }
            }

            if let approval = model.pendingApproval {
                ControlApprovalPanel(approval: approval)
            }

            HStack(alignment: .top, spacing: 12) {
                NativeGroupPanel(title: "This Mac", subtitle: "") {
                    ControlButtonGrid {
                        ActionButton(title: "Status", icon: "waveform.path.ecg") {
                            Task { await model.refreshLocalStatus() }
                        }
                        ActionButton(title: "Reveal cwd", icon: "folder") {
                            NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: model.status.cwd)])
                        }
                        ActionButton(title: "Copy agent URL", icon: "link") {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(model.settings.desktopAgentBaseURL, forType: .string)
                        }
                        ActionButton(title: "Tunnel", icon: "point.3.connected.trianglepath.dotted") {
                            model.requestRemoteTunnelApproval()
                        }
                        ActionButton(title: "Remote desktop", icon: "rectangle.connected.to.line.below") {
                            model.openRemoteDesktop()
                        }
                        ActionButton(title: "VPN", icon: "lock.shield") {
                            model.openVPN()
                        }
                        ActionButton(title: "Health", icon: "stethoscope") {
                            Task { await model.checkServerReachability() }
                        }
                    }
                }

                NativeGroupPanel(title: "Server", subtitle: "") {
                    ControlButtonGrid {
                        ActionButton(title: model.isCheckingServerReachability ? "Checking" : "Health", icon: "heart.text.square") {
                            Task { await model.checkServerReachability() }
                        }
                        .disabled(model.isServerBusy)
                        ActionButton(title: "Copy diag", icon: "doc.on.doc") {
                            model.copyServerDiagnostics()
                        }
                        ActionButton(title: "Start", icon: "play.fill") {
                            Task { await model.runServerAction(model.settings.serverStartPath) }
                        }
                        .disabled(model.isServerBusy)
                        ActionButton(title: "Stop", icon: "stop.fill", tone: .danger) {
                            model.requestStopServerApproval()
                        }
                        .disabled(model.isServerBusy)
                        ActionButton(title: "Logs", icon: "doc.text.magnifyingglass") {
                            Task { await model.checkServerLogs() }
                        }
                        .disabled(model.isServerBusy)
                        ActionButton(title: "VMs", icon: "cpu") {
                            model.selectedSection = .dashboard
                            model.openNativeDashboard(path: "/dashboard/vms", label: "VMs")
                        }
                        ActionButton(title: "AI models", icon: "sparkles") {
                            model.selectedSection = .ai
                            Task { await model.loadAIPage() }
                        }
                        ActionButton(title: "Settings", icon: "gearshape") {
                            model.selectedSection = .settings
                        }
                    }
                }
            }

            HStack(alignment: .top, spacing: 12) {
                NativeGroupPanel(title: "Workflows", subtitle: "") {
                    ControlButtonGrid {
                        ActionButton(title: "Mail", icon: "envelope") {
                            model.selectedSection = .mail
                        }
                        ActionButton(title: "Notes", icon: "note.text") {
                            model.openNativeDashboard(path: "/dashboard/notes", label: "Notes")
                        }
                        ActionButton(title: "Documents", icon: "doc.viewfinder") {
                            model.selectedSection = .documents
                        }
                        ActionButton(title: "Images", icon: "photo.on.rectangle.angled") {
                            model.selectedSection = .images
                        }
                        ActionButton(title: "Clear pages", icon: "trash", tone: .danger) {
                            model.requestClearDocumentsApproval()
                        }
                        ActionButton(title: "Trash images", icon: "trash.slash", tone: .danger) {
                            model.requestTrashImagesApproval()
                        }
                    }
                }

                ControlRunHistoryPanel()
            }
        }
    }
}

struct ControlButtonGrid<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 132), spacing: 10)], alignment: .leading, spacing: 10) {
            content
        }
    }
}

struct ControlStateChip: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let value: String
    let icon: String

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(theme.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                Text(value)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .frame(height: 48)
        .frame(maxWidth: .infinity)
        .background(theme.cardRaised)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct ControlApprovalPanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    let approval: ControlApproval

    var body: some View {
        NativeGroupPanel(title: approval.title, subtitle: approval.detail) {
            Text(approval.command.isEmpty ? "No command configured." : approval.command)
                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                .foregroundStyle(theme.textSecondary)
                .textSelection(.enabled)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(theme.field)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            HStack(spacing: 10) {
                ActionButton(title: "Cancel", icon: "xmark") {
                    model.cancelPendingApproval()
                }
                if approval.kind != .blocked {
                    ActionButton(title: "Approve", icon: "checkmark", tone: .danger) {
                        model.approvePendingAction()
                    }
                }
            }
        }
    }
}

struct ControlRunHistoryPanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        NativeGroupPanel(title: "Run history", subtitle: "") {
            if model.runHistory.isEmpty {
                NativeEmptyState(title: "No runs yet", message: "Run a prompt or press an action button.")
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("\(model.runHistory.count) saved")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(theme.textTertiary)
                        Spacer()
                        Button("Clear") {
                            model.clearControlRunHistory()
                        }
                        .buttonStyle(.plain)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(theme.danger)
                    }
                    ForEach(model.runHistory.prefix(8)) { run in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: run.kind.icon)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(run.kind == .error ? theme.danger : theme.accent)
                                .frame(width: 28, height: 28)
                                .background(run.kind == .error ? theme.danger.opacity(0.12) : theme.accentSoft)
                                .clipShape(Circle())
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(run.title)
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundStyle(theme.text)
                                        .lineLimit(1)
                                    Spacer()
                                    Text(DateFormatter.localizedString(from: run.date, dateStyle: .none, timeStyle: .short))
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(theme.textTertiary)
                                }
                                Text(run.detail)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(theme.textSecondary)
                                    .lineLimit(2)
                                    .textSelection(.enabled)
                                HStack(spacing: 12) {
                                    Button("Reuse") {
                                        model.reuseControlRun(run)
                                    }
                                    .buttonStyle(.plain)
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(theme.accent)

                                    Button("Copy") {
                                        NSPasteboard.general.clearContents()
                                        NSPasteboard.general.setString(run.detail, forType: .string)
                                    }
                                    .buttonStyle(.plain)
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(theme.textTertiary)
                                }
                            }
                        }
                        .padding(10)
                        .background(theme.cardRaised)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
            }
        }
    }
}

struct MacWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        FeatureWorkspace(title: "This Mac", subtitle: model.status.message) {
            HStack(spacing: 12) {
                FeatureCard(title: "Host", value: model.status.hostname, icon: "desktopcomputer")
                FeatureCard(title: "Platform", value: model.status.platform, icon: "apple.logo")
                FeatureCard(title: "Uptime", value: "\(Int(model.status.uptimeSeconds / 60)) min", icon: "clock")
            }
            HStack(spacing: 10) {
                ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                    Task { await model.refreshLocalStatus() }
                }
                ActionButton(title: "Copy agent URL", icon: "link") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(model.settings.desktopAgentBaseURL, forType: .string)
                }
            }
            Text(model.status.cwd)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(theme.textSecondary)
                .textSelection(.enabled)
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(theme.card)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }
}

struct MailWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        FeatureWorkspace(title: "Mail", subtitle: model.mailOverview == nil ? "Inbox and accounts" : model.mailSummary) {
            MailNativePanel()
        }
    }
}

struct DocumentWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var confirmClear = false
    @State private var isDropTargeted = false

    var body: some View {
        FeatureWorkspace(title: "Documents", subtitle: model.documentStatus) {
            HStack(spacing: 10) {
                ActionButton(title: "Import pages", icon: "square.and.arrow.down") { model.importDocumentPages() }
                ActionButton(title: "Export PDF", icon: "doc.richtext") { model.exportDocumentPDF() }
                ActionButton(title: "Clear", icon: "trash", tone: .danger) { confirmClear = true }
                    .disabled(model.documentPages.isEmpty)
            }
            HStack(spacing: 12) {
                FeatureCard(title: "Pages", value: "\(model.documentPages.count)", icon: "doc.on.doc")
                FeatureCard(title: "Mode", value: "Import/reorder/export", icon: "arrow.up.arrow.down")
                FeatureCard(title: "Last export", value: model.exportedDocumentPath.isEmpty ? "None" : URL(fileURLWithPath: model.exportedDocumentPath).lastPathComponent, icon: "checkmark.seal")
            }
            if model.documentPages.isEmpty {
                NativeEmptyState(title: isDropTargeted ? "Drop to import" : "No pages", message: "Drop PDFs/images. Reorder, delete, export.")
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 12)], alignment: .leading, spacing: 12) {
                    ForEach(Array(model.documentPages.enumerated()), id: \.element.id) { index, page in
                        VStack(alignment: .leading, spacing: 10) {
                            Image(nsImage: page.image)
                                .resizable()
                                .scaledToFit()
                                .frame(height: 220)
                                .frame(maxWidth: .infinity)
                                .background(Color.black.opacity(0.18))
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            HStack {
                                Text("Page \(index + 1)")
                                    .font(.system(size: 12, weight: .black))
                                Spacer()
                                Text(page.title)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(theme.textTertiary)
                                    .lineLimit(1)
                            }
                            HStack(spacing: 8) {
                                Button("Up") { model.moveDocumentPage(page, direction: -1) }
                                    .disabled(index == 0)
                                Button("Down") { model.moveDocumentPage(page, direction: 1) }
                                    .disabled(index == model.documentPages.count - 1)
                                Button("Rotate") { model.rotateDocumentPage(page) }
                                Spacer()
                                Button("Delete") { model.removeDocumentPage(page) }
                                    .foregroundStyle(theme.danger)
                            }
                            .buttonStyle(.plain)
                            .font(.system(size: 11, weight: .bold))
                        }
                        .padding(12)
                        .background(theme.card)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .contextMenu {
                            Button("Reveal Source") {
                                model.revealDocumentPageSource(page)
                            }
                            .disabled(page.sourceURL == nil)
                            Button("Copy Title") {
                                model.copyDocumentPageTitle(page)
                            }
                            Divider()
                            Button("Move Up") {
                                model.moveDocumentPage(page, direction: -1)
                            }
                            .disabled(index == 0)
                            Button("Move Down") {
                                model.moveDocumentPage(page, direction: 1)
                            }
                            .disabled(index == model.documentPages.count - 1)
                            Button("Rotate") {
                                model.rotateDocumentPage(page)
                            }
                            Divider()
                            Button("Delete", role: .destructive) {
                                model.removeDocumentPage(page)
                            }
                        }
                    }
                }
            }
        }
        .onDrop(of: [UTType.fileURL.identifier], isTargeted: $isDropTargeted) { providers in
            model.importDocumentProviders(providers)
        }
        .alert("Clear document bundle?", isPresented: $confirmClear) {
            Button("Clear", role: .destructive) { model.clearDocumentPages() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes \(model.documentPages.count) imported page\(model.documentPages.count == 1 ? "" : "s") from the local bundle. Original files are not deleted.")
        }
    }
}

struct ImageReviewWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var confirmTrash = false
    @State private var isDropTargeted = false

    private var discardCount: Int { model.imageReviewDecisions.values.filter { $0 == .discard }.count }
    private var remaining: Int { max(model.imageReviewItems.count - model.imageReviewIndex, 0) }

    var body: some View {
        FeatureWorkspace(title: "Images", subtitle: model.imageReviewStatus) {
            HStack(spacing: 10) {
                ActionButton(title: "Import images", icon: "photo.stack") { model.importImagesForReview() }
                ActionButton(title: "Undo", icon: "arrow.uturn.backward") { model.undoImageDecision() }
                ActionButton(title: "Restart", icon: "arrow.counterclockwise") { model.restartImageReview() }
                ActionButton(title: "Trash marked (\(discardCount))", icon: "trash", tone: .danger) { confirmTrash = true }
                    .disabled(discardCount == 0)
            }
            HStack(spacing: 12) {
                FeatureCard(title: "Remaining", value: "\(remaining)", icon: "rectangle.stack")
                FeatureCard(title: "Keep", value: "\(model.imageReviewDecisions.values.filter { $0 == .keep }.count)", icon: "checkmark.circle")
                FeatureCard(title: "Discard later", value: "\(discardCount)", icon: "trash")
            }
            if let current = model.currentImageReviewItem {
                NativeGroupPanel(title: current.title, subtitle: current.sizeLabel) {
                    Image(nsImage: current.image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 520)
                        .frame(maxWidth: .infinity)
                        .background(Color.black.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .contextMenu {
                            Button("Keep") {
                                model.decideCurrentImage(.keep)
                            }
                            Button("Discard Later") {
                                model.decideCurrentImage(.discard)
                            }
                            Button("Undo Last Decision") {
                                model.undoImageDecision()
                            }
                            Divider()
                            Button("Reveal in Finder") {
                                model.revealCurrentImage()
                            }
                            Button("Copy Path") {
                                model.copyCurrentImagePath()
                            }
                        }
                    HStack(spacing: 10) {
                        ActionButton(title: "Discard later", icon: "xmark.circle", tone: .danger) { model.decideCurrentImage(.discard) }
                        ActionButton(title: "Keep", icon: "checkmark.circle") { model.decideCurrentImage(.keep) }
                        Spacer()
                        ActionButton(title: "Reveal", icon: "folder") {
                            NSWorkspace.shared.activateFileViewerSelecting([current.url])
                        }
                    }
                }
            } else {
                NativeEmptyState(title: model.imageReviewItems.isEmpty ? (isDropTargeted ? "Drop to import" : "No images") : "Batch sorted", message: model.imageReviewItems.isEmpty ? "Drop images. Mark keep/discard; trash only when done." : "Review complete. Undo or trash marked files.")
            }
        }
        .onDrop(of: [UTType.fileURL.identifier], isTargeted: $isDropTargeted) { providers in
            model.importImageProviders(providers)
        }
        .alert("Move marked images to Trash?", isPresented: $confirmTrash) {
            Button("Move to Trash", role: .destructive) { model.trashDiscardedImages() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("\(discardCount) image\(discardCount == 1 ? "" : "s") will be moved to the macOS Trash.")
        }
    }
}

struct BrowserAgentElement: Identifiable, Decodable {
    let id: Int
    let role: String
    let label: String
    let selector: String
    let x: Double
    let y: Double
}

struct BrowserDestination: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let icon: String
    let url: String
}

struct BrowserOpenRequest: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let url: String
}

struct BrowserChatCommand {
    enum Kind {
        case open
        case popOut
        case popOutCurrent
    }

    let kind: Kind
    let target: String

    static func parse(_ rawPrompt: String) -> BrowserChatCommand? {
        let prompt = rawPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = prompt.lowercased()

        if ["pop out browser", "popout browser", "pop out current browser", "popout current browser"].contains(lower) {
            return BrowserChatCommand(kind: .popOutCurrent, target: "")
        }

        for prefix in ["pop out ", "popout "] where lower.hasPrefix(prefix) {
            let target = String(prompt.dropFirst(prefix.count)).cleanBrowserTargetSuffix()
            guard !target.isEmpty else { return BrowserChatCommand(kind: .popOutCurrent, target: "") }
            return BrowserChatCommand(kind: .popOut, target: target)
        }

        for prefix in ["open ", "go to ", "browse ", "show "] where lower.hasPrefix(prefix) {
            let target = String(prompt.dropFirst(prefix.count)).cleanBrowserTargetSuffix()
            guard !target.isEmpty else { return nil }
            if target.lowercased().contains(" pop out") || target.lowercased().contains(" popout") {
                return BrowserChatCommand(kind: .popOut, target: target.replacingOccurrences(of: " pop out", with: "", options: .caseInsensitive).replacingOccurrences(of: " popout", with: "", options: .caseInsensitive))
            }
            return BrowserChatCommand(kind: .open, target: target)
        }

        return nil
    }
}

enum BrowserTargetResolver {
    static func resolve(_ rawTarget: String) -> (url: String, title: String) {
        let target = rawTarget.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = target.lowercased()
        let shortcuts = [
            "vg": ("https://www.vg.no", "VG"),
            "vg.no": ("https://www.vg.no", "VG"),
            "nrk": ("https://www.nrk.no", "NRK"),
            "nrk.no": ("https://www.nrk.no", "NRK"),
            "db": ("https://www.dagbladet.no", "Dagbladet"),
            "dagbladet": ("https://www.dagbladet.no", "Dagbladet"),
            "google": ("https://www.google.com", "Google"),
            "github": ("https://github.com", "GitHub"),
            "youtube": ("https://www.youtube.com", "YouTube"),
            "hanasand": ("https://hanasand.com", "Hanasand")
        ]
        if let shortcut = shortcuts[lower] {
            return shortcut
        }

        if let url = URL(string: target), url.scheme != nil {
            return (url.absoluteString, title(from: url, fallback: target))
        }

        if target.contains("."),
           let url = URL(string: "https://\(target)") {
            return (url.absoluteString, title(from: url, fallback: target))
        }

        var components = URLComponents(string: "https://duckduckgo.com/")
        components?.queryItems = [URLQueryItem(name: "q", value: target)]
        let url = components?.url?.absoluteString ?? "https://duckduckgo.com"
        return (url, target.isEmpty ? "Search" : target.capitalized)
    }

    private static func title(from url: URL, fallback: String) -> String {
        let host = url.host?.replacingOccurrences(of: "www.", with: "") ?? fallback
        return host.split(separator: ".").first.map { String($0).capitalized } ?? fallback
    }
}

extension String {
    fileprivate func cleanBrowserTargetSuffix() -> String {
        trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: " in the built in browser", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: " in the built-in browser", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: " in browser", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: " in the browser", with: "", options: .caseInsensitive)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

@MainActor
final class BrowserTabState: NSObject, ObservableObject, WKNavigationDelegate, Identifiable {
    let id = UUID()
    @Published var label: String
    @Published var address = ""
    @Published var title: String
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var isLoading = false
    @Published var progress = 0.0
    @Published var statusText = "Ready"
    @Published var agentSelector = ""
    @Published var agentText = ""
    @Published var agentX = "120"
    @Published var agentY = "120"
    @Published var agentStatus = "Agent controls ready"
    @Published var agentElements: [BrowserAgentElement] = []

    let webView: WKWebView
    private var progressObservation: NSKeyValueObservation?
    private var urlObservation: NSKeyValueObservation?

    init(label: String, url: String) {
        self.label = label
        self.title = label

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true

        super.init()

        webView.navigationDelegate = self
        progressObservation = webView.observe(\.estimatedProgress, options: [.initial, .new]) { [weak self] view, _ in
            Task { @MainActor in
                self?.progress = view.estimatedProgress
            }
        }
        urlObservation = webView.observe(\.url, options: [.new]) { [weak self] view, _ in
            Task { @MainActor in
                if let url = view.url {
                    self?.address = url.absoluteString
                }
            }
        }
        load(url)
    }

    func load(_ rawValue: String) {
        guard let url = normalizedURL(from: rawValue) else {
            statusText = "Enter a valid address"
            return
        }

        address = url.absoluteString
        statusText = "Loading \(url.host ?? url.absoluteString)"
        webView.load(URLRequest(url: url))
    }

    func goBack() {
        if webView.canGoBack {
            webView.goBack()
        }
    }

    func goForward() {
        if webView.canGoForward {
            webView.goForward()
        }
    }

    func reloadOrStop() {
        if webView.isLoading {
            webView.stopLoading()
        } else {
            webView.reload()
        }
    }

    func refreshAgentElements() {
        let script = """
        (() => {
          const visible = (el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          };
          const cssPath = (el) => {
            if (el.id) return '#' + CSS.escape(el.id);
            const parts = [];
            while (el && el.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
              let part = el.nodeName.toLowerCase();
              if (el.classList.length) part += '.' + [...el.classList].slice(0, 2).map(CSS.escape).join('.');
              const parent = el.parentElement;
              if (parent) {
                const same = [...parent.children].filter(child => child.nodeName === el.nodeName);
                if (same.length > 1) part += `:nth-of-type(${same.indexOf(el) + 1})`;
              }
              parts.unshift(part);
              el = parent;
            }
            return parts.join(' > ');
          };
          const roleFor = (el) => {
            const tag = el.tagName.toLowerCase();
            return el.getAttribute('role') || (tag === 'a' ? 'link' : tag);
          };
          const labelFor = (el) => {
            return (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.title || el.href || roleFor(el))
              .replace(/\\s+/g, ' ')
              .trim()
              .slice(0, 90);
          };
          const nodes = [...document.querySelectorAll('button,a,input,textarea,select,[role="button"],[onclick]')]
            .filter(visible)
            .slice(0, 48);
          return JSON.stringify(nodes.map((el, index) => {
            const rect = el.getBoundingClientRect();
            return {
              id: index,
              role: roleFor(el),
              label: labelFor(el),
              selector: cssPath(el),
              x: Math.round(rect.left + rect.width / 2),
              y: Math.round(rect.top + rect.height / 2)
            };
          }));
        })();
        """
        evaluateAgentScript("Inspecting controls", script: script) { [weak self] result in
            guard let self else { return }
            if let json = result as? String,
               let data = json.data(using: .utf8),
               let elements = try? JSONDecoder().decode([BrowserAgentElement].self, from: data) {
                agentElements = elements
                agentStatus = "Found \(elements.count) visible controls"
            } else {
                agentStatus = "Could not inspect this page"
            }
        }
    }

    func clickAgentSelector(_ selector: String? = nil) {
        let target = selector ?? agentSelector
        guard !target.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            agentStatus = "Add a selector or inspect page controls first"
            return
        }

        let selectorValue = javaScriptString(target)
        let script = """
        (() => {
          const el = document.querySelector(\(selectorValue));
          if (!el) return 'No element matched \(selectorValue)';
          el.scrollIntoView({ block: 'center', inline: 'center' });
          const rect = el.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          for (const type of ['pointerover','mouseover','pointermove','mousemove','pointerdown','mousedown','pointerup','mouseup','click']) {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
          }
          if (typeof el.click === 'function') el.click();
          return 'Clicked ' + \(selectorValue);
        })();
        """
        evaluateAgentScript("Clicking", script: script)
    }

    func focusAgentSelector() {
        let selectorValue = javaScriptString(agentSelector)
        let script = """
        (() => {
          const el = document.querySelector(\(selectorValue));
          if (!el) return 'No element matched \(selectorValue)';
          el.scrollIntoView({ block: 'center', inline: 'center' });
          el.focus();
          return 'Focused ' + \(selectorValue);
        })();
        """
        evaluateAgentScript("Focusing", script: script)
    }

    func typeAgentText() {
        let selectorValue = javaScriptString(agentSelector)
        let textValue = javaScriptString(agentText)
        let script = """
        (() => {
          const el = document.querySelector(\(selectorValue)) || document.activeElement;
          if (!el) return 'No input is focused';
          el.focus();
          const value = \(textValue);
          if ('value' in el) {
            el.value = value;
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            el.textContent = value;
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
          }
          return 'Typed ' + value.length + ' characters';
        })();
        """
        evaluateAgentScript("Typing", script: script)
    }

    func pressAgentKey(_ key: String) {
        let keyValue = javaScriptString(key)
        let script = """
        (() => {
          const el = document.activeElement || document.body;
          for (const type of ['keydown','keyup']) {
            el.dispatchEvent(new KeyboardEvent(type, { key: \(keyValue), bubbles: true, cancelable: true }));
          }
          if (\(keyValue) === 'Enter' && el.form) el.form.requestSubmit();
          return 'Pressed ' + \(keyValue);
        })();
        """
        evaluateAgentScript("Pressing key", script: script)
    }

    func scrollAgentPage(deltaY: Int) {
        let script = "window.scrollBy({ top: \(deltaY), behavior: 'smooth' }); 'Scrolled \(deltaY > 0 ? "down" : "up")';"
        evaluateAgentScript("Scrolling", script: script)
    }

    func clickAgentPoint() {
        let x = Int(agentX) ?? 0
        let y = Int(agentY) ?? 0
        let script = """
        (() => {
          const el = document.elementFromPoint(\(x), \(y));
          if (!el) return 'No element at \(x),\(y)';
          for (const type of ['pointermove','mousemove','pointerdown','mousedown','pointerup','mouseup','click']) {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: \(x), clientY: \(y) }));
          }
          if (typeof el.click === 'function') el.click();
          return 'Clicked ' + el.tagName.toLowerCase() + ' at \(x),\(y)';
        })();
        """
        evaluateAgentScript("Clicking point", script: script)
    }

    private func evaluateAgentScript(_ pendingStatus: String, script: String, completion: ((Any?) -> Void)? = nil) {
        agentStatus = pendingStatus
        webView.evaluateJavaScript(script) { [weak self] result, error in
            Task { @MainActor in
                if let error {
                    self?.agentStatus = error.localizedDescription
                    completion?(nil)
                    return
                }
                if let message = result as? String, !message.isEmpty {
                    self?.agentStatus = message
                } else {
                    self?.agentStatus = "Action complete"
                }
                completion?(result)
            }
        }
    }

    private func javaScriptString(_ value: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: value),
              let encoded = String(data: data, encoding: .utf8) else {
            return "''"
        }
        return encoded
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        updateNavigationState(webView)
        isLoading = true
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        updateNavigationState(webView)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        updateNavigationState(webView)
        isLoading = false
        progress = 1
        title = webView.title?.isEmpty == false ? webView.title! : label
        if title != label && webView.url?.host?.contains("hanasand") == true {
            label = title
        }
        statusText = webView.url?.host ?? "Ready"
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        updateNavigationState(webView)
        isLoading = false
        statusText = error.localizedDescription
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        updateNavigationState(webView)
        isLoading = false
        statusText = error.localizedDescription
    }

    private func updateNavigationState(_ webView: WKWebView) {
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
        if let url = webView.url {
            address = url.absoluteString
        }
    }

    private func normalizedURL(from value: String) -> URL? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        if let url = URL(string: trimmed), url.scheme != nil {
            return url
        }

        if trimmed.contains("."),
           let url = URL(string: "https://\(trimmed)") {
            return url
        }

        var components = URLComponents(string: "https://duckduckgo.com/")
        components?.queryItems = [URLQueryItem(name: "q", value: trimmed)]
        return components?.url
    }
}

struct BrowserTabGroup: Identifiable {
    let id: String
    let title: String
    let icon: String
    var tabs: [BrowserTabState]
    let destinations: [BrowserDestination]
    var isCustom = false
}

@MainActor
final class BrowserWorkspaceModel: ObservableObject {
    @Published var groups: [BrowserTabGroup] = []
    @Published var selectedGroupID = "operations"
    @Published var selectedTabID: UUID?

    var selectedTab: BrowserTabState? {
        guard let group = selectedGroup else { return nil }
        return group.tabs.first { $0.id == selectedTabID } ?? group.tabs.first
    }

    var selectedGroup: BrowserTabGroup? {
        groups.first { $0.id == selectedGroupID } ?? groups.first
    }

    func configure(settings: HanasandDesktopSettings) {
        guard groups.isEmpty else { return }

        let base = settings.websiteBaseURL.normalizedBaseURL
        let operations = BrowserTabGroup(
            id: "operations",
            title: "Operations",
            icon: "gauge.with.dots.needle",
            tabs: [
                BrowserTabState(label: "Dashboard", url: base.appendingPathComponent("dashboard").absoluteString),
                BrowserTabState(label: "System", url: base.appendingPathComponent("dashboard/system").absoluteString),
            ],
            destinations: [
                BrowserDestination(title: "Dashboard", subtitle: "Overview", icon: "square.grid.2x2", url: base.appendingPathComponent("dashboard").absoluteString),
                BrowserDestination(title: "Logs", subtitle: "Runtime", icon: "doc.text.magnifyingglass", url: base.appendingPathComponent("dashboard/logs").absoluteString),
                BrowserDestination(title: "Database", subtitle: "Storage", icon: "externaldrive.connected.to.line.below", url: base.appendingPathComponent("dashboard/db").absoluteString),
                BrowserDestination(title: "VMs", subtitle: "Machines", icon: "display.2", url: base.appendingPathComponent("dashboard/vms").absoluteString),
            ]
        )
        let communication = BrowserTabGroup(
            id: "communication",
            title: "Communication",
            icon: "bubble.left.and.bubble.right",
            tabs: [
                BrowserTabState(label: "Mail", url: "https://mail.hanasand.com"),
                BrowserTabState(label: "Notes", url: base.appendingPathComponent("dashboard/notes").absoluteString),
            ],
            destinations: [
                BrowserDestination(title: "Mail", subtitle: "Inbox", icon: "envelope", url: "https://mail.hanasand.com"),
                BrowserDestination(title: "Notes", subtitle: "Shared memory", icon: "note.text", url: base.appendingPathComponent("dashboard/notes").absoluteString),
                BrowserDestination(title: "Articles", subtitle: "Writing", icon: "text.alignleft", url: base.appendingPathComponent("dashboard/articles").absoluteString),
                BrowserDestination(title: "Thoughts", subtitle: "Ideas", icon: "brain.head.profile", url: base.appendingPathComponent("dashboard/thoughts").absoluteString),
            ]
        )
        let research = BrowserTabGroup(
            id: "research",
            title: "Research",
            icon: "magnifyingglass.circle",
            tabs: [
                BrowserTabState(label: "Hanasand", url: settings.websiteBaseURL),
            ],
            destinations: [
                BrowserDestination(title: "Hanasand", subtitle: "Public site", icon: "house", url: settings.websiteBaseURL),
                BrowserDestination(title: "GitHub", subtitle: "Code", icon: "chevron.left.forwardslash.chevron.right", url: "https://github.com/eirikhanasand"),
                BrowserDestination(title: "DuckDuckGo", subtitle: "Search", icon: "magnifyingglass", url: "https://duckduckgo.com"),
            ]
        )

        groups = [operations, communication, research]
        selectedGroupID = operations.id
        selectedTabID = operations.tabs.first?.id
    }

    func selectGroup(_ id: String) {
        selectedGroupID = id
        selectedTabID = selectedGroup?.tabs.first?.id
    }

    func selectTab(_ id: UUID) {
        selectedTabID = id
    }

    func createGroup() {
        let nextNumber = groups.count + 1
        let tab = BrowserTabState(label: "New tab", url: "https://duckduckgo.com")
        let group = BrowserTabGroup(
            id: UUID().uuidString,
            title: "Group \(nextNumber)",
            icon: "rectangle.stack.badge.plus",
            tabs: [tab],
            destinations: [],
            isCustom: true
        )
        groups.append(group)
        selectedGroupID = group.id
        selectedTabID = tab.id
    }

    func removeSelectedGroup() {
        guard groups.count > 1,
              let removeIndex = groups.firstIndex(where: { $0.id == selectedGroupID }) else { return }
        let removedTabs = groups[removeIndex].tabs
        groups.remove(at: removeIndex)
        let targetIndex = groups.indices.first ?? 0
        groups[targetIndex].tabs.append(contentsOf: removedTabs)
        selectedGroupID = groups[targetIndex].id
        selectedTabID = groups[targetIndex].tabs.first?.id
    }

    func open(_ destination: BrowserDestination) {
        open(label: destination.title, url: destination.url)
    }

    func open(label: String = "New", url: String) {
        guard let groupIndex = groups.firstIndex(where: { $0.id == selectedGroupID }) else { return }
        let tab = BrowserTabState(label: label, url: url)
        groups[groupIndex].tabs.append(tab)
        selectedTabID = tab.id
    }

    func open(_ request: BrowserOpenRequest) {
        if let researchIndex = groups.firstIndex(where: { $0.id == "research" }) {
            selectedGroupID = groups[researchIndex].id
        }
        open(label: request.title, url: request.url)
    }

    func close(_ tab: BrowserTabState) {
        guard let groupIndex = groups.firstIndex(where: { $0.id == selectedGroupID }) else { return }
        guard groups[groupIndex].tabs.count > 1 else { return }
        groups[groupIndex].tabs.removeAll { $0.id == tab.id }
        if selectedTabID == tab.id {
            selectedTabID = groups[groupIndex].tabs.last?.id
        }
    }

    func move(_ tab: BrowserTabState, to groupID: String) {
        guard groupID != selectedGroupID,
              let sourceIndex = groups.firstIndex(where: { $0.id == selectedGroupID }),
              let targetIndex = groups.firstIndex(where: { $0.id == groupID }),
              let tabIndex = groups[sourceIndex].tabs.firstIndex(where: { $0.id == tab.id }) else { return }
        let moved = groups[sourceIndex].tabs.remove(at: tabIndex)
        groups[targetIndex].tabs.append(moved)
        selectedGroupID = groupID
        selectedTabID = moved.id
        if groups[sourceIndex].tabs.isEmpty {
            groups[sourceIndex].tabs.append(BrowserTabState(label: "New tab", url: "https://duckduckgo.com"))
        }
    }
}

struct QueuedPromptDropDelegate: DropDelegate {
    let target: QueuedPrompt
    @ObservedObject var model: DesktopAgentModel
    @Binding var draggingID: UUID?

    func dropEntered(info: DropInfo) {
        guard let draggingID,
              let dragging = model.promptQueue.first(where: { $0.id == draggingID }),
              dragging.id != target.id else { return }
        withAnimation(.snappy(duration: 0.14)) {
            model.moveQueuedPrompt(dragging, before: target)
        }
    }

    func performDrop(info: DropInfo) -> Bool {
        draggingID = nil
        return true
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: .move)
    }
}

struct BrowserWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @StateObject private var workspace = BrowserWorkspaceModel()
    @FocusState private var addressFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            TopBar()
            HStack(spacing: 0) {
                browserWorkspaceRail
                    .frame(width: 250)
                Rectangle()
                    .fill(theme.divider)
                    .frame(width: 1)
                VStack(spacing: 0) {
                    destinationStrip
                    tabStrip
                    if let tab = workspace.selectedTab {
                        browserToolbar(tab)
                        agentControlPanel(tab)
                        ZStack(alignment: .top) {
                            NativeBrowserView(tab: tab)
                                .background(theme.background)
                            if tab.isLoading {
                                ProgressView(value: tab.progress)
                                    .progressViewStyle(.linear)
                                    .tint(theme.accent)
                                    .frame(height: 2)
                            }
                        }
                        browserStatusBar(tab)
                    } else {
                        ContentUnavailableView("No workspace selected", systemImage: "rectangle.on.rectangle")
                    }
                }
            }
            .background(theme.background)
        }
        .background(theme.background)
        .onAppear {
            workspace.configure(settings: model.settings)
            consumeBrowserOpenRequest()
        }
        .onChange(of: model.browserOpenRequest?.id) { _, _ in
            consumeBrowserOpenRequest()
        }
        .onChange(of: workspace.selectedTab?.address ?? "") { _, address in
            guard !address.isEmpty else { return }
            model.browserActiveAddress = address
            model.browserActiveTitle = workspace.selectedTab?.title ?? model.browserActiveTitle
        }
    }

    private var browserWorkspaceRail: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text("Workspaces")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                Spacer()
                BrowserIconButton(systemName: "plus") {
                    workspace.createGroup()
                }
                .help("Create tab group")
                BrowserIconButton(systemName: "minus", disabled: workspace.groups.count <= 1) {
                    workspace.removeSelectedGroup()
                }
                .help("Remove selected group")
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            ForEach(workspace.groups) { group in
                Button {
                    workspace.selectGroup(group.id)
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: group.icon)
                            .frame(width: 18)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(group.title)
                                .font(.system(size: 14, weight: .bold))
                            Text("\(group.tabs.count) tabs")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(theme.textTertiary)
                        }
                        Spacer()
                    }
                    .foregroundStyle(workspace.selectedGroupID == group.id ? theme.text : theme.textSecondary)
                    .padding(.horizontal, 12)
                    .frame(height: 48)
                    .background(workspace.selectedGroupID == group.id ? theme.sidebarSelected : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(.horizontal, 8)
        .background(theme.sidebar.opacity(0.72))
    }

    private var destinationStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(workspace.selectedGroup?.destinations ?? []) { destination in
                    Button {
                        workspace.open(destination)
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: destination.icon)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(destination.title)
                                    .font(.system(size: 12, weight: .bold))
                                Text(destination.subtitle)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(theme.textTertiary)
                            }
                        }
                        .foregroundStyle(theme.text)
                        .padding(.horizontal, 12)
                        .frame(height: 42)
                        .background(theme.card)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
        .background(theme.backgroundElevated)
    }

    private var tabStrip: some View {
        HStack(spacing: 8) {
            ForEach(workspace.selectedGroup?.tabs ?? []) { tab in
                BrowserTabButton(tab: tab, selected: workspace.selectedTabID == tab.id) {
                    workspace.selectTab(tab.id)
                } close: {
                    workspace.close(tab)
                } moveTargets: {
                    workspace.groups.filter { $0.id != workspace.selectedGroupID }
                } move: { groupID in
                    workspace.move(tab, to: groupID)
                }
            }
            Button {
                workspace.open(url: model.settings.websiteBaseURL)
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 12, weight: .bold))
                    .frame(width: 28, height: 28)
                    .background(theme.cardRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(.plain)
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.bottom, 8)
        .background(theme.backgroundElevated)
    }

    private func browserToolbar(_ browser: BrowserTabState) -> some View {
        HStack(spacing: 10) {
            BrowserIconButton(systemName: "chevron.left", disabled: !browser.canGoBack) {
                browser.goBack()
            }
            BrowserIconButton(systemName: "chevron.right", disabled: !browser.canGoForward) {
                browser.goForward()
            }
            BrowserIconButton(systemName: browser.isLoading ? "xmark" : "arrow.clockwise") {
                browser.reloadOrStop()
            }
            BrowserAddressField(
                address: Binding(
                    get: { browser.address },
                    set: { browser.address = $0 }
                ),
                isFocused: $addressFocused
            ) {
                browser.load(browser.address)
            }
            BrowserIconButton(systemName: "house") {
                browser.load(model.settings.websiteBaseURL)
            }
            BrowserIconButton(systemName: "arrow.up.forward.square") {
                if let url = browser.webView.url {
                    NSWorkspace.shared.open(url)
                }
            }
            BrowserIconButton(systemName: "rectangle.inset.filled.and.person.filled") {
                model.openMiniBrowser(url: browser.address, title: browser.title, minified: false)
            }
            .help("Pop out floating browser")
            BrowserIconButton(systemName: "minus") {
                model.openMiniBrowser(url: browser.address, title: browser.title, minified: true)
            }
            .help("Open minified overlay")
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .background(theme.commandBar)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    private func consumeBrowserOpenRequest() {
        workspace.configure(settings: model.settings)
        guard let request = model.browserOpenRequest else { return }
        workspace.open(request)
        model.browserActiveAddress = request.url
        model.browserActiveTitle = request.title
        model.browserOpenRequest = nil
    }

    private func agentControlPanel(_ browser: BrowserTabState) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Label("Agent controls", systemImage: "cursorarrow.motionlines")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.text)
                Text(browser.agentStatus)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
                    .lineLimit(1)
                Spacer()
                BrowserAgentButton(title: "Inspect", icon: "scope") {
                    browser.refreshAgentElements()
                }
                BrowserAgentButton(title: "Click", icon: "cursorarrow.click") {
                    browser.clickAgentSelector()
                }
                BrowserAgentButton(title: "Focus", icon: "selection.pin.in.out") {
                    browser.focusAgentSelector()
                }
                BrowserAgentButton(title: "Type", icon: "keyboard") {
                    browser.typeAgentText()
                }
                BrowserAgentButton(title: "Enter", icon: "return") {
                    browser.pressAgentKey("Enter")
                }
                BrowserAgentButton(title: "Esc", icon: "escape") {
                    browser.pressAgentKey("Escape")
                }
            }

            HStack(spacing: 8) {
                BrowserAgentField(
                    title: "Selector",
                    text: Binding(get: { browser.agentSelector }, set: { browser.agentSelector = $0 }),
                    placeholder: "#login, button[type=submit], .save"
                )
                BrowserAgentField(
                    title: "Text",
                    text: Binding(get: { browser.agentText }, set: { browser.agentText = $0 }),
                    placeholder: "Text to type"
                )
                BrowserAgentField(
                    title: "X",
                    text: Binding(get: { browser.agentX }, set: { browser.agentX = $0 }),
                    placeholder: "120",
                    width: 72
                )
                BrowserAgentField(
                    title: "Y",
                    text: Binding(get: { browser.agentY }, set: { browser.agentY = $0 }),
                    placeholder: "120",
                    width: 72
                )
                BrowserAgentButton(title: "Point", icon: "target") {
                    browser.clickAgentPoint()
                }
                BrowserAgentButton(title: "Up", icon: "arrow.up") {
                    browser.scrollAgentPage(deltaY: -520)
                }
                BrowserAgentButton(title: "Down", icon: "arrow.down") {
                    browser.scrollAgentPage(deltaY: 520)
                }
            }

            if !browser.agentElements.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(browser.agentElements) { element in
                            Button {
                                browser.agentSelector = element.selector
                                browser.agentX = String(Int(element.x))
                                browser.agentY = String(Int(element.y))
                                browser.clickAgentSelector(element.selector)
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(element.label.isEmpty ? element.role : element.label)
                                        .font(.system(size: 11, weight: .bold))
                                        .lineLimit(1)
                                    Text("\(element.role)  \(Int(element.x)),\(Int(element.y))")
                                        .font(.system(size: 10, weight: .semibold))
                                        .foregroundStyle(theme.textTertiary)
                                        .lineLimit(1)
                                }
                                .foregroundStyle(theme.text)
                                .padding(.horizontal, 10)
                                .frame(width: 150, height: 42, alignment: .leading)
                                .background(theme.card)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .help(element.selector)
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(theme.backgroundElevated.opacity(0.96))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    private func browserStatusBar(_ browser: BrowserTabState) -> some View {
        HStack(spacing: 8) {
            Image(systemName: browser.webView.url?.scheme == "https" ? "lock.fill" : "globe")
                .font(.system(size: 11, weight: .bold))
            Text(browser.title)
                .lineLimit(1)
            Spacer()
            Text(browser.statusText)
                .lineLimit(1)
        }
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(theme.textTertiary)
        .padding(.horizontal, 18)
        .frame(height: 28)
        .background(theme.commandBar.opacity(0.72))
    }
}

struct NativeBrowserView: NSViewRepresentable {
    @ObservedObject var tab: BrowserTabState

    func makeNSView(context: Context) -> WKWebView {
        tab.webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}
}

enum MiniBrowserCorner: String, CaseIterable, Identifiable {
    case topLeft
    case topRight
    case bottomLeft
    case bottomRight

    var id: String { rawValue }

    var title: String {
        switch self {
        case .topLeft: return "TL"
        case .topRight: return "TR"
        case .bottomLeft: return "BL"
        case .bottomRight: return "BR"
        }
    }
}

@MainActor
final class MiniBrowserState: ObservableObject {
    let id = UUID()
    @Published var tab: BrowserTabState
    @Published var corner: MiniBrowserCorner = .topRight
    @Published var opacity = 0.92
    @Published var isMinified = false
    var snapToCorner: ((MiniBrowserCorner) -> Void)?
    var cloneWindow: (() -> Void)?
    var toggleFullScreen: (() -> Void)?

    init(title: String, url: String, minified: Bool) {
        tab = BrowserTabState(label: title, url: url)
        isMinified = minified
    }

    func currentURLString() -> String {
        tab.webView.url?.absoluteString ?? tab.address
    }
}

@MainActor
final class MiniBrowserWindowController {
    static let shared = MiniBrowserWindowController()

    private final class WindowRecord {
        let state: MiniBrowserState
        let window: NSWindow
        let delegate: MiniBrowserWindowDelegate
        var cancellables: Set<AnyCancellable> = []

        init(state: MiniBrowserState, window: NSWindow, delegate: MiniBrowserWindowDelegate) {
            self.state = state
            self.window = window
            self.delegate = delegate
        }
    }

    private final class MiniBrowserWindowDelegate: NSObject, NSWindowDelegate {
        var onMove: ((NSWindow) -> Void)?
        var onClose: (() -> Void)?

        func windowDidMove(_ notification: Notification) {
            guard let window = notification.object as? NSWindow else { return }
            onMove?(window)
        }

        func windowWillClose(_ notification: Notification) {
            onClose?()
        }
    }

    private var windows: [UUID: WindowRecord] = [:]
    private var positioningWindowIDs = Set<UUID>()

    func open(url: String, title: String, minified: Bool) {
        let nextState = MiniBrowserState(title: title, url: url, minified: minified)
        let content = MiniBrowserFloatingView(state: nextState)
        let hosting = NSHostingView(rootView: content)
        let nextWindow = NSPanel(
            contentRect: NSRect(origin: .zero, size: size(for: nextState)),
            styleMask: styleMask(for: nextState),
            backing: .buffered,
            defer: false
        )
        nextWindow.contentView = hosting
        nextWindow.backgroundColor = .clear
        nextWindow.isOpaque = false
        nextWindow.hasShadow = true
        nextWindow.level = .floating
        nextWindow.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .fullScreenPrimary]
        nextWindow.isMovableByWindowBackground = true
        nextWindow.titlebarAppearsTransparent = true
        nextWindow.titleVisibility = .hidden
        nextWindow.hidesOnDeactivate = false
        nextWindow.becomesKeyOnlyIfNeeded = true
        nextWindow.minSize = NSSize(width: 92, height: 58)
        nextWindow.title = "Hanasand Mini Browser"

        let delegate = MiniBrowserWindowDelegate()
        let record = WindowRecord(state: nextState, window: nextWindow, delegate: delegate)
        windows[nextState.id] = record
        nextWindow.delegate = delegate

        nextState.snapToCorner = { [weak self, weak nextState] corner in
            guard let self, let nextState, let record = self.windows[nextState.id] else { return }
            nextState.corner = corner
            self.position(window: record.window, state: nextState)
        }
        nextState.cloneWindow = { [weak self, weak nextState] in
            guard let self, let nextState else { return }
            self.open(url: nextState.currentURLString(), title: nextState.tab.title, minified: nextState.isMinified)
        }
        nextState.toggleFullScreen = { [weak self, weak nextState] in
            guard let self, let nextState, let record = self.windows[nextState.id] else { return }
            record.window.toggleFullScreen(nil)
        }

        delegate.onMove = { [weak self, weak nextState] window in
            guard let self, let nextState, !self.positioningWindowIDs.contains(nextState.id) else { return }
            nextState.corner = self.nearestCorner(to: window.frame)
        }
        delegate.onClose = { [weak self, weak nextState] in
            guard let self, let nextState else { return }
            self.windows[nextState.id] = nil
        }

        nextState.$isMinified
            .sink { [weak self, weak nextState] _ in
                guard let self, let nextState, let record = self.windows[nextState.id] else { return }
                self.render(window: record.window, state: nextState)
                self.resizeInPlace(window: record.window, state: nextState)
            }
            .store(in: &record.cancellables)
        nextState.$opacity
            .sink { [weak nextState, weak self] opacity in
                guard let nextState, let window = self?.windows[nextState.id]?.window else { return }
                window.alphaValue = CGFloat(max(0.1, min(1, opacity)))
            }
            .store(in: &record.cancellables)

        position(window: nextWindow, state: nextState)
        nextWindow.orderFrontRegardless()
        if !nextState.isMinified {
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    private func size(for state: MiniBrowserState) -> NSSize {
        state.isMinified ? NSSize(width: 92, height: 58) : NSSize(width: 560, height: 390)
    }

    private func styleMask(for state: MiniBrowserState) -> NSWindow.StyleMask {
        var mask: NSWindow.StyleMask = [.titled, .closable, .resizable, .fullSizeContentView]
        if state.isMinified {
            mask.insert(.nonactivatingPanel)
        }
        return mask
    }

    private func render(window: NSWindow, state: MiniBrowserState) {
        window.styleMask = styleMask(for: state)
        window.contentView = NSHostingView(rootView: MiniBrowserFloatingView(state: state))
    }

    private func resizeInPlace(window: NSWindow, state: MiniBrowserState) {
        let size = size(for: state)
        let frame = window.frame
        let nextOrigin = NSPoint(x: frame.minX, y: frame.maxY - size.height)
        window.setFrame(NSRect(origin: nextOrigin, size: size), display: true, animate: true)
        window.alphaValue = CGFloat(max(0.1, min(1, state.opacity)))
    }

    private func position(window: NSWindow, state: MiniBrowserState) {
        let size = size(for: state)
        let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let margin: CGFloat = 18
        let stackIndex = stackIndex(for: state)
        let stackOffset = CGFloat(stackIndex) * (size.height + 12)
        let origin: NSPoint
        switch state.corner {
        case .topLeft:
            origin = NSPoint(x: screenFrame.minX + margin, y: screenFrame.maxY - size.height - margin - stackOffset)
        case .topRight:
            origin = NSPoint(x: screenFrame.maxX - size.width - margin, y: screenFrame.maxY - size.height - margin - stackOffset)
        case .bottomLeft:
            origin = NSPoint(x: screenFrame.minX + margin, y: screenFrame.minY + margin + stackOffset)
        case .bottomRight:
            origin = NSPoint(x: screenFrame.maxX - size.width - margin, y: screenFrame.minY + margin + stackOffset)
        }
        positioningWindowIDs.insert(state.id)
        window.setFrame(NSRect(origin: origin, size: size), display: true, animate: true)
        window.alphaValue = CGFloat(max(0.1, min(1, state.opacity)))
        Task { @MainActor in
            self.positioningWindowIDs.remove(state.id)
        }
    }

    private func stackIndex(for state: MiniBrowserState) -> Int {
        windows.values
            .sorted { $0.state.id.uuidString < $1.state.id.uuidString }
            .filter { $0.state.corner == state.corner }
            .firstIndex { $0.state.id == state.id } ?? 0
    }

    private func nearestCorner(to frame: NSRect) -> MiniBrowserCorner {
        let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let center = NSPoint(x: frame.midX, y: frame.midY)
        let isLeft = center.x < screenFrame.midX
        let isBottom = center.y < screenFrame.midY
        switch (isLeft, isBottom) {
        case (true, false): return .topLeft
        case (false, false): return .topRight
        case (true, true): return .bottomLeft
        case (false, true): return .bottomRight
        }
    }
}

struct MiniBrowserFloatingView: View {
    @ObservedObject var state: MiniBrowserState

    var body: some View {
        if state.isMinified {
            Button {
                state.isMinified = false
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "plus")
                        .font(.system(size: 18, weight: .bold))
                    Text(state.tab.label)
                        .font(.system(size: 11, weight: .bold))
                        .lineLimit(1)
                }
                .foregroundStyle(.white)
                .frame(width: 92, height: 58)
                .background(.black.opacity(0.88))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            .help("Expand mini browser")
        } else {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    Text(state.tab.title)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Spacer()
                    ForEach(MiniBrowserCorner.allCases) { corner in
                        Button(corner.title) {
                            state.snapToCorner?(corner)
                        }
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(state.corner == corner ? .black : .white)
                        .frame(width: 28, height: 24)
                        .background(state.corner == corner ? Color.white : Color.white.opacity(0.14))
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        .buttonStyle(.plain)
                        .help("Snap to \(corner.title)")
                    }
                    Slider(value: $state.opacity, in: 0.1...1)
                        .frame(width: 92)
                        .help("Opacity")
                    Text("\(Int(state.opacity * 100))%")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.76))
                        .frame(width: 34, alignment: .trailing)
                    Button {
                        state.toggleFullScreen?()
                    } label: {
                        Image(systemName: "arrow.up.left.and.arrow.down.right")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 28, height: 24)
                            .background(Color.white.opacity(0.14))
                            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .help("Full screen this mini browser")
                    Button {
                        state.cloneWindow?()
                    } label: {
                        Image(systemName: "plus.square.on.square")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 28, height: 24)
                            .background(Color.white.opacity(0.14))
                            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .help("Clone mini browser")
                    Button {
                        state.isMinified = true
                    } label: {
                        Image(systemName: "minus")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 28, height: 24)
                            .background(Color.white.opacity(0.14))
                            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .help("Minify")
                }
                .padding(.horizontal, 10)
                .frame(height: 38)
                .background(.black.opacity(0.86))

                NativeBrowserView(tab: state.tab)
                    .background(.black)
            }
            .background(.black.opacity(0.82))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color.white.opacity(0.22), lineWidth: 1)
            )
        }
    }
}

struct BrowserTabButton: View {
    @Environment(\.desktopTheme) private var theme
    @ObservedObject var tab: BrowserTabState
    let selected: Bool
    let select: () -> Void
    let close: () -> Void
    let moveTargets: () -> [BrowserTabGroup]
    let move: (String) -> Void

    var body: some View {
        Button(action: select) {
            HStack(spacing: 8) {
                Image(systemName: tab.isLoading ? "circle.dotted" : "macwindow")
                    .font(.system(size: 11, weight: .bold))
                Text(tab.label)
                    .lineLimit(1)
                    .frame(maxWidth: 140, alignment: .leading)
                if !moveTargets().isEmpty {
                    Menu {
                        ForEach(moveTargets()) { group in
                            Button(group.title) {
                                move(group.id)
                            }
                        }
                    } label: {
                        Image(systemName: "folder.badge.plus")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(theme.textTertiary)
                    }
                    .menuStyle(.borderlessButton)
                    .frame(width: 18)
                    .help("Move tab to group")
                }
                Button(action: close) {
                    Image(systemName: "xmark")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(theme.textTertiary)
                }
                .buttonStyle(.plain)
            }
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(selected ? theme.text : theme.textSecondary)
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(selected ? theme.commandBar : theme.card.opacity(0.72))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct BrowserAgentButton: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .bold))
                Text(title)
                    .font(.system(size: 11, weight: .bold))
            }
            .foregroundStyle(theme.text)
            .padding(.horizontal, 9)
            .frame(height: 26)
            .background(theme.cardRaised)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct BrowserAgentField: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    @Binding var text: String
    let placeholder: String
    var width: CGFloat?

    var body: some View {
        HStack(spacing: 6) {
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(theme.textTertiary)
                .textCase(.uppercase)
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: 11, weight: .semibold, design: title == "Selector" ? .monospaced : .default))
                .foregroundStyle(theme.text)
        }
        .padding(.horizontal, 9)
        .frame(width: width)
        .frame(height: 28)
        .background(theme.field)
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct BrowserIconButton: View {
    @Environment(\.desktopTheme) private var theme
    let systemName: String
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(disabled ? theme.textTertiary : theme.text)
                .frame(width: 30, height: 30)
                .background(theme.cardRaised)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }
}

struct BrowserAddressField: View {
    @Environment(\.desktopTheme) private var theme
    @Binding var address: String
    var isFocused: FocusState<Bool>.Binding
    let submit: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(theme.textTertiary)
            TextField("Open surface, search, or paste URL", text: $address)
                .textFieldStyle(.plain)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(theme.text)
                .focused(isFocused)
                .onSubmit(submit)
        }
        .padding(.horizontal, 12)
        .frame(height: 32)
        .background(theme.field)
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(isFocused.wrappedValue ? theme.accent.opacity(0.62) : theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct IDEShareFile: Identifiable {
    let id: String
    let title: String
    let path: String
    let language: String
    let icon: String
    let seed: String
    var diskPath: String? = nil
    var diskModifiedAt: Date? = nil
}

struct IDEQuickCommand: Identifiable {
    let id = UUID()
    let title: String
    let command: String
    let icon: String
}

struct IDECodePlugin: Identifiable {
    let id: String
    let language: String
    let icon: String
    let extensions: [String]
    let formatter: String
    let diagnostics: [String]
}

struct IDEProjectFile: Identifiable {
    let id: String
    let name: String
    let relativePath: String
    let absolutePath: String
    let icon: String
}

struct IDEOpenRequest: Identifiable, Equatable {
    let id = UUID()
    let path: String
    let line: Int?
    let revealDiff: Bool
}

struct IDEChatCommand {
    let path: String
    let line: Int?
    let revealDiff: Bool

    static func parse(_ prompt: String) -> IDEChatCommand? {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()
        let linePattern = #"line\s+(\d+)\s+(?:of|in)\s+([A-Za-z0-9_./@+\-]+\.[A-Za-z0-9]+)"#
        if let match = firstMatch(linePattern, in: lower),
           let line = Int(match[1]) {
            return IDEChatCommand(path: match[2], line: line, revealDiff: false)
        }

        for prefix in ["open file ", "open ", "show file ", "show "] where lower.hasPrefix(prefix) {
            let target = String(trimmed.dropFirst(prefix.count)).trimmingCharacters(in: .whitespacesAndNewlines)
            guard target.contains(".") || target.contains("/") else { continue }
            return IDEChatCommand(path: target, line: nil, revealDiff: false)
        }

        for prefix in ["diff ", "show diff ", "open diff "] where lower.hasPrefix(prefix) {
            let target = String(trimmed.dropFirst(prefix.count)).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !target.isEmpty else { continue }
            return IDEChatCommand(path: target, line: nil, revealDiff: true)
        }

        return nil
    }

    private static func firstMatch(_ pattern: String, in text: String) -> [String]? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { return nil }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let match = regex.firstMatch(in: text, range: range) else { return nil }
        return (0..<match.numberOfRanges).compactMap { index in
            guard let range = Range(match.range(at: index), in: text) else { return nil }
            return String(text[range])
        }
    }
}

struct IDEEditChatCommand {
    enum Kind {
        case replaceLine
        case insertAfterLine
        case patch
    }

    let kind: Kind
    let path: String
    let line: Int
    let text: String

    static func parse(_ prompt: String) -> IDEEditChatCommand? {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        if let patch = fencedPatch(in: trimmed) {
            return IDEEditChatCommand(kind: .patch, path: "patch.diff", line: 1, text: patch)
        }

        let patterns: [(String, Kind)] = [
            (#"replace\s+line\s+(\d+)\s+(?:of|in)\s+([A-Za-z0-9_./@+\-]+\.[A-Za-z0-9]+)\s+with\s+([\s\S]+)"#, .replaceLine),
            (#"insert\s+(?:below|after)\s+line\s+(\d+)\s+(?:of|in)\s+([A-Za-z0-9_./@+\-]+\.[A-Za-z0-9]+)\s+(?:with\s+)?([\s\S]+)"#, .insertAfterLine),
        ]
        for (pattern, kind) in patterns {
            guard let match = firstMatch(pattern, in: trimmed.lowercased(), original: trimmed),
                  let line = Int(match[1]) else { continue }
            return IDEEditChatCommand(kind: kind, path: match[2], line: line, text: match[3])
        }
        return nil
    }

    private static func fencedPatch(in text: String) -> String? {
        guard text.lowercased().contains("apply this patch"),
              let start = text.range(of: "```") else { return nil }
        let afterStart = text[start.upperBound...]
        let codeStart = afterStart.firstIndex(of: "\n").map { text.index(after: $0) } ?? start.upperBound
        guard let end = text[codeStart...].range(of: "```") else { return nil }
        let patch = String(text[codeStart..<end.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
        return patch.isEmpty ? nil : patch
    }

    private static func firstMatch(_ pattern: String, in lowerText: String, original: String) -> [String]? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { return nil }
        let range = NSRange(lowerText.startIndex..<lowerText.endIndex, in: lowerText)
        guard let match = regex.firstMatch(in: lowerText, range: range) else { return nil }
        return (0..<match.numberOfRanges).compactMap { index in
            guard let lowerRange = Range(match.range(at: index), in: lowerText),
                  let originalRange = Range(match.range(at: index), in: original) else { return nil }
            return index <= 2 ? String(lowerText[lowerRange]) : String(original[originalRange])
        }
    }
}

struct IDEPendingEdit: Identifiable, Equatable {
    enum Kind {
        case replaceLine
        case insertAfterLine
        case patch
    }

    let id = UUID()
    let kind: Kind
    let title: String
    let path: String
    let line: Int
    let original: String
    let replacement: String
    let updated: String

    var preview: String {
        switch kind {
        case .patch:
            return replacement
        case .replaceLine, .insertAfterLine:
            let oldLines = original.components(separatedBy: .newlines)
            let newLines = updated.components(separatedBy: .newlines)
            let lower = max(1, line - 2)
            let upper = min(max(oldLines.count, newLines.count), line + 3)
            return (lower...upper).map { index in
                let old = oldLines.indices.contains(index - 1) ? oldLines[index - 1] : ""
                let new = newLines.indices.contains(index - 1) ? newLines[index - 1] : ""
                if old == new {
                    return " \(index): \(old)"
                }
                return "-\(index): \(old)\n+\(index): \(new)"
            }.joined(separator: "\n")
        }
    }

    static func prepare(command: IDEEditChatCommand, path: String, original: String) -> IDEPendingEdit {
        var lines = original.components(separatedBy: .newlines)
        let lineIndex = max(0, min(command.line - 1, max(lines.count - 1, 0)))
        let title: String
        switch command.kind {
        case .replaceLine:
            if lines.isEmpty {
                lines = [command.text]
            } else {
                lines[lineIndex] = command.text
            }
            title = "Replace line \(command.line)"
        case .insertAfterLine:
            let insertIndex = min(command.line, lines.count)
            lines.insert(command.text, at: insertIndex)
            title = "Insert after line \(command.line)"
        case .patch:
            title = "Apply patch"
        }
        return IDEPendingEdit(
            kind: Kind(command.kind),
            title: title,
            path: path,
            line: command.line,
            original: original,
            replacement: command.text,
            updated: command.kind == .patch ? original : lines.joined(separator: "\n")
        )
    }
}

extension IDEPendingEdit.Kind {
    init(_ kind: IDEEditChatCommand.Kind) {
        switch kind {
        case .replaceLine: self = .replaceLine
        case .insertAfterLine: self = .insertAfterLine
        case .patch: self = .patch
        }
    }
}

struct IDEGitChange: Identifiable {
    let id: String
    let status: String
    let path: String
    let absolutePath: String

    var icon: String {
        if status.contains("A") || status.contains("?") { return "plus.circle" }
        if status.contains("D") { return "minus.circle" }
        if status.contains("R") { return "arrow.triangle.2.circlepath" }
        return "pencil.circle"
    }
}

struct IDEGitHistoryEntry: Identifiable {
    let id: String
    let line: String
}

struct IDEProblemMarker: Identifiable {
    let id: String
    let label: String
    let detail: String
    let filePath: String
    let line: Int
    let severity: String

    var icon: String {
        severity == "error" ? "xmark.octagon" : "exclamationmark.triangle"
    }
}

struct IDEOutlineItem: Identifiable {
    let id = UUID()
    let title: String
    let line: Int
    let icon: String
}

struct IDEDiffHunk: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let newLine: Int
}

struct IDEWorkspaceSession: Codable {
    var selectedFileID: String
    var openFileIDs: [String]
    var recentFileIDs: [String]
    var pinnedFileIDs: [String]
    var cwd: String?
    var showPreview: Bool?
    var showTerminal: Bool?
    var showSyntaxPreview: Bool?
    var autosaveEnabled: Bool?
    var autoformatEnabled: Bool?
}

private func hanasandSafeIDEWorkspacePath() -> String {
    let fileManager = FileManager.default
    if let support = try? fileManager.url(
        for: .applicationSupportDirectory,
        in: .userDomainMask,
        appropriateFor: nil,
        create: true
    ) {
        let directory = support.appendingPathComponent("Hanasand/IDEWorkspace", isDirectory: true)
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.path
    }

    let fallback = fileManager.temporaryDirectory.appendingPathComponent("Hanasand/IDEWorkspace", isDirectory: true)
    try? fileManager.createDirectory(at: fallback, withIntermediateDirectories: true)
    return fallback.path
}

private func hanasandIsDesktopProtectedPath(_ path: String) -> Bool {
    let standardized = URL(fileURLWithPath: path).standardizedFileURL.path
    let desktop = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Desktop", isDirectory: true)
        .standardizedFileURL
        .path
    return standardized == desktop || standardized.hasPrefix(desktop + "/")
}

final class IDETerminalModel: ObservableObject {
    @Published var command = "pwd"
    @Published var output = "$ ready\n"
    @Published var cwd = hanasandSafeIDEWorkspacePath()
    @Published var isRunning = false
    @Published var history: [String] = []
    @Published var historyIndex: Int?
    private var activeProcess: Process?
    private var activePipe: Pipe?

    func run() {
        run(command)
    }

    func run(_ nextCommand: String) {
        command = nextCommand
        let trimmed = command.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isRunning else { return }
        if history.last != trimmed {
            history.append(trimmed)
        }
        historyIndex = nil
        output += "\n$ \(trimmed)\n"
        isRunning = true

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lc", trimmed]
        process.currentDirectoryURL = URL(fileURLWithPath: cwd)
        process.environment = ProcessInfo.processInfo.environment.merging([
            "TERM": "xterm-256color",
            "HANASAND_DESKTOP": "1",
        ]) { current, _ in current }

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8), !text.isEmpty else { return }
            Task { @MainActor in
                self?.output += text
                if self?.output.count ?? 0 > 80_000 {
                    self?.output = String(self?.output.suffix(60_000) ?? "")
                }
            }
        }
        process.terminationHandler = { [weak self] process in
            pipe.fileHandleForReading.readabilityHandler = nil
            Task { @MainActor in
                if process.terminationStatus != 0 {
                    self?.output += "exit \(process.terminationStatus)\n"
                }
                if self?.output.hasSuffix("\n") == false {
                    self?.output += "\n"
                }
                self?.activeProcess = nil
                self?.activePipe = nil
                self?.isRunning = false
            }
        }

        do {
            activeProcess = process
            activePipe = pipe
            try process.run()
        } catch {
            output += "\(error.localizedDescription)\n"
            activeProcess = nil
            activePipe = nil
            isRunning = false
        }
    }

    func stop() {
        guard let activeProcess, activeProcess.isRunning else { return }
        output += "\n$ stop\n"
        activeProcess.terminate()
    }

    func clear() {
        output = "$ ready\n"
    }

    func previousHistory() {
        guard !history.isEmpty else { return }
        let nextIndex = max((historyIndex ?? history.count) - 1, 0)
        historyIndex = nextIndex
        command = history[nextIndex]
    }

    func nextHistory() {
        guard !history.isEmpty else { return }
        guard let current = historyIndex else { return }
        let nextIndex = current + 1
        if nextIndex >= history.count {
            historyIndex = nil
            command = ""
        } else {
            historyIndex = nextIndex
            command = history[nextIndex]
        }
    }
}

@MainActor
final class IDEWorkspaceModel: ObservableObject {
    @Published var files: [IDEShareFile] = []
    @Published var selectedFileID = "shares-index"
    @Published var openFileIDs: [String] = []
    @Published var editorText = ""
    @Published var status = "Native scratch workspace ready"
    @Published var drafts: [String: String] = [:]
    @Published var savedSnapshots: [String: String] = [:]
    @Published var searchText = ""
    @Published var showPreview = false
    @Published var showTerminal = false
    @Published var showSyntaxPreview = false
    @Published var autosaveEnabled = true
    @Published var autoformatEnabled = true
    @Published var diagnostics: [String] = ["No diagnostics yet."]
    @Published var codePlugins: [IDECodePlugin] = []
    @Published var enabledPluginIDs: Set<String> = []
    @Published var projectFiles: [IDEProjectFile] = []
    @Published var projectFileFilter = ""
    @Published var projectStatus = "Project not scanned"
    @Published var editorFindText = ""
    @Published var editorReplaceText = ""
    @Published var gitCommitMessage = ""
    @Published var gitChanges: [IDEGitChange] = []
    @Published var gitSummary = "Git not refreshed"
    @Published var gitCommitPreview = "Refresh Git to preview commit contents."
    @Published var gitHistory: [IDEGitHistoryEntry] = []
    @Published var gitHistorySummary = "History not refreshed"
    @Published var commandPaletteQuery = ""
    @Published var problemMarkers: [IDEProblemMarker] = []
    @Published var problemsSummary = "Problems not scanned"
    @Published var recentFileIDs: [String] = []
    @Published var pinnedFileIDs: Set<String> = []
    @Published var highlightedLine: Int?
    @Published var inlineDiff = ""
    @Published var inlineDiffTitle = "Inline diff"
    @Published var inlineDiffHunks: [IDEDiffHunk] = []
    @Published var autosaveState = "Autosave ready"
    @Published var lastAutosavedAt: Date?

    var terminal = IDETerminalModel()
    private(set) var previewTab: BrowserTabState?
    private let draftKey = "hanasand.desktop.ide.drafts"
    private let sessionKey = "hanasand.desktop.ide.session"
    private var autosaveTask: Task<Void, Never>?

    var selectedFile: IDEShareFile? {
        files.first { $0.id == selectedFileID } ?? files.first
    }

    var filteredFiles: [IDEShareFile] {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return files }
        return files.filter {
            $0.title.localizedCaseInsensitiveContains(trimmed)
                || $0.path.localizedCaseInsensitiveContains(trimmed)
                || $0.language.localizedCaseInsensitiveContains(trimmed)
        }
    }

    var openFiles: [IDEShareFile] {
        openFileIDs.compactMap { id in files.first { $0.id == id } }
    }

    var recentFiles: [IDEShareFile] {
        recentFileIDs.compactMap { id in files.first { $0.id == id } }
    }

    var pinnedFiles: [IDEShareFile] {
        files.filter { pinnedFileIDs.contains($0.id) }
    }

    var isDirty: Bool {
        editorText != (savedSnapshots[selectedFileID] ?? selectedFile?.seed ?? "")
    }

    var selectedDiskFileChangedExternally: Bool {
        guard let selectedFile, let diskPath = selectedFile.diskPath else { return false }
        guard let currentDate = try? FileManager.default.attributesOfItem(atPath: diskPath)[.modificationDate] as? Date else { return false }
        guard let storedDate = selectedFile.diskModifiedAt else { return false }
        return currentDate > storedDate.addingTimeInterval(0.5)
    }

    var selectedFileStorageLabel: String {
        guard selectedFile?.diskPath != nil else {
            return isDirty ? "Unsaved local draft" : "Saved local draft"
        }
        return isDirty ? "Unsaved disk draft" : "Saved disk file"
    }

    var selectedFileModeLabel: String {
        selectedFile?.diskPath == nil ? "local draft" : "disk-backed file"
    }

    var quickCommands: [IDEQuickCommand] {
        [
            IDEQuickCommand(title: "Status", command: "git status --short", icon: "waveform.path.ecg"),
            IDEQuickCommand(title: "Pull", command: "git pull --ff-only", icon: "arrow.down.circle"),
            IDEQuickCommand(title: "Push", command: "git push", icon: "arrow.up.circle"),
            IDEQuickCommand(title: "Build desktop", command: "cd app/desktop && swift build", icon: "hammer"),
            IDEQuickCommand(title: "List shares", command: "curl -I -s https://hanasand.com/s", icon: "network"),
            IDEQuickCommand(title: "Files", command: "find . -maxdepth 2 -type f | head -80", icon: "doc.text.magnifyingglass"),
        ]
    }

    var workspaceTasks: [IDEQuickCommand] {
        let root = URL(fileURLWithPath: terminal.cwd, isDirectory: true)
        let packageJSON = root.appendingPathComponent("package.json").path
        let bunLock = root.appendingPathComponent("bun.lock").path
        let packageSwift = root.appendingPathComponent("Package.swift").path
        let dockerCompose = root.appendingPathComponent("docker-compose.yml").path
        var tasks: [IDEQuickCommand] = []

        if FileManager.default.fileExists(atPath: packageSwift) {
            tasks.append(IDEQuickCommand(title: "Swift build", command: "swift build", icon: "swift"))
            tasks.append(IDEQuickCommand(title: "Swift test", command: "swift test", icon: "checkmark.seal"))
        }
        if FileManager.default.fileExists(atPath: packageJSON) {
            let runner = FileManager.default.fileExists(atPath: bunLock) ? "bun" : "npm"
            tasks.append(IDEQuickCommand(title: "\(runner) install", command: "\(runner) install", icon: "tray.and.arrow.down"))
            tasks.append(IDEQuickCommand(title: "\(runner) build", command: "\(runner) run build", icon: "hammer"))
            tasks.append(IDEQuickCommand(title: "\(runner) test", command: "\(runner) test", icon: "checkmark.seal"))
        }
        if FileManager.default.fileExists(atPath: dockerCompose) {
            tasks.append(IDEQuickCommand(title: "Compose up", command: "docker compose up --build", icon: "shippingbox"))
            tasks.append(IDEQuickCommand(title: "Compose ps", command: "docker compose ps", icon: "list.bullet.rectangle"))
        }
        if tasks.isEmpty {
            tasks = [
                IDEQuickCommand(title: "List files", command: "find . -maxdepth 2 -type f | head -80", icon: "doc.text.magnifyingglass"),
                IDEQuickCommand(title: "Disk", command: "pwd && du -sh .", icon: "internaldrive"),
            ]
        }
        return tasks
    }

    var currentFileRunCommands: [IDEQuickCommand] {
        guard let file = selectedFile, let path = file.diskPath else { return [] }
        let quotedPath = shellQuoted(path)
        let ext = URL(fileURLWithPath: path).pathExtension.lowercased()
        let root = URL(fileURLWithPath: terminal.cwd, isDirectory: true)
        let hasBun = FileManager.default.fileExists(atPath: root.appendingPathComponent("bun.lock").path)

        switch ext {
        case "swift":
            return [
                IDEQuickCommand(title: "Run Swift file", command: "swift \(quotedPath)", icon: "swift"),
                IDEQuickCommand(title: "Typecheck Swift", command: "swiftc -typecheck \(quotedPath)", icon: "checkmark.seal"),
            ]
        case "js", "mjs":
            return [
                IDEQuickCommand(title: "Run JS file", command: "\(hasBun ? "bun" : "node") \(quotedPath)", icon: "play.fill"),
            ]
        case "ts", "tsx":
            return [
                IDEQuickCommand(title: "Run TS file", command: "\(hasBun ? "bun" : "npx tsx") \(quotedPath)", icon: "play.fill"),
            ]
        case "py":
            return [
                IDEQuickCommand(title: "Run Python file", command: "python3 \(quotedPath)", icon: "play.fill"),
            ]
        case "sh", "bash", "zsh":
            return [
                IDEQuickCommand(title: "Run shell file", command: "zsh \(quotedPath)", icon: "terminal"),
                IDEQuickCommand(title: "Check shell syntax", command: "zsh -n \(quotedPath)", icon: "checkmark.seal"),
            ]
        case "json":
            return [
                IDEQuickCommand(title: "Validate JSON", command: "python3 -m json.tool \(quotedPath) >/dev/null", icon: "checkmark.seal"),
            ]
        case "md", "mdx":
            return [
                IDEQuickCommand(title: "Preview Markdown text", command: "sed -n '1,120p' \(quotedPath)", icon: "text.alignleft"),
            ]
        default:
            return [
                IDEQuickCommand(title: "Print file", command: "sed -n '1,120p' \(quotedPath)", icon: "doc.text.magnifyingglass"),
            ]
        }
    }

    var selectedPlugin: IDECodePlugin {
        let language = selectedFile?.language.lowercased() ?? ""
        let extensionMatch = selectedFile?.title.split(separator: ".").last.map(String.init) ?? ""
        return codePlugins.first {
            enabledPluginIDs.contains($0.id) && ($0.language.lowercased() == language || $0.extensions.contains(extensionMatch))
        } ?? codePlugins.first {
            $0.id == "plaintext"
        } ?? Self.plainTextPlugin
    }

    var filteredProjectFiles: [IDEProjectFile] {
        let trimmed = projectFileFilter.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return projectFiles }
        return projectFiles.filter {
            $0.name.localizedCaseInsensitiveContains(trimmed)
                || $0.relativePath.localizedCaseInsensitiveContains(trimmed)
        }
    }

    var findMatchCount: Int {
        let needle = editorFindText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needle.isEmpty else { return 0 }
        return editorText.lowercased().components(separatedBy: needle.lowercased()).count - 1
    }

    var editorLineCount: Int {
        max(1, editorText.components(separatedBy: .newlines).count)
    }

    var outlineItems: [IDEOutlineItem] {
        editorText.components(separatedBy: .newlines).enumerated().compactMap { index, line in
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("#") {
                return IDEOutlineItem(title: trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "# ")), line: index + 1, icon: "textformat.size")
            }
            for keyword in ["struct ", "class ", "func ", "function ", "def ", "const ", "let "] where trimmed.hasPrefix(keyword) {
                let title = trimmed
                    .replacingOccurrences(of: "{", with: "")
                    .trimmingCharacters(in: .whitespaces)
                return IDEOutlineItem(title: title, line: index + 1, icon: keyword.contains("func") || keyword == "def " ? "function" : "cube")
            }
            return nil
        }
    }

    var selectedSnippets: [IDEQuickCommand] {
        switch selectedPlugin.id {
        case "swift":
            return [
                IDEQuickCommand(title: "View", command: "struct NewView: View {\n    var body: some View {\n        Text(\"Hello\")\n    }\n}\n", icon: "swift"),
                IDEQuickCommand(title: "Task", command: "Task { @MainActor in\n    \n}\n", icon: "clock"),
                IDEQuickCommand(title: "Model", command: "@MainActor\nfinal class ViewModel: ObservableObject {\n    @Published var status = \"Ready\"\n}\n", icon: "cube"),
            ]
        case "typescript", "javascript":
            return [
                IDEQuickCommand(title: "Async fn", command: "async function run() {\n  \n}\n", icon: "bolt"),
                IDEQuickCommand(title: "Fetch", command: "const response = await fetch(url);\nconst data = await response.json();\n", icon: "network"),
                IDEQuickCommand(title: "Test", command: "test('works', async () => {\n  expect(true).toBe(true);\n});\n", icon: "checkmark.seal"),
            ]
        case "markdown":
            return [
                IDEQuickCommand(title: "Section", command: "\n## Section\n\n", icon: "textformat.size"),
                IDEQuickCommand(title: "Checklist", command: "- [ ] Item\n- [ ] Item\n", icon: "checklist"),
                IDEQuickCommand(title: "Code", command: "```swift\n\n```\n", icon: "curlybraces"),
            ]
        case "shell":
            return [
                IDEQuickCommand(title: "Safe shell", command: "set -euo pipefail\n\n", icon: "terminal"),
                IDEQuickCommand(title: "Loop", command: "for file in \"$@\"; do\n  echo \"$file\"\ndone\n", icon: "repeat"),
            ]
        default:
            return [
                IDEQuickCommand(title: "Note", command: "\n# Note\n\n", icon: "note.text"),
                IDEQuickCommand(title: "TODO", command: "TODO: ", icon: "checkmark.circle"),
            ]
        }
    }

    var paletteCommands: [IDEQuickCommand] {
        let editorCommands = [
            IDEQuickCommand(title: "Save draft", command: "ide:save", icon: "square.and.arrow.down"),
            IDEQuickCommand(title: "Format document", command: "ide:format", icon: "wand.and.stars"),
            IDEQuickCommand(title: "Refresh project", command: "ide:refresh-project", icon: "arrow.clockwise"),
            IDEQuickCommand(title: "Refresh git", command: "ide:refresh-git", icon: "waveform.path.ecg"),
            IDEQuickCommand(title: "Scan problems", command: "ide:scan-problems", icon: "exclamationmark.triangle"),
            IDEQuickCommand(title: "Toggle preview", command: "ide:toggle-preview", icon: "rectangle.rightthird.inset.filled"),
            IDEQuickCommand(title: "Toggle terminal", command: "ide:toggle-terminal", icon: "terminal"),
            IDEQuickCommand(title: "New scratch", command: "ide:new-scratch", icon: "plus"),
        ]
        let snippetCommands = selectedSnippets.map {
            IDEQuickCommand(title: "Insert \($0.title)", command: "snippet:\($0.command)", icon: $0.icon)
        }
        let all = editorCommands + currentFileRunCommands + workspaceTasks + quickCommands + snippetCommands
        let query = commandPaletteQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return all }
        return all.filter {
            $0.title.localizedCaseInsensitiveContains(query)
                || $0.command.localizedCaseInsensitiveContains(query)
        }
    }

    func configure(settings: HanasandDesktopSettings) {
        guard files.isEmpty else { return }
        if let data = UserDefaults.standard.data(forKey: draftKey),
           let decoded = try? JSONDecoder().decode([String: String].self, from: data) {
            drafts = decoded
            savedSnapshots = decoded
        }
        let base = settings.websiteBaseURL.normalizedBaseURL
        let sharesURL = base.appendingPathComponent("s").absoluteString
        previewTab = BrowserTabState(label: "Shares", url: sharesURL)
        terminal.cwd = hanasandSafeIDEWorkspacePath()
        codePlugins = Self.defaultCodePlugins()
        enabledPluginIDs = Set(codePlugins.map(\.id))
        files = [
            IDEShareFile(
                id: "shares-index",
                title: "shares.index",
                path: "/s",
                language: "Share map",
                icon: "square.grid.2x2",
                seed: """
                // Hanasand Shares
                // Source: \(sharesURL)

                workspace {
                  preview: "\(sharesURL)"
                  purpose: "Browse, inspect, and edit share-backed work in one native surface."
                }
                """
            ),
            IDEShareFile(
                id: "public-site",
                title: "hanasand.site",
                path: "/",
                language: "Web",
                icon: "globe",
                seed: """
                // Public site share
                open("\(base.absoluteString)")

                notes:
                - Keep previews inside the app when possible.
                - Use the terminal for local checks and deploy helpers.
                """
            ),
            IDEShareFile(
                id: "dashboard",
                title: "dashboard.share",
                path: "/dashboard",
                language: "Ops",
                icon: "gauge.with.dots.needle",
                seed: """
                // Dashboard share
                route: /dashboard
                mode: native-first

                actions:
                - inspect page controls
                - run local terminal commands
                - keep browser preview docked
                """
            ),
            IDEShareFile(
                id: "scratch",
                title: "scratch.md",
                path: "/s/scratch",
                language: "Markdown",
                icon: "note.text",
                seed: """
                # Scratch

                This is a native Hanasand IDE note tied to the shares workspace.
                Use it for agent plans, local command output, and quick edits.
                """
            ),
        ]
        restoreSession()
        if openFileIDs.isEmpty {
            selectedFileID = files.first?.id ?? selectedFileID
            openFileIDs = [selectedFileID]
        }
        editorText = drafts[selectedFileID] ?? selectedFile?.seed ?? files.first?.seed ?? ""
        if savedSnapshots[selectedFileID] == nil {
            savedSnapshots[selectedFileID] = editorText
        }
        scanProjectFiles()
        refreshGitChanges()
        refreshGitHistory()
        scanProblemMarkers()
    }

    func select(_ file: IDEShareFile) {
        persistCurrentInMemory()
        selectedFileID = file.id
        if !openFileIDs.contains(file.id) {
            openFileIDs.append(file.id)
        }
        editorText = drafts[file.id] ?? file.seed
        if savedSnapshots[file.id] == nil {
            savedSnapshots[file.id] = editorText
        }
        status = "\(file.path) selected"
        remember(file)
        persistSession()
        runDiagnostics()
    }

    func preview(_ file: IDEShareFile, settings: HanasandDesktopSettings) {
        let base = settings.websiteBaseURL.normalizedBaseURL
        let trimmed = file.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let url = trimmed.isEmpty ? base.absoluteString : base.appendingPathComponent(trimmed).absoluteString
        previewTab?.load(url)
        status = "Previewing \(file.path)"
    }

    func closeTab(_ file: IDEShareFile) {
        guard openFileIDs.count > 1 else { return }
        persistCurrentInMemory()
        openFileIDs.removeAll { $0 == file.id }
        if selectedFileID == file.id, let next = openFiles.last {
            selectedFileID = next.id
            editorText = drafts[next.id] ?? next.seed
            if savedSnapshots[next.id] == nil {
                savedSnapshots[next.id] = editorText
            }
        }
        persistSession()
    }

    func saveCurrent() {
        if autoformatEnabled {
            formatCurrent()
        }
        persistCurrentInMemory()
        if let encoded = try? JSONEncoder().encode(drafts) {
            UserDefaults.standard.set(encoded, forKey: draftKey)
        }
        if let diskPath = selectedFile?.diskPath {
            do {
                autosaveState = "Saving..."
                try editorText.write(toFile: diskPath, atomically: true, encoding: .utf8)
                if let index = files.firstIndex(where: { $0.id == selectedFileID }) {
                    files[index].diskModifiedAt = (try? FileManager.default.attributesOfItem(atPath: diskPath)[.modificationDate] as? Date) ?? Date()
                }
            } catch {
                status = error.localizedDescription
                autosaveState = "Disk save failed"
                return
            }
        }
        savedSnapshots[selectedFileID] = editorText
        lastAutosavedAt = Date()
        autosaveState = "Saved just now"
        status = "\(selectedFile?.title ?? "File") saved locally"
        runDiagnostics()
    }

    func exportCurrent(to url: URL) {
        do {
            if autoformatEnabled {
                formatCurrent()
            }
            try editorText.write(to: url, atomically: true, encoding: .utf8)
            savedSnapshots[selectedFileID] = editorText
            if let index = files.firstIndex(where: { $0.id == selectedFileID }) {
                files[index].diskModifiedAt = (try? FileManager.default.attributesOfItem(atPath: url.path)[.modificationDate] as? Date) ?? Date()
                files[index].diskPath = url.path
            }
            status = "Wrote \(url.lastPathComponent)"
        } catch {
            status = error.localizedDescription
        }
    }

    func resetCurrent() {
        guard let selectedFile else { return }
        drafts[selectedFile.id] = selectedFile.seed
        editorText = selectedFile.seed
        saveCurrent()
        status = "\(selectedFile.title) reset"
    }

    func discardUnsavedChanges() {
        let restored = savedSnapshots[selectedFileID] ?? selectedFile?.seed ?? ""
        editorText = restored
        drafts[selectedFileID] = restored
        status = "Discarded unsaved changes"
        runDiagnostics()
    }

    func newScratch() {
        persistCurrentInMemory()
        let count = files.filter { $0.id.hasPrefix("scratch-") }.count + 1
        let file = IDEShareFile(
            id: "scratch-\(count)",
            title: "scratch-\(count).md",
            path: "/s/scratch-\(count)",
            language: "Markdown",
            icon: "square.and.pencil",
            seed: "# Scratch \(count)\n\n"
        )
        files.append(file)
        drafts[file.id] = file.seed
        select(file)
        saveCurrent()
    }

    func importLocalFile(_ url: URL) {
        do {
            let text = try String(contentsOf: url, encoding: .utf8)
            let modifiedAt = (try? FileManager.default.attributesOfItem(atPath: url.path)[.modificationDate] as? Date) ?? Date()
            persistCurrentInMemory()
            let file = IDEShareFile(
                id: "local-\(url.path.hashValue)",
                title: url.lastPathComponent,
                path: url.path,
                language: languageName(for: url.pathExtension),
                icon: iconName(for: url.pathExtension),
                seed: text,
                diskPath: url.path,
                diskModifiedAt: modifiedAt
            )
            if let existingIndex = files.firstIndex(where: { $0.id == file.id }) {
                files[existingIndex] = file
            } else {
                files.append(file)
            }
            drafts[file.id] = text
            savedSnapshots[file.id] = text
            select(file)
            saveCurrent()
        } catch {
            status = error.localizedDescription
        }
    }

    func reloadCurrentFromDisk() {
        guard let selectedFile, let diskPath = selectedFile.diskPath else {
            status = "Current file is not backed by disk"
            return
        }
        do {
            let url = URL(fileURLWithPath: diskPath)
            let text = try String(contentsOf: url, encoding: .utf8)
            editorText = text
            drafts[selectedFile.id] = text
            savedSnapshots[selectedFile.id] = text
            if let index = files.firstIndex(where: { $0.id == selectedFile.id }) {
                files[index].diskModifiedAt = (try? FileManager.default.attributesOfItem(atPath: diskPath)[.modificationDate] as? Date) ?? Date()
            }
            status = "Reloaded \(url.lastPathComponent)"
            runDiagnostics()
        } catch {
            status = error.localizedDescription
        }
    }

    func checkCurrentDiskState() {
        guard selectedFile?.diskPath != nil else {
            status = "Current file is draft-only"
            return
        }
        status = selectedDiskFileChangedExternally ? "Disk file changed externally" : "Disk file is current"
    }

    func openProjectFile(_ file: IDEProjectFile) {
        importLocalFile(URL(fileURLWithPath: file.absolutePath))
    }

    func openRequest(_ request: IDEOpenRequest) {
        scanProjectFiles()
        let requestURL = URL(fileURLWithPath: request.path)
        let candidates = [
            request.path,
            projectFiles.first { $0.absolutePath == request.path }?.absolutePath,
            projectFiles.first { $0.relativePath == request.path }?.absolutePath,
            projectFiles.first { $0.name == requestURL.lastPathComponent }?.absolutePath,
            projectFiles.first { $0.relativePath.hasSuffix(request.path) }?.absolutePath,
        ].compactMap { $0 }
        guard let path = candidates.first(where: { FileManager.default.fileExists(atPath: $0) }) else {
            status = "Could not find \(request.path)"
            return
        }
        importLocalFile(URL(fileURLWithPath: path))
        if request.revealDiff {
            loadInlineDiff(for: path)
        }
        if let line = request.line {
            highlight(line: line)
        }
    }

    func highlight(line: Int) {
        let target = max(1, min(line, editorLineCount))
        highlightedLine = target
        status = "Highlighted line \(target)"
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 3_200_000_000)
            await MainActor.run {
                if self?.highlightedLine == target {
                    self?.highlightedLine = nil
                }
            }
        }
    }

    func loadInlineDiff(for path: String) {
        let root = terminal.cwd
        let absolute = URL(fileURLWithPath: path).path
        let relative = absolute.hasPrefix(root + "/") ? String(absolute.dropFirst(root.count + 1)) : absolute
        inlineDiffTitle = "Diff · \(URL(fileURLWithPath: path).lastPathComponent)"
        inlineDiff = Self.executeShell("git diff -- \(shellQuoted(relative))", cwd: root)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if inlineDiff.isEmpty {
            inlineDiff = "No unstaged diff for \(relative)."
        }
        inlineDiffHunks = Self.diffHunks(from: inlineDiff)
        showTerminal = false
        status = "Loaded inline diff for \(relative)"
    }

    nonisolated private static func diffHunks(from diff: String) -> [IDEDiffHunk] {
        guard let regex = try? NSRegularExpression(pattern: #"@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@"#) else { return [] }
        let range = NSRange(diff.startIndex..<diff.endIndex, in: diff)
        return regex.matches(in: diff, range: range).compactMap { match in
            guard let lineRange = Range(match.range(at: 1), in: diff),
                  let line = Int(diff[lineRange]),
                  let titleRange = Range(match.range(at: 0), in: diff) else { return nil }
            return IDEDiffHunk(title: String(diff[titleRange]), newLine: line)
        }
    }

    func togglePin(_ file: IDEShareFile) {
        if pinnedFileIDs.contains(file.id) {
            pinnedFileIDs.remove(file.id)
        } else {
            pinnedFileIDs.insert(file.id)
        }
        persistSession()
    }

    func scanProjectFiles() {
        let root = URL(fileURLWithPath: terminal.cwd, isDirectory: true)
        guard !hanasandIsDesktopProtectedPath(root.path) else {
            projectFiles = []
            projectStatus = "Desktop folder is not scanned automatically. Open specific files when needed."
            return
        }
        let skipDirectories: Set<String> = [".git", ".build", "node_modules", "dist", "build", ".next", ".expo", "DerivedData"]
        let allowedExtensions: Set<String> = ["swift", "ts", "tsx", "js", "jsx", "mjs", "json", "md", "mdx", "sh", "zsh", "bash", "py", "css", "html", "txt", "yml", "yaml", "toml", "env", "gitignore"]
        let keys: [URLResourceKey] = [.isDirectoryKey, .fileSizeKey]
        guard let enumerator = FileManager.default.enumerator(
            at: root,
            includingPropertiesForKeys: keys,
            options: [.skipsHiddenFiles, .skipsPackageDescendants]
        ) else {
            projectStatus = "Could not scan \(root.path)"
            return
        }

        var next: [IDEProjectFile] = []
        for case let url as URL in enumerator {
            if next.count >= 160 { break }
            let values = try? url.resourceValues(forKeys: Set(keys))
            if values?.isDirectory == true {
                if skipDirectories.contains(url.lastPathComponent) {
                    enumerator.skipDescendants()
                }
                continue
            }
            let ext = url.pathExtension.lowercased()
            let name = url.lastPathComponent
            guard allowedExtensions.contains(ext) || allowedExtensions.contains(name) else { continue }
            if let size = values?.fileSize, size > 512_000 { continue }
            let relative = url.path.replacingOccurrences(of: root.path + "/", with: "")
            next.append(IDEProjectFile(
                id: url.path,
                name: name,
                relativePath: relative,
                absolutePath: url.path,
                icon: iconName(for: ext)
            ))
        }
        projectFiles = next.sorted { $0.relativePath.localizedCaseInsensitiveCompare($1.relativePath) == .orderedAscending }
        projectStatus = "\(projectFiles.count) files in \(root.lastPathComponent)"
    }

    func scanProblemMarkers() {
        let markers = ["TODO", "FIXME", "HACK", "XXX", "fatalError(", "print(\"DEBUG", "console.log(", "debugger"]
        var next: [IDEProblemMarker] = []
        for file in projectFiles.prefix(120) {
            guard next.count < 80,
                  let content = try? String(contentsOfFile: file.absolutePath, encoding: .utf8) else { continue }
            for (index, line) in content.components(separatedBy: .newlines).enumerated() {
                guard let marker = markers.first(where: { line.localizedCaseInsensitiveContains($0) }) else { continue }
                let severity = ["fatalError(", "debugger"].contains(marker) ? "error" : "warning"
                next.append(IDEProblemMarker(
                    id: "\(file.absolutePath):\(index + 1):\(marker)",
                    label: marker,
                    detail: line.trimmingCharacters(in: .whitespaces),
                    filePath: file.absolutePath,
                    line: index + 1,
                    severity: severity
                ))
                if next.count >= 80 { break }
            }
        }
        problemMarkers = next
        problemsSummary = next.isEmpty ? "No markers found" : "\(next.count) markers found"
    }

    func openProblemMarker(_ marker: IDEProblemMarker) {
        importLocalFile(URL(fileURLWithPath: marker.filePath))
        editorFindText = marker.detail.isEmpty ? marker.label : marker.detail
        status = "Opened \(URL(fileURLWithPath: marker.filePath).lastPathComponent):\(marker.line)"
    }

    func refreshGitChanges() {
        let root = terminal.cwd
        Task {
            let output = await Task.detached {
                Self.executeShell("git status --porcelain", cwd: root)
            }.value
            await MainActor.run {
                let parsed = output
                    .components(separatedBy: .newlines)
                    .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                    .map { line -> IDEGitChange in
                        let status = String(line.prefix(2)).trimmingCharacters(in: .whitespaces)
                        let rawPath = String(line.dropFirst(min(3, line.count)))
                        let path = rawPath.components(separatedBy: " -> ").last ?? rawPath
                        return IDEGitChange(
                            id: path,
                            status: status.isEmpty ? "M" : status,
                            path: path,
                            absolutePath: URL(fileURLWithPath: root).appendingPathComponent(path).path
                        )
                    }
                gitChanges = parsed
                gitSummary = parsed.isEmpty ? "Clean working tree" : "\(parsed.count) changed files"
                gitCommitPreview = Self.gitCommitPreview(for: parsed)
            }
        }
    }

    func refreshGitHistory() {
        let root = terminal.cwd
        Task {
            let output = await Task.detached {
                Self.executeShell("git log --oneline -14", cwd: root)
            }.value
            await MainActor.run {
                let parsed = output
                    .components(separatedBy: .newlines)
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                    .map { line in
                        let sha = String(line.prefix { !$0.isWhitespace })
                        return IDEGitHistoryEntry(id: sha.isEmpty ? line : sha, line: line)
                    }
                gitHistory = parsed
                gitHistorySummary = parsed.isEmpty ? "No local history" : "\(parsed.count) recent commits"
            }
        }
    }

    func openGitChange(_ change: IDEGitChange) {
        let url = URL(fileURLWithPath: change.absolutePath)
        guard FileManager.default.fileExists(atPath: url.path) else {
            terminal.run("git diff -- \(shellQuoted(change.path))")
            return
        }
        importLocalFile(url)
    }

    func diffGitChange(_ change: IDEGitChange) {
        loadInlineDiff(for: change.absolutePath)
    }

    nonisolated private static func gitCommitPreview(for changes: [IDEGitChange]) -> String {
        guard !changes.isEmpty else { return "Working tree clean." }
        let added = changes.filter { $0.status.contains("A") || $0.status.contains("?") }.count
        let modified = changes.filter { $0.status.contains("M") }.count
        let deleted = changes.filter { $0.status.contains("D") }.count
        let renamed = changes.filter { $0.status.contains("R") }.count
        let headline = "\(changes.count) files: +\(added) ~\(modified) -\(deleted) renamed \(renamed)"
        let files = changes.prefix(12).map { "\($0.status) \($0.path)" }.joined(separator: "\n")
        return "\(headline)\n\(files)"
    }

    func runDiagnostics() {
        var next: [String] = []
        if editorText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            next.append("Editor is empty.")
        }
        if editorText.contains("TODO") {
            next.append("Contains TODO markers.")
        }
        if editorText.count > 8_000 {
            next.append("Large scratch buffer; consider splitting into another share.")
        }
        next.append(contentsOf: selectedPlugin.diagnostics)
        diagnostics = next.isEmpty ? ["No diagnostics."] : next
    }

    func autosaveCurrent() {
        guard autosaveEnabled else { return }
        autosaveTask?.cancel()
        autosaveTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard let self else { return }
                self.saveCurrent()
                self.status = "Autosaved \(self.selectedFile?.title ?? "draft")"
            }
        }
    }

    func togglePlugin(_ plugin: IDECodePlugin) {
        if enabledPluginIDs.contains(plugin.id) {
            guard plugin.id != "plaintext" else { return }
            enabledPluginIDs.remove(plugin.id)
        } else {
            enabledPluginIDs.insert(plugin.id)
        }
        status = "\(plugin.language) plugin \(enabledPluginIDs.contains(plugin.id) ? "enabled" : "disabled")"
        runDiagnostics()
    }

    func replaceAllMatches() {
        guard !editorFindText.isEmpty else { return }
        editorText = editorText.replacingOccurrences(of: editorFindText, with: editorReplaceText, options: [.caseInsensitive])
        status = "Replaced matches for \(editorFindText)"
        autosaveCurrent()
        runDiagnostics()
    }

    func insertSnippet(_ snippet: IDEQuickCommand) {
        if !editorText.hasSuffix("\n") {
            editorText += "\n"
        }
        editorText += snippet.command
        status = "Inserted \(snippet.title)"
        autosaveCurrent()
        runDiagnostics()
    }

    func runPaletteCommand(_ command: IDEQuickCommand) {
        if command.command.hasPrefix("snippet:") {
            let text = String(command.command.dropFirst("snippet:".count))
            insertSnippet(IDEQuickCommand(title: command.title, command: text, icon: command.icon))
            return
        }

        switch command.command {
        case "ide:save":
            saveCurrent()
        case "ide:format":
            formatCurrent()
            autosaveCurrent()
        case "ide:refresh-project":
            scanProjectFiles()
        case "ide:refresh-git":
            refreshGitChanges()
        case "ide:scan-problems":
            scanProblemMarkers()
        case "ide:toggle-preview":
            showPreview.toggle()
        case "ide:toggle-terminal":
            showTerminal.toggle()
        case "ide:new-scratch":
            newScratch()
        default:
            terminal.run(command.command)
            showTerminal = true
        }
        commandPaletteQuery = ""
    }

    func commitAllChanges() {
        let trimmed = gitCommitMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            status = "Add a commit message first"
            return
        }
        terminal.run("git add -A && git commit -m \(shellQuoted(trimmed))")
        gitCommitMessage = ""
        refreshGitChanges()
    }

    private func shellQuoted(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\\''"))'"
    }

    nonisolated private static func executeShell(_ command: String, cwd: String) -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lc", command]
        process.currentDirectoryURL = URL(fileURLWithPath: cwd)
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        do {
            try process.run()
            process.waitUntilExit()
            return String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        } catch {
            return ""
        }
    }

    func formatCurrent() {
        let plugin = selectedPlugin
        switch plugin.id {
        case "json":
            if let data = editorText.data(using: .utf8),
               let object = try? JSONSerialization.jsonObject(with: data),
               let pretty = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys]),
               let formatted = String(data: pretty, encoding: .utf8) {
                editorText = formatted + "\n"
            }
        case "markdown":
            editorText = editorText
                .components(separatedBy: .newlines)
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .joined(separator: "\n")
        case "shell", "swift", "typescript", "javascript", "css", "html", "python":
            editorText = editorText
                .components(separatedBy: .newlines)
                .map { $0.replacingOccurrences(of: "\t", with: "    ").trimmingCharacters(in: .whitespaces) }
                .joined(separator: "\n")
        default:
            editorText = editorText.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if !editorText.hasSuffix("\n") {
            editorText += "\n"
        }
        status = "Formatted with \(plugin.language)"
        runDiagnostics()
    }

    static func defaultCodePlugins() -> [IDECodePlugin] {
        [
            IDECodePlugin(id: "swift", language: "Swift", icon: "swift", extensions: ["swift"], formatter: "swift-format", diagnostics: ["Swift plugin: actors, async, and SwiftUI hints enabled."]),
            IDECodePlugin(id: "typescript", language: "TypeScript", icon: "chevron.left.forwardslash.chevron.right", extensions: ["ts", "tsx"], formatter: "prettier", diagnostics: ["TypeScript plugin: import and type-shape checks enabled."]),
            IDECodePlugin(id: "javascript", language: "JavaScript", icon: "curlybraces", extensions: ["js", "jsx", "mjs"], formatter: "prettier", diagnostics: ["JavaScript plugin: module syntax checks enabled."]),
            IDECodePlugin(id: "json", language: "JSON", icon: "list.bullet.rectangle", extensions: ["json"], formatter: "JSON pretty printer", diagnostics: ["JSON plugin: pretty-print and parse validation enabled."]),
            IDECodePlugin(id: "markdown", language: "Markdown", icon: "text.alignleft", extensions: ["md", "mdx"], formatter: "markdown tidy", diagnostics: ["Markdown plugin: heading and whitespace cleanup enabled."]),
            IDECodePlugin(id: "shell", language: "Shell", icon: "terminal", extensions: ["sh", "zsh", "bash"], formatter: "shfmt-style", diagnostics: ["Shell plugin: command snippets and terminal handoff enabled."]),
            IDECodePlugin(id: "python", language: "Python", icon: "ellipsis.curlybraces", extensions: ["py"], formatter: "black-style", diagnostics: ["Python plugin: indentation normalization enabled."]),
            IDECodePlugin(id: "css", language: "CSS", icon: "paintpalette", extensions: ["css"], formatter: "prettier", diagnostics: ["CSS plugin: selector and spacing cleanup enabled."]),
            IDECodePlugin(id: "html", language: "HTML", icon: "globe", extensions: ["html"], formatter: "prettier", diagnostics: ["HTML plugin: tag and attribute highlighting enabled."]),
            plainTextPlugin,
        ]
    }

    static let plainTextPlugin = IDECodePlugin(id: "plaintext", language: "Plain Text", icon: "doc.plaintext", extensions: ["txt", "share", "site", "index"], formatter: "trim", diagnostics: ["Plain-text plugin: whitespace cleanup enabled."])

    private func languageName(for ext: String) -> String {
        codePlugins.first { $0.extensions.contains(ext.lowercased()) }?.language ?? "Plain Text"
    }

    private func iconName(for ext: String) -> String {
        codePlugins.first { $0.extensions.contains(ext.lowercased()) }?.icon ?? "doc.plaintext"
    }

    private func persistCurrentInMemory() {
        drafts[selectedFileID] = editorText
    }

    private func remember(_ file: IDEShareFile) {
        recentFileIDs.removeAll { $0 == file.id }
        recentFileIDs.insert(file.id, at: 0)
        recentFileIDs = Array(recentFileIDs.prefix(10))
    }

    private func restoreSession() {
        guard let data = UserDefaults.standard.data(forKey: sessionKey),
              let session = try? JSONDecoder().decode(IDEWorkspaceSession.self, from: data) else { return }
        let validIDs = Set(files.map(\.id))
        openFileIDs = session.openFileIDs.filter { validIDs.contains($0) }
        recentFileIDs = session.recentFileIDs.filter { validIDs.contains($0) }
        pinnedFileIDs = Set(session.pinnedFileIDs.filter { validIDs.contains($0) })
        if validIDs.contains(session.selectedFileID) {
            selectedFileID = session.selectedFileID
        }
        if let cwd = session.cwd,
           !hanasandIsDesktopProtectedPath(cwd),
           FileManager.default.fileExists(atPath: cwd) {
            terminal.cwd = cwd
        }
        showPreview = session.showPreview ?? showPreview
        showTerminal = session.showTerminal ?? showTerminal
        showSyntaxPreview = session.showSyntaxPreview ?? showSyntaxPreview
        autosaveEnabled = session.autosaveEnabled ?? autosaveEnabled
        autoformatEnabled = session.autoformatEnabled ?? autoformatEnabled
    }

    private func persistSession() {
        let session = IDEWorkspaceSession(
            selectedFileID: selectedFileID,
            openFileIDs: openFileIDs,
            recentFileIDs: recentFileIDs,
            pinnedFileIDs: Array(pinnedFileIDs),
            cwd: terminal.cwd,
            showPreview: showPreview,
            showTerminal: showTerminal,
            showSyntaxPreview: showSyntaxPreview,
            autosaveEnabled: autosaveEnabled,
            autoformatEnabled: autoformatEnabled
        )
        if let encoded = try? JSONEncoder().encode(session) {
            UserDefaults.standard.set(encoded, forKey: sessionKey)
        }
    }

    func persistWorkspaceState() {
        persistSession()
    }
}

struct IDEWorkspace: View {
    @EnvironmentObject private var appModel: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @StateObject private var model = IDEWorkspaceModel()
    @State private var terminalAutoScroll = true
    @State private var toolsExpanded = false

    var body: some View {
        VStack(spacing: 0) {
            TopBar()
            HStack(spacing: 0) {
                ideNavigator
                    .frame(width: 300)
                Divider()
                    .background(theme.divider)
                VStack(spacing: 0) {
                    ideMinimalHeader
                    editorTabStrip
                    editorPane
                }
                Divider()
                    .background(theme.divider)
                ideToolRail
                    .frame(width: toolsExpanded ? 340 : 56)
            }
        }
        .background(theme.background)
        .onAppear {
            model.configure(settings: appModel.settings)
            consumeIDEOpenRequest()
        }
        .onChange(of: appModel.ideOpenRequest?.id) { _, _ in
            consumeIDEOpenRequest()
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.willTerminateNotification)) { _ in
            model.saveCurrent()
        }
        .onDisappear {
            model.saveCurrent()
        }
    }

    private func consumeIDEOpenRequest() {
        model.configure(settings: appModel.settings)
        guard let request = appModel.ideOpenRequest else { return }
        model.openRequest(request)
        appModel.ideOpenRequest = nil
    }

    private var ideNavigator: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Files")
                    .font(.system(size: 18, weight: .black))
                    .foregroundStyle(theme.text)
                Text(model.projectStatus)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                    .lineLimit(1)
            }
            .padding(.top, 16)
            .padding(.horizontal, 14)
            .padding(.bottom, 12)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                TextField("Find file", text: $model.projectFileFilter)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.text)
                Button {
                    model.scanProjectFiles()
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 10, weight: .bold))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 10)
            .frame(height: 32)
            .background(theme.field)
            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            .padding(.horizontal, 12)
            .padding(.bottom, 10)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(model.filteredProjectFiles.prefix(90)) { file in
                        Button {
                            model.openProjectFile(file)
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: file.icon)
                                    .font(.system(size: 11, weight: .bold))
                                    .frame(width: 16)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(file.name)
                                        .font(.system(size: 11, weight: .bold))
                                        .lineLimit(1)
                                    Text(file.relativePath)
                                        .font(.system(size: 9, weight: .semibold))
                                        .foregroundStyle(theme.textTertiary)
                                        .lineLimit(1)
                                }
                                Spacer(minLength: 0)
                            }
                            .foregroundStyle(file.absolutePath == model.selectedFile?.diskPath ? theme.text : theme.textSecondary)
                            .padding(.horizontal, 9)
                            .frame(height: 34)
                            .background(file.absolutePath == model.selectedFile?.diskPath ? theme.sidebarSelected : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .help(file.absolutePath)
                    }
                }
                .padding(.horizontal, 8)
            }
            .frame(maxHeight: .infinity)

            Divider()
                .background(theme.divider)

            gitNavigator
                .frame(height: 310)
        }
        .background(theme.sidebar.opacity(0.9))
    }

    private var gitNavigator: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Label("Git", systemImage: "point.3.connected.trianglepath.dotted")
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(theme.text)
                Spacer()
                Button {
                    model.refreshGitChanges()
                    model.refreshGitHistory()
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 10, weight: .bold))
                }
                .buttonStyle(.plain)
            }

            Text(model.gitSummary)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(theme.textTertiary)
                .lineLimit(1)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 5) {
                    ForEach(model.gitChanges.prefix(10)) { change in
                        HStack(spacing: 6) {
                            Button {
                                model.openGitChange(change)
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: change.icon)
                                        .font(.system(size: 10, weight: .bold))
                                        .frame(width: 13)
                                    Text(change.status)
                                        .font(.system(size: 9, weight: .black, design: .monospaced))
                                        .frame(width: 18, alignment: .leading)
                                    Text(change.path)
                                        .font(.system(size: 10, weight: .bold))
                                        .lineLimit(1)
                                    Spacer(minLength: 0)
                                }
                            }
                            .buttonStyle(.plain)
                            Button {
                                model.diffGitChange(change)
                                model.showTerminal = true
                                toolsExpanded = true
                            } label: {
                                Image(systemName: "plus.forwardslash.minus")
                                    .font(.system(size: 9, weight: .bold))
                            }
                            .buttonStyle(.plain)
                        }
                        .foregroundStyle(theme.textSecondary)
                        .padding(.horizontal, 8)
                        .frame(height: 28)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }

                    if model.gitChanges.isEmpty {
                        Text("Working tree clean")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(theme.textTertiary)
                            .padding(.vertical, 6)
                    }

                    Text(model.gitHistorySummary)
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(theme.textTertiary)
                        .textCase(.uppercase)
                        .padding(.top, 6)

                    ForEach(model.gitHistory.prefix(8)) { entry in
                        Text(entry.line)
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundStyle(theme.textSecondary)
                            .lineLimit(1)
                            .padding(.horizontal, 8)
                            .frame(maxWidth: .infinity, minHeight: 24, alignment: .leading)
                            .background(theme.field.opacity(0.72))
                            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                    }
                }
            }
        }
        .padding(12)
    }

    private var ideMinimalHeader: some View {
        HStack(spacing: 10) {
            if let file = model.selectedFile {
                Image(systemName: file.icon)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(theme.accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text(file.title)
                        .font(.system(size: 13, weight: .black))
                        .foregroundStyle(theme.text)
                    Text(file.diskPath ?? file.path)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                        .lineLimit(1)
                }
            }
            Spacer()
            Text(model.status)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(theme.textTertiary)
                .lineLimit(1)
            Button {
                model.saveCurrent()
            } label: {
                Label("Save", systemImage: "square.and.arrow.down")
                    .font(.system(size: 11, weight: .bold))
            }
            .buttonStyle(.plain)
            Button {
                toolsExpanded.toggle()
            } label: {
                Image(systemName: toolsExpanded ? "sidebar.right" : "sidebar.leading")
                    .font(.system(size: 12, weight: .bold))
                    .frame(width: 28, height: 28)
                    .background(theme.cardRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(.plain)
            .help(toolsExpanded ? "Collapse tools" : "Expand tools")
        }
        .padding(.horizontal, 14)
        .frame(height: 48)
        .background(theme.commandBar)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    private var ideToolRail: some View {
        VStack(spacing: 0) {
            Button {
                toolsExpanded.toggle()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: toolsExpanded ? "chevron.right" : "chevron.left")
                        .font(.system(size: 12, weight: .black))
                    if toolsExpanded {
                        Text("Tools")
                            .font(.system(size: 12, weight: .black))
                        Spacer()
                    }
                }
                .foregroundStyle(theme.text)
                .frame(maxWidth: .infinity)
                .frame(height: 42)
                .padding(.horizontal, toolsExpanded ? 12 : 0)
            }
            .buttonStyle(.plain)

            if toolsExpanded {
                expandedTools
            } else {
                collapsedTools
            }
        }
        .background(theme.sidebar.opacity(0.9))
    }

    private var collapsedTools: some View {
        VStack(spacing: 10) {
            IDEToolIconButton(icon: "square.and.arrow.down", label: "Save") {
                model.saveCurrent()
            }
            IDEToolIconButton(icon: "wand.and.stars", label: "Format") {
                model.formatCurrent()
                model.autosaveCurrent()
            }
            IDEToolIconButton(icon: "terminal", label: "Terminal") {
                model.showTerminal.toggle()
                toolsExpanded = true
                model.persistWorkspaceState()
            }
            IDEToolIconButton(icon: "safari", label: "Preview") {
                if let file = model.selectedFile {
                    model.preview(file, settings: appModel.settings)
                }
                model.showPreview.toggle()
                toolsExpanded = true
                model.persistWorkspaceState()
            }
            IDEToolIconButton(icon: "exclamationmark.triangle", label: "Problems") {
                model.scanProblemMarkers()
                toolsExpanded = true
            }
            IDEToolIconButton(icon: "play.fill", label: "Run") {
                if let command = model.currentFileRunCommands.first {
                    model.terminal.run(command.command)
                    model.showTerminal = true
                    toolsExpanded = true
                }
            }
            Spacer()
        }
        .padding(.top, 10)
    }

    private var expandedTools: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                toolsSection("Actions") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 116), spacing: 7)], spacing: 7) {
                        BrowserAgentButton(title: "Open file", icon: "folder") {
                            openLocalFile()
                        }
                        BrowserAgentButton(title: "New scratch", icon: "plus") {
                            model.newScratch()
                        }
                        BrowserAgentButton(title: "Export", icon: "square.and.arrow.up") {
                            exportCurrentFile()
                        }
                        BrowserAgentButton(title: "Format", icon: "wand.and.stars") {
                            model.formatCurrent()
                            model.autosaveCurrent()
                        }
                        BrowserAgentButton(title: model.autosaveEnabled ? "Autosave on" : "Autosave off", icon: "externaldrive.badge.checkmark") {
                            model.autosaveEnabled.toggle()
                            model.persistWorkspaceState()
                        }
                        BrowserAgentButton(title: "Discard", icon: "xmark.circle") {
                            model.discardUnsavedChanges()
                        }
                    }
                }

                toolsSection("Run") {
                    ForEach(model.currentFileRunCommands.prefix(3)) { command in
                        IDEToolCommandRow(command: command) {
                            model.terminal.run(command.command)
                            model.showTerminal = true
                        }
                    }
                    ForEach(model.workspaceTasks.prefix(4)) { task in
                        IDEToolCommandRow(command: task) {
                            model.terminal.run(task.command)
                            model.showTerminal = true
                        }
                    }
                }

                toolsSection("Git commands") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 7)], spacing: 7) {
                        BrowserAgentButton(title: "Status", icon: "waveform.path.ecg") {
                            model.terminal.run("git status --short")
                            model.showTerminal = true
                        }
                        BrowserAgentButton(title: "Pull", icon: "arrow.down.circle") {
                            model.terminal.run("git pull --ff-only")
                            model.showTerminal = true
                        }
                        BrowserAgentButton(title: "Push", icon: "arrow.up.circle") {
                            model.terminal.run("git push")
                            model.showTerminal = true
                        }
                        BrowserAgentButton(title: "Log", icon: "clock.arrow.circlepath") {
                            model.terminal.run("git log --oneline -12")
                            model.showTerminal = true
                        }
                    }
                    Text(model.gitCommitPreview)
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundStyle(theme.textTertiary)
                        .lineLimit(6)
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }

                toolsSection("Menus") {
                    HStack(spacing: 8) {
                        Toggle("Preview", isOn: Binding(
                            get: { model.showPreview },
                            set: {
                                model.showPreview = $0
                                model.persistWorkspaceState()
                            }
                        ))
                        Toggle("Terminal", isOn: Binding(
                            get: { model.showTerminal },
                            set: {
                                model.showTerminal = $0
                                model.persistWorkspaceState()
                            }
                        ))
                    }
                    .toggleStyle(.checkbox)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(theme.textSecondary)

                    if model.showPreview {
                        previewPane
                            .frame(height: 280)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    if model.showTerminal {
                        terminalPane
                            .frame(height: 300)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }

                toolsSection("Problems") {
                    Text(model.problemsSummary)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(theme.textTertiary)
                    ForEach(model.problemMarkers.prefix(6)) { marker in
                        IDEProblemRow(marker: marker) {
                            model.openProblemMarker(marker)
                        }
                    }
                }

                toolsSection("Outline") {
                    if model.outlineItems.isEmpty {
                        Text("No symbols yet")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(theme.textTertiary)
                    } else {
                        ForEach(model.outlineItems.prefix(8)) { item in
                            HStack(spacing: 7) {
                                Image(systemName: item.icon)
                                    .frame(width: 14)
                                Text(item.title)
                                    .lineLimit(1)
                                Spacer()
                                Text("\(item.line)")
                                    .foregroundStyle(theme.textTertiary)
                            }
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(theme.textSecondary)
                        }
                    }
                }

                toolsSection("Snippets") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 7)], spacing: 7) {
                        ForEach(model.selectedSnippets.prefix(6)) { snippet in
                            BrowserAgentButton(title: snippet.title, icon: snippet.icon) {
                                model.insertSnippet(snippet)
                            }
                        }
                    }
                }
            }
            .padding(12)
        }
    }

    @ViewBuilder
    private func toolsSection<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 10, weight: .black))
                .foregroundStyle(theme.textTertiary)
                .textCase(.uppercase)
            content()
        }
    }

    private var ideRail: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Native IDE")
                        .font(.system(size: 18, weight: .black))
                        .foregroundStyle(theme.text)
                    Text("Local drafts, disk files, and live previews")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(theme.textTertiary)
                }
                .padding(.top, 18)
                .padding(.horizontal, 14)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                TextField("Filter drafts", text: $model.searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.text)
            }
            .padding(.horizontal, 10)
            .frame(height: 32)
            .background(theme.field)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .padding(.horizontal, 10)

            VStack(alignment: .leading, spacing: 8) {
                Text("Command Palette")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                HStack(spacing: 6) {
                    Image(systemName: "command")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(theme.textTertiary)
                    TextField("Run action", text: $model.commandPaletteQuery)
                        .textFieldStyle(.plain)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(theme.text)
                }
                .padding(.horizontal, 8)
                .frame(height: 28)
                .background(theme.field)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                ForEach(model.paletteCommands.prefix(4)) { command in
                    Button {
                        model.runPaletteCommand(command)
                    } label: {
                        HStack(spacing: 7) {
                            Image(systemName: command.icon)
                                .frame(width: 14)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(command.title)
                                    .font(.system(size: 10, weight: .bold))
                                    .lineLimit(1)
                                Text(command.command)
                                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(theme.textTertiary)
                                    .lineLimit(1)
                            }
                            Spacer()
                        }
                        .foregroundStyle(theme.textSecondary)
                        .padding(.horizontal, 8)
                        .frame(height: 34)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)

            VStack(alignment: .leading, spacing: 6) {
                ForEach(model.filteredFiles) { file in
                    Button {
                        model.select(file)
                        model.preview(file, settings: appModel.settings)
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: file.icon)
                                .frame(width: 18)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(file.title)
                                    .font(.system(size: 13, weight: .bold))
                                Text(file.path)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(theme.textTertiary)
                            }
                            Spacer()
                        }
                        .foregroundStyle(model.selectedFileID == file.id ? theme.text : theme.textSecondary)
                        .padding(.horizontal, 12)
                        .frame(height: 48)
                        .background(model.selectedFileID == file.id ? theme.sidebarSelected : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 8)

            if !model.pinnedFiles.isEmpty || !model.recentFiles.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Memory")
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(theme.textTertiary)
                        .textCase(.uppercase)
                    ForEach(model.pinnedFiles.prefix(4)) { file in
                        IDEMemoryFileButton(file: file, icon: "pin.fill") {
                            model.select(file)
                        }
                    }
                    ForEach(model.recentFiles.prefix(4)) { file in
                        if !model.pinnedFileIDs.contains(file.id) {
                            IDEMemoryFileButton(file: file, icon: "clock") {
                                model.select(file)
                            }
                        }
                    }
                }
                .padding(.horizontal, 12)
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Project")
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(theme.textTertiary)
                        .textCase(.uppercase)
                    Spacer()
                    Button {
                        model.scanProjectFiles()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 10, weight: .bold))
                    }
                    .buttonStyle(.plain)
                }
                Text(model.projectStatus)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(theme.textTertiary)
                    TextField("Find file", text: $model.projectFileFilter)
                        .textFieldStyle(.plain)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(theme.text)
                }
                .padding(.horizontal, 8)
                .frame(height: 26)
                .background(theme.field)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 3) {
                        ForEach(model.filteredProjectFiles.prefix(32)) { file in
                            Button {
                                model.openProjectFile(file)
                            } label: {
                                HStack(spacing: 7) {
                                    Image(systemName: file.icon)
                                        .font(.system(size: 10, weight: .bold))
                                        .frame(width: 14)
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(file.name)
                                            .font(.system(size: 11, weight: .bold))
                                            .lineLimit(1)
                                        Text(file.relativePath)
                                            .font(.system(size: 9, weight: .semibold))
                                            .foregroundStyle(theme.textTertiary)
                                            .lineLimit(1)
                                    }
                                    Spacer()
                                }
                                .foregroundStyle(theme.textSecondary)
                                .padding(.horizontal, 8)
                                .frame(height: 34)
                                .background(file.absolutePath == model.selectedFile?.diskPath ? theme.sidebarSelected : Color.clear)
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .help(file.absolutePath)
                        }
                    }
                }
                .frame(maxHeight: 180)
            }
            .padding(.horizontal, 12)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Problems")
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(theme.textTertiary)
                        .textCase(.uppercase)
                    Spacer()
                    Button {
                        model.scanProblemMarkers()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 10, weight: .bold))
                    }
                    .buttonStyle(.plain)
                }
                Text(model.problemsSummary)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
                    .lineLimit(1)
                if !model.problemMarkers.isEmpty {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 4) {
                            ForEach(model.problemMarkers.prefix(6)) { marker in
                                Button {
                                    model.openProblemMarker(marker)
                                } label: {
                                    HStack(spacing: 7) {
                                        Image(systemName: marker.icon)
                                            .foregroundStyle(marker.severity == "error" ? theme.danger : theme.accent)
                                            .frame(width: 14)
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text("\(URL(fileURLWithPath: marker.filePath).lastPathComponent):\(marker.line)")
                                                .font(.system(size: 10, weight: .bold))
                                                .lineLimit(1)
                                            Text(marker.detail)
                                                .font(.system(size: 9, weight: .semibold))
                                                .foregroundStyle(theme.textTertiary)
                                                .lineLimit(1)
                                        }
                                        Spacer()
                                    }
                                    .foregroundStyle(theme.textSecondary)
                                    .padding(.horizontal, 8)
                                    .frame(height: 34)
                                    .background(theme.field)
                                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                                }
                                .buttonStyle(.plain)
                                .help(marker.filePath)
                            }
                        }
                    }
                    .frame(maxHeight: 132)
                }
            }
            .padding(.horizontal, 12)

            VStack(alignment: .leading, spacing: 8) {
                Text("Git")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                HStack(spacing: 6) {
                    BrowserAgentButton(title: "Status", icon: "waveform.path.ecg") {
                        model.terminal.run("git status --short")
                        model.refreshGitChanges()
                        model.showTerminal = true
                    }
                    BrowserAgentButton(title: "Pull", icon: "arrow.down.circle") {
                        model.terminal.run("git pull --ff-only")
                        model.refreshGitChanges()
                        model.showTerminal = true
                    }
                    BrowserAgentButton(title: "Push", icon: "arrow.up.circle") {
                        model.terminal.run("git push")
                        model.refreshGitChanges()
                        model.showTerminal = true
                    }
                }
                HStack(spacing: 6) {
                    BrowserAgentButton(title: "Branch", icon: "point.3.connected.trianglepath.dotted") {
                        model.terminal.run("git branch --show-current")
                        model.showTerminal = true
                    }
                    BrowserAgentButton(title: "Log", icon: "clock.arrow.circlepath") {
                        model.terminal.run("git log --oneline -8")
                        model.showTerminal = true
                    }
                    BrowserAgentButton(title: "Diff", icon: "plus.forwardslash.minus") {
                        model.terminal.run("git diff --stat")
                        model.showTerminal = true
                    }
                }
                HStack {
                    Text(model.gitSummary)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                        .lineLimit(1)
                    Spacer()
                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(model.gitCommitPreview, forType: .string)
                    } label: {
                        Image(systemName: "doc.on.doc")
                            .font(.system(size: 10, weight: .bold))
                    }
                    .buttonStyle(.plain)
                    Button {
                        model.refreshGitChanges()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 10, weight: .bold))
                    }
                    .buttonStyle(.plain)
                }
                if !model.gitChanges.isEmpty {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 4) {
                            ForEach(model.gitChanges.prefix(8)) { change in
                                HStack(spacing: 6) {
                                    Button {
                                        model.openGitChange(change)
                                    } label: {
                                        HStack(spacing: 6) {
                                            Image(systemName: change.icon)
                                                .frame(width: 13)
                                            Text(change.status)
                                                .font(.system(size: 9, weight: .black, design: .monospaced))
                                                .frame(width: 18, alignment: .leading)
                                            Text(change.path)
                                                .lineLimit(1)
                                            Spacer()
                                        }
                                    }
                                    .buttonStyle(.plain)
                                    Button {
                                        model.diffGitChange(change)
                                        model.showTerminal = true
                                    } label: {
                                        Image(systemName: "plus.forwardslash.minus")
                                            .font(.system(size: 9, weight: .bold))
                                    }
                                    .buttonStyle(.plain)
                                }
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(theme.textSecondary)
                                .padding(.horizontal, 8)
                                .frame(height: 28)
                                .background(theme.field)
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                        }
                    }
                    .frame(maxHeight: 124)
                }
                if !model.gitChanges.isEmpty {
                    Text(model.gitCommitPreview)
                        .font(.system(size: 9, weight: .semibold, design: .monospaced))
                        .foregroundStyle(theme.textTertiary)
                        .lineLimit(4)
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                HStack(spacing: 6) {
                    TextField("Commit message", text: $model.gitCommitMessage)
                        .textFieldStyle(.plain)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(theme.text)
                        .padding(.horizontal, 8)
                        .frame(height: 26)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    BrowserAgentButton(title: "Commit", icon: "checkmark.circle") {
                        model.commitAllChanges()
                        model.showTerminal = true
                    }
                }
            }
            .padding(.horizontal, 12)

            VStack(alignment: .leading, spacing: 8) {
                Text("Tasks")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 6)], spacing: 6) {
                    ForEach(model.workspaceTasks.prefix(6)) { task in
                        BrowserAgentButton(title: task.title, icon: task.icon) {
                            model.terminal.run(task.command)
                            model.showTerminal = true
                        }
                    }
                }
            }
            .padding(.horizontal, 12)

            VStack(alignment: .leading, spacing: 8) {
                Text("Plugins")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                ForEach(model.codePlugins.prefix(6)) { plugin in
                    Button {
                        model.togglePlugin(plugin)
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: plugin.icon)
                                .frame(width: 16)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(plugin.language)
                                    .font(.system(size: 11, weight: .bold))
                                Text(plugin.formatter)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(theme.textTertiary)
                            }
                            Spacer()
                            Image(systemName: model.enabledPluginIDs.contains(plugin.id) ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(plugin.id == model.selectedPlugin.id ? theme.accent : theme.textTertiary)
                        }
                        .foregroundStyle(theme.textSecondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)

            VStack(alignment: .leading, spacing: 8) {
                Text("Outline")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                if model.outlineItems.isEmpty {
                    Text("No symbols yet")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                } else {
                    ForEach(model.outlineItems.prefix(5)) { item in
                        HStack(spacing: 7) {
                            Image(systemName: item.icon)
                                .frame(width: 14)
                            Text(item.title)
                                .lineLimit(1)
                            Spacer()
                            Text("\(item.line)")
                                .foregroundStyle(theme.textTertiary)
                        }
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(theme.textSecondary)
                    }
                }
            }
            .padding(.horizontal, 12)

            VStack(alignment: .leading, spacing: 8) {
                Text("Snippets")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                HStack(spacing: 6) {
                    ForEach(model.selectedSnippets.prefix(3)) { snippet in
                        BrowserAgentButton(title: snippet.title, icon: snippet.icon) {
                            model.insertSnippet(snippet)
                        }
                    }
                }
            }
            .padding(.horizontal, 12)

            Spacer()

            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    BrowserAgentButton(title: "Open file", icon: "folder") {
                        openLocalFile()
                    }
                    BrowserAgentButton(title: "Export", icon: "square.and.arrow.up") {
                        exportCurrentFile()
                    }
                }
                BrowserAgentButton(title: "New scratch", icon: "plus") {
                    model.newScratch()
                }
                Label("Local drafts persist in this app", systemImage: "tray.full")
                Label("Disk files save back to disk", systemImage: "internaldrive")
                Label("Preview and terminal stay docked", systemImage: "rectangle.split.3x1")
            }
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(theme.textTertiary)
                .padding(14)
            }
            .padding(.bottom, 14)
        }
        .background(theme.sidebar.opacity(0.86))
    }

    private var ideHeader: some View {
        HStack(spacing: 10) {
            if let file = model.selectedFile {
                Label(file.title, systemImage: file.icon)
                    .font(.system(size: 13, weight: .black))
                Text(file.language)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                    .padding(.horizontal, 8)
                    .frame(height: 22)
                    .background(theme.card)
                    .clipShape(Capsule())
            }
            Spacer()
            Text(model.status)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(theme.textTertiary)
            if let runCommand = model.currentFileRunCommands.first {
                BrowserAgentButton(title: runCommand.title, icon: runCommand.icon) {
                    model.terminal.run(runCommand.command)
                    model.showTerminal = true
                }
            }
            BrowserAgentButton(title: "Save", icon: "square.and.arrow.down") {
                model.saveCurrent()
            }
            BrowserAgentButton(title: "Save disk", icon: "internaldrive") {
                if let path = model.selectedFile?.diskPath {
                    model.exportCurrent(to: URL(fileURLWithPath: path))
                } else {
                    exportCurrentFile()
                }
            }
            if model.selectedFile?.diskPath != nil {
                BrowserAgentButton(title: "Copy path", icon: "doc.on.doc") {
                    if let path = model.selectedFile?.diskPath {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(path, forType: .string)
                    }
                }
                BrowserAgentButton(title: "Reveal", icon: "folder") {
                    if let path = model.selectedFile?.diskPath {
                        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: path)])
                    }
                }
                BrowserAgentButton(title: "Check disk", icon: "externaldrive.badge.questionmark") {
                    model.checkCurrentDiskState()
                }
                BrowserAgentButton(title: "Reload disk", icon: "arrow.clockwise") {
                    model.reloadCurrentFromDisk()
                }
            }
            BrowserAgentButton(title: "Format", icon: "text.alignleft") {
                model.formatCurrent()
                model.autosaveCurrent()
            }
            BrowserAgentButton(title: model.autosaveEnabled ? "Autosave on" : "Autosave off", icon: "externaldrive.badge.checkmark") {
                model.autosaveEnabled.toggle()
                model.persistWorkspaceState()
            }
            BrowserAgentButton(title: model.autoformatEnabled ? "Format on save" : "Manual format", icon: "wand.and.stars") {
                model.autoformatEnabled.toggle()
                model.persistWorkspaceState()
            }
            BrowserAgentButton(title: "Reset", icon: "arrow.uturn.backward") {
                model.resetCurrent()
            }
            if model.isDirty {
                BrowserAgentButton(title: "Discard", icon: "xmark.circle") {
                    model.discardUnsavedChanges()
                }
            }
            BrowserAgentButton(title: "Preview", icon: "play.rectangle") {
                if let file = model.selectedFile {
                    model.preview(file, settings: appModel.settings)
                }
            }
            BrowserAgentButton(title: model.showPreview ? "Hide preview" : "Show preview", icon: "rectangle.rightthird.inset.filled") {
                model.showPreview.toggle()
                model.persistWorkspaceState()
            }
            BrowserAgentButton(title: model.showTerminal ? "Hide terminal" : "Show terminal", icon: "terminal") {
                model.showTerminal.toggle()
                model.persistWorkspaceState()
            }
            BrowserAgentButton(title: "Open /s", icon: "square.and.arrow.up") {
                model.previewTab?.load(appModel.settings.websiteBaseURL.normalizedBaseURL.appendingPathComponent("s").absoluteString)
            }
        }
        .foregroundStyle(theme.text)
        .padding(.horizontal, 16)
        .frame(height: 48)
        .background(theme.commandBar)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    private var editorTabStrip: some View {
        HStack(spacing: 8) {
            ForEach(model.openFiles) { file in
                IDEEditorTabButton(file: file, selected: model.selectedFileID == file.id) {
                    model.select(file)
                } close: {
                    model.closeTab(file)
                }
            }
            Spacer()
            if let selected = model.selectedFile {
                Button {
                    model.togglePin(selected)
                } label: {
                    Image(systemName: model.pinnedFileIDs.contains(selected.id) ? "pin.fill" : "pin")
                        .font(.system(size: 11, weight: .bold))
                }
                .buttonStyle(.plain)
                .foregroundStyle(model.pinnedFileIDs.contains(selected.id) ? theme.accent : theme.textTertiary)
            }
            Text(model.selectedFileStorageLabel)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(model.isDirty ? theme.accent : theme.textTertiary)
            Text(model.selectedPlugin.language)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(theme.textTertiary)
        }
        .padding(.horizontal, 12)
        .frame(height: 38)
        .background(theme.backgroundElevated)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    private var editorPane: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text(model.selectedFile?.title ?? "editor")
                    .font(.system(size: 12, weight: .bold))
                ForEach(model.currentFileRunCommands.dropFirst().prefix(2)) { command in
                    BrowserAgentButton(title: command.title, icon: command.icon) {
                        model.terminal.run(command.command)
                        model.showTerminal = true
                    }
                }
                Spacer()
                Image(systemName: "circle.fill")
                    .font(.system(size: 7))
                    .foregroundStyle(theme.accent)
                Text(model.selectedFileModeLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
            }
            .padding(.horizontal, 14)
            .frame(height: 36)
            .background(theme.backgroundElevated)

            HStack(spacing: 8) {
                BrowserAgentField(
                    title: "Find",
                    text: $model.editorFindText,
                    placeholder: "Search buffer"
                )
                BrowserAgentField(
                    title: "Replace",
                    text: $model.editorReplaceText,
                    placeholder: "Replacement"
                )
                Text("\(model.findMatchCount) matches")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                BrowserAgentButton(title: "Replace all", icon: "arrow.triangle.2.circlepath") {
                    model.replaceAllMatches()
                }
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(theme.commandBar.opacity(0.72))

            if !model.inlineDiff.isEmpty {
                IDEInlineDiffView(title: model.inlineDiffTitle, diff: model.inlineDiff, hunks: model.inlineDiffHunks) {
                    model.inlineDiff = ""
                } jumpToLine: { line in
                    model.highlight(line: line)
                }
                .frame(maxHeight: 190)
            }

            HStack(alignment: .top, spacing: 0) {
                ScrollView {
                    VStack(alignment: .trailing, spacing: 0) {
                        ForEach(1...model.editorLineCount, id: \.self) { line in
                            Text("\(line)")
                                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                .foregroundStyle(model.highlightedLine == line ? theme.text : theme.textTertiary)
                                .frame(width: 46, height: 20, alignment: .trailing)
                                .padding(.trailing, 8)
                                .background(model.highlightedLine == line ? theme.accent.opacity(0.34) : Color.clear)
                        }
                    }
                    .padding(.top, 15)
                    .padding(.bottom, 12)
                }
                .frame(width: 56)
                .background(theme.commandBar.opacity(0.62))

                HanasandCodeEditor(text: $model.editorText, highlightedLine: model.highlightedLine)
                    .background(theme.background)
                    .onChange(of: model.editorText) { _, _ in
                        model.runDiagnostics()
                        model.autosaveCurrent()
                    }
            }

            if model.showSyntaxPreview {
                IDEHighlightedCodeView(code: model.editorText, plugin: model.selectedPlugin)
                    .frame(maxHeight: 170)
            }

            HStack(spacing: 10) {
                Label("\(model.editorText.count) chars", systemImage: "textformat.size")
                Label(model.autosaveState, systemImage: model.autosaveState.contains("failed") ? "exclamationmark.triangle" : "externaldrive.badge.checkmark")
                    .foregroundStyle(model.autosaveState.contains("failed") ? theme.danger : theme.textTertiary)
                if let diskPath = model.selectedFile?.diskPath {
                    Label(diskPath, systemImage: "internaldrive")
                        .lineLimit(1)
                }
                if model.selectedDiskFileChangedExternally {
                    Label("Changed on disk", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(theme.danger)
                }
                Label(model.selectedPlugin.formatter, systemImage: "puzzlepiece.extension")
                ForEach(model.diagnostics, id: \.self) { diagnostic in
                    Label(diagnostic, systemImage: diagnostic == "No diagnostics." ? "checkmark.circle" : "exclamationmark.triangle")
                }
                Spacer()
                Button(model.showSyntaxPreview ? "Hide syntax" : "Show syntax") {
                    model.showSyntaxPreview.toggle()
                    model.persistWorkspaceState()
                }
                .buttonStyle(.plain)
            }
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(theme.textTertiary)
            .padding(.horizontal, 12)
            .frame(height: 30)
            .background(theme.commandBar.opacity(0.62))
        }
    }

    private var previewPane: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Label("Share preview", systemImage: "safari")
                    .font(.system(size: 12, weight: .bold))
                Spacer()
                BrowserAgentButton(title: "Back", icon: "chevron.left") {
                    model.previewTab?.goBack()
                }
                BrowserAgentButton(title: "Forward", icon: "chevron.right") {
                    model.previewTab?.goForward()
                }
                BrowserAgentButton(title: "Copy URL", icon: "doc.on.doc") {
                    if let url = model.previewTab?.webView.url?.absoluteString {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(url, forType: .string)
                    }
                }
                BrowserAgentButton(title: "Open", icon: "arrow.up.forward.square") {
                    if let url = model.previewTab?.webView.url {
                        NSWorkspace.shared.open(url)
                    }
                }
                BrowserAgentButton(title: "Reload", icon: "arrow.clockwise") {
                    model.previewTab?.reloadOrStop()
                }
                BrowserAgentButton(title: "Inspect", icon: "scope") {
                    model.previewTab?.refreshAgentElements()
                }
                BrowserAgentButton(title: "Click", icon: "cursorarrow.click") {
                    model.previewTab?.clickAgentSelector()
                }
            }
            .foregroundStyle(theme.text)
            .padding(.horizontal, 12)
            .frame(height: 36)
            .background(theme.backgroundElevated)

            if let tab = model.previewTab {
                VStack(spacing: 0) {
                    NativeBrowserView(tab: tab)
                    if !tab.agentElements.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(tab.agentElements.prefix(12)) { element in
                                    HStack(spacing: 4) {
                                        Button {
                                            tab.agentSelector = element.selector
                                            tab.clickAgentSelector(element.selector)
                                        } label: {
                                            Text(element.label.isEmpty ? element.role : element.label)
                                                .font(.system(size: 10, weight: .bold))
                                                .lineLimit(1)
                                                .foregroundStyle(theme.text)
                                                .padding(.horizontal, 9)
                                                .frame(height: 26)
                                                .background(theme.card)
                                                .clipShape(Capsule())
                                        }
                                        .buttonStyle(.plain)
                                        Button {
                                            NSPasteboard.general.clearContents()
                                            NSPasteboard.general.setString(element.selector, forType: .string)
                                            tab.agentSelector = element.selector
                                            tab.agentStatus = "Copied selector \(element.selector)"
                                        } label: {
                                            Image(systemName: "doc.on.doc")
                                                .font(.system(size: 9, weight: .bold))
                                                .foregroundStyle(theme.textTertiary)
                                                .frame(width: 22, height: 26)
                                                .background(theme.card)
                                                .clipShape(Capsule())
                                        }
                                        .buttonStyle(.plain)
                                    }
                                    .help(element.selector)
                                }
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 6)
                        }
                        .background(theme.commandBar)
                    }
                }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(theme.background)
    }

    private var terminalPane: some View {
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

    private func openLocalFile() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        if panel.runModal() == .OK, let url = panel.url {
            model.importLocalFile(url)
        }
    }

    private func exportCurrentFile() {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = model.selectedFile?.title ?? "scratch.md"
        if panel.runModal() == .OK, let url = panel.url {
            model.exportCurrent(to: url)
        }
    }
}

struct IDEToolIconButton: View {
    @Environment(\.desktopTheme) private var theme
    let icon: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(theme.textSecondary)
                .frame(width: 34, height: 34)
                .background(theme.cardRaised)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        }
        .buttonStyle(.plain)
        .help(label)
        .accessibilityLabel(label)
    }
}

struct IDEToolCommandRow: View {
    @Environment(\.desktopTheme) private var theme
    let command: IDEQuickCommand
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: command.icon)
                    .font(.system(size: 11, weight: .bold))
                    .frame(width: 16)
                VStack(alignment: .leading, spacing: 2) {
                    Text(command.title)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(theme.text)
                        .lineLimit(1)
                    Text(command.command)
                        .font(.system(size: 9, weight: .semibold, design: .monospaced))
                        .foregroundStyle(theme.textTertiary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 9)
            .frame(height: 38)
            .background(theme.field)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct IDEProblemRow: View {
    @Environment(\.desktopTheme) private var theme
    let marker: IDEProblemMarker
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: marker.icon)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(marker.severity == "error" ? theme.danger : theme.accent)
                    .frame(width: 16)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(URL(fileURLWithPath: marker.filePath).lastPathComponent):\(marker.line)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(theme.text)
                        .lineLimit(1)
                    Text(marker.detail)
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 9)
            .frame(height: 36)
            .background(theme.field)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct IDEEditorTabButton: View {
    @Environment(\.desktopTheme) private var theme
    let file: IDEShareFile
    let selected: Bool
    let select: () -> Void
    let close: () -> Void

    var body: some View {
        Button(action: select) {
            HStack(spacing: 8) {
                Image(systemName: file.icon)
                    .font(.system(size: 11, weight: .bold))
                Text(file.title)
                    .lineLimit(1)
                    .frame(maxWidth: 150, alignment: .leading)
                Button(action: close) {
                    Image(systemName: "xmark")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(theme.textTertiary)
                }
                .buttonStyle(.plain)
            }
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(selected ? theme.text : theme.textSecondary)
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(selected ? theme.commandBar : theme.card.opacity(0.72))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct IDEMemoryFileButton: View {
    @Environment(\.desktopTheme) private var theme
    let file: IDEShareFile
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .bold))
                    .frame(width: 14)
                VStack(alignment: .leading, spacing: 1) {
                    Text(file.title)
                        .font(.system(size: 10, weight: .bold))
                        .lineLimit(1)
                    Text(file.path)
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                        .lineLimit(1)
                }
                Spacer()
            }
            .foregroundStyle(theme.textSecondary)
            .padding(.horizontal, 8)
            .frame(height: 32)
            .background(theme.field)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct IDEHighlightedCodeView: View {
    @Environment(\.desktopTheme) private var theme
    let code: String
    let plugin: IDECodePlugin

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Label("Syntax", systemImage: plugin.icon)
                    .font(.system(size: 11, weight: .black))
                Text(plugin.language)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                Spacer()
            }
            .padding(.horizontal, 12)
            .frame(height: 28)
            .background(theme.commandBar)

            ScrollView {
                Text(highlightedCode)
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .padding(12)
            }
            .background(theme.backgroundElevated)
        }
        .overlay(alignment: .top) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    private var highlightedCode: AttributedString {
        var output = AttributedString("")
        for line in code.components(separatedBy: .newlines) {
            output += highlightedLine(line)
            output += AttributedString("\n")
        }
        return output
    }

    private func highlightedLine(_ line: String) -> AttributedString {
        var result = AttributedString("")
        let words = line.split(omittingEmptySubsequences: false, whereSeparator: { $0 == " " || $0 == "\t" })
        var cursor = line.startIndex

        for word in words {
            let wordText = String(word)
            if let range = line[cursor...].range(of: wordText) {
                if cursor < range.lowerBound {
                    result += colored(String(line[cursor..<range.lowerBound]), theme.textSecondary)
                }
                result += colored(wordText, color(for: wordText, fullLine: line))
                cursor = range.upperBound
            }
        }

        if cursor < line.endIndex {
            result += colored(String(line[cursor..<line.endIndex]), theme.textSecondary)
        }

        if line.isEmpty {
            result += AttributedString("")
        }
        return result
    }

    private func color(for token: String, fullLine: String) -> Color {
        let trimmed = token.trimmingCharacters(in: .punctuationCharacters)
        if fullLine.trimmingCharacters(in: .whitespaces).hasPrefix("//")
            || fullLine.trimmingCharacters(in: .whitespaces).hasPrefix("#") {
            return theme.textTertiary
        }
        if ["func", "struct", "class", "let", "var", "import", "return", "if", "else", "guard", "case", "switch", "async", "await", "const", "function", "export", "from", "def", "for", "while"].contains(trimmed) {
            return theme.accent
        }
        if token.contains("\"") || token.contains("'") {
            return theme.green
        }
        if Double(trimmed) != nil {
            return theme.danger
        }
        if token.hasPrefix("<") || token.hasSuffix(">") {
            return theme.accent
        }
        return theme.textSecondary
    }

    private func colored(_ text: String, _ color: Color) -> AttributedString {
        var attributed = AttributedString(text)
        attributed.foregroundColor = color
        return attributed
    }
}

struct IDEInlineDiffView: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let diff: String
    let hunks: [IDEDiffHunk]
    let close: () -> Void
    let jumpToLine: (Int) -> Void
    @State private var sideBySide = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Label(title, systemImage: "plus.forwardslash.minus")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
                Spacer()
                Toggle("Split", isOn: $sideBySide)
                    .toggleStyle(.checkbox)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                ForEach(hunks.prefix(4)) { hunk in
                    Button("Line \(hunk.newLine)") {
                        jumpToLine(hunk.newLine)
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(theme.accent)
                    .help(hunk.title)
                }
                Button(action: close) {
                    Image(systemName: "xmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(theme.textTertiary)
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .frame(height: 30)
            .background(theme.commandBar)

            ScrollView {
                if sideBySide {
                    HStack(alignment: .top, spacing: 10) {
                        Text(sideBySideColumn(prefix: "-"))
                            .foregroundStyle(theme.danger)
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                        Text(sideBySideColumn(prefix: "+"))
                            .foregroundStyle(theme.green)
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .textSelection(.enabled)
                    .padding(12)
                } else {
                    Text(highlightedDiff)
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                        .padding(12)
                }
            }
            .background(theme.backgroundElevated)
        }
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    private func sideBySideColumn(prefix: String) -> String {
        diff.components(separatedBy: .newlines)
            .filter { $0.hasPrefix(prefix) && !$0.hasPrefix(prefix + prefix + prefix) }
            .map { String($0.dropFirst()) }
            .joined(separator: "\n")
    }

    private var highlightedDiff: AttributedString {
        var output = AttributedString("")
        for line in diff.components(separatedBy: .newlines) {
            let color: Color
            if line.hasPrefix("+"), !line.hasPrefix("+++") {
                color = theme.green
            } else if line.hasPrefix("-"), !line.hasPrefix("---") {
                color = theme.danger
            } else if line.hasPrefix("@@") {
                color = theme.accent
            } else {
                color = theme.textSecondary
            }
            var attributed = AttributedString(line + "\n")
            attributed.foregroundColor = color
            output += attributed
        }
        return output
    }
}

struct HanasandCodeEditor: NSViewRepresentable {
    @Binding var text: String
    let highlightedLine: Int?

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = true
        scrollView.autohidesScrollers = false
        scrollView.borderType = .noBorder
        scrollView.drawsBackground = false

        let textView = NSTextView()
        textView.isRichText = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.allowsUndo = true
        textView.font = NSFont.monospacedSystemFont(ofSize: 13, weight: .semibold)
        textView.textColor = NSColor.labelColor
        textView.backgroundColor = .clear
        textView.insertionPointColor = NSColor.systemOrange
        textView.string = text
        textView.delegate = context.coordinator
        textView.textContainerInset = NSSize(width: 12, height: 12)
        textView.minSize = NSSize(width: 0, height: 0)
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = true
        textView.autoresizingMask = [.width]
        textView.textContainer?.widthTracksTextView = false
        textView.textContainer?.containerSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)

        scrollView.documentView = textView
        context.coordinator.textView = textView
        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = context.coordinator.textView else { return }
        if textView.string != text {
            textView.string = text
        }
        context.coordinator.applyHighlight(line: highlightedLine)
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        @Binding var text: String
        weak var textView: NSTextView?
        private var lastHighlightedLine: Int?

        init(text: Binding<String>) {
            _text = text
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            text = textView.string
        }

        func applyHighlight(line: Int?) {
            guard let textView else { return }
            let fullRange = NSRange(location: 0, length: (textView.string as NSString).length)
            textView.textStorage?.removeAttribute(.backgroundColor, range: fullRange)
            guard let line else {
                lastHighlightedLine = nil
                return
            }
            let range = characterRange(for: line, in: textView.string)
            guard range.location != NSNotFound else { return }
            textView.textStorage?.addAttribute(.backgroundColor, value: NSColor.systemOrange.withAlphaComponent(0.28), range: range)
            if lastHighlightedLine != line {
                textView.scrollRangeToVisible(range)
                lastHighlightedLine = line
            }
        }

        private func characterRange(for targetLine: Int, in text: String) -> NSRange {
            let nsText = text as NSString
            let lines = text.components(separatedBy: .newlines)
            guard targetLine >= 1, targetLine <= max(lines.count, 1) else {
                return NSRange(location: NSNotFound, length: 0)
            }
            var location = 0
            for index in 0..<(targetLine - 1) {
                location += (lines.indices.contains(index) ? lines[index].count : 0) + 1
            }
            let length = max(1, lines.indices.contains(targetLine - 1) ? lines[targetLine - 1].count : 0)
            return NSRange(location: min(location, nsText.length), length: min(length, max(0, nsText.length - location)))
        }
    }
}

struct AIWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @StateObject private var chatBrowserPreview = BrowserTabState(label: "AI Browser", url: "https://hanasand.com")
    @State private var showChatBrowserPreview = true
    let commandFocused: FocusState<Bool>.Binding

    var body: some View {
        VStack(spacing: 0) {
            TopBar()
            HStack(spacing: 0) {
                aiSidebar
                    .frame(width: 300)
                Divider()
                    .background(theme.divider)
                VStack(spacing: 0) {
                    aiHeader
                    chatPane
                    composer
                }
            }
        }
        .background(theme.background)
        .task {
            await model.loadAIPage()
        }
        .onDisappear {
            model.disconnectAISocket()
        }
    }

    private var aiHeader: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Hanasand AI")
                    .font(.system(size: 22, weight: .black))
                    .foregroundStyle(theme.text)
                Text(model.aiSummary)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
                    .lineLimit(1)
            }
            Spacer()
            FeatureCard(title: "Socket", value: model.aiSocketConnected ? "Live" : "Offline", icon: model.aiSocketConnected ? "bolt.horizontal.circle" : "bolt.slash")
                .frame(width: 170)
            FeatureCard(title: "Models", value: "\(model.aiClients.count)", icon: "cpu")
                .frame(width: 150)
            FeatureCard(title: "Last run", value: model.aiLastDuration, icon: "timer")
                .frame(width: 170)
            ActionButton(title: "Browser", icon: "globe") {
                model.openInlineBrowser(url: model.browserActiveAddress, title: model.browserActiveTitle, source: "AI toolbar")
            }
            ActionButton(title: "Pop out", icon: "rectangle.inset.filled.and.person.filled") {
                model.popOutBrowser(source: "AI toolbar")
            }
            ActionButton(title: showChatBrowserPreview ? "Hide preview" : "Preview", icon: "rectangle.rightthird.inset.filled") {
                showChatBrowserPreview.toggle()
            }
            ActionButton(title: "Reload", icon: "arrow.clockwise") {
                Task { await model.loadAIPage() }
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(theme.backgroundElevated.opacity(0.96))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    private var aiSidebar: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Runtime")
                    .font(.system(size: 18, weight: .black))
                    .foregroundStyle(theme.text)
                Text(model.aiSocketConnected ? "Streaming tool-aware responses" : "Waiting for runtime")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
            }
            .padding(.top, 18)
            .padding(.horizontal, 16)

            VStack(alignment: .leading, spacing: 8) {
                Text("Models")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                ForEach(model.aiClients.prefix(6)) { client in
                    AIClientRow(client: client)
                }
                if model.aiClients.isEmpty {
                    CompactInfoCard(title: "No model yet", lines: ["Open the AI runtime or reload this page."])
                }
            }
            .padding(.horizontal, 10)

            VStack(alignment: .leading, spacing: 8) {
                Text("Training")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                Text("Run the website-to-app parity drill through the same chat surface you will use.")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                ActionButton(title: model.isRunning ? "Training" : "App parity drill", icon: "graduationcap") {
                    model.submitAppParityTrainingPrompt()
                }
                .disabled(model.isRunning)
            }
            .padding(.horizontal, 10)

            VStack(alignment: .leading, spacing: 8) {
                Text("Run trace")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(model.aiTrace) { event in
                            AITraceRow(event: event)
                        }
                        if model.aiTrace.isEmpty {
                            CompactInfoCard(title: "Trace", lines: ["Tool calls, timing summaries, and file artifacts appear here."])
                        }
                    }
                    .padding(.bottom, 12)
                }
            }
            .padding(.horizontal, 10)

            Spacer(minLength: 0)
        }
        .background(theme.sidebar.opacity(0.88))
    }

    private var chatPane: some View {
        HStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if model.aiMessages.isEmpty {
                        EmptyAIChatCard()
                    } else {
                        ForEach(model.aiMessages) { message in
                            AIMessageBubble(message: message)
                        }
                        if let edit = model.pendingIDEEdit {
                            AIPendingEditPanel(edit: edit)
                                .frame(maxWidth: 720, alignment: .leading)
                        }
                    }
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(theme.background)

            if showChatBrowserPreview {
                Divider()
                    .background(theme.divider)
                AIChatBrowserPreview(tab: chatBrowserPreview)
                    .frame(width: 390)
            }
        }
        .background(theme.background)
        .onAppear {
            chatBrowserPreview.load(model.browserActiveAddress)
        }
        .onChange(of: model.browserActiveAddress) { _, address in
            chatBrowserPreview.load(address)
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Ask Hanasand AI", text: $model.prompt, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(theme.text)
                .lineLimit(2...6)
                .focused(commandFocused)
                .padding(14)
                .background(theme.commandPanel)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .onSubmit {
                    model.submitAIChatPrompt()
                }
            Button {
                model.submitAIChatPrompt()
            } label: {
                Label(model.isRunning ? "Working" : "Send", systemImage: model.isRunning ? "circle.dotted" : "paperplane.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(theme.text)
                    .padding(.horizontal, 16)
                    .frame(height: 46)
                    .background(theme.cardRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(model.isRunning)
        }
        .padding(14)
        .background(theme.commandBar)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }
}

struct AIClientRow: View {
    @Environment(\.desktopTheme) private var theme
    let client: AIConnectedClient

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "cpu")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(theme.accent)
                .frame(width: 32, height: 32)
                .background(theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                Text(client.name)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
                Text(client.statusText)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .background(theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct AIChatBrowserPreview: View {
    @Environment(\.desktopTheme) private var theme
    @ObservedObject var tab: BrowserTabState

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Label(tab.title, systemImage: "globe")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
                Spacer()
                BrowserIconButton(systemName: "scope") {
                    tab.refreshAgentElements()
                }
                .help("Inspect")
                BrowserIconButton(systemName: "arrow.clockwise") {
                    tab.reloadOrStop()
                }
                .help("Reload")
            }
            .padding(.horizontal, 10)
            .frame(height: 34)
            .background(theme.commandBar)
            NativeBrowserView(tab: tab)
            if !tab.agentElements.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(tab.agentElements.prefix(10)) { element in
                            Button {
                                tab.agentSelector = element.selector
                                tab.clickAgentSelector(element.selector)
                            } label: {
                                Text(element.label.isEmpty ? element.role : element.label)
                                    .font(.system(size: 10, weight: .bold))
                                    .lineLimit(1)
                                    .foregroundStyle(theme.text)
                                    .padding(.horizontal, 8)
                                    .frame(height: 24)
                                    .background(theme.card)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(8)
                }
                .background(theme.commandBar)
            }
        }
        .background(theme.backgroundElevated)
    }
}

struct AITraceRow: View {
    @Environment(\.desktopTheme) private var theme
    let event: AITraceEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: event.kind.icon)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(event.kind == .error ? theme.danger : theme.accent)
                Text(event.title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
            }
            Text(event.detail)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(theme.textSecondary)
                .lineLimit(4)
        }
        .padding(11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct EmptyAIChatCard: View {
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "sparkles")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(theme.accent)
                    .frame(width: 36, height: 36)
                    .background(theme.accentSoft)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text("Ask from here")
                        .font(.system(size: 16, weight: .black))
                        .foregroundStyle(theme.text)
                    Text("The composer below sends directly to the Hanasand model pool.")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                }
            }
            HStack(spacing: 8) {
                Label("Models", systemImage: "cpu")
                Label("Tools", systemImage: "wrench.and.screwdriver")
                Label("Trace", systemImage: "waveform.path.ecg")
            }
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(theme.textTertiary)
        }
        .padding(16)
        .frame(maxWidth: 620, alignment: .leading)
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct AIMessageBubble: View {
    @Environment(\.desktopTheme) private var theme
    @EnvironmentObject private var model: DesktopAgentModel
    let message: AIChatMessage

    var body: some View {
        HStack {
            if message.role == .user {
                Spacer(minLength: 80)
            }
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 7) {
                    Image(systemName: message.role == .user ? "person.crop.circle" : "sparkles")
                    Text(message.role == .user ? "You" : "Hanasand AI")
                    if message.isPending {
                        ProgressView()
                            .scaleEffect(0.55)
                    }
                }
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(message.isError ? theme.danger : theme.textTertiary)

                AIMessageContentView(
                    content: message.content.isEmpty && message.isPending ? "Thinking..." : message.content,
                    isError: message.isError
                )

                if message.role == .assistant {
                    let referencedFiles = AIFileReferenceParser.references(in: message.content, changedFiles: model.changedFileSummary)
                    if !referencedFiles.isEmpty {
                        AIChangedFilesInlinePanel(files: Array(referencedFiles.prefix(6)))
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: 720, alignment: .leading)
            .background(message.role == .user ? theme.cardRaised : theme.card)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            if message.role == .assistant {
                Spacer(minLength: 80)
            }
        }
    }
}

struct AIMessageContentView: View {
    @Environment(\.desktopTheme) private var theme
    let content: String
    let isError: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(AIChatContentParser.segments(from: content)) { segment in
                switch segment.kind {
                case .text:
                    Text(segment.content)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(isError ? theme.danger : theme.text)
                        .textSelection(.enabled)
                        .lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                case .json:
                    AIJSONCodeBlock(content: segment.content, language: segment.language)
                case .code:
                    AICodeBlock(content: segment.content, language: segment.language)
                }
            }
        }
    }
}

struct AIChangedFilesInlinePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    let files: [ChangedFileSummary]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Label("Changed files", systemImage: "plus.forwardslash.minus")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(theme.text)
                Spacer()
                Button("Go IDE") {
                    model.selectedSection = .ide
                }
                .buttonStyle(.plain)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(theme.accent)
            }
            ForEach(files) { file in
                HStack(spacing: 8) {
                    Text(file.status)
                        .font(.system(size: 10, weight: .black, design: .monospaced))
                        .foregroundStyle(tint(for: file))
                        .frame(width: 24, alignment: .leading)
                    Text(file.path)
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(theme.textSecondary)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    Button("Diff") {
                        model.openIDEFile(file.path, revealDiff: true, source: "AI changed files")
                    }
                    .buttonStyle(.plain)
                    Button("Preview") {
                        model.previewChangedFile(file.path)
                    }
                    .buttonStyle(.plain)
                    Button("Open") {
                        model.openIDEFile(file.path, source: "AI changed files")
                    }
                    .buttonStyle(.plain)
                }
                .font(.system(size: 11, weight: .bold))
                .padding(.horizontal, 10)
                .frame(height: 30)
                .background(theme.field)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
        }
        .padding(10)
        .background(theme.backgroundElevated.opacity(0.78))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func tint(for file: ChangedFileSummary) -> Color {
        if file.status.contains("D") { return theme.danger }
        if file.status.contains("A") || file.status.contains("?") { return theme.green }
        return theme.accent
    }
}

enum AIFileReferenceParser {
    static func references(in content: String, changedFiles: [ChangedFileSummary]) -> [ChangedFileSummary] {
        var output = changedFiles
        let existing = Set(output.map(\.path))
        let patterns = [
            #"`([^`\n]+\.[A-Za-z0-9]+)`"#,
            #"([A-Za-z0-9_./@+\-]+\.(?:swift|ts|tsx|js|jsx|json|md|css|html|py|sh|yml|yaml))(?::(\d+))?"#,
        ]
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { continue }
            let range = NSRange(content.startIndex..<content.endIndex, in: content)
            for match in regex.matches(in: content, range: range) {
                guard let pathRange = Range(match.range(at: 1), in: content) else { continue }
                let path = String(content[pathRange]).trimmingCharacters(in: CharacterSet(charactersIn: "`.,) "))
                guard path.contains("."), !existing.contains(path), !output.contains(where: { $0.path == path }) else { continue }
                output.append(ChangedFileSummary(id: "mentioned-\(path)", status: "~", path: path))
            }
        }
        return output
    }
}

struct AIPendingEditPanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    let edit: IDEPendingEdit

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Label(edit.title, systemImage: "square.and.pencil")
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(theme.text)
                Spacer()
                Button("Open") {
                    model.openIDEFile(edit.path, line: edit.line, revealDiff: false, source: "Edit preview")
                }
                .buttonStyle(.plain)
                Button("Apply") {
                    model.applyPendingIDEEdit()
                }
                .buttonStyle(.plain)
                .foregroundStyle(theme.green)
                Button("Discard") {
                    model.discardPendingIDEEdit()
                }
                .buttonStyle(.plain)
                .foregroundStyle(theme.danger)
            }
            Text(edit.path)
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundStyle(theme.textTertiary)
                .lineLimit(1)
            Text(edit.preview)
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(theme.textSecondary)
                .textSelection(.enabled)
                .lineLimit(12)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(theme.backgroundElevated)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .padding(12)
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(theme.accent.opacity(0.32), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct AIJSONCodeBlock: View {
    @Environment(\.desktopTheme) private var theme
    let content: String
    let language: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AIBlockHeader(language: language.isEmpty ? "json" : language, copyText: content)
            ScrollView(.horizontal, showsIndicators: false) {
                Text(AIJSONHighlighter.highlight(content, theme: theme))
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .textSelection(.enabled)
                    .lineSpacing(5)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
        .background(theme.backgroundElevated.opacity(0.92))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct AICodeBlock: View {
    @Environment(\.desktopTheme) private var theme
    let content: String
    let language: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AIBlockHeader(language: language.isEmpty ? "code" : language, copyText: content)
            ScrollView(.horizontal, showsIndicators: false) {
                Text(content)
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.textSecondary)
                    .textSelection(.enabled)
                    .lineSpacing(5)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
        .background(theme.backgroundElevated.opacity(0.82))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct AIBlockHeader: View {
    @Environment(\.desktopTheme) private var theme
    let language: String
    let copyText: String

    var body: some View {
        HStack(spacing: 8) {
            Text(language.lowercased())
                .font(.system(size: 11, weight: .black, design: .monospaced))
                .foregroundStyle(theme.textTertiary)
            Spacer()
            Button {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(copyText, forType: .string)
            } label: {
                Image(systemName: "doc.on.doc")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                    .frame(width: 26, height: 24)
            }
            .buttonStyle(.plain)
            .help("Copy")
            .accessibilityLabel("Copy \(language) block")
        }
        .padding(.leading, 14)
        .padding(.trailing, 8)
        .frame(height: 32)
        .background(theme.commandBar.opacity(0.78))
    }
}

struct AIChatContentSegment: Identifiable {
    enum Kind {
        case text
        case json
        case code
    }

    let id = UUID()
    let kind: Kind
    let language: String
    let content: String
}

enum AIChatContentParser {
    static func segments(from rawContent: String) -> [AIChatContentSegment] {
        let content = rawContent.trimmingCharacters(in: .newlines)
        guard !content.isEmpty else {
            return [AIChatContentSegment(kind: .text, language: "", content: rawContent)]
        }

        if !content.contains("```"), let formatted = JSONChatFormatter.formattedJSON(from: content) {
            return [AIChatContentSegment(kind: .json, language: "json", content: formatted)]
        }

        var segments: [AIChatContentSegment] = []
        var cursor = content.startIndex

        while let fenceStart = content[cursor...].range(of: "```") {
            appendText(String(content[cursor..<fenceStart.lowerBound]), to: &segments)

            let languageStart = fenceStart.upperBound
            var language = ""
            var codeStart = languageStart
            if languageStart < content.endIndex,
               let lineEnd = content[languageStart...].firstIndex(of: "\n") {
                language = String(content[languageStart..<lineEnd]).trimmingCharacters(in: .whitespacesAndNewlines)
                codeStart = content.index(after: lineEnd)
            }

            if let fenceEnd = content[codeStart...].range(of: "```") {
                appendCode(String(content[codeStart..<fenceEnd.lowerBound]), language: language, to: &segments)
                cursor = fenceEnd.upperBound
            } else {
                appendCode(String(content[codeStart...]), language: language, to: &segments)
                cursor = content.endIndex
            }
        }

        if cursor < content.endIndex {
            appendText(String(content[cursor..<content.endIndex]), to: &segments)
        }

        return segments.isEmpty ? [AIChatContentSegment(kind: .text, language: "", content: content)] : segments
    }

    private static func appendText(_ text: String, to segments: inout [AIChatContentSegment]) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if let formatted = JSONChatFormatter.formattedJSON(from: trimmed) {
            segments.append(AIChatContentSegment(kind: .json, language: "json", content: formatted))
        } else {
            segments.append(AIChatContentSegment(kind: .text, language: "", content: trimmed))
        }
    }

    private static func appendCode(_ code: String, language: String, to segments: inout [AIChatContentSegment]) {
        let cleanCode = code.trimmingCharacters(in: .newlines)
        let normalizedLanguage = language.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalizedLanguage == "json", let formatted = JSONChatFormatter.formattedJSON(from: cleanCode) {
            segments.append(AIChatContentSegment(kind: .json, language: "json", content: formatted))
        } else if let formatted = JSONChatFormatter.formattedJSON(from: cleanCode) {
            segments.append(AIChatContentSegment(kind: .json, language: "json", content: formatted))
        } else {
            segments.append(AIChatContentSegment(kind: .code, language: normalizedLanguage, content: cleanCode))
        }
    }
}

enum JSONChatFormatter {
    static func formattedJSON(from raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return nil }

        if let formatted = formattedJSONObject(trimmed) {
            return formatted
        }

        let lines = trimmed
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard lines.count > 1 else { return nil }

        let formattedLines = lines.compactMap { formattedJSONObject($0) }
        guard formattedLines.count == lines.count else { return nil }
        return formattedLines.joined(separator: "\n")
    }

    private static func formattedJSONObject(_ raw: String) -> String? {
        guard let first = raw.first,
              first == "{" || first == "[" else { return nil }
        guard let data = raw.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data),
              JSONSerialization.isValidJSONObject(object) else { return nil }
        var options: JSONSerialization.WritingOptions = [.prettyPrinted, .sortedKeys]
        options.insert(.withoutEscapingSlashes)
        guard let formattedData = try? JSONSerialization.data(withJSONObject: object, options: options),
              let formatted = String(data: formattedData, encoding: .utf8) else { return nil }
        return formatted
    }
}

enum AIJSONHighlighter {
    static func highlight(_ json: String, theme: DesktopTheme) -> AttributedString {
        var output = AttributedString("")
        var index = json.startIndex

        while index < json.endIndex {
            let character = json[index]
            if character == "\"" {
                let tokenStart = index
                index = json.index(after: index)
                var escaped = false
                while index < json.endIndex {
                    let next = json[index]
                    index = json.index(after: index)
                    if escaped {
                        escaped = false
                    } else if next == "\\" {
                        escaped = true
                    } else if next == "\"" {
                        break
                    }
                }
                let token = String(json[tokenStart..<index])
                output += colored(token, isObjectKey(after: index, in: json) ? keyColor(theme) : theme.green)
            } else if character.isNumber || character == "-" {
                let tokenStart = index
                index = json.index(after: index)
                while index < json.endIndex,
                      "0123456789.eE+-".contains(json[index]) {
                    index = json.index(after: index)
                }
                output += colored(String(json[tokenStart..<index]), numberColor(theme))
            } else if let keyword = keyword(at: index, in: json) {
                let end = json.index(index, offsetBy: keyword.count)
                output += colored(keyword, theme.accent)
                index = end
            } else if "{}[]:,".contains(character) {
                output += colored(String(character), theme.text)
                index = json.index(after: index)
            } else {
                output += colored(String(character), theme.textSecondary)
                index = json.index(after: index)
            }
        }

        return output
    }

    private static func isObjectKey(after tokenEnd: String.Index, in json: String) -> Bool {
        var cursor = tokenEnd
        while cursor < json.endIndex {
            let character = json[cursor]
            if character == ":" {
                return true
            }
            if character == " " || character == "\t" || character == "\n" || character == "\r" {
                cursor = json.index(after: cursor)
                continue
            }
            return false
        }
        return false
    }

    private static func keyword(at index: String.Index, in json: String) -> String? {
        for keyword in ["true", "false", "null"] where json[index...].hasPrefix(keyword) {
            return keyword
        }
        return nil
    }

    private static func keyColor(_ theme: DesktopTheme) -> Color {
        theme.isLight ? Color(red: 0.82, green: 0.10, blue: 0.42) : Color(red: 1.00, green: 0.24, blue: 0.56)
    }

    private static func numberColor(_ theme: DesktopTheme) -> Color {
        theme.isLight ? Color(red: 0.58, green: 0.30, blue: 0.86) : Color(red: 0.74, green: 0.46, blue: 1.00)
    }

    private static func colored(_ text: String, _ color: Color) -> AttributedString {
        var attributed = AttributedString(text)
        attributed.foregroundColor = color
        return attributed
    }
}

struct ServerWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var confirmServerStop = false

    var body: some View {
        FeatureWorkspace(title: "Server", subtitle: model.serverSummary) {
            HStack(spacing: 10) {
                ActionButton(title: "VPN", icon: "lock.shield") {
                    model.openVPN()
                }
                ActionButton(title: "Mac mini", icon: "macmini") {
                    model.configureMacMiniRemoteDesktop()
                }
                ActionButton(title: "Tunnel", icon: "point.3.connected.trianglepath.dotted") {
                    model.openRemoteDesktopTunnel()
                }
                ActionButton(title: "Connect", icon: "display") {
                    model.openRemoteDesktop()
                }
                ActionButton(title: model.isCheckingServerReachability ? "Checking" : "Health check", icon: "heart.text.square") {
                    Task { await model.checkServerReachability() }
                }
                .disabled(model.isServerBusy)
                ActionButton(title: "Copy diagnostics", icon: "doc.on.doc") {
                    model.copyServerDiagnostics()
                }
                ActionButton(title: "Logs", icon: "doc.text.magnifyingglass") {
                    Task { await model.checkServerLogs() }
                }
                .disabled(model.isServerBusy)
            }
            HStack(spacing: 10) {
                ActionButton(title: model.isRunningServerAction ? "Working" : "Start", icon: model.isRunningServerAction ? "circle.dotted" : "play.fill") {
                    Task { await model.runServerAction(model.settings.serverStartPath) }
                }
                .disabled(model.isServerBusy)
                ActionButton(title: "Stop", icon: "stop.fill", tone: .danger) {
                    confirmServerStop = true
                }
                .disabled(model.isServerBusy)
            }

            HStack(spacing: 12) {
                FeatureCard(title: "Management plane", value: model.settings.serverBaseURL, icon: "server.rack")
                FeatureCard(title: "Internal API", value: model.settings.internalAPIBaseURL, icon: "network")
                FeatureCard(title: "Server action", value: model.serverActionStatus, icon: model.isServerBusy ? "circle.dotted" : "bolt.circle")
                FeatureCard(
                    title: "Remote target",
                    value: "\(model.remoteDesktopProtocolLabel) · \(model.remoteDesktopTargetSummary)",
                    icon: model.remoteDesktopProtocolIcon
                )
            }

            NativeGroupPanel(title: "Remote desktop", subtitle: model.remoteControlSummary) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), spacing: 12)], alignment: .leading, spacing: 12) {
                    FeatureCard(title: "Target", value: model.remoteDesktopTargetSummary, icon: model.remoteDesktopProtocolIcon)
                    FeatureCard(title: "Last app command", value: model.remoteControlLastCommand, icon: "iphone.gen3")
                    FeatureCard(title: "Proof", value: model.remoteControlProofSummary, icon: "checkmark.seal")
                    FeatureCard(title: "Requests", value: "\(model.remoteControlRequests)", icon: "arrow.left.arrow.right")
                }
                HStack(spacing: 10) {
                    ActionButton(title: "Status", icon: "waveform.path.ecg") {
                        model.showRemoteDesktopStatus()
                    }
                    ActionButton(title: "Proof", icon: "checkmark.seal") {
                        model.runRemoteDesktopProof()
                    }
                    ActionButton(title: "Connect", icon: "display") {
                        model.openRemoteDesktop()
                    }
                    ActionButton(title: "Tunnel", icon: "point.3.connected.trianglepath.dotted") {
                        model.requestRemoteTunnelApproval()
                    }
                    ActionButton(title: "Mac mini", icon: "macmini") {
                        model.configureMacMiniRemoteDesktop()
                    }
                    ActionButton(title: "TextEdit proof", icon: "keyboard") {
                        model.openTextEditRemoteProof()
                    }
                    ActionButton(title: "Type keys", icon: "text.cursor") {
                        model.typeKeyboardRemoteProof()
                    }
                    ActionButton(title: "Move mouse", icon: "cursorarrow.motionlines") {
                        model.movePointerRemoteProof()
                    }
                    ActionButton(title: "Click", icon: "cursorarrow.click") {
                        model.clickPointerRemoteProof()
                    }
                    ActionButton(title: "Finder", icon: "folder") {
                        model.openFinderRemoteProof()
                    }
                }
            }

            NativeGroupPanel(title: "Connection status", subtitle: model.isCheckingServerReachability ? "Checking VPN/internal routes..." : model.serverReachabilityCheckedText) {
                if model.serverReachability.isEmpty {
                    NativeEmptyState(title: "Unchecked", message: "Run Health check before server actions. The app will also check automatically before Start, Stop, and Logs.")
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 12)], alignment: .leading, spacing: 12) {
                        ForEach(model.serverReachability) { status in
                            ServerEndpointStatusCard(status: status)
                        }
                    }
                }
                Text("Blocked? Connect VPN, then run Health check.")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
            }
        }
        .alert("Stop server?", isPresented: $confirmServerStop) {
            Button("Stop server", role: .destructive) {
                model.requestStopServerApproval()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This can interrupt active sessions. Continue only when you intend to stop the configured server target.")
        }
    }
}

struct ServerEndpointStatusCard: View {
    @Environment(\.desktopTheme) private var theme
    let status: ServerEndpointStatus

    private var tint: Color {
        switch status.isReachable {
        case .some(true):
            return theme.green
        case .some(false):
            return theme.danger
        case .none:
            return theme.accent
        }
    }

    private var icon: String {
        switch status.isReachable {
        case .some(true):
            return "checkmark.circle.fill"
        case .some(false):
            return "xmark.octagon.fill"
        case .none:
            return "questionmark.circle.fill"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 9) {
                Image(systemName: icon)
                    .foregroundStyle(tint)
                Text(status.title)
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(theme.text)
                Spacer()
                Text(status.stateLabel)
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(tint)
                    .textCase(.uppercase)
            }
            Text(status.target)
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(theme.textTertiary)
                .lineLimit(2)
                .textSelection(.enabled)
            Text(status.detail)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(theme.textSecondary)
                .lineLimit(3)
            Text(DateFormatter.localizedString(from: status.checkedAt, dateStyle: .none, timeStyle: .short))
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(theme.textTertiary)
        }
        .padding(13)
        .background(theme.cardRaised)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(tint.opacity(0.35), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .contextMenu {
            Button("Copy Status") {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString("\(status.title): \(status.stateLabel) | \(status.target) | \(status.detail)", forType: .string)
            }
            Button("Copy Target") {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(status.target, forType: .string)
            }
        }
    }
}

struct UpdatesWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        FeatureWorkspace(title: "Updates", subtitle: "Desktop package feed, staged installers, and automatic checks") {
            HStack(spacing: 12) {
                FeatureCard(title: "Installed", value: DesktopAgentModel.appVersion, icon: "shippingbox")
                FeatureCard(title: "Latest", value: model.updateManifest?.latestVersion ?? "Checking", icon: "arrow.triangle.2.circlepath")
                FeatureCard(title: "Auto check", value: updateIntervalLabel, icon: "timer")
            }

            AppUpdateCard()

            NativeGroupPanel(title: "Staged package", subtitle: model.stagedUpdatePath == nil ? "No local installer staged" : "Ready in Application Support") {
                HStack(spacing: 10) {
                    Image(systemName: model.stagedUpdatePath == nil ? "tray" : "checkmark.seal.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(model.stagedUpdatePath == nil ? theme.textTertiary : theme.green)
                        .frame(width: 34, height: 34)
                        .background(theme.field)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    Text(model.stagedUpdatePath.map { URL(fileURLWithPath: $0).lastPathComponent } ?? "The app will stage updates here after a newer package is found.")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                        .lineLimit(2)
                        .textSelection(.enabled)

                    Spacer(minLength: 0)

                    if model.stagedUpdatePath != nil {
                        ActionButton(title: "Reveal", icon: "folder") {
                            model.revealStagedUpdate()
                        }
                    }
                }
            }
        }
    }

    private var updateIntervalLabel: String {
        let seconds = DesktopAgentModel.automaticUpdateCheckInterval
        if seconds >= 60 {
            return "\(Int(seconds / 60)) min"
        }
        return "\(Int(seconds)) sec"
    }
}

struct FeatureWorkspace<Content: View>: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            TopBar()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(title)
                            .font(.system(size: 27, weight: .black))
                            .foregroundStyle(theme.text)
                        if !subtitle.isEmpty {
                            Text(subtitle)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(theme.textTertiary)
                                .lineLimit(2)
                                .textSelection(.enabled)
                        }
                    }
                    content
                }
                .frame(maxWidth: 980, alignment: .leading)
                .padding(.horizontal, 34)
                .padding(.top, 38)
                .padding(.bottom, 44)
                .frame(maxWidth: .infinity)
            }
        }
        .background(
            ZStack {
                theme.background
                RadialGradient(colors: [theme.accent.opacity(theme.isLight ? 0.08 : 0.16), .clear], center: .topLeading, startRadius: 40, endRadius: 720)
                RadialGradient(colors: [theme.green.opacity(theme.isLight ? 0.05 : 0.10), .clear], center: .bottomTrailing, startRadius: 60, endRadius: 760)
            }
        )
    }
}

struct FeatureCard: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let value: String
    let icon: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .black))
                .foregroundStyle(theme.accent)
                .frame(width: 34, height: 34)
                .background(theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                Text(value)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
                    .textSelection(.enabled)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 76, alignment: .topLeading)
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(theme.divider.opacity(0.95), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct ActionGrid: View {
    let actions: [DesktopAction]

    private let columns = [
        GridItem(.adaptive(minimum: 210), spacing: 10, alignment: .top),
    ]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
            ForEach(actions) { action in
                ActionCard(action: action)
            }
        }
    }
}

struct ActionCard: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
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

enum ActionTone {
    case normal
    case danger
}

struct ActionButton: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let icon: String
    var tone: ActionTone = .normal
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                Image(systemName: icon)
                Text(title)
            }
            .font(.system(size: 13, weight: .black))
            .foregroundStyle(tone == .danger ? theme.danger : theme.text)
            .padding(.horizontal, 13)
            .frame(height: 34)
            .background(tone == .danger ? theme.danger.opacity(0.12) : theme.cardRaised)
            .overlay(
                Capsule()
                    .stroke(tone == .danger ? theme.danger.opacity(0.28) : theme.divider.opacity(0.8), lineWidth: 1)
            )
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct SettingsWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @State private var showEndpointSettings = false
    @State private var showRemoteSettings = false

    var body: some View {
        FeatureWorkspace(title: "Settings", subtitle: "Account, appearance, updater, and advanced connections") {
            HStack(spacing: 12) {
                FeatureCard(title: "Endpoints", value: model.settings.hasValidEndpoints ? "Valid" : "Check", icon: model.settings.hasValidEndpoints ? "checkmark.seal" : "exclamationmark.triangle")
                FeatureCard(title: "Auth", value: model.settings.authToken.isEmpty ? "Missing" : "Ready", icon: "key")
                FeatureCard(title: "Update checks", value: settingsUpdateIntervalLabel, icon: "timer")
            }

            NativeGroupPanel(title: "Account", subtitle: model.settings.authToken.isEmpty ? "Login token not stored" : "Token stored for API calls") {
                VStack(alignment: .leading, spacing: 10) {
                    SettingsField(label: "Auth token", text: $model.settings.authToken, isSecure: true)
                    SettingsField(label: "User id", text: $model.settings.userID)
                    SettingsValidationPanel(settings: model.settings)
                }
            }

            NativeGroupPanel(title: "Theme", subtitle: "Native appearance") {
                HStack(spacing: 8) {
                    ForEach(AppearancePreference.allCases) { option in
                        AppearanceOptionButton(option: option, isSelected: model.appearancePreference == option) {
                            model.appearancePreference = option
                        }
                    }
                    Spacer()
                }
            }

            SettingsDisclosurePanel(
                title: "Advanced endpoints",
                subtitle: endpointSummary,
                icon: "network",
                isExpanded: $showEndpointSettings
            ) {
                VStack(alignment: .leading, spacing: 10) {
                    SettingsField(label: "API base", text: $model.settings.apiBaseURL)
                    SettingsField(label: "Internal API", text: $model.settings.internalAPIBaseURL)
                    SettingsField(label: "Beekeeper API", text: $model.settings.beekeeperAPIBaseURL)
                    SettingsField(label: "CDN base", text: $model.settings.cdnBaseURL)
                    SettingsField(label: "Codex path", text: $model.settings.codexAPIPath)
                    SettingsField(label: "AI endpoint", text: $model.settings.aiAPIURL)
                    SettingsField(label: "Desktop agent", text: $model.settings.desktopAgentBaseURL)
                }
            }

            SettingsDisclosurePanel(
                title: "Remote control",
                subtitle: "\(model.remoteDesktopProtocolLabel) · \(model.settings.serverBaseURL.normalizedBaseURL.host ?? "server")",
                icon: model.remoteDesktopProtocolIcon,
                isExpanded: $showRemoteSettings
            ) {
                VStack(alignment: .leading, spacing: 10) {
                    SettingsField(label: "VPN URL", text: $model.settings.vpnURLScheme)
                    Picker("Remote protocol", selection: $model.settings.remoteDesktopProtocol) {
                        ForEach(RemoteDesktopProtocol.allCases) { remoteProtocol in
                            Label(remoteProtocol.label, systemImage: remoteProtocol.icon)
                                .tag(remoteProtocol.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)
                    SettingsField(label: "Remote host", text: $model.settings.rdpHost)
                    SettingsField(label: "Remote user", text: $model.settings.rdpUser)
                    SettingsField(label: "Tunnel command", text: $model.settings.remoteDesktopTunnelCommand)
                    SettingsField(label: "Server base", text: $model.settings.serverBaseURL)
                    SettingsField(label: "Start path", text: $model.settings.serverStartPath)
                    SettingsField(label: "Stop path", text: $model.settings.serverStopPath)
                    SettingsField(label: "Logs path", text: $model.settings.serverLogsPath)
                }
            }
        }
    }

    private var endpointSummary: String {
        let host = model.settings.apiBaseURL.normalizedBaseURL.host ?? "API"
        return model.settings.hasValidEndpoints ? "\(host) · all URLs valid" : "\(host) · review URL issues"
    }

    private var settingsUpdateIntervalLabel: String {
        let seconds = DesktopAgentModel.automaticUpdateCheckInterval
        if seconds >= 60 { return "\(Int(seconds / 60)) min" }
        return "\(Int(seconds)) sec"
    }
}

struct SettingsDisclosurePanel<Content: View>: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let subtitle: String
    let icon: String
    @Binding var isExpanded: Bool
    @ViewBuilder let content: Content

    var body: some View {
        NativeGroupPanel(title: title, subtitle: subtitle) {
            VStack(alignment: .leading, spacing: 12) {
                Button {
                    withAnimation(.easeInOut(duration: 0.16)) {
                        isExpanded.toggle()
                    }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: icon)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(theme.accent)
                            .frame(width: 32, height: 32)
                            .background(theme.accentSoft)
                            .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                        Text(isExpanded ? "Hide fields" : "Show fields")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(theme.text)
                        Spacer()
                        Image(systemName: "chevron.down")
                            .font(.system(size: 11, weight: .black))
                            .foregroundStyle(theme.textTertiary)
                            .rotationEffect(.degrees(isExpanded ? 180 : 0))
                    }
                    .padding(10)
                    .background(theme.field)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)

                if isExpanded {
                    content
                }
            }
        }
    }
}

struct AppUpdateCard: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(theme.accent)
                    .frame(width: 38, height: 38)
                    .background(theme.accentSoft)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 7) {
                    Text("Auto update")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(theme.text)
                    Text(model.updateStatus.message)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                        .lineLimit(2)
                }
                Spacer()
                if model.updateStatus.isBusy {
                    ProgressView()
                        .scaleEffect(0.70)
                }
                Button("Check now") {
                    Task {
                        await model.checkForUpdates()
                    }
                }
                .disabled(model.updateStatus.isBusy)
                .buttonStyle(.plain)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(theme.accent)
                if model.stagedUpdatePath != nil {
                    Button("Reveal") {
                        model.revealStagedUpdate()
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(theme.text)
                }
            }

            HStack(spacing: 10) {
                UpdateMetric(label: "Installed", value: DesktopAgentModel.appVersion)
                UpdateMetric(label: "Latest", value: model.updateManifest?.latestVersion ?? "Checking")
                UpdateMetric(label: "Source", value: "/api/app")
                UpdateMetric(label: "Channel", value: model.updateManifest?.channel.capitalized ?? "Stable")
            }

            if let manifest = model.updateManifest {
                Text(manifest.notes)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
            }
        }
        .padding(18)
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct SettingsValidationPanel: View {
    @Environment(\.desktopTheme) private var theme
    let settings: HanasandDesktopSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: settings.hasValidEndpoints ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                    .foregroundStyle(settings.hasValidEndpoints ? theme.green : theme.danger)
                Text(settings.hasValidEndpoints ? "Endpoints look valid" : "Endpoint issues")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(theme.text)
                Spacer()
                Text(settings.authToken.isEmpty ? "Auth missing" : "Auth configured")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(settings.authToken.isEmpty ? theme.textTertiary : theme.green)
                    .padding(.horizontal, 9)
                    .frame(height: 24)
                    .background(theme.field)
                    .clipShape(Capsule())
            }

            if settings.endpointValidationMessages.isEmpty {
                Text("Desktop, API, AI, CDN, and server URLs all include valid schemes and hosts.")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
            } else {
                ForEach(settings.endpointValidationMessages, id: \.self) { message in
                    Label(message, systemImage: "xmark.circle")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                }
            }
        }
        .padding(12)
        .background(settings.hasValidEndpoints ? theme.accentSoft.opacity(0.55) : theme.danger.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct SettingsField: View {
    @Environment(\.desktopTheme) private var theme
    let label: String
    @Binding var text: String
    var isSecure = false

    var body: some View {
        HStack(spacing: 14) {
            Text(label)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(theme.textSecondary)
                .frame(width: 130, alignment: .leading)
            if isSecure {
                SecureField(label, text: $text)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.text)
            } else {
                TextField(label, text: $text)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.text)
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 40)
        .background(theme.field)
        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
    }
}

struct UpdateMetric: View {
    @Environment(\.desktopTheme) private var theme
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(theme.textTertiary)
                .textCase(.uppercase)
            Text(value)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(theme.text)
                .lineLimit(1)
        }
        .padding(.horizontal, 11)
        .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
        .background(theme.cardRaised)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct AppearanceOptionButton: View {
    @Environment(\.desktopTheme) private var theme
    let option: AppearancePreference
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                Image(systemName: option.icon)
                    .font(.system(size: 14, weight: .semibold))
                Text(option.title)
                    .font(.system(size: 13, weight: .bold))
            }
            .foregroundStyle(isSelected ? theme.text : theme.textSecondary)
            .padding(.horizontal, 11)
            .frame(height: 32)
            .background(isSelected ? theme.cardRaised : Color.clear)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct ThemeDiffPreview: View {
    @Environment(\.desktopTheme) private var theme

    private let rows = [
        ("1", #"const themePreview: ThemeConfig = {"#, false),
        ("2", #"  surface: "sidebar-elevated","#, true),
        ("3", ##"  accent: "#0ea5e9","##, true),
        ("4", #"  contrast: 68,"#, true),
        ("5", #"};"#, false),
    ]

    var body: some View {
        HStack(spacing: 0) {
            CodePane(rows: rows, fill: theme.danger.opacity(0.14), marker: theme.danger)
            Rectangle()
                .fill(theme.green)
                .frame(width: 5)
            CodePane(rows: rows, fill: theme.green.opacity(0.14), marker: theme.green)
        }
        .frame(height: 110)
        .background(Color.black.opacity(theme.isLight ? 0.80 : 0.34))
    }
}

struct CodePane: View {
    @Environment(\.desktopTheme) private var theme
    let rows: [(String, String, Bool)]
    let fill: Color
    let marker: Color

    var body: some View {
        VStack(spacing: 0) {
            ForEach(rows, id: \.0) { row in
                HStack(spacing: 12) {
                    Text(row.0)
                        .frame(width: 28, alignment: .trailing)
                        .foregroundStyle(row.2 ? marker : theme.textSecondary)
                    Text(row.1)
                        .foregroundStyle(row.2 ? theme.text : theme.textSecondary)
                    Spacer()
                }
                .font(.system(size: 14, weight: .semibold, design: .monospaced))
                .padding(.horizontal, 10)
                .frame(maxWidth: .infinity, minHeight: 22, alignment: .leading)
                .background(row.2 ? fill : Color.clear)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

struct HanasandLogo: View {
    var body: some View {
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height)
            ZStack {
                RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.075),
                                Color.black.opacity(0.72),
                                Color.black.opacity(0.94)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                            .stroke(Color.white.opacity(0.12), lineWidth: max(1, size * 0.012))
                    )
                    .shadow(color: Color.black.opacity(0.28), radius: size * 0.08, y: size * 0.035)

                Text("H")
                    .font(.system(size: size * 0.68, weight: .black, design: .serif))
                    .tracking(-size * 0.02)
                    .foregroundStyle(Color(red: 0.96, green: 0.94, blue: 0.88))
                    .shadow(color: Color.black.opacity(0.42), radius: size * 0.035, x: size * 0.01, y: size * 0.018)
            }
            .frame(width: size, height: size)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityLabel("Hanasand logo")
    }
}

struct ThemeEditorCard: View {
    @Environment(\.desktopTheme) private var theme
    @EnvironmentObject private var model: DesktopAgentModel
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

    private var themePayload: String {
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

    private func copyTheme() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(themePayload, forType: .string)
        model.recordUIEvent(meta: "Theme", body: "Copied \(title) theme JSON to clipboard.", kind: .command)
    }

    private func importTheme() {
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

struct ThemeValueRow: View {
    @Environment(\.desktopTheme) private var theme
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

struct ThemeTextRow: View {
    @Environment(\.desktopTheme) private var theme
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .lineLimit(1)
                .foregroundStyle(theme.textSecondary)
                .padding(.horizontal, 12)
                .frame(width: 180, height: 34, alignment: .leading)
                .background(theme.field)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .padding(.horizontal, 18)
        .frame(height: 52)
        .overlay(alignment: .bottom) {
            Rectangle().fill(theme.divider).frame(height: 1)
        }
    }
}

struct ThemeToggleRow: View {
    @Environment(\.desktopTheme) private var theme
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

struct ThemeSliderRow: View {
    @Environment(\.desktopTheme) private var theme
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

struct NavRow: View {
    @Environment(\.desktopTheme) private var theme
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

struct ProjectRow: View {
    @Environment(\.desktopTheme) private var theme
    let project: ProjectItem
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 10) {
            if project.state == .folder {
                Image(systemName: "folder")
                    .foregroundStyle(.secondary)
                    .frame(width: 18)
            } else {
                Color.clear.frame(width: 18, height: 1)
            }
            Text(project.title)
                .lineLimit(1)
                .font(.system(size: 13, weight: isSelected ? .black : .semibold))
            Spacer(minLength: 8)
            if project.state == .syncing {
                ProgressView().scaleEffect(0.45)
            }
            if project.state == .live {
                Circle().fill(theme.accent).frame(width: 8, height: 8)
            }
            if let age = project.age {
                Text(age).foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(isSelected ? theme.text : theme.textSecondary)
        .padding(.horizontal, 10)
        .frame(height: 32)
        .background(isSelected ? theme.sidebarSelected : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
    }
}

struct AgentStatusPill: View {
    @Environment(\.desktopTheme) private var theme
    let status: AgentStatus

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(status.ok ? theme.green : theme.danger)
                .frame(width: 7, height: 7)
            Text(status.message)
                .lineLimit(1)
        }
        .font(.system(size: 11, weight: .bold))
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(theme.cardRaised)
        .overlay(Capsule().stroke(theme.divider, lineWidth: 1))
        .clipShape(Capsule())
    }
}

struct UpdateStatusPill: View {
    @Environment(\.desktopTheme) private var theme
    let status: AppUpdateStatus

    var body: some View {
        HStack(spacing: 7) {
            if status.isBusy {
                ProgressView()
                    .scaleEffect(0.45)
            } else {
                Circle()
                    .fill(color)
                    .frame(width: 7, height: 7)
            }
            Text(status.title)
                .lineLimit(1)
        }
        .font(.system(size: 11, weight: .bold))
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(theme.cardRaised)
        .overlay(Capsule().stroke(theme.divider, lineWidth: 1))
        .clipShape(Capsule())
    }

    private var color: Color {
        switch status {
        case .ready:
            return theme.accent
        case .unavailable:
            return theme.accent
        case .failed:
            return theme.danger
        default:
            return theme.green
        }
    }
}

struct AgentEvent: Identifiable {
    enum Kind {
        case note
        case user
        case command
        case change
        case error
    }

    let id = UUID()
    let meta: String
    let body: String
    let kind: Kind

    static let seed: [AgentEvent] = [
        AgentEvent(meta: "Explored 1 search, ran 2 commands", body: "I am going to pick this up as a product pass: make the desktop app useful for command input, local status, and fast agent loops.", kind: .note),
        AgentEvent(meta: "Reviewed desktop agent", body: "The local agent is no longer just a background proof. This app owns the loopback API and shows the Mac connection directly in the GUI.", kind: .note),
        AgentEvent(meta: "Edited desktop app", body: "Added a native split-pane workspace, transcript, project rail, and command dock tuned for agentic working.", kind: .change),
    ]
}

extension AgentEvent.Kind {
    init(persistenceValue: String) {
        switch persistenceValue {
        case "note":
            self = .note
        case "user":
            self = .user
        case "change":
            self = .change
        case "error":
            self = .error
        default:
            self = .command
        }
    }

    var persistenceValue: String {
        switch self {
        case .note:
            return "note"
        case .user:
            return "user"
        case .command:
            return "command"
        case .change:
            return "change"
        case .error:
            return "error"
        }
    }

    var icon: String {
        switch self {
        case .note:
            return "note.text"
        case .user:
            return "person.crop.circle"
        case .command:
            return "terminal"
        case .change:
            return "checkmark.seal"
        case .error:
            return "exclamationmark.triangle"
        }
    }
}

struct ProjectItem: Identifiable {
    enum State {
        case normal
        case folder
        case active
        case live
        case syncing
    }

    let id = UUID()
    let title: String
    var state: State = .normal
    var age: String?

    static func folder(_ title: String) -> ProjectItem {
        ProjectItem(title: title, state: .folder)
    }
}

struct QueuedPrompt: Identifiable {
    let id = UUID()
    let text: String
    let createdAt = Date()
}

struct ChangedFileSummary: Identifiable {
    let id: String
    let status: String
    let path: String
}

struct AgentStatus: Codable {
    var ok: Bool
    var agent: String
    var message: String
    var hostname: String
    var platform: String
    var user: String
    var cwd: String
    var uptimeSeconds: Double
    var timestamp: String
    var screenCaptureAllowed: Bool
    var accessibilityAllowed: Bool

    static func ready(ok: Bool = true, message: String = "ready") -> AgentStatus {
        AgentStatus(
            ok: ok,
            agent: "hanasand-desktop-agent",
            message: message,
            hostname: Host.current().localizedName ?? "localhost",
            platform: "macOS",
            user: NSUserName(),
            cwd: FileManager.default.currentDirectoryPath,
            uptimeSeconds: ProcessInfo.processInfo.systemUptime,
            timestamp: ISO8601DateFormatter().string(from: Date()),
            screenCaptureAllowed: CGPreflightScreenCaptureAccess(),
            accessibilityAllowed: AXIsProcessTrusted()
        )
    }
}

extension AgentStatus {
    var aiContext: String {
        [
            "agent=\(agent)",
            "host=\(hostname)",
            "platform=\(platform)",
            "user=\(user)",
            "cwd=\(cwd)",
            "uptimeSeconds=\(Int(uptimeSeconds))",
        ].joined(separator: "\n")
    }
}

private struct LoopbackCommandRequest: Decodable {
    let command: String
}

final class LoopbackAgentServer {
    private let port: UInt16
    private let onCommand: (String) -> Void
    private var listener: NWListener?

    init(port: UInt16, onCommand: @escaping (String) -> Void) {
        self.port = port
        self.onCommand = onCommand
    }

    func start() throws {
        let listener = try NWListener(using: .tcp, on: NWEndpoint.Port(rawValue: port)!)
        listener.newConnectionHandler = { [weak self] connection in
            self?.handle(connection)
        }
        listener.start(queue: .global(qos: .userInitiated))
        self.listener = listener
    }

    private func handle(_ connection: NWConnection) {
        connection.start(queue: .global(qos: .userInitiated))
        var buffer = Data()

        func receiveMore() {
            connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, _ in
                guard let self else {
                    connection.cancel()
                    return
                }
                if let data {
                    buffer.append(data)
                }
                if let request = String(data: buffer, encoding: .utf8),
                   Self.hasCompleteHTTPRequest(request) || isComplete {
                    let response = self.response(for: request)
                    connection.send(content: response.data(using: .utf8), completion: .contentProcessed { _ in
                        connection.cancel()
                    })
                    return
                }
                receiveMore()
            }
        }

        receiveMore()
    }

    private static func hasCompleteHTTPRequest(_ request: String) -> Bool {
        guard let separatorRange = request.range(of: "\r\n\r\n") else { return false }
        let header = String(request[..<separatorRange.lowerBound])
        let body = String(request[separatorRange.upperBound...])
        let contentLength = header
            .components(separatedBy: "\r\n")
            .first { $0.lowercased().hasPrefix("content-length:") }
            .flatMap { Int($0.split(separator: ":", maxSplits: 1).last?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "") } ?? 0
        return body.utf8.count >= contentLength
    }

    private static func screenshotResponse() -> String {
        guard let cgImage = CGDisplayCreateImage(CGMainDisplayID()) else {
            return #"{"ok":false,"message":"Unable to capture the Mac screen. Check Screen Recording permission."}"#
        }

        let maxWidth: CGFloat = 900
        let sourceSize = NSSize(width: cgImage.width, height: cgImage.height)
        let scale = min(1, maxWidth / max(sourceSize.width, 1))
        let targetSize = NSSize(width: sourceSize.width * scale, height: sourceSize.height * scale)
        let sourceImage = NSImage(cgImage: cgImage, size: sourceSize)
        let targetImage = NSImage(size: targetSize)
        targetImage.lockFocus()
        sourceImage.draw(in: NSRect(origin: .zero, size: targetSize), from: NSRect(origin: .zero, size: sourceSize), operation: .copy, fraction: 1)
        targetImage.unlockFocus()

        guard let tiff = targetImage.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiff),
              let png = bitmap.representation(using: .png, properties: [:]) else {
            return #"{"ok":false,"message":"Unable to encode the Mac screenshot."}"#
        }

        return #"{"ok":true,"message":"Mac screen captured.","mimeType":"image/png","imageBase64":"\#(png.base64EncodedString())"}"#
    }

    private func response(for request: String) -> String {
        if request.hasPrefix("OPTIONS ") {
            return http(body: "{}", status: "204 No Content")
        }
        if request.hasPrefix("GET /health ") || request.hasPrefix("GET /status ") {
            return http(body: encode(AgentStatus.ready(message: "this pc is reachable")))
        }
        if request.hasPrefix("GET /screenshot ") {
            return http(body: Self.screenshotResponse())
        }
        if request.hasPrefix("GET /commands ") {
            return http(body: encode([
                "status",
                "update",
                "ai_reload",
                "ai_train_app_parity",
                "ai_audit_desktop_ui",
                "open_section_command",
                "open_section_control",
                "open_section_dashboard",
                "open_section_workspace",
                "browser_mini_fern",
                "browser_popout_fern",
                "open_section_ide",
                "open_section_mac",
                "open_section_mail",
                "open_section_documents",
                "open_section_images",
                "open_section_ai",
                "open_section_server",
                "open_section_updates",
                "open_section_settings",
                "dashboard_refresh",
                "open_dashboard_mail",
                "open_dashboard_articles",
                "open_dashboard_thoughts",
                "open_dashboard_shares",
                "open_dashboard_links",
                "open_dashboard_tests",
                "open_dashboard_profile",
                "open_dashboard_users",
                "open_dashboard_roles",
                "open_dashboard_logs",
                "open_dashboard_system",
                "open_dashboard_vms",
                "open_dashboard_ai_models",
                "open_dashboard_notes",
                "open_dashboard_db",
                "open_dashboard_backups",
                "open_dashboard_restore",
                "open_dashboard_vulnerabilities",
                "open_dashboard_rate_limits",
                "open_dashboard_traffic",
                "server_logs",
                "settings_summary",
                "remote_desktop_status",
                "remote_desktop_proof",
                "remote_desktop_connect",
                "remote_desktop_tunnel",
                "remote_desktop_macmini",
                "mac_control_textedit_proof",
                "mac_control_keyboard_proof",
                "mac_control_full_proof",
                "mac_control_authorize",
                "codex_prompt:<url-encoded-prompt>",
                "mac_control_type_text:<url-encoded-text>",
                "mac_control_key_search",
                "mac_control_key_enter",
                "mac_control_pointer_move",
                "mac_control_pointer_click",
                "mac_control_finder",
            ]))
        }
        if request.hasPrefix("POST /command ") || request.hasPrefix("POST /command?") || request.hasPrefix("GET /command?") {
            let command = Self.commandName(from: request)
            if Self.requiresAccessibility(command), !AXIsProcessTrusted() {
                return http(
                    body: #"{"ok":false,"message":"Mac Accessibility permission is required before the Hanasand app can control keyboard, Enter, Go/Search, or mouse clicks. Open Privacy & Security -> Accessibility and enable Hanasand, then reopen the app.","accessibilityAllowed":false}"#,
                    status: "409 Conflict"
                )
            }
            onCommand(command)
            if command == "status" {
                return http(body: encode(AgentStatus.ready(message: "status command executed")))
            }
            if command == "update" {
                return http(body: #"{"ok":true,"message":"Update check started through /api/app."}"#)
            }
            if command == "ai_reload" {
                return http(body: #"{"ok":true,"message":"AI runtime reload queued in the Desktop app."}"#)
            }
            if command == "ai_train_app_parity" {
                return http(body: #"{"ok":true,"message":"App-parity training drill queued in the Desktop app."}"#)
            }
            if command == "ai_audit_desktop_ui" {
                return http(body: #"{"ok":true,"message":"Desktop UI audit queued in the Desktop app."}"#)
            }
            if command == "dashboard_refresh" {
                return http(body: #"{"ok":true,"message":"Dashboard refresh queued in the Desktop app."}"#)
            }
            if command.hasPrefix("open_section_") {
                return http(body: #"{"ok":true,"message":"Desktop section opened in the app."}"#)
            }
            if command == "browser_mini_fern" {
                return http(body: #"{"ok":true,"message":"Minified Fern browser opened above the Mac desktop."}"#)
            }
            if command == "browser_popout_fern" {
                return http(body: #"{"ok":true,"message":"Floating Fern browser opened above the Mac desktop."}"#)
            }
            if command == "open_dashboard_articles" {
                return http(body: #"{"ok":true,"message":"Native Articles panel opened in the Desktop app."}"#)
            }
            if command == "open_dashboard_thoughts" {
                return http(body: #"{"ok":true,"message":"Native Thoughts panel opened in the Desktop app."}"#)
            }
            if command == "open_dashboard_shares" {
                return http(body: #"{"ok":true,"message":"Native Shares panel opened in the Desktop app."}"#)
            }
            if command == "open_dashboard_profile" {
                return http(body: #"{"ok":true,"message":"Native Profile panel opened in the Desktop app."}"#)
            }
            if command == "open_dashboard_users" {
                return http(body: #"{"ok":true,"message":"Native Users panel opened in the Desktop app."}"#)
            }
            if command == "open_dashboard_roles" {
                return http(body: #"{"ok":true,"message":"Native Roles panel opened in the Desktop app."}"#)
            }
            if command == "open_dashboard_logs" {
                return http(body: #"{"ok":true,"message":"Native Logs panel opened in the Desktop app."}"#)
            }
            if command.hasPrefix("open_dashboard_") {
                return http(body: #"{"ok":true,"message":"Native dashboard panel opened in the Desktop app."}"#)
            }
            if command == "server_logs" {
                return http(body: #"{"ok":true,"message":"Server logs refresh queued in the Desktop app."}"#)
            }
            if command == "settings_summary" {
                return http(body: #"{"ok":true,"message":"Settings summary queued in the Desktop app."}"#)
            }
            if command == "remote_desktop_status" {
                return http(body: #"{"ok":true,"message":"Remote desktop status shown in the Desktop app."}"#)
            }
            if command == "remote_desktop_proof" {
                return http(body: #"{"ok":true,"message":"Remote desktop proof reflected in the Desktop app."}"#)
            }
            if command == "remote_desktop_connect" {
                return http(body: #"{"ok":true,"message":"Remote desktop connection requested on this Mac."}"#)
            }
            if command == "remote_desktop_tunnel" {
                return http(body: #"{"ok":true,"message":"Remote desktop tunnel approval requested on this Mac."}"#)
            }
            if command == "remote_desktop_macmini" {
                return http(body: #"{"ok":true,"message":"Mac mini remote desktop profile configured on this Mac."}"#)
            }
            if command == "mac_control_textedit_proof" {
                return http(body: #"{"ok":true,"message":"TextEdit proof opened on this Mac from the Hanasand app."}"#)
            }
            if command == "mac_control_keyboard_proof" {
                return http(body: #"{"ok":true,"message":"Keyboard proof typed on this Mac from the Hanasand app."}"#)
            }
            if command == "mac_control_full_proof" {
                return http(body: #"{"ok":true,"message":"Full keyboard, Enter, and pointer proof ran on this Mac from the Hanasand app."}"#)
            }
            if command == "mac_control_authorize" {
                return http(body: #"{"ok":true,"message":"Mac privacy panes opened for remote-control authorization."}"#)
            }
            if command.hasPrefix("codex_prompt:") {
                return http(body: #"{"ok":true,"message":"Codex prompt queued on this Mac from the Hanasand app."}"#)
            }
            if command.hasPrefix("mac_control_type_text:") {
                return http(body: #"{"ok":true,"message":"Text typed on this Mac from the Hanasand app."}"#)
            }
            if command == "mac_control_key_search" {
                return http(body: #"{"ok":true,"message":"Go/Search pressed on this Mac from the Hanasand app."}"#)
            }
            if command == "mac_control_key_enter" {
                return http(body: #"{"ok":true,"message":"Enter pressed on this Mac from the Hanasand app."}"#)
            }
            if command == "mac_control_pointer_move" {
                return http(body: #"{"ok":true,"message":"Pointer move requested on this Mac from the Hanasand app."}"#)
            }
            if command == "mac_control_pointer_click" {
                return http(body: #"{"ok":true,"message":"Pointer click requested on this Mac from the Hanasand app."}"#)
            }
            if command.hasPrefix("mac_control_pointer_click_at:") {
                return http(body: #"{"ok":true,"message":"Mac preview tap clicked on this Mac from the Hanasand app."}"#)
            }
            if command == "mac_control_finder" {
                return http(body: #"{"ok":true,"message":"Finder opened on this Mac from the Hanasand app."}"#)
            }
            return http(body: #"{"ok":false,"message":"Command not allowed. GET /commands lists supported commands."}"#, status: "400 Bad Request")
        }
        return http(body: #"{"ok":false,"message":"Route not found."}"#, status: "404 Not Found")
    }

    private static func requiresAccessibility(_ command: String) -> Bool {
        command == "mac_control_textedit_proof"
            || command == "mac_control_keyboard_proof"
            || command == "mac_control_full_proof"
            || command == "mac_control_key_search"
            || command == "mac_control_key_enter"
            || command == "mac_control_pointer_click"
            || command.hasPrefix("mac_control_type_text:")
            || command.hasPrefix("mac_control_pointer_click_at:")
    }

    private static func commandName(from request: String) -> String {
        let explicit = commandFromBody(request) ?? commandFromQuery(request)
        let rawRequest = (explicit ?? request).trimmingCharacters(in: .whitespacesAndNewlines)
        if rawRequest.hasPrefix("mac_control_type_text:") || rawRequest.lowercased().hasPrefix("mac_control_type_text:") {
            return rawRequest
        }
        if rawRequest.hasPrefix("codex_prompt:") || rawRequest.lowercased().hasPrefix("codex_prompt:") {
            return rawRequest
        }
        if rawRequest.hasPrefix("mac_control_pointer_click_at:") || rawRequest.lowercased().hasPrefix("mac_control_pointer_click_at:") {
            return rawRequest.lowercased()
        }
        let lowercasedRequest = rawRequest.lowercased()
        if lowercasedRequest == "ai_audit_desktop_ui" || lowercasedRequest == "audit_desktop" {
            return "ai_audit_desktop_ui"
        }
        if lowercasedRequest == "ai_train_app_parity" || lowercasedRequest == "app_parity" {
            return "ai_train_app_parity"
        }
        if lowercasedRequest == "ai_reload" || lowercasedRequest == "reload_ai" {
            return "ai_reload"
        }
        if lowercasedRequest == "open_section_command" || lowercasedRequest == "command" || lowercasedRequest == "terminal" {
            return "open_section_command"
        }
        if lowercasedRequest == "open_section_control" || lowercasedRequest == "control" || lowercasedRequest == "control_plane" {
            return "open_section_control"
        }
        if lowercasedRequest == "open_section_dashboard" || lowercasedRequest == "dashboard" {
            return "open_section_dashboard"
        }
        if lowercasedRequest == "open_section_workspace" || lowercasedRequest == "workspace" || lowercasedRequest == "browser" {
            return "open_section_workspace"
        }
        if lowercasedRequest == "browser_mini_fern" || lowercasedRequest == "mini_fern" || lowercasedRequest == "fern_minified" {
            return "browser_mini_fern"
        }
        if lowercasedRequest == "browser_popout_fern" || lowercasedRequest == "popout_fern" || lowercasedRequest == "fern_browser" {
            return "browser_popout_fern"
        }
        if lowercasedRequest == "open_section_ide" || lowercasedRequest == "ide" || lowercasedRequest == "editor" {
            return "open_section_ide"
        }
        if lowercasedRequest == "open_section_mac" || lowercasedRequest == "mac" || lowercasedRequest == "this_mac" {
            return "open_section_mac"
        }
        if lowercasedRequest == "open_section_mail" || lowercasedRequest == "mail_section" {
            return "open_section_mail"
        }
        if lowercasedRequest == "open_section_documents" || lowercasedRequest == "documents" || lowercasedRequest == "docs" || lowercasedRequest == "pdf" {
            return "open_section_documents"
        }
        if lowercasedRequest == "open_section_images" || lowercasedRequest == "images" || lowercasedRequest == "photos" {
            return "open_section_images"
        }
        if lowercasedRequest == "open_section_ai" || lowercasedRequest == "ai" || lowercasedRequest == "hanasand_ai" {
            return "open_section_ai"
        }
        if lowercasedRequest == "open_section_server" || lowercasedRequest == "server" {
            return "open_section_server"
        }
        if lowercasedRequest == "open_section_updates" || lowercasedRequest == "updates" {
            return "open_section_updates"
        }
        if lowercasedRequest == "open_section_settings" || lowercasedRequest == "settings_section" {
            return "open_section_settings"
        }
        if lowercasedRequest == "dashboard_refresh" || lowercasedRequest == "refresh_dashboard" {
            return "dashboard_refresh"
        }
        if lowercasedRequest == "open_dashboard_mail" || lowercasedRequest == "dashboard_mail" || lowercasedRequest == "mail" {
            return "open_dashboard_mail"
        }
        if lowercasedRequest == "open_dashboard_articles" || lowercasedRequest == "articles" {
            return "open_dashboard_articles"
        }
        if lowercasedRequest == "open_dashboard_thoughts" || lowercasedRequest == "thoughts" {
            return "open_dashboard_thoughts"
        }
        if lowercasedRequest == "open_dashboard_shares" || lowercasedRequest == "shares" {
            return "open_dashboard_shares"
        }
        if lowercasedRequest == "open_dashboard_links" || lowercasedRequest == "links" || lowercasedRequest == "g" {
            return "open_dashboard_links"
        }
        if lowercasedRequest == "open_dashboard_tests" || lowercasedRequest == "tests" || lowercasedRequest == "load_tests" {
            return "open_dashboard_tests"
        }
        if lowercasedRequest == "open_dashboard_profile" || lowercasedRequest == "profile" {
            return "open_dashboard_profile"
        }
        if lowercasedRequest == "open_dashboard_users" || lowercasedRequest == "users" {
            return "open_dashboard_users"
        }
        if lowercasedRequest == "open_dashboard_roles" || lowercasedRequest == "roles" {
            return "open_dashboard_roles"
        }
        if lowercasedRequest == "open_dashboard_logs" || lowercasedRequest == "dashboard_logs" {
            return "open_dashboard_logs"
        }
        if lowercasedRequest == "open_dashboard_system" || lowercasedRequest == "system" || lowercasedRequest == "containers" {
            return "open_dashboard_system"
        }
        if lowercasedRequest == "open_dashboard_vms" || lowercasedRequest == "vms" || lowercasedRequest == "machines" {
            return "open_dashboard_vms"
        }
        if lowercasedRequest == "open_dashboard_ai_models" || lowercasedRequest == "ai_models" || lowercasedRequest == "models" {
            return "open_dashboard_ai_models"
        }
        if lowercasedRequest == "open_dashboard_notes" || lowercasedRequest == "notes" {
            return "open_dashboard_notes"
        }
        if lowercasedRequest == "open_dashboard_db" || lowercasedRequest == "db" || lowercasedRequest == "databases" {
            return "open_dashboard_db"
        }
        if lowercasedRequest == "open_dashboard_backups" || lowercasedRequest == "backups" {
            return "open_dashboard_backups"
        }
        if lowercasedRequest == "open_dashboard_restore" || lowercasedRequest == "restore" {
            return "open_dashboard_restore"
        }
        if lowercasedRequest == "open_dashboard_vulnerabilities" || lowercasedRequest == "vulnerabilities" || lowercasedRequest == "vulns" {
            return "open_dashboard_vulnerabilities"
        }
        if lowercasedRequest == "open_dashboard_rate_limits" || lowercasedRequest == "rate_limits" || lowercasedRequest == "rate-limits" || lowercasedRequest == "limits" {
            return "open_dashboard_rate_limits"
        }
        if lowercasedRequest == "open_dashboard_traffic" || lowercasedRequest == "traffic" {
            return "open_dashboard_traffic"
        }
        if lowercasedRequest == "server_logs" || lowercasedRequest == "logs" {
            return "server_logs"
        }
        if lowercasedRequest == "settings_summary" || lowercasedRequest == "settings" {
            return "settings_summary"
        }
        if lowercasedRequest == "remote_desktop_status" || lowercasedRequest == "rdp_status" || lowercasedRequest == "vnc_status" || lowercasedRequest == "screen_status" {
            return "remote_desktop_status"
        }
        if lowercasedRequest == "remote_desktop_proof" || lowercasedRequest == "rdp_proof" || lowercasedRequest == "pc_proof" || lowercasedRequest == "control_proof" {
            return "remote_desktop_proof"
        }
        if lowercasedRequest == "remote_desktop_connect" || lowercasedRequest == "rdp_connect" || lowercasedRequest == "vnc_connect" || lowercasedRequest == "screen_sharing" {
            return "remote_desktop_connect"
        }
        if lowercasedRequest == "remote_desktop_tunnel" || lowercasedRequest == "rdp_tunnel" || lowercasedRequest == "vnc_tunnel" || lowercasedRequest == "tunnel" {
            return "remote_desktop_tunnel"
        }
        if lowercasedRequest == "remote_desktop_macmini" || lowercasedRequest == "macmini" || lowercasedRequest == "mac_mini" {
            return "remote_desktop_macmini"
        }
        if lowercasedRequest == "mac_control_textedit_proof" || lowercasedRequest == "textedit_proof" || lowercasedRequest == "type_proof" {
            return "mac_control_textedit_proof"
        }
        if lowercasedRequest == "mac_control_keyboard_proof" || lowercasedRequest == "keyboard_proof" || lowercasedRequest == "type_keys" {
            return "mac_control_keyboard_proof"
        }
        if lowercasedRequest == "mac_control_full_proof" || lowercasedRequest == "full_proof" || lowercasedRequest == "full_control" || lowercasedRequest == "teamviewer_proof" {
            return "mac_control_full_proof"
        }
        if lowercasedRequest == "mac_control_authorize" || lowercasedRequest == "authorize_mac" || lowercasedRequest == "permissions" {
            return "mac_control_authorize"
        }
        if lowercasedRequest == "mac_control_key_search" || lowercasedRequest == "go" || lowercasedRequest == "search" || lowercasedRequest == "cmd_space" || lowercasedRequest == "command_space" {
            return "mac_control_key_search"
        }
        if lowercasedRequest == "mac_control_key_enter" || lowercasedRequest == "enter" || lowercasedRequest == "return" {
            return "mac_control_key_enter"
        }
        if lowercasedRequest == "mac_control_pointer_move" || lowercasedRequest == "move_pointer" || lowercasedRequest == "move_mouse" {
            return "mac_control_pointer_move"
        }
        if lowercasedRequest == "mac_control_pointer_click" || lowercasedRequest == "click_pointer" || lowercasedRequest == "click_mouse" {
            return "mac_control_pointer_click"
        }
        if lowercasedRequest.hasPrefix("mac_control_pointer_click_at:") {
            return lowercasedRequest
        }
        if lowercasedRequest == "mac_control_finder" || lowercasedRequest == "open_finder" || lowercasedRequest == "finder" {
            return "mac_control_finder"
        }
        if lowercasedRequest == "update" {
            return "update"
        }
        if lowercasedRequest == "status" {
            return "status"
        }
        return "blocked"
    }

    private static func commandFromBody(_ request: String) -> String? {
        guard let separatorRange = request.range(of: "\r\n\r\n") else { return nil }
        let body = String(request[separatorRange.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return nil }

        if let data = body.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(LoopbackCommandRequest.self, from: data) {
            return decoded.command
        }

        for pair in body.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1).map(String.init)
            guard parts.count == 2, parts[0] == "command" else { continue }
            return decodedCommandValue(parts[1])
        }
        return decodedCommandValue(body)
    }

    private static func commandFromQuery(_ request: String) -> String? {
        guard let firstLine = request.components(separatedBy: "\r\n").first,
              let queryRange = firstLine.range(of: "?") else { return nil }
        let query = firstLine[queryRange.upperBound...].split(separator: " ").first.map(String.init) ?? ""
        for pair in query.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1).map(String.init)
            guard parts.count == 2, parts[0] == "command" else { continue }
            return decodedCommandValue(parts[1])
        }
        return nil
    }

    private static func decodedCommandValue(_ value: String) -> String {
        let formDecoded = value.replacingOccurrences(of: "+", with: " ")
        return (formDecoded.removingPercentEncoding ?? formDecoded).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func encode<T: Encodable>(_ value: T) -> String {
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(value), let string = String(data: data, encoding: .utf8) else {
            return #"{"ok":false,"message":"Unable to encode response."}"#
        }
        return string
    }

    private func http(body: String, status: String = "200 OK") -> String {
        """
        HTTP/1.1 \(status)\r
        Content-Type: application/json\r
        Access-Control-Allow-Origin: *\r
        Access-Control-Allow-Methods: GET, POST, OPTIONS\r
        Access-Control-Allow-Headers: Content-Type, Authorization, id\r
        Content-Length: \(body.utf8.count)\r
        Connection: close\r
        \r
        \(body)
        """
    }
}

extension Color {
    static let agentBackground = Color(red: 0.080, green: 0.081, blue: 0.078)
    static let sidebarBackground = Color(red: 0.155, green: 0.160, blue: 0.150)
    static let sidebarText = Color(red: 0.78, green: 0.78, blue: 0.74)
    static let commandPanel = Color(red: 0.172, green: 0.172, blue: 0.166)
    static let commandBar = Color(red: 0.145, green: 0.145, blue: 0.140)
    static let dividerLine = Color.white.opacity(0.10)
    static let agentText = Color(red: 0.93, green: 0.93, blue: 0.90)
    static let agentGreen = Color(red: 0.33, green: 0.78, blue: 0.50)
    static let agentDanger = Color(red: 0.92, green: 0.34, blue: 0.31)
    static let agentBlue = Color(red: 0.55, green: 0.74, blue: 1.0)
}

extension String {
    var normalizedBaseURL: URL {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: trimmed).or(URL(string: "https://hanasand.com/api")!)
    }

    var slugifiedPath: String {
        let lowered = lowercased()
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        let scalars = lowered.unicodeScalars.map { scalar -> Character in
            allowed.contains(scalar) ? Character(scalar) : "-"
        }
        let collapsed = String(scalars)
            .split(separator: "-")
            .joined(separator: "-")
            .trimmingCharacters(in: CharacterSet(charactersIn: "-_"))
        return collapsed.isEmpty ? "desktop-share" : collapsed
    }

    var htmlEscaped: String {
        replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&#39;")
    }

    var websocketBaseURL: URL? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if trimmed.hasPrefix("https://") {
            return URL(string: "wss://\(trimmed.dropFirst("https://".count))")
        }
        if trimmed.hasPrefix("http://") {
            return URL(string: "ws://\(trimmed.dropFirst("http://".count))")
        }
        if trimmed.hasPrefix("ws://") || trimmed.hasPrefix("wss://") {
            return URL(string: trimmed)
        }
        return nil
    }
}

extension Data {
    mutating func appendUTF8(_ string: String) {
        append(Data(string.utf8))
    }

    mutating func appendMultipartBoundary(_ boundary: String) {
        appendUTF8("--\(boundary)\r\n")
    }
}

extension NSImage {
    func rotated(clockwise: Bool) -> NSImage? {
        let nextSize = NSSize(width: size.height, height: size.width)
        let next = NSImage(size: nextSize)
        next.lockFocus()
        guard let context = NSGraphicsContext.current?.cgContext else {
            next.unlockFocus()
            return nil
        }
        context.translateBy(x: nextSize.width / 2, y: nextSize.height / 2)
        context.rotate(by: clockwise ? -.pi / 2 : .pi / 2)
        draw(in: NSRect(x: -size.width / 2, y: -size.height / 2, width: size.width, height: size.height), from: .zero, operation: .copy, fraction: 1)
        next.unlockFocus()
        return next
    }
}

extension URL {
    func appendingAPIPath(_ path: String) -> URL {
        var url = self
        for component in path.split(separator: "/") where !component.isEmpty {
            url.appendPathComponent(String(component))
        }
        return url
    }
}

func formatBytes(_ bytes: Int) -> String {
    guard bytes > 0 else { return "0 B" }
    let units = ["B", "KB", "MB", "GB", "TB"]
    var value = Double(bytes)
    var index = 0
    while value >= 1024 && index < units.count - 1 {
        value /= 1024
        index += 1
    }
    return "\(String(format: index == 0 ? "%.0f" : "%.2f", value)) \(units[index])"
}

func formatMilliseconds(_ milliseconds: Double) -> String {
    if milliseconds < 1000 {
        return "\(Int(milliseconds)) ms"
    }
    let seconds = milliseconds / 1000
    if seconds < 60 {
        return "\(String(format: "%.1f", seconds)) s"
    }
    return "\(Int(seconds / 60))m \(Int(seconds.truncatingRemainder(dividingBy: 60)))s"
}

func formatDateText(_ value: String?, fallback: String) -> String {
    guard let value, !value.isEmpty else { return fallback }
    let iso = ISO8601DateFormatter()
    if let date = iso.date(from: value) {
        return date.formatted(date: .abbreviated, time: .shortened)
    }
    return value
}

private extension Optional where Wrapped == URL {
    func or(_ fallback: URL) -> URL {
        self ?? fallback
    }
}

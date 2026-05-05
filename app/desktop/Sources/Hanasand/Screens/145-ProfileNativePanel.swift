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

struct ProfileNativePanel: View {
    @EnvironmentObject var model: DesktopAgentModel
    @Environment(\.desktopTheme) var theme
    @State var pendingSessionRevoke: DashboardAuthSession?
    @State var pendingCertificateDelete: DashboardCertificate?
    @State var confirmRevokeOtherSessions = false

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

    var sessionRevokePresented: Binding<Bool> {
        Binding(
            get: { pendingSessionRevoke != nil },
            set: { visible in
                if !visible {
                    pendingSessionRevoke = nil
                }
            }
        )
    }

    var certificateDeletePresented: Binding<Bool> {
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

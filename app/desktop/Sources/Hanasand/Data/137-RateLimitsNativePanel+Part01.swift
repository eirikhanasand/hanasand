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

extension RateLimitsNativePanel {

    var columns: [GridItem] {
        [GridItem(.adaptive(minimum: 260), spacing: 12, alignment: .top)]
    }

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

    var overview: DashboardRateLimitOverview? {
        model.rateLimitOverview
    }

    func issueKeyPanel(_ overview: DashboardRateLimitOverview) -> some View {
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

    func nativeTextField(_ label: String, text: Binding<String>, placeholder: String) -> some View {
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

    func defaultsPanel(_ overview: DashboardRateLimitOverview) -> some View {
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
}

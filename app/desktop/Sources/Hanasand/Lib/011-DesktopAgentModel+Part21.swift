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

extension DesktopAgentModel {

    func friendlyServerError(_ error: Error, target: String) -> String {
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
}

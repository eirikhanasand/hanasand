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
}

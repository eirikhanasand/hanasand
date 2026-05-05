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

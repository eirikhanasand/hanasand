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

    func validateURLField(_ label: String, _ rawValue: String, allowedSchemes: Set<String>) -> String? {
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

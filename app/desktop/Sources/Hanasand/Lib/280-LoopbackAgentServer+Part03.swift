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

extension LoopbackAgentServer {

    func isAuthorized(_ request: String) -> Bool {
        if Self.hostHeader(from: request).map(Self.isLocalHostHeader) == true {
            return true
        }
        let certificate = certificateProvider().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !certificate.isEmpty else { return false }
        return Self.hasValidSessionProof(request, certificate: certificate)
    }

    static func hasValidSessionProof(_ request: String, certificate: String) -> Bool {
        guard let timestamp = headerValue("x-hanasand-session-timestamp", from: request),
              let timestampValue = TimeInterval(timestamp),
              abs(Date().timeIntervalSince1970 - timestampValue) <= 120,
              let nonce = headerValue("x-hanasand-session-nonce", from: request),
              !nonce.isEmpty,
              nonce.count <= 160,
              let proof = headerValue("x-hanasand-session-proof", from: request),
              let firstLine = request.components(separatedBy: "\r\n").first else {
            return false
        }

        let parts = firstLine.split(separator: " ", maxSplits: 2).map(String.init)
        guard parts.count >= 2 else { return false }
        let material = "\(certificate)\n\(parts[0])\n\(parts[1])\n\(timestamp)\n\(nonce)"
        let digest = SHA256.hash(data: Data(material.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
        return timingSafeEqual(proof.lowercased(), digest)
    }

    static func timingSafeEqual(_ left: String, _ right: String) -> Bool {
        let leftBytes = Array(left.utf8)
        let rightBytes = Array(right.utf8)
        var diff = leftBytes.count ^ rightBytes.count
        for index in 0..<max(leftBytes.count, rightBytes.count) {
            diff |= Int((index < leftBytes.count ? leftBytes[index] : 0) ^ (index < rightBytes.count ? rightBytes[index] : 0))
        }
        return diff == 0
    }

    static func headerValue(_ name: String, from request: String) -> String? {
        let lowercasedName = name.lowercased()
        return request
            .components(separatedBy: "\r\n")
            .dropFirst()
            .first { $0.lowercased().hasPrefix("\(lowercasedName):") }
            .flatMap { line in
                line.split(separator: ":", maxSplits: 1).last?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
            }
    }

    static func hostHeader(from request: String) -> String? {
        headerValue("host", from: request)
    }

    static func isLocalHostHeader(_ host: String) -> Bool {
        let clean = host
            .lowercased()
            .split(separator: ":")
            .first
            .map(String.init) ?? host.lowercased()
        return clean == "localhost" || clean == "127.0.0.1" || clean == "::1"
    }

    static func requiresAccessibility(_ command: String) -> Bool {
        command.hasPrefix("mac_control_type_text:")
            || command.hasPrefix("mac_control_pointer_click_at:")
    }
}

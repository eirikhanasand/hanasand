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

    static func title(from url: URL, fallback: String) -> String {
        let host = url.host?.replacingOccurrences(of: "www.", with: "") ?? fallback
        return host.split(separator: ".").first.map { String($0).capitalized } ?? fallback
    }
}

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

enum UpdateError: LocalizedError {
    case invalidURL
    case httpStatus(Int)
    case checksumMismatch
    case unsupportedPackage
    case invalidPackage
    case unsupportedBundleLocation
    case installFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "The app update URL is invalid."
        case .httpStatus(let status):
            return "The Hanasand app update endpoint returned HTTP \(status)."
        case .checksumMismatch:
            return "The downloaded update did not match the API checksum."
        case .unsupportedPackage:
            return "The downloaded update package is not a zip archive."
        case .invalidPackage:
            return "The downloaded update did not contain a Hanasand app bundle."
        case .unsupportedBundleLocation:
            return "This running copy is not an app bundle, so it cannot be updated in place."
        case .installFailed(let message):
            return "The app update could not be installed: \(message)."
        }
    }
}

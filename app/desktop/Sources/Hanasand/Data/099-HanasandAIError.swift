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

enum HanasandAIError: LocalizedError {
    case invalidPayload
    case missingToken(String)
    case httpStatus(Int, String?)

    var errorDescription: String? {
        switch self {
        case .invalidPayload:
            return "Could not encode the Hanasand AI request."
        case .missingToken(let endpoint):
            return "The Hanasand AI endpoint at \(endpoint) needs your Hanasand login session. Sign in again to refresh it."
        case .httpStatus(let status, let error):
            if [502, 503, 504].contains(status) {
                return error ?? "The AI service is taking longer than expected. I’ll keep trying in the background."
            }
            return error ?? "The Hanasand AI endpoint returned HTTP \(status)."
        }
    }
}

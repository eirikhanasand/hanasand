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

struct HanasandAIClient {
    let session: URLSession
    let apiURL: URL
    let token: String
    let userId: String

    init(apiURL configuredURL: URL? = nil, token configuredToken: String = "", userId configuredUserId: String = "", session: URLSession = .shared) {
        self.session = session
        let environment = ProcessInfo.processInfo.environment
        let configured = environment["HANASAND_AI_API"] ?? "https://api.hanasand.com/api/tools/ai"
        apiURL = configuredURL ?? URL(string: configured) ?? URL(string: "https://api.hanasand.com/api/tools/ai")!
        token = configuredToken.isEmpty ? (environment["HANASAND_API_TOKEN"] ?? environment["HANASAND_AUTH_TOKEN"] ?? "") : configuredToken
        userId = configuredUserId.isEmpty ? (environment["HANASAND_USER_ID"] ?? "") : configuredUserId
    }

    func send(prompt: String, context: String) async throws -> HanasandAIResponse {
        let (data, response) = try await performRequest(prompt: prompt, context: context, includeUserId: true)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 200
        if status == 401 && !token.isEmpty && !userId.isEmpty {
            let (retryData, retryResponse) = try await performRequest(prompt: prompt, context: context, includeUserId: false)
            return try decodeResponse(data: retryData, response: retryResponse)
        }

        return try decodeResponse(data: data, response: response)
    }

    func performRequest(prompt: String, context: String, includeUserId: Bool) async throws -> (Data, URLResponse) {
        var request = URLRequest(url: apiURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if includeUserId && !userId.isEmpty {
            request.setValue(userId, forHTTPHeaderField: "id")
        }
        request.httpBody = try JSONEncoder().encode(AIRequest(prompt: prompt, context: context))

        return try await session.data(for: request)
    }

    func decodeResponse(data: Data, response: URLResponse) throws -> HanasandAIResponse {
        let status = (response as? HTTPURLResponse)?.statusCode ?? 200
        let payload = try? JSONDecoder().decode(AIToolPayload.self, from: data)

        guard (200..<300).contains(status) else {
            if status == 401 {
                throw HanasandAIError.missingToken(apiURL.absoluteString)
            }
            throw HanasandAIError.httpStatus(status, payload?.error)
        }

        let text = payload?.message
            ?? payload?.suggestion
            ?? payload?.error
            ?? String(data: data, encoding: .utf8)
            ?? "No response."
        let meta = payload?.status == "configured_later" ? "Hanasand AI" : "Hanasand AI"

        return HanasandAIResponse(meta: meta, body: text)
    }

    struct AIRequest: Encodable {
        let prompt: String
        let context: String
    }

    struct AIToolPayload: Decodable {
        let status: String?
        let message: String?
        let suggestion: String?
        let error: String?
    }
}

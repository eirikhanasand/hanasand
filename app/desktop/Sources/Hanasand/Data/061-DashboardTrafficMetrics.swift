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

struct DashboardTrafficMetrics: Decodable {
    struct Metric: Decodable, Identifiable {
        var id: String { key }
        let key: String
        let count: Int
    }

    let totalRequests: Int
    let avgRequestTime: Double
    let errorRate: Double
    let topDomains: [Metric]

    enum CodingKeys: String, CodingKey {
        case totalRequests = "total_requests"
        case avgRequestTime = "avg_request_time"
        case errorRate = "error_rate"
        case topDomains = "top_domains"
    }
}

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

struct ActionGrid: View {
    let actions: [DesktopAction]

    let columns = [
        GridItem(.adaptive(minimum: 210), spacing: 10, alignment: .top),
    ]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
            ForEach(actions) { action in
                ActionCard(action: action)
            }
        }
    }
}

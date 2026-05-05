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

struct HanasandLogo: View {
    var body: some View {
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height)
            ZStack {
                RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.075),
                                Color.black.opacity(0.72),
                                Color.black.opacity(0.94)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                            .stroke(Color.white.opacity(0.12), lineWidth: max(1, size * 0.012))
                    )
                    .shadow(color: Color.black.opacity(0.28), radius: size * 0.08, y: size * 0.035)

                Text("H")
                    .font(.custom("Georgia", size: size * 0.56).weight(.bold))
                    .scaleEffect(x: 0.82, y: 1, anchor: .center)
                    .tracking(-size * 0.006)
                    .foregroundStyle(Color(red: 0.96, green: 0.94, blue: 0.88))
                    .shadow(color: Color.black.opacity(0.42), radius: size * 0.035, x: size * 0.01, y: size * 0.018)
            }
            .frame(width: size, height: size)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityLabel("Hanasand logo")
    }
}

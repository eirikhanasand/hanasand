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

struct ProjectRow: View {
    @Environment(\.desktopTheme) var theme
    let project: ProjectItem
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 10) {
            if project.state == .folder {
                Image(systemName: "folder")
                    .foregroundStyle(.secondary)
                    .frame(width: 18)
            } else {
                Color.clear.frame(width: 18, height: 1)
            }
            Text(project.title)
                .lineLimit(1)
                .font(.system(size: 13, weight: isSelected ? .black : .semibold))
            Spacer(minLength: 8)
            if project.state == .syncing {
                ProgressView().scaleEffect(0.45)
            }
            if project.state == .live {
                Circle().fill(theme.accent).frame(width: 8, height: 8)
            }
            if let age = project.age {
                Text(age).foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(isSelected ? theme.text : theme.textSecondary)
        .padding(.horizontal, 10)
        .frame(height: 32)
        .background(isSelected ? theme.sidebarSelected : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
    }
}

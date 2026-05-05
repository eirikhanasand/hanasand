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

struct Sidebar: View {
    @EnvironmentObject var model: DesktopAgentModel
    @Environment(\.desktopTheme) var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 18) {
                HanasandLogo()
                    .frame(width: 34, height: 34)
                Text("Hanasand")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(theme.text)
                Spacer()
                Image(systemName: "chevron.left")
                    .foregroundStyle(.secondary)
                Image(systemName: "chevron.right")
                    .foregroundStyle(.tertiary)
            }
            .font(.system(size: 15, weight: .semibold))
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 24)

            ScrollView {
                VStack(alignment: .leading, spacing: 17) {
                    ForEach([DesktopSection.command, .control, .dashboard, .browser, .ide, .mac, .mail, .documents, .images, .server, .updates], id: \.id) { section in
                        NavRow(icon: section.icon, title: section.title, isSelected: model.selectedSection == section)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                model.selectedSection = section
                            }
                    }
                }
                .padding(.horizontal, 8)

                HStack {
                    Text("Projects")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: "line.3.horizontal.decrease")
                    Button {
                        model.createProject()
                    } label: {
                        Image(systemName: "folder.badge.plus")
                    }
                    .buttonStyle(.plain)
                    .help("Create project")
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 8)
                .padding(.top, 34)
                .padding(.bottom, 14)

                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(model.realProjects) { project in
                        ProjectRow(project: project, isSelected: model.selectedSection == .command && model.selectedProject == project.title)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                model.selectedSection = .command
                                model.selectedProject = project.title
                            }
                        }
                }
            }
            .padding(.horizontal, 8)

            Spacer(minLength: 16)

            NavRow(icon: DesktopSection.settings.icon, title: DesktopSection.settings.title, isSelected: model.selectedSection == .settings)
                .contentShape(Rectangle())
                .onTapGesture {
                    model.selectedSection = .settings
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 20)
        }
        .background(theme.sidebar)
    }
}

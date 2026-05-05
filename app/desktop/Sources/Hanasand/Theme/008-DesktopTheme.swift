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

struct DesktopTheme {
    let isLight: Bool
    let background: Color
    let backgroundElevated: Color
    let sidebar: Color
    let sidebarSelected: Color
    let commandPanel: Color
    let commandBar: Color
    let card: Color
    let cardRaised: Color
    let field: Color
    let divider: Color
    let text: Color
    let textSecondary: Color
    let textTertiary: Color
    let accent: Color
    let accentSoft: Color
    let green: Color
    let danger: Color

    init(preference: AppearancePreference, systemScheme: ColorScheme) {
        isLight = preference == .light || (preference == .system && systemScheme == .light)
        if isLight {
            background = Color(red: 0.955, green: 0.955, blue: 0.940)
            backgroundElevated = Color(red: 0.985, green: 0.985, blue: 0.972)
            sidebar = Color(red: 0.895, green: 0.900, blue: 0.875)
            sidebarSelected = Color.black.opacity(0.075)
            commandPanel = Color(red: 0.990, green: 0.990, blue: 0.980)
            commandBar = Color(red: 0.915, green: 0.920, blue: 0.900)
            card = Color(red: 0.930, green: 0.932, blue: 0.912)
            cardRaised = Color(red: 0.980, green: 0.980, blue: 0.965)
            field = Color.white.opacity(0.88)
            divider = Color.black.opacity(0.11)
            text = Color(red: 0.090, green: 0.100, blue: 0.095)
            textSecondary = Color.black.opacity(0.58)
            textTertiary = Color.black.opacity(0.38)
            accent = Color(red: 0.180, green: 0.480, blue: 0.940)
            accentSoft = Color(red: 0.180, green: 0.480, blue: 0.940).opacity(0.14)
            green = Color(red: 0.120, green: 0.560, blue: 0.310)
            danger = Color(red: 0.780, green: 0.190, blue: 0.160)
        } else {
            background = Color(red: 0.035, green: 0.043, blue: 0.038)
            backgroundElevated = Color(red: 0.070, green: 0.083, blue: 0.074)
            sidebar = Color(red: 0.055, green: 0.066, blue: 0.058)
            sidebarSelected = Color(red: 0.94, green: 0.49, blue: 0.20).opacity(0.16)
            commandPanel = Color.white.opacity(0.075)
            commandBar = Color(red: 0.058, green: 0.068, blue: 0.061).opacity(0.96)
            card = Color.white.opacity(0.070)
            cardRaised = Color.white.opacity(0.105)
            field = Color.white.opacity(0.085)
            divider = Color.white.opacity(0.115)
            text = Color(red: 0.965, green: 0.955, blue: 0.915)
            textSecondary = Color.white.opacity(0.68)
            textTertiary = Color.white.opacity(0.43)
            accent = Color(red: 0.94, green: 0.49, blue: 0.20)
            accentSoft = Color(red: 0.94, green: 0.49, blue: 0.20).opacity(0.18)
            green = Color(red: 0.40, green: 0.82, blue: 0.52)
            danger = Color(red: 0.96, green: 0.38, blue: 0.31)
        }
    }
}

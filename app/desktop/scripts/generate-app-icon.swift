import AppKit
import CoreText
import Foundation

let root = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? FileManager.default.currentDirectoryPath, isDirectory: true)
let resources = root.appendingPathComponent("Resources", isDirectory: true)
let iconset = resources.appendingPathComponent("Hanasand.iconset", isDirectory: true)
let icns = resources.appendingPathComponent("Hanasand.icns")
let fileManager = FileManager.default

try fileManager.createDirectory(at: iconset, withIntermediateDirectories: true)

let sizes: [(String, CGFloat)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]

func titleFont(size: CGFloat) -> NSFont {
    let preferred = [
        "NewYorkExtraLarge-Black",
        "NewYorkExtraLarge-Bold",
        "NewYork-Black",
        "NewYork-Bold",
        "Georgia-Bold",
        "TimesNewRomanPS-BoldMT",
    ]
    for name in preferred {
        if let font = NSFont(name: name, size: size) {
            return font
        }
    }
    if let georgia = NSFontManager.shared.font(
        withFamily: "Georgia",
        traits: .boldFontMask,
        weight: 9,
        size: size
    ) {
        return georgia
    }
    return NSFont.systemFont(ofSize: size, weight: .black)
}

func drawIcon(size: CGFloat) throws -> Data {
    let pixels = Int(size)
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: pixels,
        pixelsHigh: pixels,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else {
        fatalError("Could not create bitmap for \(pixels)")
    }

    bitmap.size = NSSize(width: size, height: size)
    guard let graphicsContext = NSGraphicsContext(bitmapImageRep: bitmap) else {
        fatalError("Could not create graphics context for \(pixels)")
    }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphicsContext

    let context = graphicsContext.cgContext
    context.clear(CGRect(x: 0, y: 0, width: size, height: size))

    let inset = size * 0.055
    let tileRect = CGRect(x: inset, y: inset, width: size - inset * 2, height: size - inset * 2)
    let radius = size * 0.215
    let tilePath = CGPath(
        roundedRect: tileRect,
        cornerWidth: radius,
        cornerHeight: radius,
        transform: nil
    )

    context.saveGState()
    context.setShadow(
        offset: CGSize(width: 0, height: -size * 0.025),
        blur: size * 0.06,
        color: NSColor.black.withAlphaComponent(0.46).cgColor
    )
    context.setFillColor(NSColor.black.cgColor)
    context.addPath(tilePath)
    context.fillPath()
    context.restoreGState()

    context.saveGState()
    context.addPath(tilePath)
    context.clip()

    let colors = [
        NSColor(calibratedWhite: 0.13, alpha: 1).cgColor,
        NSColor(calibratedWhite: 0.025, alpha: 1).cgColor,
        NSColor.black.cgColor,
    ] as CFArray
    let locations: [CGFloat] = [0, 0.58, 1]
    let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: locations)!
    context.drawLinearGradient(
        gradient,
        start: CGPoint(x: tileRect.minX, y: tileRect.maxY),
        end: CGPoint(x: tileRect.maxX, y: tileRect.minY),
        options: []
    )

    context.setFillColor(NSColor.white.withAlphaComponent(0.075).cgColor)
    context.fill(CGRect(x: tileRect.minX, y: tileRect.midY, width: tileRect.width, height: tileRect.height / 2))

    context.setStrokeColor(NSColor.white.withAlphaComponent(0.16).cgColor)
    context.setLineWidth(max(1, size * 0.006))
    context.addPath(tilePath)
    context.strokePath()

    let bottomGlowColors = [
        NSColor(calibratedRed: 1, green: 0.56, blue: 0.22, alpha: 0.22).cgColor,
        NSColor(calibratedRed: 1, green: 0.56, blue: 0.22, alpha: 0).cgColor,
    ] as CFArray
    let bottomGlow = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: bottomGlowColors, locations: [0, 1])!
    context.drawRadialGradient(
        bottomGlow,
        startCenter: CGPoint(x: tileRect.midX, y: tileRect.minY + tileRect.height * 0.12),
        startRadius: 0,
        endCenter: CGPoint(x: tileRect.midX, y: tileRect.minY + tileRect.height * 0.12),
        endRadius: tileRect.width * 0.62,
        options: []
    )

    let font = titleFont(size: size * 0.76)
    let coreTextFont = CTFontCreateWithName(font.fontName as CFString, font.pointSize, nil)
    let shadowAttributes: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): coreTextFont,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): NSColor.black.withAlphaComponent(0.46).cgColor,
        .kern: -size * 0.018,
    ]
    let attributes: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): coreTextFont,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): NSColor(calibratedWhite: 0.955, alpha: 1).cgColor,
        .kern: -size * 0.026,
    ]
    let letter = NSAttributedString(string: "H", attributes: attributes)
    let line = CTLineCreateWithAttributedString(letter)
    let bounds = CTLineGetBoundsWithOptions(line, [.useGlyphPathBounds])
    let letterPosition = CGPoint(
        x: (size - bounds.width) / 2 - bounds.minX,
        y: (size - bounds.height) / 2 - bounds.minY - size * 0.025
    )
    let shadowLetter = NSAttributedString(string: "H", attributes: shadowAttributes)
    let shadowLine = CTLineCreateWithAttributedString(shadowLetter)
    context.textPosition = CGPoint(
        x: letterPosition.x + size * 0.018,
        y: letterPosition.y - size * 0.024
    )
    CTLineDraw(shadowLine, context)

    context.setShadow(
        offset: CGSize(width: 0, height: -size * 0.012),
        blur: size * 0.018,
        color: NSColor.black.withAlphaComponent(0.34).cgColor
    )
    context.textPosition = letterPosition
    CTLineDraw(line, context)
    context.setShadow(offset: .zero, blur: 0, color: nil)

    let highlightAttributes: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): coreTextFont,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): NSColor.white.withAlphaComponent(0.32).cgColor,
        .kern: -size * 0.026,
    ]
    let highlightLine = CTLineCreateWithAttributedString(NSAttributedString(string: "H", attributes: highlightAttributes))
    context.textPosition = CGPoint(x: letterPosition.x - size * 0.006, y: letterPosition.y + size * 0.008)
    CTLineDraw(highlightLine, context)

    context.restoreGState()

    NSGraphicsContext.restoreGraphicsState()

    guard let png = bitmap.representation(using: .png, properties: [:]) else {
        fatalError("Could not encode PNG for \(pixels)")
    }
    return png
}

func appendFourCC(_ value: String, to data: inout Data) {
    data.append(value.data(using: .ascii)!)
}

func appendUInt32(_ value: UInt32, to data: inout Data) {
    var bigEndian = value.bigEndian
    withUnsafeBytes(of: &bigEndian) { data.append(contentsOf: $0) }
}

func writeIcns(chunks: [(type: String, png: Data)], to url: URL) throws {
    var body = Data()
    for chunk in chunks {
        appendFourCC(chunk.type, to: &body)
        appendUInt32(UInt32(chunk.png.count + 8), to: &body)
        body.append(chunk.png)
    }

    var file = Data()
    appendFourCC("icns", to: &file)
    appendUInt32(UInt32(body.count + 8), to: &file)
    file.append(body)
    try file.write(to: url)
}

var rendered: [String: Data] = [:]
for (name, size) in sizes {
    let png = try drawIcon(size: size)
    rendered[name] = png
    try png.write(to: iconset.appendingPathComponent(name))
}

let icnsChunks = [
    ("icp4", "icon_16x16.png"),
    ("icp5", "icon_32x32.png"),
    ("icp6", "icon_32x32@2x.png"),
    ("ic07", "icon_128x128.png"),
    ("ic08", "icon_256x256.png"),
    ("ic09", "icon_512x512.png"),
    ("ic10", "icon_512x512@2x.png"),
].map { type, name in
    guard let png = rendered[name] else {
        fatalError("Missing rendered icon \(name)")
    }
    return (type: type, png: png)
}

try writeIcns(chunks: icnsChunks, to: icns)

print(iconset.path)

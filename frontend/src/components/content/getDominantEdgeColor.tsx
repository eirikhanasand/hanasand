import sharp from 'sharp'

export default async function getDominantEdgeColor(imagePath: string): Promise<{ rgb: string | null, hex: string | null }> {
    const path = `public${imagePath}`
    const metadata = await sharp(path).metadata()
    if (!metadata.width || !metadata.height) {
        return {
            rgb: null,
            hex: null
        }
    }

    const width = metadata.width
    const height = metadata.height

    const edgeWidth = Math.max(1, Math.floor(width * 0.05))
    const edgeHeight = Math.max(1, Math.floor(height * 0.05))

    const top = await sharp(path)
        .extract({ left: 0, top: 0, width, height: edgeHeight })
        .removeAlpha()
        .raw()
        .toBuffer()

    const bottom = await sharp(path)
        .extract({ left: 0, top: height - edgeHeight, width, height: edgeHeight })
        .removeAlpha()
        .raw()
        .toBuffer()

    const left = await sharp(path)
        .extract({ left: 0, top: 0, width: edgeWidth, height })
        .removeAlpha()
        .raw()
        .toBuffer()

    const right = await sharp(path)
        .extract({ left: width - edgeWidth, top: 0, width: edgeWidth, height })
        .removeAlpha()
        .raw()
        .toBuffer()

    const allPixels = Buffer.concat([top, bottom, left, right])

    let r = 0,
        g = 0,
        b = 0,
        count = 0

    const channels = 3
    for (let i = 0; i < allPixels.length; i += channels) {
        r += allPixels[i]
        g += allPixels[i + 1]
        b += allPixels[i + 2]
        count++
    }

    r = Math.round(r / count)
    g = Math.round(g / count)
    b = Math.round(b / count)

    const toHex = (v: number) => v.toString(16).padStart(2, '0')
    return {
        rgb: `rgb(${r}, ${g}, ${b})`,
        hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`
    }
}

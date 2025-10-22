/**
 * Converts a user-provided URL into a fetchable direct media URL.
 * Handles Tenor, Giphy, Imgur, and direct media URLs.
 */
export default function getFetchableUrl(url: string): string {
    try {
        const u = new URL(url)
        const host = u.hostname.toLowerCase()
        const path = u.pathname

        // -------- TENOR --------
        if (host.includes('tenor.com')) {
            if (host === 'c.tenor.com') return url
            return url
        }

        // -------- GIPHY --------
        if (host.includes('giphy.com')) {
            // Direct media URL
            if (host === 'media.giphy.com') return url
            // Convert /gifs/<slug>-<id> to media
            const gifMatch = path.match(/gifs\/[^-]+-([a-zA-Z0-9]+)/)
            if (gifMatch) {
                return `https://media.giphy.com/media/${gifMatch[1]}/giphy.gif`
            }
            return url
        }

        // -------- IMGUR --------
        if (host.includes('imgur.com')) {
            // Direct image URL
            if (host === 'i.imgur.com') return url
            // Convert /gallery/<id> or /a/<id> to direct image
            const imgMatch = path.match(/(?:gallery|a)\/([a-zA-Z0-9]+)/)
            if (imgMatch) {
                return `https://i.imgur.com/${imgMatch[1]}.jpg`
            }
            return url
        }

        // -------- DIRECT MEDIA URL --------
        // If URL ends with common image/video extensions, return as-is
        if (url.match(/\.(png|jpg|jpeg|gif|mp4|webm)$/i)) {
            return url
        }

        // Unknown or unsupported site
        return url
    } catch (error) {
        console.log(error)
        return url
    }
}

export default function estimateReadingTime(text: string, wpm = 80) {
    const wordCount = text.trim().split(/\s+/).length
    const minutes = wordCount / wpm
    const roundedMinutes = Math.ceil(minutes)

    return {
        wordCount,
        estimatedMinutes: roundedMinutes
    }
}

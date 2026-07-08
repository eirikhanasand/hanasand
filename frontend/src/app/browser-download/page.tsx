import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Browser Download Fixture',
    robots: { index: false, follow: false },
}

export default function Page() {
    return (
        <main>
            <h1>Browser download fixture</h1>
            <script dangerouslySetInnerHTML={{ __html: `
                const blob = new Blob(['browser sandbox download fixture\\n'], { type: 'text/plain' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'browser-fixture.txt';
                document.body.appendChild(link);
                setTimeout(() => link.click(), 250);
            ` }} />
        </main>
    )
}

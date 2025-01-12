import Link from "next/link";

export default function QuoteButton() {
    return (
        <Link href="/quotes" className="absolute bottom-10 left-10 bg-gray-800 text-center p-1 px-4 rounded-lg cursor-pointer">
            <h2 className="text-2xs">Quotes</h2>
        </Link>
    )
}
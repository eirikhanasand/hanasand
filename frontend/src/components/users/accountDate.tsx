export default function AccountDate({ value, empty = 'Unknown' }: { value?: string | null, empty?: string }) {
    if (!value || !Number.isFinite(new Date(value).getTime())) return <span>{empty}</span>
    return <time dateTime={value} title={new Date(value).toUTCString()}>{new Date(value).toLocaleDateString('en-GB', { timeZone: 'UTC' })}</time>
}

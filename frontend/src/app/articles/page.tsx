import Articles from "@/components/articles/articles"

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const error = Array.isArray(params.error) ? params.error[0] : params.error
    const errorPath = Array.isArray(params.path) ? params.path[0] : params.path

    return (
        <div className="h-full">
            <Articles error={error} errorPath={errorPath} />
        </div>
    )
}

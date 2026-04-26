import config from '@/config'

export async function rerunTest(id: string | number) {
    const response = await fetch(`${config.url.api}/test/${id}/rerun`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
    })

    if (!response.ok) {
        throw new Error('Failed to rerun test')
    }

    return await response.json()
}

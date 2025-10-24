type User = {
    id: string
    name: string
    avatar: string
}

type Role = {
    id: number
    name: string
    description?: string
    created_by: string
    created_at: string
    updated_at: string
}

type Test = {
    id: number
    url: string
    timeout: number
    stages: object & { default: boolean }
    status: string
    logs: object[]
    errors: object[]
    duration: { milliseconds: number }
    created_at: string
    finished_at: string
    exit_code: number
    visits: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    summary: any
}

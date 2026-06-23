'use client'

import { getCookie } from '@/utils/cookies/cookies'

function authHeaders() {
    const token = getCookie('access_token') || ''
    const id = getCookie('id') || ''

    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        id,
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api/backend${path}`, {
        ...init,
        headers: {
            ...authHeaders(),
            ...(init?.headers || {}),
        },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(String((body as { error?: string }).error || 'Notes request failed.'))
    }

    return body as T
}

export function fetchNotes() {
    return request<Note[]>('/notes')
}

export function createNote(payload: { title: string, content: string }) {
    return request<Note>('/notes', {
        method: 'POST',
        body: JSON.stringify({ ...payload, source: 'website' }),
    })
}

export function updateNote(id: string, payload: { title: string, content: string }) {
    return request<Note>(`/notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...payload, source: 'website' }),
    })
}

export function deleteNote(id: string) {
    return request<{ deleted: boolean, id: string }>(`/notes/${id}`, {
        method: 'DELETE',
    })
}

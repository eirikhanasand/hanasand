import assert from 'node:assert/strict'
// @ts-expect-error Bun supplies the focused test mocks.
import { mock } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToReadableStream } from 'react-dom/server'

let release: (allowed: boolean) => void = () => {}
mock.module('@/utils/organizations/management', () => ({ canManageOrganizations: () => new Promise<boolean>(resolve => { release = resolve }) }))
mock.module('next/headers', () => ({
    cookies: async () => ({ get: (name: string) => ['id', 'access_token'].includes(name) ? { value: 'fixture' } : undefined }),
    headers: async () => ({ get: () => '/cases' }),
}))
const children = ({ children }: { children: ReactNode }) => children
mock.module('@/components/organizations/workspaceProvider', () => ({ default: children }))
mock.module('@/components/layout/mobileNavigation', () => ({ default: children }))
mock.module('@/components/layout/routeFrame', () => ({ default: ({ children, sidebar }: { children: ReactNode, sidebar: ReactNode }) => createElement('main', null, sidebar, children) }))
mock.module('@/components/dashboard/dashboardSidebar', () => ({ default: ({ canManageOrganizations }: { canManageOrganizations: boolean }) => createElement('nav', null, canManageOrganizations ? 'Management allowed' : 'Navigation') }))
mock.module('@/components/header/header', () => ({ default: () => null }))
mock.module('@/components/box/detachedBoxHost', () => ({ default: () => null }))
mock.module('@/components/system/recovery', () => ({ RecoveryBanner: () => null }))
mock.module('@/components/impersonation/impersonationBanner', () => ({ default: () => null }))
const { default: Layout } = await import('../src/app/layout')
for (const allowed of [true, false]) {
    const start = performance.now()
    const reader = (await renderToReadableStream(await Layout({ children: createElement('h1', null, 'Cases content') }))).getReader()
    const first = await Promise.race([reader.read(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Sidebar permission blocks cases')), 1000))])
    const shell = new TextDecoder().decode(first.value)
    assert(shell.includes('Cases content'))
    assert(!shell.includes('Management allowed'))
    console.log(`Cases shell before sidebar permission resolves: ${(performance.now() - start).toFixed(2)} ms`)
    release(allowed)
    let rest = ''
    for (;;) { const next = await reader.read(); if (next.done) break; rest += new TextDecoder().decode(next.value) }
    assert.equal(rest.includes('Management allowed'), allowed)
}

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function source(relativePath) {
    return readFileSync(path.join(root, relativePath), 'utf8')
}

const sidebar = source('src/components/dashboard/dashboardSidebar.tsx')
const notices = source('src/components/error/errorNotice.tsx')
const vmList = source('src/components/profile/vms.tsx')
const vmRow = source('src/components/profile/vm.tsx')

for (const required of [
    'border-ui-primary bg-ui-primary/10 text-ui-primary',
    'border border-ui-border bg-ui-panel',
]) {
    assert.ok(sidebar.includes(required), `Dashboard sidebar active dark contrast token is missing: ${required}`)
}

for (const required of [
    'border-ui-primary bg-ui-panel text-ui-text',
    'border-ui-danger bg-ui-panel text-ui-danger',
    'border-ui-success bg-ui-panel text-ui-success',
]) {
    assert.ok(notices.includes(required), `Notice dark-mode contrast token is missing: ${required}`)
}

for (const required of [
    'border border-ui-border bg-ui-primary/10',
    'text-ui-primary',
]) {
    assert.ok(vmList.includes(required), `VM managed badge dark contrast token is missing: ${required}`)
}

for (const required of [
    'border border-ui-border bg-ui-raised',
    'border border-ui-border bg-ui-canvas',
]) {
    assert.ok(vmRow.includes(required), `VM row dark contrast token is missing: ${required}`)
}

for (const banned of [
    '<Notify className=\'px-4\' background=\'bg-white\'',
    '<Notify background=\'bg-white\'',
]) {
    assert.equal(vmRow.includes(banned), false, `VM row should not force a light toast surface: ${banned}`)
}

console.log('[dashboard-vm-contrast] dark dashboard VM contrast guard passed')

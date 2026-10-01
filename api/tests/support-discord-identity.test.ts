import { expect, test } from 'bun:test'
import { parseDiscordSupportIdentity } from '../src/utils/support/discordIdentity.ts'

test('Discord support identity prefers the server nickname, then global name, then username', () => {
    expect(parseDiscordSupportIdentity({
        nick: 'Axe',
        roles: ['support-role'],
        user: { global_name: 'Global Axe', username: 'axe123' },
    }, 'support-role')).toEqual({ displayName: 'Axe', isSupportMember: true })

    expect(parseDiscordSupportIdentity({
        nick: null,
        roles: [],
        user: { global_name: 'Global Axe', username: 'axe123' },
    }, 'support-role')).toEqual({ displayName: 'Global Axe', isSupportMember: false })

    expect(parseDiscordSupportIdentity({
        roles: [],
        user: { global_name: null, username: 'axe123' },
    }, 'support-role')).toEqual({ displayName: 'axe123', isSupportMember: false })
})

test('Discord identity parsing rejects incomplete member responses', () => {
    expect(parseDiscordSupportIdentity(null, 'support-role')).toBeNull()
    expect(parseDiscordSupportIdentity({ roles: [], user: { username: '' } }, 'support-role')).toBeNull()
})

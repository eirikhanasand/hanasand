import React from 'react'
import { createRoot } from 'react-dom/client'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import UsersList from '../../src/components/users/usersList'
import PublicProfile from '../../src/components/profile/publicProfile'
const users = [
    { id: 'member', name: 'Member One', username: 'member', avatar: '', active: true, email: 'support@example.com' },
    { id: 'second', name: 'Other Member', username: 'second', avatar: '', active: true, email: null },
] as UserWithRole[]
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch: async () => {}, hmrRefresh() {} }
createRoot(document.getElementById('root')!).render(<AppRouterContext.Provider value={router}>
    <div data-testid='user-list'><UsersList roles={[]} users={users} /></div>
    <div data-testid='admin-profile'><PublicProfile username='member' profile={users[0]} /></div>
    <div data-testid='public-profile'><PublicProfile username='second' profile={users[1]} /></div>
</AppRouterContext.Provider>)

import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import OrganizationList from '../src/app/dashboard/management/organizations/organizationList'

test('organization table retains creation dates and shows recorded activity with an explicit UTC time', () => {
    const html = renderToStaticMarkup(<OrganizationList organizations={[
        { id: 'one', name: 'Hanasand', slug: 'hanasand', status: 'active', member_count: 2, created_at: '2026-09-14T14:42:50Z', last_active_at: '2026-09-19T10:30:00Z' },
        { id: 'two', name: 'Cashflow', slug: 'cashflow', status: 'active', member_count: 1, created_at: '2026-09-14T14:42:50Z', last_active_at: null },
    ]} />)
    expect(html).toContain('Created')
    expect(html).toContain('14/09/2026')
    expect(html).toContain('Last active (UTC)')
    expect(html).toContain('dateTime="2026-09-19T10:30:00Z"')
    expect(html).toMatch(/19 Sep(?:t)? 2026(?:,| at) 10:30/)
    expect(html).toContain('No recorded activity')
})

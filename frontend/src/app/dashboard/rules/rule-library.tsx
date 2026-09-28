'use client'

import { useState } from 'react'
import Link from '@/components/organizations/workspaceLink'
import { DashboardPanel } from '@/components/dashboard/ui'
import Button from '@/components/misc/button'
import SortIndicator from '@/components/dashboard/sort-indicator'
import { useSmoothedCount } from './use-smoothed-count'
import { compareRules, defaultRuleSortDirection, type RuleSortColumn, type RuleSortDirection } from './rule-sort'
import { getRuleCategory, ruleCategories, type RuleCategory } from './rule-categories'
import type { Rule } from './detection-rules'

type RuleLibraryProps = {
    category: RuleCategory
    rules: Rule[]
    loading: boolean
    canManageRules: boolean
    organizationId: string
    onToggleRule: (rule: Rule) => void
}

export default function RuleLibrary({ category, rules, loading, canManageRules, organizationId, onToggleRule }: RuleLibraryProps) {
    const [sort, setSort] = useState<{ column: RuleSortColumn, direction: RuleSortDirection }>({ column: 'Hits', direction: 'descending' })
    const [titleFilter, setTitleFilter] = useState('')
    const [textFilter, setTextFilter] = useState('')
    const [enabledFilter, setEnabledFilter] = useState('all')
    const [severityFilter, setSeverityFilter] = useState('all')

    function sortBy(column: RuleSortColumn) {
        setSort(current => ({ column, direction: current.column === column ? current.direction === 'descending' ? 'ascending' : 'descending' : defaultRuleSortDirection(column) }))
    }

    const titleQuery = titleFilter.trim().toLowerCase()
    const textQuery = textFilter.trim().toLowerCase()
    const categoryRules = rules.filter(rule => getRuleCategory(rule) === category)
    const filteredRules = categoryRules.filter(rule =>
        rule.name.toLowerCase().includes(titleQuery)
        && (!textQuery || [rule.name, rule.id, rule.rule_id, rule.explanation, rule.family, rule.severity, rule.source].join(' ').toLowerCase().includes(textQuery))
        && (enabledFilter === 'all' || (rule.enabled !== false) === (enabledFilter === 'enabled'))
        && (severityFilter === 'all' || rule.severity.toLowerCase() === severityFilter)
    )
    const sortedRules = [...filteredRules].sort((a, b) => compareRules(a, b, sort.column, sort.direction))
    const columns: Array<{ label: string, key: RuleSortColumn }> = (['Title', 'Description', 'Family', 'Severity', 'Status', 'Source', 'Hits'] as RuleSortColumn[]).map(key => ({ label: key, key }))
    if (category === 'analysis') columns.push({ label: 'Action', key: 'Action' })
    columns.push({ label: category === 'analysis' ? 'Controls' : 'Action', key: 'Controls' })
    const ruleListLabel = ruleCategories[category].label.endsWith(' rules') ? ruleCategories[category].label : `${ruleCategories[category].label} rules`
    const severities = Array.from(new Set(['informational', 'low', 'medium', 'high', 'critical', ...categoryRules.map(rule => rule.severity.toLowerCase())]))
    const hasFilters = Boolean(titleFilter || textFilter || enabledFilter !== 'all' || severityFilter !== 'all')

    function clearFilters() {
        setTitleFilter('')
        setTextFilter('')
        setEnabledFilter('all')
        setSeverityFilter('all')
    }

    return (
        <DashboardPanel className='grid min-w-0 gap-4 p-4 sm:p-6' id='event-rules'>
            <h2 className='font-semibold'>Rule library</h2>
            <div role='search' aria-label='Filter rules' className='grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1.5fr_auto_auto_auto]'>
                <label className='grid min-w-0 gap-1 text-xs text-ui-muted'>Title<input type='search' value={titleFilter} onChange={event => setTitleFilter(event.target.value)} placeholder='Filter by title' className='h-9 min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                <label className='grid min-w-0 gap-1 text-xs text-ui-muted'>Search text<input type='search' value={textFilter} onChange={event => setTextFilter(event.target.value)} placeholder='Search descriptions, IDs, families…' className='h-9 min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                <label className='grid min-w-0 gap-1 text-xs text-ui-muted'>Status<select value={enabledFilter} onChange={event => setEnabledFilter(event.target.value)} className='h-9 min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text'><option value='all'>All statuses</option><option value='enabled'>Enabled</option><option value='disabled'>Disabled</option></select></label>
                <label className='grid min-w-0 gap-1 text-xs text-ui-muted'>Severity<select value={severityFilter} onChange={event => setSeverityFilter(event.target.value)} className='h-9 min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text'><option value='all'>All severities</option>{severities.map(severity => <option key={severity} value={severity}>{severity.charAt(0).toUpperCase() + severity.slice(1)}</option>)}</select></label>
                <Button text='Clear filters' variant='outline' size='sm' onClick={clearFilters} disabled={!hasFilters} className='h-9 self-end rounded-md' />
            </div>
            <p role='status' className='text-xs text-ui-muted'>{filteredRules.length} of {categoryRules.length} rules</p>
            <div role='region' aria-label={ruleListLabel} tabIndex={0} className='min-w-0 overflow-x-auto rounded-md border border-ui-border focus-visible:outline-2 focus-visible:outline-ui-primary'>
                <table className='w-full min-w-[1000px] table-fixed text-left text-sm' aria-label={ruleListLabel}>
                    <colgroup><col className='w-[22%]' /><col className={category === 'analysis' ? 'w-[15%]' : 'w-[23%]'} /><col className='w-[10%]' /><col className='w-[8%]' /><col className='w-[8%]' /><col className='w-[10%]' /><col className='w-[10%]' />{category === 'analysis' && <col className='w-[8%]' />}<col className='w-[9%]' /></colgroup>
                    <thead className='bg-ui-raised text-xs text-ui-muted'><tr>{columns.map(column => {
                        const active = sort.column === column.key
                        const direction = active ? sort.direction : defaultRuleSortDirection(column.key)
                        return <th key={column.key} scope='col' aria-sort={active ? direction : 'none'} className='px-3 py-2 font-medium'>
                            <button type='button' onClick={() => sortBy(column.key)} className='inline-flex items-center gap-1.5 rounded-sm text-left hover:text-ui-primary focus-visible:outline-2 focus-visible:outline-ui-primary'>
                                {column.label}<SortIndicator active={active} direction={direction === 'ascending' ? 'asc' : 'desc'} />
                            </button>
                        </th>
                    })}</tr></thead>
                    <tbody className='divide-y divide-ui-border'>
                        {sortedRules.map(rule => <tr key={rule.id} className='h-16 hover:bg-ui-raised'>
                            <th scope='row' className='px-3 py-2 font-normal'>
                                <Link prefetch={false} href={`/rules/${category}/${encodeURIComponent(rule.id.replace(/\.v\d+$/, ''))}?organizationId=${encodeURIComponent(organizationId)}`} className='block rounded-sm focus-visible:outline-2 focus-visible:outline-ui-primary'>
                                    <span className='block truncate font-semibold text-ui-primary' title={rule.name}>{rule.name}</span>
                                    <span className='mt-1 block truncate text-xs text-ui-muted' title={rule.id.replace(/\.v\d+$/, '')}>{rule.id.replace(/\.v\d+$/, '')}</span>
                                </Link>
                            </th>
                            <td className='px-3 py-2 text-xs text-ui-muted'><span className='line-clamp-2' title={rule.explanation}>{rule.explanation}</span></td>
                            <td className='px-3 py-2 text-xs text-ui-muted'><span className='line-clamp-2' title={rule.family}>{rule.family}</span></td>
                            <td className='px-3 py-2 text-xs capitalize'>{rule.severity}</td>
                            <td className='px-3 py-2 text-xs'>{rule.enabled === false ? 'Disabled' : 'Enabled'}</td>
                            <td className='px-3 py-2 text-xs text-ui-muted'>{rule.source === 'open_source' ? 'Imported rule' : rule.source === 'owned' ? 'Custom rule' : 'Hanasand rule'}</td>
                            <td className='px-3 py-2 text-xs tabular-nums'><AnimatedHits value={rule.hitCount} rate={rule.hitRate} sampledAt={rule.sampledAt} /></td>
                            {category === 'analysis' && <td className='px-3 py-2 text-xs'>{rule.definition?.action === 'drop' ? 'Drop' : 'Store'}</td>}
                            <td className='px-2 py-2'><Button text={rule.enabled === false ? 'Enable' : 'Disable'} aria-label={`${rule.enabled === false ? 'Enable' : 'Disable'} ${rule.name}`} variant='outline' size='sm' className='rounded-md' disabled={!canManageRules} onClick={() => onToggleRule(rule)} /></td>
                        </tr>)}
                        {!filteredRules.length && <tr><td colSpan={category === 'analysis' ? 9 : 8} className='px-3 py-6 text-center text-sm text-ui-muted'>{loading ? 'Loading rules…' : hasFilters ? 'No rules in this category match these filters.' : 'No rules in this category.'}</td></tr>}
                    </tbody>
                </table>
            </div>
        </DashboardPanel>
    )
}

function AnimatedHits({ value, rate, sampledAt }: { value?: number | null, rate?: number | null, sampledAt?: number }) {
    const count = useSmoothedCount(value, 10_000, rate, sampledAt)
    return <>{count?.toLocaleString('en-US') ?? '—'}</>
}

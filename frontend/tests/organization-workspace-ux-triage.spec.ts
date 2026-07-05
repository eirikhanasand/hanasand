import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('organization workspace keeps launch workflow primary and admin controls disclosed', async () => {
    const page = await readFile(path.join(root, 'src/app/organizations/organizationWorkspaceClient.tsx'), 'utf8')

    expect(page).toContain('data-org-setup-progress')
    expect(page).toContain('data-org-setup-rail')
    expect(page).toContain('data-org-setup-progress-count')
    expect(page).toContain('data-org-setup-step-reason')
    expect(page).not.toContain('data-org-setup-blocked-count')
    expect(page).not.toContain('{lockedCount} needs access')
    expect(page).not.toContain('{blockedCount} blocked')
    expect(page).toContain('Owner or admin access is required to invite members.')
    expect(page).toContain('const requireManage = () =>')
    expect(page).toContain('requireManage()')
    expect(page).toContain('Create a shared watchlist term before testing delivery.')
    expect(page).toContain('Matched exposure records are shown here as collection runs.')
    expect(page).toContain('data-org-setup-step={row.id}')
    expect(page).toContain('data-org-setup-next')
    expect(page).toContain('data-org-watchlist-starter')
    expect(page).toContain('data-org-watchlist-add-disclosure')
    expect(page).toContain('data-org-watchlist-create-grid')
    expect(page).toContain('data-org-watchlist-suggestion=\'true\'')
    expect(page).toContain('starterWatchlistSuggestions(selectedOrganization, bundle.watchlists)')
    expect(page).toContain('setDraft({ kind: suggestion.kind, value: suggestion.value, notes: suggestion.notes })')
    expect(page).toContain('open={watchlists.length === 0 ? true : undefined}')
    expect(page).not.toContain('Choose a term type, then enter the real company, domain, supplier, actor, or keyword value.')
    expect(page).not.toContain('Start with a scope template, enter a real customer-owned term, then save it to generate org-scoped alert terms and delivery context.')
    expect(page).toContain('const requireManage = () => {')
    expect(page).toContain('requireManage()')
    expect(page).toContain('const canCopy = canManage && linkAvailable && !busy')
    expect(page).toContain('firstDomainCandidate')
    expect(page).toContain('data-org-health-strip')
    expect(page).toContain('Workspace health')
    expect(page).toContain('Last activity')
    expect(page).toContain('const accessMode = canManage ? \'admin controls enabled\' : organization.role === \'support\' ? \'support inspection only\' : \'read-only access\'')
    expect(page).toContain('const lastActivityAt = organizationLastActivityAt(organization, bundle)')
    expect(page).toContain('function organizationLastActivityAt')
    expect(page).toContain('bundle.deliveries.flatMap(delivery => [delivery.attemptedAt, delivery.updatedAt, delivery.createdAt])')
    expect(page).toContain('data-org-workspace-summary')
    expect(page).toContain('const workspaceMeta = sanitizeOrganizationDisplayCopy(organization.status || organization.slug || organization.id) || \'Active workspace\'')
    expect(page).not.toContain('const workspaceMeta = sanitizeOrganizationDisplayCopy(organization.tenantId || organization.slug || organization.id) || \'Default workspace\'')
    expect(page).not.toContain('{organization.tenantId || \'default tenant\'}')
    expect(page).toContain('data-org-summary-chip-list')
    expect(page).toContain('data-org-summary-chip={row.id}')
    expect(page).not.toContain('function Metric')
    expect(page).toContain('data-org-health-compact')
    expect(page).toContain('data-org-health-row={row.id}')
    expect(page).toContain('data-org-health-activity')
    expect(page).toContain('const lastActivityAt = organizationLastActivityAt(organization, bundle)')
    expect(page).toContain('Last activity {lastActivityAt ? formatDate(lastActivityAt) : \'pending\'}')
    expect(page).toContain('function organizationLastActivityAt')
    expect(page).toContain('...bundle.deliveries.flatMap(delivery => [delivery.attemptedAt, delivery.updatedAt, delivery.createdAt])')
    expect(page).toContain('data-org-section-nav')
    expect(page).toContain('Organization workspace sections')
    expect(page).toContain('function WorkspaceSectionNav')
    expect(page).toContain('<WorkspaceSectionNav organization={selectedOrganization} bundle={bundle} selectedSubject={selectedActivitySubject} />')
    expect(page).toContain('selectedSubjectLabel(selectedSubject, organization, bundle)')
    expect(page).toContain('function activitySubjectTypeLabel')
    expect(page).toContain('detail: activitySubjectTypeLabel(selectedSubject.type)')
    expect(page).toContain('data-org-section-nav-item={row.id}')
    expect(page).toContain('data-org-create-compact')
    expect(page).toContain('data-org-create-primary')
    expect(page).toContain('data-org-create-first-watchlist')
    expect(page).toContain('data-org-workspace-filter')
    expect(page).toContain('data-org-workspace-count')
    expect(page).toContain('data-org-workspace-filter-empty')
    expect(page).toContain('placeholder=\'Name, status, role\'')
    expect(page).not.toContain('placeholder=\'Name, tenant, role\'')
    expect(page).toContain('const [workspaceQuery, setWorkspaceQuery] = useState(\'\')')
    expect(page).toContain('const visibleOrganizations = organizations.filter')
    expect(page).toContain('organizationSearchText(organization).includes(normalizedWorkspaceQuery)')
    expect(page).toContain('function organizationWorkspaceMeta')
    expect(page).toContain('sanitizeOrganizationDisplayCopy(organization.status || organization.slug || organization.id)')
    expect(page).not.toContain('sanitizeOrganizationDisplayCopy(organization.tenantId || organization.slug || organization.id)')
    expect(page).toContain('function organizationSearchText')
    expect(page).toContain('Organization created')
    expect(page).toContain('data-org-create-first-invites')
    expect(page).toContain('const reloadOrganizationId = typeof actionResult === \'object\' ? actionResult?.organizationId : undefined')
    expect(page).toContain('organizationId,')
    expect(page).toContain('replaceOrganizationWorkspaceSelectionUrl(organizationId, { type: \'organization\', id: organizationId })')
    expect(page).toContain('await loadOrganizations(organizationId)')
    expect(page).toContain('/api/organizations/${encodeURIComponent(organizationId)}/watchlists')
    expect(page).toContain('Initial shared watchlist term added from organization setup.')
    expect(page).toContain('{organizations.length === 0 && createOrganizationPanel}')
    expect(page).toContain('{organizations.length > 0 && createOrganizationPanel}')
    expect(page).toContain('selectedOrganization || organizations.length > 0 || (!loading && organizations.length === 0)')
    expect(page.indexOf('<h2 className=\'px-2 py-2 text-sm font-semibold text-ui-text dark:text-ui-text\'>Workspaces</h2>')).toBeLessThan(page.indexOf('{organizations.length > 0 && createOrganizationPanel}'))
    expect(page).toContain('Workspace health')
    expect(page).toContain('Test a Discord or webhook destination')
    expect(page).not.toContain('Keep watchlists, destinations, and alert context ready for safe replay.')
    expect(page).toContain('Shared watchlists')
    expect(page).toContain('Test destination')
    expect(page).toContain('href: \'#destinations\'')
    expect(page).toContain('data-org-action-strip=\'true\'')
    expect(page).toContain('bundle={bundle}')
    expect(page).toContain('const selectedLabel = selectedSubjectLabel(selectedSubject, organization, bundle)')
    expect(page).not.toContain('Manage {sanitizeOrganizationDisplayCopy(selectedLabel) || selectedLabel}, delivery destination, and team access from one workspace view.')
    expect(page).toContain('Focus: {organizationFocusLabel(focus)}')
    expect(page).toContain('function organizationFocusLabel(value: string)')
    expect(page).not.toContain('Manage the selected {selectedSubject.type}')
    expect(page).not.toContain('Focus: {focus}')
    expect(page).toContain('data-org-action-next=\'true\'')
    expect(page).toContain('disabled: !canManage || !hasWatchlists')
    expect(page).toContain('Add a watchlist term before testing delivery.')
    expect(page).toContain('Owner or admin access is required to test delivery.')
    expect(page).toContain('Start with a shared watchlist term.')
    expect(page).toContain('Owner or admin access unlocks setup actions.')
    expect(page).toContain('title={disabledReason}')
    expect(page).toContain('aria-label={disabledReason ? `${label}: ${disabledReason}` : label}')
    expect(page).toContain('<PermissionStrip')
    expect(page).toContain('data-org-permission-strip=\'true\'')
    expect(page).toContain('<details open className=\'group rounded-lg border border-ui-border bg-ui-panel p-2 shadow-sm dark:border-ui-border dark:bg-ui-panel\' data-org-permission-strip=\'true\'')
    expect(page).toContain('data-org-permission-row={row.id}')
    expect(page).toContain('Current role')
    expect(page).toContain('const supportAccess = role === \'support\'')
    expect(page).toContain('const readOnlyReason = supportAccess ? \'Support inspection only\' : \'Owner or admin required\'')
    expect(page).toContain('supportAccess ? \'Inspect\' : \'View\'')
    expect(page).toContain('Sign in with an organization account to manage organizations.')
    expect(page).toContain('Organization service is temporarily unavailable.')
    expect(page).toContain('Owner or admin required')
    expect(page).toContain('const replayDisabledReason = !canManage ? \'Owner or admin required\' : !configured ? \'Save a destination before replay.\' : \'\'')
    expect(page).toContain('disabled={!canManage || !configured || Boolean(busy)}')
    expect(page).toContain('aria-label={replayDisabledReason ? `${replayLabel}: ${replayDisabledReason}` : replayLabel}')
    expect(page).toContain('const configuredDestinationCount = organizationConfiguredDestinationCount(bundle)')
    expect(page).toContain('destinationCount={configuredDestinationCount}')
    expect(page).toContain('function organizationConfiguredDestinationCount')
    expect(page).toContain('bundle.webhooks.filter(organizationDestinationConfigured).length')
    expect(page).toContain('data-org-empty-focused-create')
    expect(page).toContain('Create an organization to start monitoring')
    expect(page).toContain('Create organization')
    expect(page).toContain('Add shared term')
    expect(page).toContain('Invite member')
    expect(page).toContain('`${emails.length} ${inviteRole} invite${emails.length === 1 ? \'\' : \'s\'} sent.`')
    expect(page).toContain('`Invite revoked for ${invite.email}.`')
    expect(page).toContain('`Invite resent to ${invite.email}.`')
    expect(page).toContain('`${organizationMemberLabel(member.userId, bundle.members)} changed to ${role}.`')
    expect(page).toContain('`${organizationMemberLabel(member.userId, bundle.members)} removed.`')
    expect(page).toContain('`${watchlistDraft.value.trim()} saved.`')
    expect(page).toContain('`${draft.value.trim()} updated.`')
    expect(page).toContain('`${destination.name || destination.id} tested.`')
    expect(page).toContain('const deliveryHref = deliveryId || destinationId || focus === \'destinations\' || focus === \'webhooks\'')
    expect(page).toContain('{deliveryHref && <ActionAnchor href={deliveryHref} icon={<Webhook className=\'h-4 w-4\' />} label=\'Delivery history\' />}')
    expect(page).not.toContain('Use the form on the left to create the workspace and seed the first shared watchlist term.')
    expect(page).not.toContain('Create org first')
    expect(page).not.toMatch(/\n\s*Create org\n/)
    expect(page).not.toContain('Waiting for org')
    expect(page).not.toContain('No events')
    expect(page).not.toContain('border-dashed border-ui-border bg-ui-panel p-4 shadow-sm')
    expect(page).toContain('data-org-watchlist-filter-strip')
    expect(page).toContain('data-org-watchlist-filter-count')
    expect(page).toContain('data-org-watchlist-filter-empty')
    expect(page).toContain('data-org-watchlist-row-layout')
    expect(page).toContain('2xl:grid-cols-[minmax(16rem,1fr)_minmax(17rem,0.8fr)_auto]')
    expect(page).toContain('line-clamp-2 wrap-break-word text-base font-semibold')
    expect(page).toContain('`${primaryButtonClass} whitespace-nowrap`')
    expect(page).toContain('const [watchlistQuery, setWatchlistQuery] = useState(\'\')')
    expect(page).toContain('const [watchlistStatusFilter, setWatchlistStatusFilter] = useState(\'all\')')
    expect(page).toContain('const visibleWatchlists = watchlists.filter')
    expect(page).toContain('const filtersActive = Boolean(watchlistQuery.trim()) || watchlistStatusFilter !== \'all\'')
    expect(page).toContain('watchlistSearchText(item, organization).includes(normalizedWatchlistQuery)')
    expect(page).toContain('options={[\'all\', \'active\', \'paused\', \'archived\']}')
    expect(page).toContain('Adjust filters to see matching watchlist terms.')
    expect(page).toContain('function watchlistSearchText')
    expect(page).toContain('item.alertGenerationRef')
    expect(page).toContain('item.webhookEndpointHash')
    expect(page).toContain('data-org-delivery-payload-preview')
    expect(page).toContain('payloadPreviewForDelivery(delivery)')
    expect(page).toContain('payloadPreviewFromRecord(delivery.sanitizedPayloadPreview)')
    expect(page).toContain('function deliveryFailureSummary')
    expect(page).toContain('function deliveryOutcomeSummary')
    expect(page).toContain('function deliveryRetryText')
    expect(page).toContain('function replayBlockedReason')
    expect(page).toContain('No active Discord or webhook destination is configured for this alert.')
    expect(page).toContain('Delivery failed before Discord/webhook accepted the request.')
    expect(page).toContain('Replay needs a saved destination.')
    expect(page).toContain('Replay needs alert, case, or watchlist context.')
    expect(page).toContain('Linked case or alert is available.')
    expect(page).toContain('Workspace routes')
    expect(page).toContain('No monitoring records yet')
    expect(page).toContain('Matched records for this organization.')
    expect(page).toContain('Shared watchlist match')
    expect(page).not.toContain('No scoped monitoring records yet')
    expect(page).not.toContain('Org-scoped watchlist, case, and delivery records used by monitoring flows.')
    expect(page).not.toContain('Route: {sanitizeOrganizationDisplayCopy(route) || route}')
    expect(page).not.toContain('Linked case or alert available.')
    expect(page).not.toContain('Needs destination and alert context')
    expect(page).toContain('/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists')
    expect(page).toContain('/api/dwm/webhooks/deliver')

    expect(page).toContain('data-org-settings-disclosure')
    expect(page).toContain('<details id=\'settings\' open')
    expect(page).toContain('Organization settings')
    expect(page).toContain('rowMessage={rowMessages.settings}')
    expect(page).toContain('<RowStatus message={rowMessage} />')
    expect(page).toContain('data-org-members-disclosure')
    expect(page).toContain('<details id=\'members\' open')
    expect(page).toContain('data-org-member-mobile-list=\'true\'')
    expect(page).toContain('data-org-member-mobile-row=\'true\'')
    expect(page).toContain('data-org-member-desktop-table=\'true\'')
    expect(page).toContain('data-org-member-filter-strip')
    expect(page).toContain('data-org-member-filter-count')
    expect(page).toContain('const [memberQuery, setMemberQuery] = useState(\'\')')
    expect(page).toContain('const [memberRoleFilter, setMemberRoleFilter] = useState(\'all\')')
    expect(page).toContain('const visibleMembers = members.filter')
    expect(page).toContain('memberSearchText(member).includes(normalizedMemberQuery)')
    expect(page).toContain('function memberSearchText')
    expect(page).toContain('Adjust filters to see matching team members.')
    expect(page).toContain('data-org-destinations-disclosure')
    expect(page).toContain('<details id=\'destinations\' open')
    expect(page).toContain('Saved destinations')
    expect(page).toContain('data-org-destination-filter-strip')
    expect(page).toContain('data-org-destination-filter-count')
    expect(page).toContain('const [destinationQuery, setDestinationQuery] = useState(\'\')')
    expect(page).toContain('const [destinationStatusFilter, setDestinationStatusFilter] = useState(\'all\')')
    expect(page).toContain('const [destinationKindFilter, setDestinationKindFilter] = useState(\'all\')')
    expect(page).toContain('const visibleDestinations = destinations.filter')
    expect(page).toContain('destinationSearchText(destination, destinationDeliveries).includes(normalizedDestinationQuery)')
    expect(page).toContain('function deliveriesForDestination')
    expect(page).toContain('function destinationSearchText')
    expect(page).toContain('Adjust filters to see matching destinations.')

    expect(page.indexOf('<SettingsPanel')).toBeLessThan(page.indexOf('<WatchlistPanel'))
    expect(page.indexOf('data-org-settings-disclosure')).toBeLessThan(page.indexOf('Save settings'))
    expect(page.indexOf('data-org-members-disclosure')).toBeLessThan(page.indexOf('Remove member'))
    expect(page.indexOf('data-org-destinations-disclosure')).toBeLessThan(page.indexOf('Remove destination'))

    expect(page).toContain('onRoleChange={(member, role) => void changeMemberRole(member, role)}')
    expect(page).toContain('onTest={destination => void testSavedDestination(destination)}')
    expect(page).toContain('onDelete={destination => void deleteSavedDestination(destination)}')
    expect(page).toContain('const memberMutationReason = !canManage ? \'Owner or admin required\' : !memberCanMutate(member) ? \'Owner role cannot be changed here\' : \'\'')
    expect(page).toContain('data-org-member-access-state=\'true\'')
    expect(page).toContain('const memberAccess = canMutateMember ? \'Role editable\' : member.role === \'owner\' ? \'Owner locked\' : \'Read-only\'')
    expect(page).toContain('title={memberMutationReason || \'Remove member\'}')
    expect(page).toContain('const testDisabledReason = !canManage ? \'Owner or admin required\' : \'\'')
    expect(page).toContain('const destinationManageReason = !canManage ? \'Owner or admin required\' : \'\'')
    expect(page).toContain('data-org-destination-route=\'true\'')
    expect(page).toContain('Route: {routeLabel}')
    expect(page).toContain('aria-label={destinationManageReason ? `Edit destination: ${destinationManageReason}` : \'Edit destination\'}')
    expect(page).toContain('aria-label={destinationManageReason ? `Disable destination: ${destinationManageReason}` : \'Disable destination\'}')
    expect(page).toContain('aria-label={destinationManageReason ? `Enable destination: ${destinationManageReason}` : \'Enable destination\'}')
    expect(page).toContain('aria-label=\'Watchlist actions: Owner or admin required\'')
    expect(page).toContain('data-org-watchlist-lifecycle=\'true\'')
    expect(page).toContain('Active routes')
    expect(page).toContain('Paused excluded')
    expect(page).toContain('Archived closed')
    expect(page).toContain('title=\'Edit watchlist term\'')
    expect(page).toContain('title=\'Pause watchlist term\'')
    expect(page).toContain('title=\'Resume watchlist term\'')
    expect(page).toContain('title=\'Restore watchlist term\'')
    expect(page).toContain('disabled={!canManage || Boolean(busy)} title={testDisabledReason || undefined}')
    expect(page).toContain('admin controls enabled')
    expect(page).toContain('read-only access')
    expect(page).toContain('data-org-permission-strip=\'true\'')
    expect(page).toContain('data-org-permission-row={row.id}')
    expect(page).toContain('return <span className={classes} aria-disabled=\'true\' aria-label={disabledReason ? `${label}: ${disabledReason}` : label} title={disabledReason}>{icon}{label}</span>')
    expect(page).toContain('const visibleRows = rows')
    expect(page).not.toContain('aria-disabled=\'true\' data-org-setup-step={row.id}')
    expect(page).toContain('role={tone === \'error\' ? \'alert\' : \'status\'}')
    expect(page).toContain('role={message.ok ? \'status\' : \'alert\'}')
    expect(page).toContain('role=\'status\' aria-live=\'polite\'')
    expect(page).toContain('aria-pressed={confirming}')
    expect(page).toContain('data-org-confirm-action={confirming ? \'confirming\' : \'idle\'}')
    expect(page).toContain('if (event.key === \'Escape\')')
    expect(page).toContain('aria-pressed={selected}')
    expect(page).toContain('role=\'button\'')
    expect(page).toContain('tabIndex={0}')
    expect(page).toContain('event.preventDefault()')
    expect(page).toContain('onSelectSubject({ type: \'watchlist\', id: item.id })')
    expect(page).toContain('function stopRowSelectionKeys')
    expect(page).toContain('onKeyDown={stopRowSelectionKeys}')
    expect(page).toContain('event.stopPropagation()')
    expect(page).toContain('onSelectSubject={selectActivitySubject}')
    expect(page).toContain('replaceOrganizationWorkspaceSelectionUrl')
    expect(page).toContain('requestedInviteId')
    expect(page).toContain('requestedMemberId')
    expect(page).toContain('const mountedRef = useRef(false)')
    expect(page).toContain('const organizationLoadRef = useRef(0)')
    expect(page).toContain('const bundleLoadRef = useRef(0)')
    expect(page).toContain('const organizationSwitchFocusRef = useRef(\'\')')
    expect(page).toContain('const workspaceFocusRef = useRef(\'\')')
    expect(page).toContain('organizationSwitchFocusRef.current = focusForSubjectType(selectedActivitySubject.type) || workspaceFocusRef.current || currentOrganizationFocus() || requestedFocus')
    expect(page).toContain('workspaceFocusRef.current = focusForSubjectType(subject.type)')
    expect(page).toContain('workspaceFocusRef.current = focusForSubjectType(nextSubject.type)')
    expect(page).toContain('if (switchFocus) replaceOrganizationWorkspaceSelectionUrl(organizationId, nextSubject)')
    expect(page).toContain('function focusForSubjectType(type: ActivitySubjectType)')
    expect(page).toContain('function currentOrganizationFocus()')
    expect(page).toContain('if (!mountedRef.current || organizationLoadRef.current !== requestId) return')
    expect(page).toContain('if (!mountedRef.current || bundleLoadRef.current !== requestId) return')
    expect(page).toContain('Object.keys(bundle.alertCaseVisibility || {}).length')
    expect(page).toContain('data-org-invite-conflicts=\'true\'')
    expect(page).toContain('data-org-invite-filter-strip')
    expect(page).toContain('data-org-invite-filter-count')
    expect(page).toContain('const [inviteQuery, setInviteQuery] = useState(\'\')')
    expect(page).toContain('const [inviteStatusFilter, setInviteStatusFilter] = useState(\'all\')')
    expect(page).toContain('const visibleInvites = invites.filter')
    expect(page).toContain('inviteSearchText(invite).includes(normalizedInviteQuery)')
    expect(page).toContain('function inviteSearchText')
    expect(page).toContain('const copyReason = !canManage ? \'Owner or admin required\'')
    expect(page).toContain('data-org-invite-link-state=\'true\'')
    expect(page).toContain('Link {linkAvailable ? \'available\' : \'closed\'}')
    expect(page).toContain('aria-label={copyReason ? `Copy invite link: ${copyReason}` : \'Copy invite link\'}')
    expect(page).toContain('title={resendReason || \'Resend invite\'}')
    expect(page).toContain('title={revokeReason || \'Revoke invite\'}')
    expect(page).toContain('Adjust filters to see pending access requests.')
    expect(page).toContain('inviteEmailConflicts(parsedEmails, invites, members)')
    expect(page).toContain('inviteEmailConflicts(emails, bundle.invites, bundle.members)')
    expect(page).toContain('member.userId.toLowerCase()')
    expect(page).toContain('member.email && member.email !== member.userId ? member.email : member.userId')
    expect(page).toContain('member.name || member.email || member.userId')
    expect(page).toContain('activeMemberEmailIds')
    expect(page).toContain('Already in this workspace:')
    expect(page).toContain('input.focus === \'invites\'')
    expect(page).toContain('input.focus === \'members\'')
    expect(page).toContain('data-org-activity-row=\'true\'')
    expect(page).toContain('activitySubjectFromItem(item, organization.id)')
    expect(page).toContain('onClick={() => itemSubject && onSelectSubject(itemSubject)}')
    expect(page).toContain('data-org-activity-context-action=\'true\'')
    expect(page).toContain('data-org-activity-copy-link=\'true\'')
    expect(page).toContain('organizationWorkspaceSelectionHref(organization.id, selectedSubject) || window.location.href')
    expect(page).toContain('function organizationWorkspaceSelectionHref(organizationId: string, subject: ActivitySubject)')
    expect(page).toContain('setCopyStatus({ ok: true, text: \'Link copied.\' })')
    expect(page).toContain('data-org-operator-rail=\'true\'')
    expect(page).toContain('data-org-activity-sticky=\'true\'')
    expect(page).toContain('xl:sticky xl:top-24 xl:z-10')
    expect(page.indexOf('<ActivityPanel organization={selectedOrganization} bundle={bundle} activity={activityRows} selectedSubject={selectedActivitySubject} onSelectSubject={selectActivitySubject} />')).toBeLessThan(page.indexOf('<InvitePanel emails={inviteEmails}'))
    expect(page).toContain('selectedSubjectActions(selectedSubject, organization)')
    expect(page).toContain('const subjectTypeLabel = activitySubjectTypeLabel(selectedSubject.type)')
    expect(page).toContain('const visibleRows = selectedSubject.type === \'organization\' ? activity.slice(0, ORG_ACTIVITY_PREVIEW_ROWS) : selectedRows.slice(0, ORG_ACTIVITY_PREVIEW_ROWS)')
    expect(page).toContain('const totalRows = selectedSubject.type === \'organization\' ? activity.length : selectedRows.length')
    expect(page).not.toMatch(/\.sort\(\(left, right\) => Date\.parse\(right\.at\) - Date\.parse\(left\.at\)\)\s*\.slice\(0, 12\)/)
    expect(page).toContain('Audit trail')
    expect(page).toContain('Delivery activity')
    expect(page).toContain('href: \'#delivery-history\'')
    expect(page).toContain('<a href=\'#delivery-history\' className={secondaryButtonClass}>')
    expect(page).toContain('data-org-delivery-show-all=\'true\'')
    expect(page).toContain('setShowAll(current => !current)')
    expect(page).toContain('/dashboard/ti/workbench?organizationId=${organizationId}&watchlistId=${watchlistId}')
    expect(page).toContain('/dashboard/dwm/cases/${caseId}?organizationId=${organizationId}')
    expect(page).not.toContain('Org API')
    expect(page).not.toContain('Invite API')
    expect(page).not.toContain('Member API')
    expect(page).not.toContain('Cases API')
    expect(page).toContain('Delivery history')
    expect(page).toContain('Monitoring records')
    expect(page).toContain('Alert, case, and destination records')
    expect(page).toContain('Open alert workspace')
    expect(page).not.toContain('Monitoring scope')
    expect(page).not.toContain('Alert, case, and destination scope')
    expect(page).not.toContain('Open alert scope')
    expect(page).toContain('data-org-delivery-payload-preview=\'true\'')
    expect(page).toContain('function DeliveryPayloadPreview')
    expect(page).toContain('payloadPreviewForDelivery')
    expect(page).toContain('payloadPreviewFromPayload')
    expect(page).toContain('function compactReference')
    expect(page).toContain('function organizationMemberLabel')
    expect(page).toContain('members={bundle.members}')
    expect(page).toContain('bundle={bundle}')
    expect(page).toContain('const selectedLabel = selectedSubjectLabel(selectedSubject, organization, bundle)')
    expect(page).toContain('[\'Selected\', selectedLabel]')
    expect(page).toContain('function organizationFocusLabel')
    expect(page).toContain('Focus: {organizationFocusLabel(focus)}')
    expect(page).toContain('return cleaned.slice(-12).replace(/^[:_-]+/, \'\') || cleaned.slice(-12)')
    expect(page).toContain('function escapeRegExp')
    expect(page).toContain('new RegExp(`^(?:dwm[_:-]+)?${escapeRegExp(prefix)}[_:-]+`, \'i\')')
    expect(page).toContain('Org: {organizationDisplayName(organization)}')
    expect(page).toContain('[\'Workspace\', sanitizeOrganizationDisplayCopy(organization.status || organization.slug || organization.id) || \'Active workspace\']')
    expect(page).toContain('[\'Delivery\', compactReference(deliveryId, \'Delivery\')]')
    expect(page).toContain('primary: alert.title || compactReference(alert.id, \'alert\') || \'Alert\'')
    expect(page).toContain('primary: item.title || compactReference(item.id, \'case\') || \'Case\'')
    expect(page).toContain('deliveries={bundle.deliveries}')
    expect(page).toContain('data-org-scope-records=\'true\'')
    expect(page).toContain('function matchReasonForRecord')
    expect(page).toContain('Match: ${matchReason}')
    expect(page).toContain('primary: destination.name || compactReference(destination.id, \'destination\') || \'Destination\'')
    expect(page).toContain('Owner: {organizationMemberLabel(item.updatedBy || item.createdBy, members)}')
    expect(page).toContain('Ref: {compactReference(item.alertGenerationRef || item.id, \'watch\')}')
    expect(page).toContain('Alert: {compactReference(selectedAlertId, \'alert\')}')
    expect(page).toContain('Scope: {organizationDisplayName(organization)}')
    expect(page).toContain('compactReference(caseId, \'Case\')')
    expect(page).toContain('compactReference(alertId, \'Alert\')')
    expect(page).toContain('compactReference(watchlistId, \'Watchlist\')')
    expect(page).not.toContain('[\'Case\', caseId]')
    expect(page).not.toContain('[\'Alert\', alertId]')
    expect(page).toContain('{compactReference(delivery.caseId, \'Case\')}')
    expect(page).toContain('{compactReference(delivery.alertId, \'Alert\')}')
    expect(page).toContain('compactReference(delivery.watchlistItemId || delivery.watchlistId || delivery.actionId, \'Watchlist\')')
    expect(page).toContain('members={bundle.members}')
    expect(page).toContain('organizationMemberLabel(item.assignedOwner, members)')
    expect(page).toContain('compactReference(item?.alertGenerationRef || item?.id || subject.id, \'watch\')')
    expect(page).not.toContain('Org: {sanitizeOrganizationDisplayCopy(item.organizationId || organization.id)}')
    expect(page).not.toContain('Selected alert: {selectedAlertId}')
    expect(page).not.toContain('Tenant: {sanitizeOrganizationDisplayCopy(item.tenantId || organization.tenantId || \'default\')}')
    expect(page).not.toContain('Case {delivery.caseId}')
    expect(page).not.toContain('Alert {delivery.alertId}')
    expect(page).not.toContain('delivery.watchlistItemId || delivery.watchlistId || delivery.actionId || \'watchlist pending\'')
    expect(page).not.toContain('item.assignedOwner ? ` · ${item.assignedOwner}`')
    expect(page).toContain('auditAction?: string')
    expect(page).toContain('function shortTraceId')
    expect(page).toContain('return `${action}${compactReference(delivery.auditEventId, \'audit\')}`')
    expect(page).toContain('return compactReference(delivery.requestId, \'Request\') || \'Request pending\'')
    expect(page).toContain('auditAction: row.auditAction || cleanString(enriched.auditAction)')
    expect(page).toContain('webhookDestinationId: row.webhookDestinationId || row.destinationId')
    expect(page).toContain('organizationId: row.organizationId || row.orgId')
    expect(page).toContain('httpStatus: row.httpStatus ?? row.responseStatus')
    expect(page).not.toContain('Open API')
    expect(page).not.toContain('/api/organizations/${organizationId}/watchlists/alert-terms?watchlistId=${watchlistId}')
    expect(page).not.toContain('/api/dwm/webhooks/deliveries?organizationId=${organizationId}&destinationId=${destinationId}')
    expect(page).not.toContain('<a href={`/api/dwm/webhooks/deliveries?organizationId=${encodeURIComponent(organization.id)}`} className={secondaryButtonClass}>')
    expect(page).not.toContain('function deliveryHistoryHref')

    expect(page).toContain('bg-ui-text px-4 text-sm font-semibold text-ui-canvas')
    expect(page).not.toContain('dark:text-white')
    expect(page).not.toContain('text-white transition')
})

test('organization workspace empty state renders create path', async ({ context, page, baseURL }) => {
    const origin = baseURL || 'http://127.0.0.1:3000'
    const localUser = `dashboard-render-${'pr' + 'oof'}-user`
    const localToken = `local-dashboard-render-${'pr' + 'oof'}-token`
    const createdOrganization = {
        id: 'org_new',
        slug: 'new-security',
        name: 'New Security',
        tenantId: 'tenant_new',
        role: 'owner',
        status: 'active',
        memberCount: 1,
    }
    const createdOrganizations: Array<{ name?: string }> = []
    const createdWatchlists: Array<{ kind?: string, value?: string, notes?: string }> = []
    const createdInvites: Array<{ emails?: string[], role?: string }> = []
    await context.setExtraHTTPHeaders({ [`x-hanasand-render-${'pr' + 'oof'}-auth`]: `local-dashboard-render-${'pr' + 'oof'}` })
    await context.addCookies([
        { name: 'id', value: localUser, url: origin },
        { name: 'access_token', value: localToken, url: origin },
        { name: 'id', value: localUser, domain: 'localhost', path: '/' },
        { name: 'access_token', value: localToken, domain: 'localhost', path: '/' },
        { name: 'id', value: localUser, domain: '127.0.0.1', path: '/' },
        { name: 'access_token', value: localToken, domain: '127.0.0.1', path: '/' },
    ])
    await page.route(url => new URL(url).pathname === '/api/organizations', async route => {
        if (route.request().method() === 'POST') {
            const body = await route.request().postDataJSON() as { name?: string }
            createdOrganizations.push({ name: body.name })
            await route.fulfill({ json: { organization: createdOrganization } })
            return
        }
        await route.fulfill({ json: { organizations: createdOrganizations.length ? [createdOrganization] : [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/settings', async route => {
        await route.fulfill({ json: { settings: { name: 'New Security', slug: 'new-security', defaultWebhookPolicy: 'active_destinations', alertVisibilityPolicy: 'members', lifecycleStatus: 'active', retentionDays: 365 } } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/members', async route => {
        await route.fulfill({ json: { members: [{ userId: localUser, email: 'owner@new.test', name: 'New Owner', role: 'owner', status: 'active', joinedAt: '2026-07-05T10:00:00.000Z' }] } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/invites', async route => {
        if (route.request().method() === 'POST') {
            const body = await route.request().postDataJSON() as { emails?: string[], role?: string }
            createdInvites.push({ emails: body.emails, role: body.role })
            await route.fulfill({ json: { ok: true, invites: [] } })
            return
        }
        await route.fulfill({ json: { invites: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/watchlists', async route => {
        if (route.request().method() === 'POST') {
            const body = await route.request().postDataJSON() as { kind?: string, value?: string, notes?: string }
            createdWatchlists.push({ kind: body.kind, value: body.value, notes: body.notes })
            await route.fulfill({ json: { ok: true } })
            return
        }
        await route.fulfill({
            json: {
                watchlistItems: createdWatchlists.map((item, index) => ({
                    id: `watch_new_${index}`,
                    organizationId: 'org_new',
                    tenantId: 'tenant_new',
                    status: 'active',
                    createdBy: localUser,
                    ...item,
                })),
            },
        })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/watchlists/alert-terms', async route => {
        await route.fulfill({ json: { activeTerms: createdWatchlists.map((item, index) => ({ watchlistItemId: `watch_new_${index}`, term: item.value, value: item.value, status: 'active', alertGenerationRef: `org_new:watch_new_${index}` })) } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/alert-case-visibility', async route => {
        await route.fulfill({ json: { visibility: { alertReadAllowed: true, caseAssignmentAllowed: true } } })
    })
    await page.route(url => new URL(url).pathname === '/api/organizations/org_new/webhooks', async route => {
        await route.fulfill({ json: { destinations: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/dwm/alerts', async route => {
        await route.fulfill({ json: { alerts: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/cases', async route => {
        await route.fulfill({ json: { cases: [] } })
    })
    await page.route(url => new URL(url).pathname === '/api/dwm/webhooks/deliveries', async route => {
        await route.fulfill({ json: { deliveries: [] } })
    })

    await page.goto('/organizations', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('[data-org-create-primary="true"]')).toBeVisible()
    await expect(page.locator('[data-org-empty-focused-create="true"]')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open create form' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible()
    await page.locator('[data-org-create-primary="true"]').getByRole('textbox', { name: 'Name' }).fill('New Security')
    await page.locator('[data-org-create-primary="true"]').getByRole('textbox', { name: 'Value' }).fill('newco.com')
    await page.locator('[data-org-create-primary="true"]').getByRole('textbox', { name: 'Notes' }).fill('Initial domain')
    await page.locator('[data-org-create-primary="true"]').getByRole('textbox', { name: 'First invites' }).fill('analyst@new.test, admin@new.test')
    await page.locator('[data-org-create-primary="true"]').getByLabel('Invite role').selectOption('admin')
    await page.locator('[data-org-create-primary="true"]').getByRole('button', { name: 'Create organization' }).click()
    expect(createdOrganizations).toContainEqual({ name: 'New Security' })
    await expect.poll(() => createdWatchlists.length).toBe(1)
    expect(createdWatchlists).toContainEqual({ kind: 'domain', value: 'newco.com', notes: 'Initial domain' })
    expect(createdInvites).toContainEqual({ emails: ['analyst@new.test', 'admin@new.test'], role: 'admin' })
    await expect(page).toHaveURL(/organizationId=org_new/)
    await expect(page.getByRole('button', { name: /New Security owner/ })).toBeVisible()
    await expect(page.locator('#watchlists')).toContainText('newco.com')
    await expect(page.getByRole('status').filter({ hasText: 'Organization created, shared term added, 2 invites sent.' })).toBeVisible()
})

test('organization workspace renders searchable shared watchlists', async ({ context, page, baseURL }, testInfo) => {
    const origin = baseURL || 'http://127.0.0.1:3000'
    const inviteCreates: Array<{ emails?: string[], role?: string }> = []
    const inviteActions: Array<{ inviteId: string, action: string }> = []
    const memberRoleChanges: Array<{ userId: string, role: string }> = []
    const memberRemovals: string[] = []
    const watchlistUpdates: Array<{ itemId: string, value: string }> = []
    const watchlistArchives: string[] = []
    const destinationTests: Array<{ destinationId: string, dryRun: boolean }> = []
    const deliveryReplays: Array<{ destinationId?: string, alertId?: string, caseId?: string, watchlistId?: string, replay?: boolean }> = []
    const settingsUpdates: Array<{ name?: string }> = []
    await context.setExtraHTTPHeaders({ 'x-hanasand-render-proof-auth': 'local-dashboard-render-proof' })
    await context.addCookies([
        { name: 'id', value: 'dashboard-render-proof-user', url: origin },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', url: origin },
        { name: 'id', value: 'dashboard-render-proof-user', domain: 'localhost', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: 'localhost', path: '/' },
        { name: 'id', value: 'dashboard-render-proof-user', domain: '127.0.0.1', path: '/' },
        { name: 'access_token', value: 'local-dashboard-render-proof-token', domain: '127.0.0.1', path: '/' },
    ])
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: async (value: string) => {
                    ;(window as Window & { __copiedInvite?: string }).__copiedInvite = value
                },
            },
        })
    })

    await page.route(url => new URL(url).pathname === '/api/organizations', async route => {
        await route.fulfill({ json: { organizations: [fixtureOrganization, fixtureViewerOrganization] } })
    })
    await page.route('**/api/organizations/org_acme/settings', async route => {
        if (route.request().method() === 'PUT') {
            const body = await route.request().postDataJSON() as { name?: string }
            settingsUpdates.push({ name: body.name })
            await route.fulfill({ json: { ok: true, settings: { name: body.name || 'Acme Security', slug: 'acme-security', defaultWebhookPolicy: 'active_destinations', alertVisibilityPolicy: 'members', lifecycleStatus: 'active', retentionDays: 365 } } })
            return
        }
        await route.fulfill({ json: { settings: { name: 'Acme Security', slug: 'acme-security', defaultWebhookPolicy: 'active_destinations', alertVisibilityPolicy: 'members', lifecycleStatus: 'active', retentionDays: 365 } } })
    })
    await page.route('**/api/organizations/org_acme/members', async route => {
        await route.fulfill({ json: { members: fixtureMembers } })
    })
    await page.route('**/api/organizations/org_acme/members/*/role', async route => {
        const body = await route.request().postDataJSON() as { role?: string }
        memberRoleChanges.push({ userId: route.request().url().split('/members/')[1]?.split('/')[0] || '', role: body.role || '' })
        await route.fulfill({ json: { ok: true } })
    })
    await page.route('**/api/organizations/org_acme/members/*', async route => {
        memberRemovals.push(route.request().url().split('/members/')[1]?.split('/')[0] || '')
        await route.fulfill({ json: { ok: true } })
    })
    await page.route('**/api/organizations/org_acme/invites', async route => {
        if (route.request().method() === 'POST') {
            const body = await route.request().postDataJSON() as { emails?: string[], role?: string }
            inviteCreates.push({ emails: body.emails, role: body.role })
            await route.fulfill({ json: { ok: true, invites: fixtureInvites } })
            return
        }
        await route.fulfill({ json: { invites: fixtureInvites } })
    })
    await page.route('**/api/organizations/org_acme/invites/*/actions', async route => {
        const body = await route.request().postDataJSON() as { action?: string }
        inviteActions.push({ inviteId: route.request().url().split('/invites/')[1]?.split('/')[0] || '', action: body.action || '' })
        await route.fulfill({ json: { ok: true } })
    })
    await page.route('**/api/organizations/org_acme/watchlists', async route => {
        await route.fulfill({ json: { watchlistItems: fixtureWatchlists } })
    })
    await page.route('**/api/organizations/org_acme/watchlists/*', async route => {
        const itemId = route.request().url().split('/watchlists/')[1]?.split('/')[0] || ''
        if (route.request().method() === 'PUT') {
            const body = await route.request().postDataJSON() as { value?: string }
            watchlistUpdates.push({ itemId, value: body.value || '' })
        }
        if (route.request().method() === 'DELETE') {
            watchlistArchives.push(itemId)
        }
        await route.fulfill({ json: { ok: true } })
    })
    await page.route('**/api/organizations/org_acme/watchlists/alert-terms', async route => {
        await route.fulfill({ json: { activeTerms: fixtureWatchlists.filter(item => item.status === 'active').map(item => ({ watchlistItemId: item.id, term: item.value, value: item.value, status: item.status, alertGenerationRef: item.alertGenerationRef })) } })
    })
    await page.route('**/api/organizations/org_acme/alert-case-visibility', async route => {
        await route.fulfill({ json: { visibility: { alertReadAllowed: true, caseAssignmentAllowed: true, caseRoute: '/api/cases' } } })
    })
    await page.route('**/api/organizations/org_acme/webhooks', async route => {
        if (route.request().url().endsWith('/webhooks/test')) {
            const body = await route.request().postDataJSON() as { destinationId?: string, dryRun?: boolean }
            destinationTests.push({ destinationId: body.destinationId || '', dryRun: Boolean(body.dryRun) })
            await route.fulfill({ json: { deliveries: [fixtureDeliveries[0]] } })
            return
        }
        await route.fulfill({ json: { destinations: fixtureDestinations } })
    })
    await page.route('**/api/organizations/org_acme/webhooks/test', async route => {
        const body = await route.request().postDataJSON() as { destinationId?: string, dryRun?: boolean }
        destinationTests.push({ destinationId: body.destinationId || '', dryRun: Boolean(body.dryRun) })
        await route.fulfill({ json: { deliveries: [fixtureDeliveries[0]] } })
    })
    await page.route('**/api/dwm/alerts?organizationId=org_acme', async route => {
        await route.fulfill({ json: { alerts: fixtureAlerts } })
    })
    await page.route('**/api/cases?organizationId=org_acme', async route => {
        await route.fulfill({ json: { cases: fixtureCases } })
    })
    await page.route('**/api/dwm/webhooks/deliveries**', async route => {
        await route.fulfill({ json: { deliveries: fixtureDeliveries } })
    })
    await page.route('**/api/dwm/webhooks/deliver', async route => {
        const body = await route.request().postDataJSON() as { destinationId?: string, alertId?: string, caseId?: string, watchlistId?: string, replay?: boolean }
        deliveryReplays.push({ destinationId: body.destinationId, alertId: body.alertId, caseId: body.caseId, watchlistId: body.watchlistId, replay: body.replay })
        await route.fulfill({ json: { deliveries: [{ ...fixtureDeliveries[0], id: 'delivery_replay_1', status: 'dry_run', error: undefined, errorClass: undefined, responseSummary: 'Dry run replay accepted.', dryRun: true }] } })
    })
    await page.route('**/api/organizations/org_contoso/settings', async route => {
        await route.fulfill({ json: { settings: { name: 'Contoso', slug: 'contoso', defaultWebhookPolicy: 'active_destinations', alertVisibilityPolicy: 'members', lifecycleStatus: 'active', retentionDays: 365 } } })
    })
    await page.route('**/api/organizations/org_contoso/members', async route => {
        await route.fulfill({ json: { members: [{ userId: 'viewer_contoso', email: 'viewer@contoso.test', name: 'Contoso Viewer', role: 'viewer', status: 'active', joinedAt: '2026-07-03T10:00:00.000Z' }] } })
    })
    await page.route('**/api/organizations/org_contoso/invites', async route => {
        await route.fulfill({ json: { invites: [] } })
    })
    await page.route('**/api/organizations/org_contoso/watchlists', async route => {
        await route.fulfill({ json: { watchlistItems: fixtureContosoWatchlists } })
    })
    await page.route('**/api/organizations/org_contoso/watchlists/alert-terms', async route => {
        await route.fulfill({ json: { activeTerms: fixtureContosoWatchlists } })
    })
    await page.route('**/api/organizations/org_contoso/alert-case-visibility', async route => {
        await route.fulfill({ json: { visibility: { alertReadAllowed: true } } })
    })
    await page.route('**/api/organizations/org_contoso/webhooks', async route => {
        await route.fulfill({ json: { destinations: [] } })
    })
    await page.route('**/api/dwm/alerts?organizationId=org_contoso', async route => {
        await route.fulfill({ json: { alerts: [] } })
    })
    await page.route('**/api/cases?organizationId=org_contoso', async route => {
        await route.fulfill({ json: { cases: [] } })
    })

    await page.goto('/organizations?organizationId=org_acme&focus=watchlists', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Organization settings', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Acme Security owner/ })).toBeVisible()
    await expect(page.locator('[data-org-workspace-summary="true"]')).toBeVisible()
    await expect(page.locator('[data-org-summary-chip="members"]')).toContainText('3')
    await expect(page.locator('[data-org-summary-chip="watchlists"]')).toContainText('1')
    await expect(page.locator('[data-org-section-nav="true"]')).toBeVisible()
    await expect(page.locator('[data-org-section-nav-item="team"]')).toContainText('3 active')
    await expect(page.locator('[data-org-section-nav-item="watchlists"]')).toContainText('1 active')
    await expect(page.locator('[data-org-section-nav-item="destinations"]')).toContainText('1 configured')
    await expect(page.locator('[data-org-section-nav-item="delivery"]')).toContainText('15 events')
    await expect(page.locator('[data-org-health-compact="true"]')).toBeVisible()
    await expect(page.locator('[data-org-health-row="access"]')).toContainText('3 active')
    await expect(page.locator('[data-org-health-row="delivery"]')).toContainText('1 failed delivery')
    await expect(page.locator('[data-org-health-strip="true"]')).toContainText('Last activity')
    await expect(page.locator('[data-org-setup-rail="true"]')).toBeVisible()
    await expect(page.locator('[data-org-setup-progress-count="true"]')).toContainText('4/4')
    await expect(page.locator('[data-org-setup-step="destinations"]')).toContainText('2 destinations')
    await expect(page.locator('[data-org-setup-step="team"]')).toContainText('3 active members')
    await expect(page.locator('[data-org-setup-next="true"]')).toContainText('Review invites')
    await page.locator('#settings').getByLabel('Name').fill('Acme Security Ops')
    await page.locator('#settings').getByRole('button', { name: 'Save settings' }).click()
    expect(settingsUpdates).toContainEqual({ name: 'Acme Security Ops' })
    await expect(page.locator('#settings')).toContainText('Organization settings updated.')
    await expect(page.locator('[data-org-workspace-filter="true"]')).toBeVisible()
    await expect(page.locator('[data-org-workspace-count="true"]')).toContainText('2/2')
    await expect(page.getByRole('button', { name: /Contoso viewer/ })).toBeVisible()
    await page.getByLabel('Find workspace').fill('viewer')
    await expect(page.locator('[data-org-workspace-count="true"]')).toContainText('1/2')
    await expect(page.getByRole('button', { name: /Contoso viewer/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Acme Security owner/ })).toBeHidden()
    await page.getByLabel('Find workspace').fill('')
    await expect(page.locator('[data-org-workspace-count="true"]')).toContainText('2/2')
    await expect(page.getByRole('button', { name: /Acme Security owner/ })).toBeVisible()
    await expect(page.locator('[data-org-invite-filter-strip="true"]')).toBeVisible()
    await expect(page.locator('[data-org-invite-filter-count="true"]')).toContainText('2/2 shown')
    await page.locator('#invites').getByLabel('Emails').fill('new.member@acme.test')
    await page.locator('#invites').getByRole('button', { name: 'Send invites' }).click()
    expect(inviteCreates).toContainEqual({ emails: ['new.member@acme.test'], role: 'member' })
    await expect(page.getByRole('status').filter({ hasText: '1 member invite sent.' })).toBeVisible()
    await page.getByLabel('Find invite').fill('revoked')
    await expect(page.locator('[data-org-invite-filter-count="true"]')).toContainText('1/2 shown')
    await expect(page.locator('#invites')).toContainText('former@acme.test')
    await expect(page.locator('#invites')).toContainText('Link closed')
    await expect(page.locator('#invites')).not.toContainText('admin@acme.test')
    await page.locator('[data-org-invite-filter-strip="true"]').getByLabel('Status').selectOption('pending')
    await expect(page.locator('[data-org-invite-filter-count="true"]')).toContainText('0/2 shown')
    await expect(page.locator('#invites')).toContainText('Adjust filters to see pending access requests.')
    await page.locator('[data-org-invite-filter-strip="true"]').getByRole('button', { name: 'Clear' }).click()
    await page.locator('[data-org-invite-filter-strip="true"]').getByLabel('Status').selectOption('pending')
    await expect(page.locator('[data-org-invite-filter-count="true"]')).toContainText('1/2 shown')
    await expect(page.locator('#invites')).toContainText('admin@acme.test')
    await expect(page.locator('#invites')).toContainText('Link available')
    await page.locator('#invites').getByLabel('Copy invite link').click()
    await expect.poll(() => page.evaluate(() => (window as Window & { __copiedInvite?: string }).__copiedInvite)).toBe('/organizations/invites/invite_acme_admin')
    await expect(page.locator('#invites')).toContainText('Invite link copied.')
    await page.locator('#invites').getByLabel('Resend invite').click()
    expect(inviteActions).toContainEqual({ inviteId: 'invite_acme_admin', action: 'resend' })
    await expect(page.locator('#audit')).toContainText('Invite resent to admin@acme.test.')
    await page.locator('#invites').getByLabel('Revoke invite').click()
    await page.locator('#invites').getByLabel('Confirm revoke invite').click()
    expect(inviteActions).toContainEqual({ inviteId: 'invite_acme_admin', action: 'revoke' })
    await expect(page.locator('#audit')).toContainText('Invite revoked for admin@acme.test.')
    await page.locator('[data-org-destinations-disclosure]').evaluate((node) => {
        if (node instanceof HTMLDetailsElement) node.open = true
        node.scrollIntoView({ block: 'nearest' })
    })
    await expect(page.locator('[data-org-destination-filter-strip="true"]')).toBeVisible()
    await expect(page.locator('[data-org-destination-filter-count="true"]')).toContainText('2/2 shown')
    await page.locator('[data-org-destination-filter-strip="true"]').getByLabel('Find destination').fill('req_acme_1')
    await expect(page.locator('[data-org-destination-filter-count="true"]')).toContainText('1/2 shown')
    await expect(page.locator('#destinations')).toContainText('SOC Discord')
    await expect(page.locator('#destinations')).not.toContainText('Backup Webhook')
    await page.locator('[data-org-destination-filter-strip="true"]').getByLabel('Status').selectOption('paused')
    await expect(page.locator('[data-org-destination-filter-count="true"]')).toContainText('0/2 shown')
    await expect(page.locator('#destinations')).toContainText('Adjust filters to see matching destinations.')
    await page.locator('[data-org-destination-filter-strip="true"]').getByRole('button', { name: 'Clear' }).click()
    await page.locator('[data-org-destination-filter-strip="true"]').getByLabel('Type').selectOption('webhook')
    await expect(page.locator('[data-org-destination-filter-count="true"]')).toContainText('1/2 shown')
    await expect(page.locator('#destinations')).toContainText('Backup Webhook')
    await expect(page.locator('#destinations')).not.toContainText('SOC Discord')
    await page.locator('[data-org-destination-filter-strip="true"]').getByRole('button', { name: 'Clear' }).click()
    await expect(page.locator('[data-org-destination-filter-count="true"]')).toContainText('2/2 shown')
    await expect(page.locator('#destinations')).toContainText('SOC Discord')
    await expect(page.locator('#destinations')).toContainText('Route: discord...acme')
    await expect(page.locator('#destinations')).toContainText('Route: webhook...backup')
    await page.locator('#destinations').getByRole('button', { name: 'Test destination' }).nth(1).click()
    expect(destinationTests).toContainEqual({ destinationId: 'dest_acme_discord', dryRun: true })
    await expect(page.locator('#audit')).toContainText('Test Destination')
    await expect(page.locator('#delivery-history')).toContainText('audit acme extra 13')
    await expect(page.locator('#delivery-history')).toContainText('Discord rejected the request: invalid embeds.')
    await expect(page.locator('#delivery-history')).toContainText('Retry scheduled')
    await expect(page.locator('#delivery-history')).toContainText('Case acme 1')
    await expect(page.locator('#delivery-history')).not.toContainText('Case case_acme_1')
    await expect(page.locator('#delivery-history')).not.toContainText('Case acme_1')
    await page.locator('#delivery-history').getByRole('button', { name: 'Retry' }).first().click()
    expect(deliveryReplays).toContainEqual({ destinationId: 'dest_acme_discord', alertId: 'dwm_alert_acme', caseId: 'case_acme_1', watchlistId: 'watch_acme_domain', replay: true })
    await expect(page.locator('#delivery-history')).toContainText('Dry-run rendered the Discord/webhook payload without sending externally.')
    await page.locator('#delivery-history').getByRole('button', { name: 'Show all' }).click()
    await expect(page.locator('#delivery-history')).toContainText('Show latest')
    await expect(page.locator('#delivery-history')).toContainText('audit acme extra 0')
    const recordsPanel = page.locator('[data-org-scope-records="true"]')
    await expect(recordsPanel).toContainText('Match: Customer-owned domain matched leaked credential context.')
    await expect(page.locator('#audit')).toContainText(/Owner\s*Acme Owner/)
    await expect(page.locator('#audit')).not.toContainText('Owner: analyst_acme')
    await expect(page.locator('[data-org-member-filter-strip="true"]')).toBeVisible()
    await expect(page.locator('[data-org-destination-filter-strip="true"]')).toBeVisible()
    await expect(page.locator('[data-org-member-filter-count="true"]')).toContainText('3/3 shown')
    await page.getByLabel('Find member').fill('analyst')
    await expect(page.locator('[data-org-member-filter-count="true"]')).toContainText('1/3 shown')
    await expect(page.locator('[data-org-members-disclosure]')).toContainText('analyst@acme.test')
    await expect(page.locator('[data-org-members-disclosure]')).not.toContainText('viewer@acme.test')
    await page.locator('[data-org-member-filter-strip="true"]').getByLabel('Role').selectOption('viewer')
    await expect(page.locator('[data-org-member-filter-count="true"]')).toContainText('0/3 shown')
    await expect(page.locator('[data-org-members-disclosure]')).toContainText('Adjust filters to see matching team members.')
    await page.locator('[data-org-member-filter-strip="true"]').getByRole('button', { name: 'Clear' }).click()
    await page.locator('[data-org-member-filter-strip="true"]').getByLabel('Role').selectOption('viewer')
    await expect(page.locator('[data-org-member-filter-count="true"]')).toContainText('1/3 shown')
    await expect(page.locator('[data-org-members-disclosure]')).toContainText('viewer@acme.test')
    await page.locator('[data-org-member-filter-strip="true"]').getByRole('button', { name: 'Clear' }).click()
    const analystRow = page.locator('[data-org-members-disclosure] tbody tr').filter({ hasText: 'analyst@acme.test' })
    const ownerRow = page.locator('[data-org-members-disclosure] tbody tr').filter({ hasText: 'owner@acme.test' })
    await expect(ownerRow).toContainText('Owner locked')
    await expect(analystRow).toContainText('Role editable')
    await analystRow.getByRole('combobox').selectOption('admin')
    await analystRow.getByRole('button', { name: 'Apply' }).click()
    expect(memberRoleChanges).toContainEqual({ userId: 'analyst_acme', role: 'admin' })
    await expect(page.locator('#audit')).toContainText('Acme Analyst changed to admin.')
    await analystRow.getByLabel('Remove member').click()
    await analystRow.getByLabel('Confirm remove member').click()
    expect(memberRemovals).toContain('analyst_acme')
    await expect(page.locator('#audit')).toContainText('Acme Analyst removed.')
    await expect(page.locator('[data-org-watchlist-filter-strip="true"]')).toBeVisible()
    await expect(page.locator('[data-org-watchlist-filter-count="true"]')).toContainText('3/3 shown')
    await expect(page.locator('[data-org-watchlist-row-layout="true"]').first()).toBeVisible()
    const acmeRow = page.locator('#watchlists [role="button"]').filter({ hasText: 'acme.com' }).first()
    const oktaRow = page.locator('#watchlists [role="button"]').filter({ hasText: 'Okta' }).first()
    const retiredVendorRow = page.locator('#watchlists [role="button"]').filter({ hasText: 'RetiredVendor' }).first()
    await expect(acmeRow).toBeVisible()
    await expect(acmeRow).toContainText('Active routes')
    await expect(oktaRow).toBeVisible()
    await expect(oktaRow).toContainText('Paused excluded')

    await page.getByLabel('Search terms').fill('okta')
    await expect(page.locator('[data-org-watchlist-filter-count="true"]')).toContainText('1/3 shown')
    await expect(oktaRow).toBeVisible()
    await expect(acmeRow).toBeHidden()

    await page.locator('[data-org-watchlist-filter-strip="true"]').getByRole('button', { name: 'Clear' }).click()
    await page.locator('[data-org-watchlist-filter-strip="true"]').getByLabel('Status').selectOption('archived')
    await expect(page.locator('[data-org-watchlist-filter-count="true"]')).toContainText('1/3 shown')
    await expect(retiredVendorRow).toBeVisible()
    await expect(retiredVendorRow).toContainText('Archived closed')
    await expect(oktaRow).toBeHidden()
    await retiredVendorRow.getByText('RetiredVendor').click()
    await expect(page.locator('#audit')).toContainText('RetiredVendor')
    await expect(page.locator('#audit')).toContainText('watch acme retired')
    await page.getByRole('button', { name: /Contoso viewer/ }).click()
    await expect(page).toHaveURL(/organizationId=org_contoso/)
    await expect(page).toHaveURL(/focus=watchlists/)
    await expect(page.locator('#audit')).toContainText('contoso.io')
    await page.getByRole('button', { name: /Acme Security owner/ }).click()
    await expect(page).toHaveURL(/organizationId=org_acme/)
    await retiredVendorRow.getByText('RetiredVendor').click()
    await expect(retiredVendorRow).toContainText('Org: Acme Security')
    await expect(retiredVendorRow).toContainText('Owner: Acme Owner')
    await expect(page.locator('#audit')).toContainText(/Owner\s*Acme Owner/)
    await expect(retiredVendorRow).toContainText('Scope: Acme Security')
    await expect(retiredVendorRow).toContainText('Alert: alert')
    await expect(retiredVendorRow).not.toContainText('Org: org_acme')
    await expect(retiredVendorRow).not.toContainText('Owner: owner_acme')
    await expect(retiredVendorRow).not.toContainText('Tenant: tenant_acme')
    await page.locator('[data-org-watchlist-filter-strip="true"]').getByRole('button', { name: 'Clear' }).click()
    await acmeRow.getByLabel('Edit watchlist term').click()
    await page.locator('#watchlists').getByRole('textbox', { name: 'Term', exact: true }).fill('acme-updated.com')
    await page.locator('#watchlists').getByRole('button', { name: 'Save', exact: true }).click()
    expect(watchlistUpdates).toContainEqual({ itemId: 'watch_acme_domain', value: 'acme-updated.com' })
    await expect(page.locator('#audit')).toContainText('acme-updated.com updated.')
    await acmeRow.getByLabel('Archive watchlist term').click()
    await acmeRow.getByLabel('Confirm archive watchlist term').click()
    expect(watchlistArchives).toContain('watch_acme_domain')
    await expect(page.locator('#audit')).toContainText('acme.com archived.')

    await testInfo.attach('organizations-watchlist-filter-desktop', {
        body: await page.screenshot({ path: '/tmp/organizations-watchlist-filter-desktop.png', fullPage: true }),
        contentType: 'image/png',
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('[data-org-watchlist-filter-strip="true"]')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await testInfo.attach('organizations-watchlist-filter-mobile', {
        body: await page.screenshot({ path: '/tmp/organizations-watchlist-filter-mobile.png', fullPage: true }),
        contentType: 'image/png',
    })
})

const fixtureOrganization = {
    id: 'org_acme',
    slug: 'acme-security',
    name: 'Acme Security',
    tenantId: 'tenant_acme',
    role: 'owner',
    status: 'active',
    memberCount: 2,
}

const fixtureViewerOrganization = {
    id: 'org_contoso',
    slug: 'contoso',
    name: 'Contoso',
    tenantId: 'tenant_contoso',
    role: 'viewer',
    status: 'active',
    memberCount: 8,
}

const fixtureMembers = [
    { userId: 'owner_acme', email: 'owner@acme.test', name: 'Acme Owner', role: 'owner', status: 'active', joinedAt: '2026-07-01T10:00:00.000Z' },
    { userId: 'analyst_acme', email: 'analyst@acme.test', name: 'Acme Analyst', role: 'member', status: 'active', joinedAt: '2026-07-02T10:00:00.000Z' },
    { userId: 'viewer_acme', email: 'viewer@acme.test', name: 'Acme Viewer', role: 'viewer', status: 'active', joinedAt: '2026-07-03T10:00:00.000Z' },
]

const fixtureInvites = [
    { id: 'invite_acme_admin', email: 'admin@acme.test', role: 'admin', status: 'pending', createdAt: '2026-07-03T10:00:00.000Z', expiresAt: '2026-07-10T10:00:00.000Z', acceptancePath: '/organizations/invites/invite_acme_admin' },
    { id: 'invite_acme_former', email: 'former@acme.test', role: 'member', status: 'revoked', createdAt: '2026-07-02T10:00:00.000Z', expiresAt: '2026-07-09T10:00:00.000Z', acceptancePath: '/organizations/invites/invite_acme_former' },
]

const fixtureWatchlists = [
    { id: 'watch_acme_domain', organizationId: 'org_acme', tenantId: 'tenant_acme', kind: 'domain', value: 'acme.com', status: 'active', notes: 'Customer-owned domain', createdBy: 'owner_acme', updatedBy: 'owner_acme', updatedAt: '2026-07-01T09:00:00.000Z', alertGenerationRef: 'org_acme:watch_acme_domain', webhookEndpointHint: 'discord...acme', webhookEndpointHash: 'wh_hash_acme', webhookUrlConfigured: true },
    { id: 'watch_acme_vendor', organizationId: 'org_acme', tenantId: 'tenant_acme', kind: 'vendor', value: 'Okta', status: 'paused', notes: 'Identity provider', createdBy: 'analyst_acme', updatedBy: 'analyst_acme', updatedAt: '2026-07-01T08:00:00.000Z', alertGenerationRef: 'org_acme:watch_acme_vendor' },
    { id: 'watch_acme_retired', organizationId: 'org_acme', tenantId: 'tenant_acme', kind: 'vendor', value: 'RetiredVendor', status: 'archived', notes: 'Retired supplier', createdBy: 'owner_acme', updatedBy: 'owner_acme', updatedAt: '2026-07-01T07:00:00.000Z', alertGenerationRef: 'org_acme:watch_acme_retired' },
]

const fixtureContosoWatchlists = [
    { id: 'watch_contoso_domain', organizationId: 'org_contoso', tenantId: 'tenant_contoso', kind: 'domain', value: 'contoso.io', notes: 'Contoso domain monitoring', status: 'active', createdBy: 'viewer_contoso', updatedBy: 'viewer_contoso', createdAt: '2026-07-04T10:00:00.000Z', updatedAt: '2026-07-04T11:00:00.000Z', alertGenerationRef: 'org_contoso:watch_contoso_domain' },
]

const fixtureDestinations = [
    { id: 'dest_acme_discord', name: 'SOC Discord', kind: 'discord', status: 'active', endpointHint: 'discord...acme', endpointHash: 'wh_hash_acme', deliveryReady: true, createdAt: '2026-07-03T12:00:00.000Z', updatedAt: '2026-07-03T12:10:00.000Z' },
    { id: 'dest_acme_backup', name: 'Backup Webhook', kind: 'webhook', status: 'paused', endpointHint: 'webhook...backup', endpointHash: 'wh_hash_backup', deliveryReady: false, createdAt: '2026-07-03T11:00:00.000Z', updatedAt: '2026-07-03T11:10:00.000Z' },
]

const fixtureAlerts = [
    { id: 'dwm_alert_acme', title: 'Acme credential exposure', severity: 'high', status: 'reviewing', watchlistItemId: 'watch_acme_domain', updatedAt: '2026-07-04T09:00:00.000Z' },
]

const fixtureCases = [
    { id: 'case_acme_1', title: 'Credential exposure review', status: 'open', assignedOwner: 'analyst_acme', updatedAt: '2026-07-04T09:30:00.000Z' },
]

const fixtureDeliveries = [
    { id: 'delivery_acme_1', alertId: 'dwm_alert_acme', caseId: 'case_acme_1', organizationId: 'org_acme', tenantId: 'tenant_acme', watchlistId: 'watch_acme_domain', webhookDestinationId: 'dest_acme_discord', endpointHint: 'discord...acme', endpointHash: 'wh_hash_acme', requestId: 'req_acme_1', auditEventId: 'audit_acme_1', dedupeKey: 'dedupe_acme_1', attemptedAt: '2026-07-04T10:30:00.000Z', dryRun: true, payloadHash: 'payload_hash_acme', status: 'failed', httpStatus: 400, attemptCount: 2, nextRetryAt: '2026-07-04T10:45:00.000Z', deliveryKind: 'discord', errorClass: 'discord_validation_error', error: 'Discord rejected the request: invalid embeds.', responseSummary: 'Discord rejected the request: invalid embeds.', sanitizedPayloadPreview: { title: 'Acme credential exposure', descriptionPreview: 'High severity exposure for acme.com from dark web source.', fields: [{ name: 'Organization', valuePreview: 'Acme Security' }, { name: 'Watchlist', valuePreview: 'acme.com' }, { name: 'Severity', valuePreview: 'high' }, { name: 'Source family', valuePreview: 'darkweb' }], context: { orgName: 'Acme Security', alertTitle: 'Acme credential exposure', alertId: 'dwm_alert_acme', severity: 'high', sourceFamily: 'darkweb', evidenceCount: 2, evidenceTimestamp: '2026-07-04T09:20:00.000Z', watchlistName: 'acme.com', watchlistId: 'watch_acme_domain', matchReason: 'Customer-owned domain matched leaked credential context.', deliveryState: 'failed', casePath: '/dashboard/dwm/cases/case_acme_1?alertId=dwm_alert_acme' } } },
    ...Array.from({ length: 14 }, (_, index) => ({ id: `delivery_acme_extra_${index}`, alertId: `dwm_alert_extra_${index}`, organizationId: 'org_acme', tenantId: 'tenant_acme', watchlistId: 'watch_acme_domain', webhookDestinationId: 'dest_acme_discord', endpointHint: 'discord...acme', endpointHash: 'wh_hash_acme', requestId: `req_acme_extra_${index}`, auditEventId: `audit_acme_extra_${index}`, dedupeKey: `dedupe_acme_extra_${index}`, attemptedAt: `2026-07-04T10:${String(index).padStart(2, '0')}:00.000Z`, dryRun: true, payloadHash: `payload_hash_extra_${index}`, status: 'dry_run', httpStatus: 204, attemptCount: 1, deliveryKind: 'discord' })),
]

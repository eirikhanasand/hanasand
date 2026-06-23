'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertTriangle, Archive, CheckCircle2, Download, ExternalLink, FileText, FolderGit2, History, LifeBuoy, RefreshCcw, Rocket, ServerCog, Share2, ShieldCheck, TerminalSquare, UsersRound } from 'lucide-react'
import { listTreePaths } from './shareTree'
import ErrorNotice from '@/components/error/errorNotice'

type WorkspacePaneProps = {
    activeConversation: AIConversation | null
    importedRepos: AIImportedRepo[]
    importInput: string
    githubToken: string
    importError: string | null
    importPending: boolean
    collaborationError: string | null
    initialShares: Share[]
    syncingRepoId: string | null
    activeShareTree: Tree | null
    selectedRepoFilePath: string | null
    selectedShareFileContent: string | null
    selectedShareContent: string | null
    deployments: AIDeployment[]
    releases: AIRelease[]
    deployQuota: AIDeployQuota | null
    ownershipSummary: AIOwnershipSummary | null
    availableVmTargets: AgentVmTarget[]
    deployPending: boolean
    collaboratorPending: boolean
    currentUserId: string | null
    rollbackPendingId: string | null
    onAttachRepo: (repoId: string) => void | Promise<void>
    onAttachShare: (shareId: string) => void | Promise<void>
    onImportInputChange: (value: string) => void
    onGitHubTokenChange: (value: string) => void
    onImportRepo: () => void | Promise<void>
    onRefreshRepo: (repoId: string) => void | Promise<void>
    onRevokeRepoCredential: (repoId: string) => void | Promise<void>
    onScaffoldStarter: (template: 'nextjs_docker', projectName?: string | null) => void | Promise<void>
    onStartDeployment: (input: { vmName: string, port: string, healthPath: string, accessPolicy: AIDeploymentAccessPolicy, environment: AIDeploymentEnvironment }) => void | Promise<void>
    onInviteCollaborator: (input: { userId: string, role: 'reviewer' | 'editor' }) => void | Promise<void>
    onRollbackRelease: (releaseId: string) => void | Promise<void>
    onRemoveCollaborator: (userId: string) => void | Promise<void>
    onSelectRepoFile: (path: string) => void | Promise<void>
    onSelectShareFile: (path: string) => void | Promise<void>
}

export default function WorkspacePane(props: WorkspacePaneProps) {
    const {
        activeConversation,
        importedRepos,
        importInput,
        githubToken,
        importError,
        importPending,
        collaborationError,
        initialShares,
        syncingRepoId,
        activeShareTree,
        selectedRepoFilePath,
        selectedShareFileContent,
        selectedShareContent,
        deployments,
        releases,
        deployQuota,
        ownershipSummary,
        availableVmTargets,
        deployPending,
        collaboratorPending,
        currentUserId,
        rollbackPendingId,
        onAttachRepo,
        onAttachShare,
        onImportInputChange,
        onGitHubTokenChange,
        onImportRepo,
        onRefreshRepo,
        onRevokeRepoCredential,
        onScaffoldStarter,
        onStartDeployment,
        onInviteCollaborator,
        onRollbackRelease,
        onRemoveCollaborator,
        onSelectRepoFile,
        onSelectShareFile,
    } = props
    const [starterName, setStarterName] = useState('')
    const [deployVmName, setDeployVmName] = useState(availableVmTargets[0]?.name || '')
    const [deployPort, setDeployPort] = useState('3000')
    const [deployHealthPath, setDeployHealthPath] = useState('/')
    const [deployAccessPolicy, setDeployAccessPolicy] = useState<AIDeploymentAccessPolicy>('owner_only')
    const [deployEnvironment, setDeployEnvironment] = useState<AIDeploymentEnvironment>('staging')
    const [collaboratorUserId, setCollaboratorUserId] = useState('')
    const [collaboratorRole, setCollaboratorRole] = useState<'reviewer' | 'editor'>('editor')
    const activeRepoId = typeof activeConversation?.workspaceMeta?.repositoryId === 'string'
        ? activeConversation.workspaceMeta.repositoryId
        : activeConversation?.workspaceKind === 'repo'
            ? activeConversation.workspaceId
            : null
    const activeRepo = activeRepoId ? importedRepos.find((repo) => repo.id === activeRepoId) || null : null
    const activeShare = initialShares.find((share) => share.id === activeConversation?.workspaceId) || null
    const activeTreePaths = listTreePaths(activeShareTree)
    const selectedPath = typeof activeConversation?.workspaceMeta?.selectedFilePath === 'string'
        ? activeConversation.workspaceMeta.selectedFilePath
        : null
    const recentPaths = Array.isArray(activeConversation?.workspaceMeta?.recentPaths)
        ? activeConversation.workspaceMeta.recentPaths.filter((entry): entry is string => typeof entry === 'string')
        : []
    const lastWorkspaceAction = typeof activeConversation?.workspaceMeta?.lastWorkspaceAction === 'string'
        ? activeConversation.workspaceMeta.lastWorkspaceAction
        : null
    const lastWorkspaceActionAt = typeof activeConversation?.workspaceMeta?.lastWorkspaceActionAt === 'string'
        ? activeConversation.workspaceMeta.lastWorkspaceActionAt
        : null
    const lastChangedPath = typeof activeConversation?.workspaceMeta?.lastChangedPath === 'string'
        ? activeConversation.workspaceMeta.lastChangedPath
        : null
    const workspaceSource = typeof activeConversation?.workspaceMeta?.workspaceSource === 'string'
        ? activeConversation.workspaceMeta.workspaceSource
        : null
    const selectedContent = selectedShareFileContent || selectedShareContent
    const deployActors = Array.from(new Set(deployments.map((deployment) => deployment.startedBy || deployment.ownerId).filter(Boolean)))
    const releaseActors = Array.from(new Set(releases.map((release) => release.createdBy || release.ownerId).filter(Boolean)))
    const latestRelease = releases[0] || null
    const trustRelease = releases.find((release) => release.status === 'current') || latestRelease
    const trust = trustRelease?.trust || buildFallbackTrust(trustRelease)
    const envPlaceholders = detectEnvPlaceholders(activeRepo)
    const deployProfile = buildDeployProfile({
        environment: deployEnvironment,
        vmName: deployVmName,
        port: deployPort,
        healthPath: deployHealthPath,
        accessPolicy: deployAccessPolicy,
        activeRepo,
        activeConversation,
        envPlaceholders,
    })

    useEffect(() => {
        if (!activeRepo) {
            return
        }

        if (activeRepo.stackType === 'fastify_postgres' || activeRepo.stackType === 'fastify_worker_redis') {
            setDeployPort('3001')
            setDeployHealthPath('/ready')
            return
        }

        setDeployPort('3000')
        setDeployHealthPath('/')
    }, [activeRepo?.id, activeRepo?.stackType])

    return (
        <aside className='flex h-full min-h-0 flex-col gap-3 rounded-2xl bg-dark/30 p-3 outline outline-dark'>
            <Panel
                icon={<TerminalSquare className='h-4 w-4' />}
                title='Workspace'
                subtitle={activeRepo?.fullName || activeShare?.alias || activeShare?.path || 'No workspace attached'}
            >
                <Stat label='Mode' value={activeConversation?.workspaceKind === 'repo' ? 'Repository' : activeConversation?.workspaceKind === 'share' ? 'Share' : 'Idle'} />
                <Stat label='Source' value={workspaceSource === 'scaffold' ? 'Scaffolded starter' : workspaceSource === 'repository-sync' ? 'Repository mirror' : workspaceSource === 'share' ? 'Existing share' : 'Unknown'} />
                <Stat label='Focus' value={selectedPath || 'No file selected'} />
                <Stat label='Shares' value={`${activeConversation?.shareIds?.length || 0} attached`} />
                {activeRepo ? <Stat label='Stack' value={activeRepo.stackType === 'unknown' ? (activeRepo.stackReason || 'Unsupported stack') : activeRepo.stackType.replaceAll('_', ' ')} /> : null}
            </Panel>

            {lastWorkspaceAction ? (
                <Panel
                    icon={<RefreshCcw className='h-4 w-4' />}
                    title='Recent workspace activity'
                    subtitle={lastWorkspaceAction}
                >
                    <Stat label='Latest' value={lastChangedPath || 'Workspace-level change'} />
                    <Stat label='When' value={formatActivityTime(lastWorkspaceActionAt)} />
                    <Stat label='Tracked files' value={recentPaths.length ? `${recentPaths.length} recent path${recentPaths.length === 1 ? '' : 's'}` : 'No recent files'} />
                </Panel>
            ) : null}

            {ownershipSummary ? (
                <Panel
                    icon={<Share2 className='h-4 w-4' />}
                    title='Ownership and usage'
                    subtitle='Workspace owners, seats, and recent usage.'
                >
                    <Stat label='Owners' value={ownershipSummary.ownerIds.join(', ') || 'Unknown'} />
                    <Stat label='Repo owners' value={ownershipSummary.repositoryOwnerIds.join(', ') || 'None'} />
                    <Stat label='VM owners' value={ownershipSummary.vmOwnerIds.join(', ') || 'None'} />
                    <Stat label='Owned chats' value={String(ownershipSummary.ownedConversationCount)} />
                    <Stat label='Shared chats' value={String(ownershipSummary.sharedConversationCount)} />
                    <Stat label='Seats' value={`${ownershipSummary.collaboratorSeatCount} invited`} />
                    <Stat label='Repos / deploys' value={`${ownershipSummary.repositoryCount} repos · ${ownershipSummary.deploymentCount} deploys`} />
                    <Stat label='External repos' value={String(ownershipSummary.externalRepositoryCount)} />
                    <Stat label='External VMs' value={String(ownershipSummary.externalVmCount)} />
                    <Stat label='24h usage' value={`${ownershipSummary.usageEventCount24h} events · ${ownershipSummary.usageUnitCount24h} units`} />
                    <Stat label='Active actors' value={`${ownershipSummary.activeActorCount24h} seen in the last day`} />
                    {ownershipSummary.boundaryWarnings.length ? (
                        <div className='space-y-1'>
                            {ownershipSummary.boundaryWarnings.map((warning) => (
                                <div key={warning} className='rounded-xl bg-amber-500/8 px-3 py-2 text-xs text-amber-100/78 outline outline-amber-200/10'>
                                    {warning}
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {ownershipSummary.recentUsage.length ? (
                        <div className='space-y-1'>
                            {ownershipSummary.recentUsage.slice(0, 4).map((event) => (
                                <div key={`${event.kind}-${event.createdAt}-${event.actorId || 'system'}`} className='rounded-xl bg-dark/28 px-3 py-2 text-xs text-bright/60 outline outline-dark'>
                                    <div className='flex items-center justify-between gap-3'>
                                        <span className='truncate font-medium text-bright/78'>{formatUsageKind(event.kind)}</span>
                                        <span className='shrink-0 text-[10px] uppercase tracking-[0.14em] text-bright/36'>{formatActivityTime(event.createdAt)}</span>
                                    </div>
                                    <div className='mt-1 truncate text-[11px] text-bright/48'>
                                        {event.actorName || event.actorId || 'System'} {'->'} {event.ownerName || event.ownerId}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </Panel>
            ) : null}

            <Panel
                icon={<UsersRound className='h-4 w-4' />}
                title='Review handoff'
                subtitle={activeConversation?.collaboration?.role === 'owner' ? 'Invite an editor or reviewer.' : `Shared with you as ${activeConversation?.collaboration?.role || 'viewer'}.`}
            >
                <Stat label='Owner' value={activeConversation?.ownerId || 'Unknown'} />
                <Stat label='Collaborators' value={`${activeConversation?.collaboration?.collaborators?.length || 0} invited`} />
                <Stat label='Seats' value={`${activeConversation?.collaboration?.seatCount || 0}/${activeConversation?.collaboration?.seatLimit || 0} used`} />
                {activeConversation?.id ? (
                    <Link href={`/ai/${activeConversation.id}`} className='text-xs text-bright/58 underline-offset-4 hover:text-bright/84 hover:underline'>
                        Shared session link: /ai/{activeConversation.id}
                    </Link>
                ) : null}
                {activeConversation?.collaboration?.canInvite ? (
                    <>
                        <div className='grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2'>
                            <input value={collaboratorUserId} onChange={(event) => setCollaboratorUserId(event.target.value)} placeholder='user id' className='min-w-0 rounded-xl bg-dark/35 px-3 py-2 text-sm text-bright/88 outline outline-dark placeholder:text-bright/24' />
                            <select value={collaboratorRole} onChange={(event) => setCollaboratorRole(event.target.value === 'reviewer' ? 'reviewer' : 'editor')} className='rounded-xl bg-dark/35 px-3 py-2 text-sm text-bright/88 outline outline-dark'>
                                <option value='editor'>Editor</option>
                                <option value='reviewer'>Reviewer</option>
                            </select>
                        </div>
                        <button
                            type='button'
                            onClick={() => void onInviteCollaborator({ userId: collaboratorUserId, role: collaboratorRole })}
                            disabled={collaboratorPending || (activeConversation.collaboration.remainingSeats <= 0 && !activeConversation.collaboration.collaborators.some((collaborator) => collaborator.userId === collaboratorUserId.trim()))}
                            className='rounded-xl bg-dark/35 px-3 py-2 text-sm font-semibold text-bright/82 outline outline-dark transition-colors hover:text-[#f07d33] disabled:opacity-60'
                        >
                            {collaboratorPending ? 'Inviting...' : 'Invite collaborator'}
                        </button>
                        <div className='text-xs text-bright/42'>
                            Collaborator seats remaining: {activeConversation.collaboration.remainingSeats} of {activeConversation.collaboration.seatLimit}.
                        </div>
                    </>
                ) : null}
                {activeConversation?.collaboration?.collaborators?.length ? (
                    <div className='space-y-1'>
                        {activeConversation.collaboration.collaborators.slice(0, 6).map((collaborator) => (
                            <div key={collaborator.userId} className='flex items-center justify-between gap-3 rounded-xl bg-dark/30 px-3 py-2 text-xs text-bright/62 outline outline-dark'>
                                <div className='min-w-0'>
                                    <div className='truncate'>{collaborator.name || collaborator.userId}</div>
                                    <div className='truncate text-[10px] text-bright/38'>{collaborator.userId}</div>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <span className='shrink-0 rounded-full bg-bright/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]'>{collaborator.role}</span>
                                    {activeConversation.collaboration.canInvite || collaborator.userId === currentUserId ? (
                                        <button
                                            type='button'
                                            onClick={() => void onRemoveCollaborator(collaborator.userId)}
                                            disabled={collaboratorPending}
                                            className='rounded-lg bg-dark/35 px-2 py-1 text-[10px] text-bright/62 outline outline-dark transition-colors hover:text-red-300 disabled:opacity-60'
                                        >
                                            {collaborator.userId === currentUserId ? 'Leave' : 'Remove'}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}
                {activeConversation?.collaboration?.role !== 'owner' ? (
                    <div className='text-xs text-bright/42'>
                        Your current access lets you inspect this AI session and continue from the same conversation route.
                    </div>
                ) : null}
                {collaborationError ? <ErrorNotice compact message={collaborationError} /> : null}
            </Panel>

            <Panel
                icon={<Share2 className='h-4 w-4' />}
                title='Ownership metadata'
                subtitle='Actor and exposure details.'
            >
                <Stat label='Tenant owner' value={activeConversation?.ownerId || 'Unknown'} />
                <Stat label='Your role' value={activeConversation?.collaboration?.role || 'owner'} />
                <Stat label='Deploy actors' value={deployActors.length ? String(deployActors.length) : 'None yet'} />
                <Stat label='Release actors' value={releaseActors.length ? String(releaseActors.length) : 'None yet'} />
                <Stat label='Repo boundary' value={ownershipSummary ? `${ownershipSummary.externalRepositoryCount} external` : 'Unknown'} />
                <Stat label='VM boundary' value={ownershipSummary ? `${ownershipSummary.externalVmCount} external` : 'Unknown'} />
                <div className='rounded-xl bg-dark/30 px-3 py-2 text-xs text-bright/55 outline outline-dark'>
                    Latest exposure: {latestRelease ? `${latestRelease.accessPolicy.replaceAll('_', ' ')} via ${latestRelease.vmName}` : 'No release metadata yet'}
                </div>
                <div className='text-xs text-bright/42'>
                    Repo, VM, deploy, and release ownership are checked against the active AI owner.
                </div>
            </Panel>

            <Panel
                icon={<ShieldCheck className='h-4 w-4' />}
                title='Commercial trust'
                subtitle={trustRelease ? 'Recovery, export, and handoff evidence for this project.' : 'Recovery evidence appears after the first release.'}
            >
                {trustRelease && trust ? (
                    <>
                        <div className='rounded-xl bg-emerald-500/8 px-3 py-2 text-xs text-emerald-100/78 outline outline-emerald-200/10'>
                            {trust.noLockIn.headline}
                        </div>
                        <TrustItem icon={<History className='h-3.5 w-3.5' />} label='Version history' value={trust.versionHistory.summary} />
                        <TrustItem icon={<RefreshCcw className='h-3.5 w-3.5' />} label='Rollback' value={trust.recovery.rollbackLabel} />
                        <TrustItem icon={<Archive className='h-3.5 w-3.5' />} label='Backup before risk' value={trust.recovery.backupBeforeRiskyChanges ? trust.recovery.backupPolicy : 'No backup policy recorded.'} />
                        <TrustItem icon={<Download className='h-3.5 w-3.5' />} label='Export' value={`${trust.exports.zipLabel} ${trust.exports.githubLabel}`} />
                        <TrustItem icon={<FileText className='h-3.5 w-3.5' />} label='Handoff report' value={trust.handoffReport.join(' ')} />
                        <div className='flex flex-wrap gap-2'>
                            <a
                                href={supportBundleHref(trustRelease)}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='inline-flex items-center gap-2 rounded-lg bg-dark/35 px-2.5 py-1.5 text-xs text-bright/78 outline outline-dark transition-colors hover:text-[#f07d33]'
                            >
                                <LifeBuoy className='h-3.5 w-3.5' />
                                Support bundle
                            </a>
                            {trustRelease.status !== 'current' && trustRelease.status !== 'rollback_target' ? (
                                <button
                                    type='button'
                                    onClick={() => void onRollbackRelease(trustRelease.id)}
                                    disabled={rollbackPendingId === trustRelease.id}
                                    className='inline-flex items-center gap-2 rounded-lg bg-dark/35 px-2.5 py-1.5 text-xs text-bright/78 outline outline-dark transition-colors hover:text-[#f07d33] disabled:opacity-60'
                                >
                                    <RefreshCcw className='h-3.5 w-3.5' />
                                    {rollbackPendingId === trustRelease.id ? 'Preparing...' : 'Rollback'}
                                </button>
                            ) : null}
                        </div>
                        <div className='space-y-1'>
                            {trust.sla.slice(0, 4).map((item) => (
                                <div key={item.tier} className='rounded-xl bg-dark/30 px-3 py-2 text-xs text-bright/58 outline outline-dark'>
                                    <span className='font-semibold text-bright/78'>{item.tier}:</span> {item.promise}
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <Empty text='No release record yet. Deploy or record a release to create rollback, export, handoff, and support evidence.' />
                )}
            </Panel>

            <Panel
                icon={<RefreshCcw className='h-4 w-4' />}
                title='Release history'
                subtitle='Rollback targets and launch evidence per release.'
            >
                {releases.length ? (
                    <div className='max-h-52 space-y-2 overflow-y-auto pr-1'>
                        {releases.slice(0, 6).map((release) => (
                            <div key={release.id} className='rounded-xl bg-dark/30 px-3 py-3 outline outline-dark'>
                                <div className='flex items-start justify-between gap-3'>
                                    <div className='min-w-0'>
                                        <div className='truncate text-sm font-medium text-bright/86'>{release.vmName}</div>
                                        <div className='mt-1 text-xs text-bright/38'>
                                            {release.stackType.replaceAll('_', ' ')} · {release.accessPolicy.replaceAll('_', ' ')}
                                        </div>
                                        <PreviewLink href={release.previewUrl} emptyText='No preview URL recorded' />
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                                        release.status === 'current'
                                            ? 'bg-emerald-500/12 text-emerald-300'
                                            : release.status === 'rollback_target'
                                                ? 'bg-amber-500/12 text-amber-200'
                                                : 'bg-dark/45 text-bright/60'
                                    }`}>
                                        {release.status.replaceAll('_', ' ')}
                                    </span>
                                </div>
                                {release.notes ? <div className='mt-2 text-xs text-bright/58'>{release.notes}</div> : null}
                                {release.trust ? (
                                    <div className='mt-2 grid gap-1 text-[11px] text-bright/44'>
                                        <span>{release.trust.noLockIn.headline}</span>
                                        <span>Support bundle: {release.trust.supportBundle.includes.join(', ')}</span>
                                    </div>
                                ) : null}
                                {release.status !== 'rollback_target' && release.status !== 'current' ? (
                                    <button
                                        type='button'
                                        onClick={() => void onRollbackRelease(release.id)}
                                        disabled={rollbackPendingId === release.id}
                                        className='mt-3 rounded-lg bg-dark/35 px-2.5 py-1.5 text-xs text-bright/78 outline outline-dark transition-colors hover:text-[#f07d33] disabled:opacity-60'
                                    >
                                        {rollbackPendingId === release.id ? 'Preparing...' : 'Rollback to this release'}
                                    </button>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : <Empty text='No release records yet. Deploy history will appear here after the first attempt.' />}
            </Panel>

            <Panel
                icon={<FolderGit2 className='h-4 w-4' />}
                title='Import from GitHub'
                subtitle='Import a public or private repository.'
            >
                <div className='flex gap-2'>
                    <input value={importInput} onChange={(event) => onImportInputChange(event.target.value)} placeholder='owner/repo, URL, or repo#branch:path' className='min-w-0 flex-1 rounded-xl bg-dark/35 px-3 py-2 text-sm text-bright/88 outline outline-dark placeholder:text-bright/24' />
                    <button type='button' onClick={() => void onImportRepo()} disabled={importPending} className='rounded-xl bg-[#f07d33] px-3 py-2 text-sm font-semibold text-black transition-opacity disabled:opacity-60'>
                        {importPending ? 'Importing' : 'Import'}
                    </button>
                </div>
                <input
                    value={githubToken}
                    onChange={(event) => onGitHubTokenChange(event.target.value)}
                    placeholder='GitHub token for private repos (optional, one-time use)'
                    type='password'
                    autoComplete='off'
                    spellCheck={false}
                    className='rounded-xl bg-dark/35 px-3 py-2 text-sm text-bright/88 outline outline-dark placeholder:text-bright/24'
                />
                <div className='text-xs text-bright/40'>
                    Tokens are only sent with the current import or refresh request and are cleared again after successful use.
                </div>
                {importError ? <ErrorNotice compact message={importError} /> : null}
            </Panel>

            <Panel
                icon={<Rocket className='h-4 w-4' />}
                title='Starter'
                subtitle='Create a Docker-ready Next.js workspace.'
            >
                <input value={starterName} onChange={(event) => setStarterName(event.target.value)} placeholder='Project name' className='rounded-xl bg-dark/35 px-3 py-2 text-sm text-bright/88 outline outline-dark placeholder:text-bright/24' />
                <button type='button' onClick={() => void onScaffoldStarter('nextjs_docker', starterName)} className='rounded-xl bg-[#f07d33] px-3 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90'>
                    Create Next.js + Docker workspace
                </button>
            </Panel>

            <Panel
                icon={<ServerCog className='h-4 w-4' />}
                title='Deploy'
                subtitle='One-click launch path with owned infrastructure evidence.'
            >
                <div className='grid grid-cols-2 gap-2'>
                    {(['staging', 'production'] as AIDeploymentEnvironment[]).map((environment) => (
                        <button
                            key={environment}
                            type='button'
                            onClick={() => setDeployEnvironment(environment)}
                            className={`rounded-xl px-3 py-2 text-sm font-semibold outline transition-colors ${deployEnvironment === environment ? 'bg-[#f07d33]/12 text-[#f07d33] outline-[#f07d33]/20' : 'bg-dark/30 text-bright/62 outline-dark hover:text-bright/86'}`}
                        >
                            {environment === 'production' ? 'Production' : 'Staging'}
                        </button>
                    ))}
                </div>
                <div className='rounded-xl bg-dark/30 px-3 py-3 text-xs text-bright/58 outline outline-dark'>
                    <div className='flex items-center gap-2 text-bright/82'>
                        <ShieldCheck className='h-3.5 w-3.5 text-[#f07d33]' />
                        <span className='font-semibold'>{deployProfile.title}</span>
                    </div>
                    <div className='mt-2 grid gap-1'>
                        <div>Domain: {deployProfile.domain}</div>
                        <div>SSL: {deployProfile.ssl}</div>
                        <div>Logs: {deployProfile.logs}</div>
                        <div>Rollback: {deployProfile.rollback}</div>
                    </div>
                </div>
                {availableVmTargets.length ? (
                    <div className='flex flex-wrap gap-2'>
                        {availableVmTargets.slice(0, 8).map((target) => (
                            <button
                                key={target.id}
                                type='button'
                                onClick={() => setDeployVmName(target.name)}
                                className={`rounded-full px-2.5 py-1 text-[11px] outline ${deployVmName === target.name ? 'bg-[#f07d33]/12 text-[#f07d33] outline-[#f07d33]/18' : 'bg-dark/28 text-bright/55 outline-dark hover:text-bright/80'}`}
                            >
                                {target.name}
                            </button>
                        ))}
                    </div>
                ) : null}
                <div className='grid grid-cols-[minmax(0,1fr)_5rem] gap-2'>
                    <input value={deployVmName} onChange={(event) => setDeployVmName(event.target.value)} placeholder='VM name' className='min-w-0 rounded-xl bg-dark/35 px-3 py-2 text-sm text-bright/88 outline outline-dark placeholder:text-bright/24' />
                    <input value={deployPort} onChange={(event) => setDeployPort(event.target.value)} placeholder='3000' inputMode='numeric' className='min-w-0 rounded-xl bg-dark/35 px-3 py-2 text-sm text-bright/88 outline outline-dark placeholder:text-bright/24' />
                </div>
                <input value={deployHealthPath} onChange={(event) => setDeployHealthPath(event.target.value)} placeholder='/health or /' className='rounded-xl bg-dark/35 px-3 py-2 text-sm text-bright/88 outline outline-dark placeholder:text-bright/24' />
                <div className='rounded-xl bg-dark/30 px-3 py-3 outline outline-dark'>
                    <div className='mb-2 text-[10px] uppercase tracking-[0.18em] text-bright/30'>Deploy checklist</div>
                    <div className='grid gap-1.5'>
                        {deployProfile.checklist.map((item) => (
                            <ChecklistItem key={item.label} label={item.label} state={item.state} />
                        ))}
                    </div>
                </div>
                <div className='rounded-xl bg-dark/30 px-3 py-3 outline outline-dark'>
                    <div className='mb-2 text-[10px] uppercase tracking-[0.18em] text-bright/30'>Env placeholders</div>
                    {envPlaceholders.length ? (
                        <div className='flex flex-wrap gap-1.5'>
                            {envPlaceholders.slice(0, 10).map((name) => (
                                <span key={name} className='rounded-full bg-bright/8 px-2 py-1 text-[10px] text-bright/62 outline outline-bright/5'>
                                    {name}=required
                                </span>
                            ))}
                            {envPlaceholders.length > 10 ? <span className='text-[10px] text-bright/38'>+{envPlaceholders.length - 10} more</span> : null}
                        </div>
                    ) : (
                        <div className='text-xs text-bright/42'>No required env vars detected from imported files. Secrets are never echoed here.</div>
                    )}
                </div>
                {activeRepo ? (
                    <div className='text-xs text-bright/42'>
                        Suggested for {activeRepo.stackType.replaceAll('_', ' ')}: {activeRepo.stackType === 'nextjs_docker' ? '3000 and /' : '3001 and /ready'}.
                    </div>
                ) : null}
                <select value={deployAccessPolicy} onChange={(event) => setDeployAccessPolicy(event.target.value as AIDeploymentAccessPolicy)} className='rounded-xl bg-dark/35 px-3 py-2 text-sm text-bright/88 outline outline-dark'>
                    <option value='owner_only'>Owner only preview</option>
                    <option value='collaborators'>Collaborators</option>
                    <option value='public_preview'>Public preview</option>
                </select>
                {deployQuota ? (
                    <div className='rounded-xl bg-dark/30 px-3 py-2 text-xs text-bright/55 outline outline-dark'>
                        <div>
                            Deploys: {deployQuota.used}/{deployQuota.limit} in {deployQuota.windowMinutes} min. {deployQuota.remaining} left.
                        </div>
                        <div className='mt-1'>
                            Live: {deployQuota.activeRunning}/{deployQuota.maxRunning}. {deployQuota.runningRemaining} slots left.
                            {deployQuota.sharedAcrossCollaborators ? ' Shared quota.' : ''}
                        </div>
                    </div>
                ) : null}
                <button
                    type='button'
                    onClick={() => void onStartDeployment({ vmName: deployVmName, port: deployPort, healthPath: deployHealthPath, accessPolicy: deployAccessPolicy, environment: deployEnvironment })}
                    disabled={deployPending}
                    className='rounded-xl bg-[#f07d33] px-3 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60'
                >
                    {deployPending ? 'Checking VM deploy...' : 'Start VM deploy check'}
                </button>
                {deployments.length ? (
                    <div className='max-h-48 space-y-2 overflow-y-auto pr-1'>
                        {deployments.slice(0, 5).map((deployment) => (
                            <div key={deployment.id} className='rounded-xl bg-dark/30 px-3 py-3 outline outline-dark'>
                                <div className='flex items-start justify-between gap-3'>
                                    <div className='min-w-0'>
                                        <div className='truncate text-sm font-medium text-bright/86'>{deployment.vmName}</div>
                                        <PreviewLink href={deployment.previewUrl || deployment.healthcheckUrl} emptyText='No preview URL yet' />
                                        <div className='mt-1 text-[11px] text-bright/32'>
                                            {deployment.accessPolicy.replaceAll('_', ' ')} · {deployment.stackType.replaceAll('_', ' ')}
                                        </div>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${deployment.status === 'running' ? 'bg-emerald-500/12 text-emerald-300' : 'bg-amber-500/12 text-amber-200'}`}>
                                        {deployment.status}
                                    </span>
                                </div>
                                {deployment.failureReason ? (
                                    <div className='mt-2 rounded-lg bg-amber-500/8 px-2.5 py-2 text-xs text-amber-100/78 outline outline-amber-200/10'>
                                        {deployment.failureReason}
                                    </div>
                                ) : null}
                                <div className='mt-2 space-y-1'>
                                    {deployment.events.slice(-3).map((event) => (
                                        <div key={`${deployment.id}-${event.stage}-${event.timestamp}`} className='text-[11px] text-bright/42'>
                                            {event.stage.replaceAll('_', ' ')} · {event.message}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <Empty text='No deploy attempts recorded for this conversation yet.' />}
            </Panel>

            <Panel
                icon={<FolderGit2 className='h-4 w-4' />}
                title='Repositories'
                subtitle={`${importedRepos.length} imported`}
                grow
            >
                {importedRepos.length ? importedRepos.map((repo) => (
                    <div key={repo.id} className={`rounded-xl px-3 py-3 outline ${repo.id === activeRepoId ? 'bg-[#f07d33]/10 outline-[#f07d33]/18' : 'bg-dark/22 outline-dark'}`}>
                        <div className='flex items-start justify-between gap-3'>
                            <div className='min-w-0'>
                                <div className='truncate text-sm font-medium text-bright/88'>{repo.fullName}</div>
                                <div className='mt-1 text-xs text-bright/35'>
                                    {repo.branch} · {repo.syncStatus === 'ready' ? 'Ready' : repo.syncStatus === 'syncing' ? 'Syncing…' : repo.lastSyncError || 'Sync failed'}
                                </div>
                                <div className='mt-1 text-[11px] text-bright/38'>
                                    {repo.accessScope === 'owned' ? `Owned by ${repo.ownerId}` : `Shared from ${repo.ownerId}`}
                                </div>
                                <div className='mt-1 text-[11px] text-bright/32'>
                                    {repo.stackType === 'unknown' ? (repo.stackReason || 'Unsupported stack') : repo.stackType.replaceAll('_', ' ')}
                                </div>
                                {repo.credential?.hasCredential ? (
                                    <div className='mt-1 text-[11px] text-emerald-200/80'>
                                        Saved GitHub token {repo.credential.tokenHint || ''}{repo.credential.lastUsedAt ? ` · used ${formatActivityTime(repo.credential.lastUsedAt)}` : ''}
                                    </div>
                                ) : repo.authHint ? (
                                    <div className='mt-1 text-[11px] text-amber-200/80'>{repo.authHint}</div>
                                ) : null}
                            </div>
                            <div className='flex items-center gap-2'>
                                <button type='button' onClick={() => void onAttachRepo(repo.id)} className='rounded-lg bg-dark/35 px-2.5 py-1.5 text-xs text-bright/80 outline outline-dark hover:text-[#f07d33]'>
                                    Attach
                                </button>
                                {repo.credential?.hasCredential ? (
                                    <button type='button' onClick={() => void onRevokeRepoCredential(repo.id)} className='rounded-lg bg-dark/35 px-2.5 py-1.5 text-xs text-bright/70 outline outline-dark hover:text-red-300'>
                                        Revoke
                                    </button>
                                ) : null}
                                <button type='button' onClick={() => void onRefreshRepo(repo.id)} className='grid h-8 w-8 place-items-center rounded-lg bg-dark/35 text-bright/70 outline outline-dark hover:text-[#f07d33]'>
                                    <RefreshCcw className={`h-3.5 w-3.5 ${syncingRepoId === repo.id ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                        {repo.id === activeRepoId && repo.files.length ? (
                            <div className='mt-3 max-h-36 space-y-1 overflow-y-auto pr-1'>
                                {repo.files.slice(0, 80).map((file) => (
                                    <button key={file.path} type='button' onClick={() => void onSelectRepoFile(file.path)} className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs outline ${selectedRepoFilePath === file.path ? 'bg-[#f07d33]/12 text-bright/90 outline-[#f07d33]/18' : 'bg-dark/30 text-bright/65 outline-transparent hover:outline-dark'}`}>
                                        <div className='flex items-center justify-between gap-3'>
                                            <span className='truncate'>{file.path}</span>
                                            <PathBadge path={file.path} selected={selectedRepoFilePath === file.path} recentPaths={recentPaths} lastChangedPath={lastChangedPath} />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                )) : <Empty text='No repositories imported yet.' />}
            </Panel>

            <Panel
                icon={<Share2 className='h-4 w-4' />}
                title='Shares'
                subtitle='Attach an existing Hanasand workspace.'
            >
                <div className='max-h-40 space-y-2 overflow-y-auto pr-1'>
                    {initialShares.length ? initialShares.slice(0, 40).map((share) => (
                        <div key={share.id} className={`rounded-xl px-3 py-3 outline ${share.id === activeConversation?.workspaceId ? 'bg-[#f07d33]/10 outline-[#f07d33]/18' : 'bg-dark/22 outline-dark'}`}>
                            <div className='flex items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                    <div className='truncate text-sm text-bright/85'>{share.alias || share.id}</div>
                                    <div className='mt-1 truncate text-xs text-bright/35'>{share.path || share.id}</div>
                                </div>
                                <button type='button' onClick={() => void onAttachShare(share.id)} className='rounded-lg bg-dark/35 px-2.5 py-1.5 text-xs text-bright/80 outline outline-dark hover:text-[#f07d33]'>
                                    Attach
                                </button>
                            </div>
                        </div>
                    )) : <Empty text='No shares available.' />}
                </div>
            </Panel>

            {activeConversation?.workspaceKind === 'share' && activeTreePaths.length ? (
                <Panel
                    icon={<FolderGit2 className='h-4 w-4' />}
                    title='Project files'
                    subtitle='Split-view file selector'
                >
                    <div className='max-h-40 space-y-1 overflow-y-auto pr-1'>
                        {activeTreePaths.slice(0, 120).map((path) => (
                            <button
                                key={path}
                                type='button'
                                onClick={() => void onSelectShareFile(path)}
                                className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs outline ${selectedPath === path ? 'bg-[#f07d33]/12 text-bright/90 outline-[#f07d33]/18' : 'bg-dark/30 text-bright/65 outline-transparent hover:outline-dark'}`}
                            >
                                <div className='flex items-center justify-between gap-3'>
                                    <span className='truncate'>{path}</span>
                                    <PathBadge path={path} selected={selectedPath === path} recentPaths={recentPaths} lastChangedPath={lastChangedPath} />
                                </div>
                            </button>
                        ))}
                    </div>
                </Panel>
            ) : null}

            {selectedContent ? (
                <Panel
                    icon={<TerminalSquare className='h-4 w-4' />}
                    title='Preview'
                    subtitle={selectedPath || 'Selected content'}
                    grow
                >
                    <pre className='max-h-72 overflow-auto rounded-xl bg-black/20 p-3 text-xs leading-5 text-bright/80'>{selectedContent.slice(0, 12000)}</pre>
                </Panel>
            ) : null}
        </aside>
    )
}

function Panel({
    icon,
    title,
    subtitle,
    children,
    grow = false,
}: {
    icon: React.ReactNode
    title: string
    subtitle: string
    children: React.ReactNode
    grow?: boolean
}) {
    return (
        <section className={`rounded-2xl bg-dark/22 p-3 outline outline-dark ${grow ? 'min-h-0 flex-1' : ''}`}>
            <div className='flex items-start gap-3'>
                <div className='mt-0.5 rounded-xl bg-[#f07d33]/12 p-2 text-[#f07d33] outline outline-[#f07d33]/18'>
                    {icon}
                </div>
                <div className='min-w-0'>
                    <div className='text-[11px] uppercase tracking-[0.18em] text-bright/30'>{title}</div>
                    <div className='mt-1 text-sm text-bright/82'>{subtitle}</div>
                </div>
            </div>
            <div className={`mt-3 grid gap-2 ${grow ? 'min-h-0' : ''}`}>{children}</div>
        </section>
    )
}

function Stat({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-xl bg-dark/30 px-3 py-2 outline outline-dark'>
            <div className='text-[10px] uppercase tracking-[0.18em] text-bright/30'>{label}</div>
            <div className='mt-1 text-sm text-bright/82'>{value}</div>
        </div>
    )
}

function TrustItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className='grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-xl bg-dark/30 px-3 py-2 text-xs text-bright/58 outline outline-dark'>
            <span className='mt-0.5 text-[#f07d33]'>{icon}</span>
            <div className='min-w-0'>
                <div className='text-[10px] uppercase tracking-[0.18em] text-bright/30'>{label}</div>
                <div className='mt-1 leading-5'>{value}</div>
            </div>
        </div>
    )
}

function Empty({ text }: { text: string }) {
    return (
        <div className='rounded-xl bg-dark/30 px-3 py-4 text-sm text-bright/40 outline outline-dark'>
            {text}
        </div>
    )
}

function supportBundleHref(release: AIRelease) {
    return `/api/backend/ai/releases/${encodeURIComponent(release.id)}/support-bundle`
}

function buildFallbackTrust(release: AIRelease | null): AIReleaseTrust | null {
    if (!release) {
        return null
    }

    return {
        versionHistory: {
            releaseId: release.id,
            status: release.status,
            createdAt: release.createdAt,
            updatedAt: release.updatedAt,
            summary: `Release ${release.id} is kept in project history as ${release.status.replaceAll('_', ' ')}.`,
        },
        recovery: {
            rollbackAvailable: release.status !== 'current' && release.status !== 'rollback_target',
            rollbackLabel: release.status === 'rollback_target' ? 'Rollback target selected' : 'Rollback to this release',
            backupBeforeRiskyChanges: true,
            backupPolicy: 'Create a checkpoint before destructive or production-impacting AI changes.',
        },
        exports: {
            zipAvailable: true,
            githubAvailable: true,
            zipLabel: 'Export project as zip from workspace files.',
            githubLabel: 'Push or mirror the project to GitHub.',
        },
        handoffReport: [
            `Release ${release.id} on ${release.vmName}.`,
            `Stack: ${release.stackType.replaceAll('_', ' ')}.`,
            `Access: ${release.accessPolicy.replaceAll('_', ' ')}.`,
            release.previewUrl ? `Preview: ${release.previewUrl}.` : 'Preview URL was not recorded.',
        ],
        noLockIn: {
            headline: 'Your code, your domain, your infrastructure.',
            bullets: ['Source stays exportable.', 'Deployments are recorded against your VM/domain choices.', 'Rollback evidence stays attached to release history.'],
        },
        supportBundle: {
            available: true,
            url: `/api/ai/releases/${release.id}/support-bundle`,
            includes: ['release metadata', 'deployment events', 'failure reason', 'request IDs', 'handoff report', 'rollback status'],
            requestIds: [],
        },
        sla: [
            { tier: 'Starter', promise: 'Async queue, basic deploy history, and recoverable release records.' },
            { tier: 'Pro', promise: 'Priority verification, rollback target selection, and support bundles.' },
            { tier: 'Agency', promise: 'Client handoff reports and multi-workspace history.' },
            { tier: 'Business', promise: 'Audit logs, approvals, scoped secrets, release evidence, and SSO later.' },
        ],
    }
}

function PreviewLink({ href, emptyText }: { href: string | null | undefined, emptyText: string }) {
    if (!href) {
        return <div className='mt-1 text-[11px] text-bright/35'>{emptyText}</div>
    }

    return (
        <a
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            className='mt-1 inline-flex max-w-full items-center gap-1 text-[11px] text-[#f07d33]/85 underline decoration-[#f07d33]/25 underline-offset-4 transition-colors hover:text-[#ffb27d]'
            title={href}
        >
            <span className='truncate'>{href}</span>
            <ExternalLink className='h-3 w-3 shrink-0' />
        </a>
    )
}

function ChecklistItem({ label, state }: { label: string, state: 'ready' | 'needs_input' | 'automatic' }) {
    const ready = state === 'ready' || state === 'automatic'

    return (
        <div className='flex items-center justify-between gap-3 rounded-lg bg-dark/26 px-2.5 py-2 text-xs text-bright/58 outline outline-dark'>
            <span className='min-w-0 truncate'>{label}</span>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${ready ? 'bg-emerald-500/12 text-emerald-300' : 'bg-amber-500/12 text-amber-200'}`}>
                {ready ? <CheckCircle2 className='h-3 w-3' /> : <AlertTriangle className='h-3 w-3' />}
                {state === 'automatic' ? 'auto' : state === 'ready' ? 'ready' : 'needed'}
            </span>
        </div>
    )
}

function detectEnvPlaceholders(repo: AIImportedRepo | null) {
    if (!repo) {
        return []
    }

    const names = new Set<string>()
    for (const file of repo.files) {
        const path = file.path.toLowerCase()
        const content = file.content || ''
        if (path.endsWith('.env.example') || path.endsWith('.env.template') || path === '.env.example') {
            for (const line of content.split('\n')) {
                const match = line.match(/^\s*([A-Z][A-Z0-9_]{1,80})\s*=/)
                if (match) {
                    names.add(match[1])
                }
            }
        }

        for (const match of content.matchAll(/\b(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]{1,80})\b/g)) {
            names.add(match[1])
        }
    }

    return Array.from(names)
        .filter((name) => !['NODE_ENV', 'PORT', 'HOST', 'HOSTNAME'].includes(name))
        .sort()
}

function buildDeployProfile({
    environment,
    vmName,
    port,
    healthPath,
    accessPolicy,
    activeRepo,
    activeConversation,
    envPlaceholders,
}: {
    environment: AIDeploymentEnvironment
    vmName: string
    port: string
    healthPath: string
    accessPolicy: AIDeploymentAccessPolicy
    activeRepo: AIImportedRepo | null
    activeConversation: AIConversation | null
    envPlaceholders: string[]
}) {
    const service = sanitizeLabel(activeRepo?.name || activeConversation?.title || 'workspace')
    const domain = environment === 'production'
        ? `${service}.hanasand.com`
        : `${service}.staging.hanasand.com`
    const checklist: Array<{ label: string, state: 'ready' | 'needs_input' | 'automatic' }> = [
        { label: `Target VM: ${vmName || 'choose a VM'}`, state: vmName ? 'ready' : 'needs_input' },
        { label: `Domain profile: ${domain}`, state: 'automatic' },
        { label: 'SSL certificate after route is live', state: 'automatic' },
        { label: `Health check: ${port || 'port'}${healthPath || '/'}`, state: port && healthPath ? 'ready' : 'needs_input' },
        { label: envPlaceholders.length ? `${envPlaceholders.length} env placeholder${envPlaceholders.length === 1 ? '' : 's'} detected` : 'No env placeholders detected', state: 'automatic' },
        { label: `Access policy: ${accessPolicy.replaceAll('_', ' ')}`, state: 'ready' },
        { label: 'Build logs, deploy events, and rollback target recorded', state: 'automatic' },
    ]

    return {
        title: `${environment === 'production' ? 'Production' : 'Staging'} infrastructure profile`,
        domain,
        ssl: 'Automatic after domain route responds',
        logs: 'Build, healthcheck, VM bridge, and release events',
        rollback: 'Previous release is selectable from release history',
        checklist,
    }
}

function sanitizeLabel(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'workspace'
}

function PathBadge({
    path,
    selected,
    recentPaths,
    lastChangedPath,
}: {
    path: string
    selected: boolean
    recentPaths: string[]
    lastChangedPath: string | null
}) {
    if (selected) {
        return <span className='shrink-0 rounded-full bg-[#f07d33]/14 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#f07d33]'>Open</span>
    }

    if (lastChangedPath === path) {
        return <span className='shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-300'>Changed</span>
    }

    if (recentPaths.includes(path)) {
        return <span className='shrink-0 rounded-full bg-bright/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-bright/48'>Recent</span>
    }

    return null
}

function formatActivityTime(value: string | null) {
    if (!value) {
        return 'Unknown'
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return value
    }

    return `${parsed.toISOString().slice(0, 10)} ${parsed.toISOString().slice(11, 16)} UTC`
}

function formatUsageKind(kind: AIUsageEventKind) {
    switch (kind) {
        case 'conversation_created':
            return 'Conversation created'
        case 'message_written':
            return 'Message written'
        case 'deployment_started':
            return 'Deployment started'
        case 'release_recorded':
            return 'Release recorded'
        case 'rollback_marked':
            return 'Rollback marked'
        case 'collaborator_invited':
            return 'Collaborator invited'
        case 'collaborator_removed':
            return 'Collaborator removed'
        default:
            return kind
    }
}

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
    const launchOwners = Array.from(new Set(deployments.map((deployment) => deployment.startedBy || deployment.ownerId).filter(Boolean)))
    const reportOwners = Array.from(new Set(releases.map((release) => release.createdBy || release.ownerId).filter(Boolean)))
    const latestRelease = releases[0] || null
    const trustRelease = releases.find((release) => release.status === 'current') || latestRelease
    const trust = trustRelease?.trust || buildFallbackTrust(trustRelease)
    const launchReport = trust?.launchReport || []
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
        <aside className='flex h-full min-h-0 flex-col gap-3 rounded-2xl bg-[#f8fafc] p-3 outline outline-[#dfe5ee]'>
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
                    <Stat label='Preview owners' value={ownershipSummary.vmOwnerIds.join(', ') || 'None'} />
                    <Stat label='Owned sessions' value={String(ownershipSummary.ownedConversationCount)} />
                    <Stat label='Shared sessions' value={String(ownershipSummary.sharedConversationCount)} />
                    <Stat label='Seats' value={`${ownershipSummary.collaboratorSeatCount} invited`} />
                    <Stat label='Repos / launches' value={`${ownershipSummary.repositoryCount} repos · ${ownershipSummary.deploymentCount} launches`} />
                    <Stat label='External repos' value={String(ownershipSummary.externalRepositoryCount)} />
                    <Stat label='External previews' value={String(ownershipSummary.externalVmCount)} />
                    <Stat label='24h usage' value={`${ownershipSummary.usageEventCount24h} events · ${ownershipSummary.usageUnitCount24h} units`} />
                    <Stat label='Active users' value={`${ownershipSummary.activeActorCount24h} seen in the last day`} />
                    {ownershipSummary.boundaryWarnings.length ? (
                        <div className='space-y-1'>
                            {ownershipSummary.boundaryWarnings.map((warning) => (
                                <div key={warning} className='rounded-xl bg-amber-500/8 px-3 py-2 text-xs text-amber-800 outline outline-amber-200/40'>
                                    {warning}
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {ownershipSummary.recentUsage.length ? (
                        <div className='space-y-1'>
                            {ownershipSummary.recentUsage.slice(0, 4).map((event) => (
                                <div key={`${event.kind}-${event.createdAt}-${event.actorId || 'system'}`} className='rounded-xl bg-[#f8fafc] px-3 py-2 text-xs text-[#596170] outline outline-[#dfe5ee]'>
                                    <div className='flex items-center justify-between gap-3'>
                                        <span className='truncate font-medium text-[#344054]'>{formatUsageKind(event.kind)}</span>
                                        <span className='shrink-0 text-[10px] uppercase tracking-[0.14em] text-[#8c95a5]'>{formatActivityTime(event.createdAt)}</span>
                                    </div>
                                    <div className='mt-1 truncate text-[11px] text-[#667085]'>
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
                title='Review access'
                subtitle={activeConversation?.collaboration?.role === 'owner' ? 'Invite an editor or reviewer.' : `Shared with you as ${activeConversation?.collaboration?.role || 'viewer'}.`}
            >
                <Stat label='Owner' value={activeConversation?.ownerId || 'Unknown'} />
                <Stat label='Collaborators' value={`${activeConversation?.collaboration?.collaborators?.length || 0} invited`} />
                <Stat label='Seats' value={`${activeConversation?.collaboration?.seatCount || 0}/${activeConversation?.collaboration?.seatLimit || 0} used`} />
                {activeConversation?.id ? (
                    <Link href={`/ai/${activeConversation.id}`} className='text-xs text-[#596170] underline-offset-4 hover:text-[#171a21] hover:underline'>
                        Session link: /ai/{activeConversation.id}
                    </Link>
                ) : null}
                {activeConversation?.collaboration?.canInvite ? (
                    <>
                        <div className='grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2'>
                            <input value={collaboratorUserId} onChange={(event) => setCollaboratorUserId(event.target.value)} placeholder='user id' className='min-w-0 rounded-xl bg-white px-3 py-2 text-sm text-[#171a21] outline outline-[#dfe5ee] placeholder:text-[#98a2b3]' />
                            <select value={collaboratorRole} onChange={(event) => setCollaboratorRole(event.target.value === 'reviewer' ? 'reviewer' : 'editor')} className='rounded-xl bg-white px-3 py-2 text-sm text-[#171a21] outline outline-[#dfe5ee]'>
                                <option value='editor'>Editor</option>
                                <option value='reviewer'>Reviewer</option>
                            </select>
                        </div>
                        <button
                            type='button'
                            onClick={() => void onInviteCollaborator({ userId: collaboratorUserId, role: collaboratorRole })}
                            disabled={collaboratorPending || (activeConversation.collaboration.remainingSeats <= 0 && !activeConversation.collaboration.collaborators.some((collaborator) => collaborator.userId === collaboratorUserId.trim()))}
                            className='rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#344054] outline outline-[#dfe5ee] transition-colors hover:text-[#3056d3] disabled:opacity-60'
                        >
                            {collaboratorPending ? 'Inviting...' : 'Invite collaborator'}
                        </button>
                        <div className='text-xs text-[#667085]'>
                            Collaborator seats remaining: {activeConversation.collaboration.remainingSeats} of {activeConversation.collaboration.seatLimit}.
                        </div>
                    </>
                ) : null}
                {activeConversation?.collaboration?.collaborators?.length ? (
                    <div className='space-y-1'>
                        {activeConversation.collaboration.collaborators.slice(0, 6).map((collaborator) => (
                            <div key={collaborator.userId} className='flex items-center justify-between gap-3 rounded-xl bg-[#f8fafc] px-3 py-2 text-xs text-[#596170] outline outline-[#dfe5ee]'>
                                <div className='min-w-0'>
                                    <div className='truncate'>{collaborator.name || collaborator.userId}</div>
                                    <div className='truncate text-[10px] text-[#8c95a5]'>{collaborator.userId}</div>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <span className='shrink-0 rounded-full bg-[#eef3ff] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]'>{collaborator.role}</span>
                                    {activeConversation.collaboration.canInvite || collaborator.userId === currentUserId ? (
                                        <button
                                            type='button'
                                            onClick={() => void onRemoveCollaborator(collaborator.userId)}
                                            disabled={collaboratorPending}
                                            className='rounded-lg bg-white px-2 py-1 text-[10px] text-[#596170] outline outline-[#dfe5ee] transition-colors hover:text-red-300 disabled:opacity-60'
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
                    <div className='text-xs text-[#667085]'>
                        Your current access lets you inspect this shared review and continue from the same conversation route.
                    </div>
                ) : null}
                {collaborationError ? <ErrorNotice compact message={collaborationError} /> : null}
            </Panel>

            <Panel
                icon={<Share2 className='h-4 w-4' />}
                title='Access summary'
                subtitle='Session and preview details.'
            >
                <Stat label='Tenant owner' value={activeConversation?.ownerId || 'Unknown'} />
                <Stat label='Your role' value={activeConversation?.collaboration?.role || 'owner'} />
                <Stat label='Launch owners' value={launchOwners.length ? String(launchOwners.length) : 'None yet'} />
                <Stat label='Report owners' value={reportOwners.length ? String(reportOwners.length) : 'None yet'} />
                <Stat label='Repo boundary' value={ownershipSummary ? `${ownershipSummary.externalRepositoryCount} external` : 'Unknown'} />
                <Stat label='Preview boundary' value={ownershipSummary ? `${ownershipSummary.externalVmCount} external` : 'Unknown'} />
                <div className='rounded-xl bg-[#f8fafc] px-3 py-2 text-xs text-[#596170] outline outline-[#dfe5ee]'>
                    Latest preview: {latestRelease ? `${latestRelease.accessPolicy.replaceAll('_', ' ')} via ${latestRelease.vmName}` : 'No report details yet'}
                </div>
                <div className='text-xs text-[#667085]'>
                    Repository, preview, launch, and report ownership are checked against the active workspace owner.
                </div>
            </Panel>

            <Panel
                icon={<ShieldCheck className='h-4 w-4' />}
                title='Launch report'
                subtitle={trustRelease ? 'Recovery, export, and release details for this project.' : 'Report details appear after the first recorded launch.'}
            >
                {trustRelease && trust ? (
                    <>
                        <div className='rounded-xl bg-emerald-500/8 px-3 py-2 text-xs text-emerald-800 outline outline-emerald-200/40'>
                            {trust.noLockIn.headline}
                        </div>
                        <TrustItem icon={<History className='h-3.5 w-3.5' />} label='Version history' value={trust.versionHistory.summary} />
                        <TrustItem icon={<RefreshCcw className='h-3.5 w-3.5' />} label='Rollback' value={trust.recovery.rollbackLabel} />
                        <TrustItem icon={<Archive className='h-3.5 w-3.5' />} label='Backup before risk' value={trust.recovery.backupBeforeRiskyChanges ? trust.recovery.backupPolicy : 'No backup policy recorded.'} />
                        <TrustItem icon={<Download className='h-3.5 w-3.5' />} label='Export' value={`${trust.exports.zipLabel} ${trust.exports.githubLabel}`} />
                        <TrustItem icon={<FileText className='h-3.5 w-3.5' />} label='Launch report' value={launchReport.join(' ')} />
                        <div className='flex flex-wrap gap-2'>
                            <a
                                href={supportBundleHref(trustRelease)}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='inline-flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs text-[#344054] outline outline-[#dfe5ee] transition-colors hover:text-[#3056d3]'
                            >
                                <LifeBuoy className='h-3.5 w-3.5' />
                                Support bundle
                            </a>
                            {trustRelease.status !== 'current' && trustRelease.status !== 'rollback_target' ? (
                                <button
                                    type='button'
                                    onClick={() => void onRollbackRelease(trustRelease.id)}
                                    disabled={rollbackPendingId === trustRelease.id}
                                    className='inline-flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs text-[#344054] outline outline-[#dfe5ee] transition-colors hover:text-[#3056d3] disabled:opacity-60'
                                >
                                    <RefreshCcw className='h-3.5 w-3.5' />
                                    {rollbackPendingId === trustRelease.id ? 'Preparing...' : 'Rollback'}
                                </button>
                            ) : null}
                        </div>
                        <div className='space-y-1'>
                            {trust.sla.slice(0, 4).map((item) => (
                                <div key={item.tier} className='rounded-xl bg-[#f8fafc] px-3 py-2 text-xs text-[#596170] outline outline-[#dfe5ee]'>
                                    <span className='font-semibold text-[#344054]'>{item.tier}:</span> {item.promise}
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <Empty text='No launch report yet. Record a launch to create rollback, export, and support details.' />
                )}
            </Panel>

            <Panel
                icon={<RefreshCcw className='h-4 w-4' />}
                title='Launch history'
                subtitle='Rollback targets and launch details.'
            >
                {releases.length ? (
                    <div className='max-h-52 space-y-2 overflow-y-auto pr-1'>
                        {releases.slice(0, 6).map((release) => (
                            <div key={release.id} className='rounded-xl bg-[#f8fafc] px-3 py-3 outline outline-[#dfe5ee]'>
                                <div className='flex items-start justify-between gap-3'>
                                    <div className='min-w-0'>
                                        <div className='truncate text-sm font-medium text-[#171a21]'>{release.vmName}</div>
                                        <div className='mt-1 text-xs text-[#8c95a5]'>
                                            {release.stackType.replaceAll('_', ' ')} · {release.accessPolicy.replaceAll('_', ' ')}
                                        </div>
                                        <PreviewLink href={release.previewUrl} emptyText='No preview URL recorded' />
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                                        release.status === 'current'
                                            ? 'bg-emerald-500/12 text-emerald-700'
                                            : release.status === 'rollback_target'
                                                ? 'bg-amber-500/12 text-amber-700'
                                                : 'bg-[#eef2f7] text-[#596170]'
                                    }`}>
                                        {release.status.replaceAll('_', ' ')}
                                    </span>
                                </div>
                                {release.notes ? <div className='mt-2 text-xs text-[#596170]'>{release.notes}</div> : null}
                                {release.trust ? (
                                    <div className='mt-2 grid gap-1 text-[11px] text-[#667085]'>
                                        <span>{release.trust.noLockIn.headline}</span>
                                        <span>Support bundle: {release.trust.supportBundle.includes.join(', ')}</span>
                                    </div>
                                ) : null}
                                {release.status !== 'rollback_target' && release.status !== 'current' ? (
                                    <button
                                        type='button'
                                        onClick={() => void onRollbackRelease(release.id)}
                                        disabled={rollbackPendingId === release.id}
                                        className='mt-3 rounded-lg bg-white px-2.5 py-1.5 text-xs text-[#344054] outline outline-[#dfe5ee] transition-colors hover:text-[#3056d3] disabled:opacity-60'
                                    >
                                        {rollbackPendingId === release.id ? 'Preparing...' : 'Rollback to this release'}
                                    </button>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : <Empty text='No launch history yet. Attempts will appear here after the first check.' />}
            </Panel>

            <Panel
                icon={<FolderGit2 className='h-4 w-4' />}
                title='Attach repository'
                subtitle='Import a public or private repository.'
            >
                <div className='flex gap-2'>
                    <input value={importInput} onChange={(event) => onImportInputChange(event.target.value)} placeholder='owner/repo, URL, or repo#branch:path' className='min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm text-[#171a21] outline outline-[#dfe5ee] placeholder:text-[#98a2b3]' />
                    <button type='button' onClick={() => void onImportRepo()} disabled={importPending} className='rounded-xl bg-[#3056d3] px-3 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60'>
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
                    className='rounded-xl bg-white px-3 py-2 text-sm text-[#171a21] outline outline-[#dfe5ee] placeholder:text-[#98a2b3]'
                />
                <div className='text-xs text-[#667085]'>
                    Tokens are only sent with the current import or refresh request and are cleared again after successful use.
                </div>
                {importError ? <ErrorNotice compact message={importError} /> : null}
            </Panel>

            <Panel
                icon={<Rocket className='h-4 w-4' />}
                title='Starter'
                subtitle='Create a Docker-ready Next.js workspace.'
            >
                <input value={starterName} onChange={(event) => setStarterName(event.target.value)} placeholder='Project name' className='rounded-xl bg-white px-3 py-2 text-sm text-[#171a21] outline outline-[#dfe5ee] placeholder:text-[#98a2b3]' />
                <button type='button' onClick={() => void onScaffoldStarter('nextjs_docker', starterName)} className='rounded-xl bg-[#3056d3] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90'>
                    Create workspace
                </button>
            </Panel>

            <Panel
                icon={<ServerCog className='h-4 w-4' />}
                title='Launch check'
                subtitle='One-click preview path with recorded release details.'
            >
                <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                    {(['staging', 'production'] as AIDeploymentEnvironment[]).map((environment) => (
                        <button
                            key={environment}
                            type='button'
                            onClick={() => setDeployEnvironment(environment)}
                            className={`rounded-xl px-3 py-2 text-sm font-semibold outline transition-colors ${deployEnvironment === environment ? 'bg-[#3056d3]/12 text-[#3056d3] outline-[#3056d3]/20' : 'bg-[#f8fafc] text-[#596170] outline-[#dfe5ee] hover:text-[#171a21]'}`}
                        >
                            {environment === 'production' ? 'Production' : 'Staging'}
                        </button>
                    ))}
                </div>
                <div className='rounded-xl bg-[#f8fafc] px-3 py-3 text-xs text-[#596170] outline outline-[#dfe5ee]'>
                    <div className='flex items-center gap-2 text-[#344054]'>
                        <ShieldCheck className='h-3.5 w-3.5 text-[#3056d3]' />
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
                                className={`rounded-full px-2.5 py-1 text-[11px] outline ${deployVmName === target.name ? 'bg-[#3056d3]/12 text-[#3056d3] outline-[#3056d3]/18' : 'bg-[#f8fafc] text-[#596170] outline-[#dfe5ee] hover:text-[#344054]'}`}
                            >
                                {target.name}
                            </button>
                        ))}
                    </div>
                ) : null}
                <div className='grid grid-cols-[minmax(0,1fr)_5rem] gap-2'>
                    <input value={deployVmName} onChange={(event) => setDeployVmName(event.target.value)} placeholder='Launch target' className='min-w-0 rounded-xl bg-white px-3 py-2 text-sm text-[#171a21] outline outline-[#dfe5ee] placeholder:text-[#98a2b3]' />
                    <input value={deployPort} onChange={(event) => setDeployPort(event.target.value)} placeholder='3000' inputMode='numeric' className='min-w-0 rounded-xl bg-white px-3 py-2 text-sm text-[#171a21] outline outline-[#dfe5ee] placeholder:text-[#98a2b3]' />
                </div>
                <input value={deployHealthPath} onChange={(event) => setDeployHealthPath(event.target.value)} placeholder='/health or /' className='rounded-xl bg-white px-3 py-2 text-sm text-[#171a21] outline outline-[#dfe5ee] placeholder:text-[#98a2b3]' />
                <div className='rounded-xl bg-[#f8fafc] px-3 py-3 outline outline-[#dfe5ee]'>
                    <div className='mb-2 text-[10px] uppercase tracking-[0.18em] text-[#667085]'>Launch checklist</div>
                    <div className='grid gap-1.5'>
                        {deployProfile.checklist.map((item) => (
                            <ChecklistItem key={item.label} label={item.label} state={item.state} />
                        ))}
                    </div>
                </div>
                <div className='rounded-xl bg-[#f8fafc] px-3 py-3 outline outline-[#dfe5ee]'>
                    <div className='mb-2 text-[10px] uppercase tracking-[0.18em] text-[#667085]'>Env placeholders</div>
                    {envPlaceholders.length ? (
                        <div className='flex flex-wrap gap-1.5'>
                            {envPlaceholders.slice(0, 10).map((name) => (
                                <span key={name} className='rounded-full bg-[#eef3ff] px-2 py-1 text-[10px] text-[#596170] outline outline-[#dce6ff]'>
                                    {name}=required
                                </span>
                            ))}
                            {envPlaceholders.length > 10 ? <span className='text-[10px] text-[#8c95a5]'>+{envPlaceholders.length - 10} more</span> : null}
                        </div>
                    ) : (
                        <div className='text-xs text-[#667085]'>No required env vars detected from imported files. Secrets are never echoed here.</div>
                    )}
                </div>
                {activeRepo ? (
                    <div className='text-xs text-[#667085]'>
                        Suggested for {activeRepo.stackType.replaceAll('_', ' ')}: {activeRepo.stackType === 'nextjs_docker' ? '3000 and /' : '3001 and /ready'}.
                    </div>
                ) : null}
                <select value={deployAccessPolicy} onChange={(event) => setDeployAccessPolicy(event.target.value as AIDeploymentAccessPolicy)} className='rounded-xl bg-white px-3 py-2 text-sm text-[#171a21] outline outline-[#dfe5ee]'>
                    <option value='owner_only'>Owner only preview</option>
                    <option value='collaborators'>Collaborators</option>
                    <option value='public_preview'>Public preview</option>
                </select>
                {deployQuota ? (
                    <div className='rounded-xl bg-[#f8fafc] px-3 py-2 text-xs text-[#596170] outline outline-[#dfe5ee]'>
                        <div>
                            Checks: {deployQuota.used}/{deployQuota.limit} in {deployQuota.windowMinutes} min. {deployQuota.remaining} left.
                        </div>
                        <div className='mt-1'>
                            Active previews: {deployQuota.activeRunning}/{deployQuota.maxRunning}. {deployQuota.runningRemaining} slots left.
                            {deployQuota.sharedAcrossCollaborators ? ' Shared quota.' : ''}
                        </div>
                    </div>
                ) : null}
                <button
                    type='button'
                    onClick={() => void onStartDeployment({ vmName: deployVmName, port: deployPort, healthPath: deployHealthPath, accessPolicy: deployAccessPolicy, environment: deployEnvironment })}
                    disabled={deployPending}
                    className='rounded-xl bg-[#3056d3] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60'
                >
                    {deployPending ? 'Checking launch target...' : 'Run launch check'}
                </button>
                {deployments.length ? (
                    <div className='max-h-48 space-y-2 overflow-y-auto pr-1'>
                        {deployments.slice(0, 5).map((deployment) => (
                            <div key={deployment.id} className='rounded-xl bg-[#f8fafc] px-3 py-3 outline outline-[#dfe5ee]'>
                                <div className='flex items-start justify-between gap-3'>
                                    <div className='min-w-0'>
                                        <div className='truncate text-sm font-medium text-[#171a21]'>{deployment.vmName}</div>
                                        <PreviewLink href={deployment.previewUrl || deployment.healthcheckUrl} emptyText='No preview URL yet' />
                                        <div className='mt-1 text-[11px] text-[#8c95a5]'>
                                            {deployment.accessPolicy.replaceAll('_', ' ')} · {deployment.stackType.replaceAll('_', ' ')}
                                        </div>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${deployment.status === 'running' ? 'bg-emerald-500/12 text-emerald-700' : 'bg-amber-500/12 text-amber-700'}`}>
                                        {deployment.status}
                                    </span>
                                </div>
                                {deployment.failureReason ? (
                                    <div className='mt-2 rounded-lg bg-amber-500/8 px-2.5 py-2 text-xs text-amber-800 outline outline-amber-200/40'>
                                        {deployment.failureReason}
                                    </div>
                                ) : null}
                                <div className='mt-2 space-y-1'>
                                    {deployment.events.slice(-3).map((event) => (
                                        <div key={`${deployment.id}-${event.stage}-${event.timestamp}`} className='text-[11px] text-[#667085]'>
                                            {event.stage.replaceAll('_', ' ')} · {event.message}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <Empty text='No launch attempts recorded for this conversation yet.' />}
            </Panel>

            <Panel
                icon={<FolderGit2 className='h-4 w-4' />}
                title='Repositories'
                subtitle={`${importedRepos.length} imported`}
                grow
            >
                {importedRepos.length ? importedRepos.map((repo) => (
                    <div key={repo.id} className={`rounded-xl px-3 py-3 outline ${repo.id === activeRepoId ? 'bg-[#3056d3]/10 outline-[#3056d3]/18' : 'bg-white outline-[#dfe5ee]'}`}>
                        <div className='flex items-start justify-between gap-3'>
                            <div className='min-w-0'>
                                <div className='truncate text-sm font-medium text-[#171a21]'>{repo.fullName}</div>
                                <div className='mt-1 text-xs text-[#8c95a5]'>
                                    {repo.branch} · {repo.syncStatus === 'ready' ? 'Ready' : repo.syncStatus === 'syncing' ? 'Syncing…' : repo.lastSyncError || 'Sync failed'}
                                </div>
                                <div className='mt-1 text-[11px] text-[#8c95a5]'>
                                    {repo.accessScope === 'owned' ? `Owned by ${repo.ownerId}` : `Shared from ${repo.ownerId}`}
                                </div>
                                <div className='mt-1 text-[11px] text-[#8c95a5]'>
                                    {repo.stackType === 'unknown' ? (repo.stackReason || 'Unsupported stack') : repo.stackType.replaceAll('_', ' ')}
                                </div>
                                {repo.credential?.hasCredential ? (
                                    <div className='mt-1 text-[11px] text-emerald-700'>
                                        Saved GitHub token {repo.credential.tokenHint || ''}{repo.credential.lastUsedAt ? ` · used ${formatActivityTime(repo.credential.lastUsedAt)}` : ''}
                                    </div>
                                ) : repo.authHint ? (
                                    <div className='mt-1 text-[11px] text-amber-700'>{repo.authHint}</div>
                                ) : null}
                            </div>
                            <div className='flex items-center gap-2'>
                                <button type='button' onClick={() => void onAttachRepo(repo.id)} className='rounded-lg bg-white px-2.5 py-1.5 text-xs text-[#344054] outline outline-[#dfe5ee] hover:text-[#3056d3]'>
                                    Attach
                                </button>
                                {repo.credential?.hasCredential ? (
                                    <button type='button' onClick={() => void onRevokeRepoCredential(repo.id)} className='rounded-lg bg-white px-2.5 py-1.5 text-xs text-[#596170] outline outline-[#dfe5ee] hover:text-red-300'>
                                        Revoke
                                    </button>
                                ) : null}
                                <button type='button' onClick={() => void onRefreshRepo(repo.id)} className='grid h-8 w-8 place-items-center rounded-lg bg-white text-[#596170] outline outline-[#dfe5ee] hover:text-[#3056d3]'>
                                    <RefreshCcw className={`h-3.5 w-3.5 ${syncingRepoId === repo.id ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                        {repo.id === activeRepoId && repo.files.length ? (
                            <div className='mt-3 max-h-36 space-y-1 overflow-y-auto pr-1'>
                                {repo.files.slice(0, 80).map((file) => (
                                    <button key={file.path} type='button' onClick={() => void onSelectRepoFile(file.path)} className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs outline ${selectedRepoFilePath === file.path ? 'bg-[#3056d3]/12 text-[#171a21] outline-[#3056d3]/18' : 'bg-[#f8fafc] text-[#596170] outline-transparent hover:outline-[#dfe5ee]'}`}>
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
                        <div key={share.id} className={`rounded-xl px-3 py-3 outline ${share.id === activeConversation?.workspaceId ? 'bg-[#3056d3]/10 outline-[#3056d3]/18' : 'bg-white outline-[#dfe5ee]'}`}>
                            <div className='flex items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                    <div className='truncate text-sm text-[#171a21]'>{share.alias || share.id}</div>
                                    <div className='mt-1 truncate text-xs text-[#8c95a5]'>{share.path || share.id}</div>
                                </div>
                                <button type='button' onClick={() => void onAttachShare(share.id)} className='rounded-lg bg-white px-2.5 py-1.5 text-xs text-[#344054] outline outline-[#dfe5ee] hover:text-[#3056d3]'>
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
                                className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs outline ${selectedPath === path ? 'bg-[#3056d3]/12 text-[#171a21] outline-[#3056d3]/18' : 'bg-[#f8fafc] text-[#596170] outline-transparent hover:outline-[#dfe5ee]'}`}
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
                    <pre className='max-h-72 overflow-auto rounded-xl bg-[#f4f6fa] p-3 text-xs leading-5 text-[#344054]'>{selectedContent.slice(0, 12000)}</pre>
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
        <section className={`rounded-2xl bg-white p-3 outline outline-[#dfe5ee] ${grow ? 'min-h-0 flex-1' : ''}`}>
            <div className='flex items-start gap-3'>
                <div className='mt-0.5 rounded-xl bg-[#3056d3]/12 p-2 text-[#3056d3] outline outline-[#3056d3]/18'>
                    {icon}
                </div>
                <div className='min-w-0'>
                    <div className='text-[11px] uppercase tracking-[0.18em] text-[#667085]'>{title}</div>
                    <div className='mt-1 text-sm text-[#344054]'>{subtitle}</div>
                </div>
            </div>
            <div className={`mt-3 grid gap-2 ${grow ? 'min-h-0' : ''}`}>{children}</div>
        </section>
    )
}

function Stat({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-xl bg-[#f8fafc] px-3 py-2 outline outline-[#dfe5ee]'>
            <div className='text-[10px] uppercase tracking-[0.18em] text-[#667085]'>{label}</div>
            <div className='mt-1 text-sm text-[#344054]'>{value}</div>
        </div>
    )
}

function TrustItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className='grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-xl bg-[#f8fafc] px-3 py-2 text-xs text-[#596170] outline outline-[#dfe5ee]'>
            <span className='mt-0.5 text-[#3056d3]'>{icon}</span>
            <div className='min-w-0'>
                <div className='text-[10px] uppercase tracking-[0.18em] text-[#667085]'>{label}</div>
                <div className='mt-1 leading-5'>{value}</div>
            </div>
        </div>
    )
}

function Empty({ text }: { text: string }) {
    return (
        <div className='rounded-xl bg-[#f8fafc] px-3 py-4 text-sm text-[#667085] outline outline-[#dfe5ee]'>
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
        launchReport: [
            `Release ${release.id} on ${release.vmName}.`,
            `Stack: ${release.stackType.replaceAll('_', ' ')}.`,
            `Access: ${release.accessPolicy.replaceAll('_', ' ')}.`,
            release.previewUrl ? `Preview: ${release.previewUrl}.` : 'Preview URL was not recorded.',
        ],
        noLockIn: {
            headline: 'Your code, your domain, your infrastructure.',
            bullets: ['Source stays exportable.', 'Launches are recorded against your target and domain choices.', 'Rollback details stay attached to launch history.'],
        },
        supportBundle: {
            available: true,
            url: `/api/ai/releases/${release.id}/support-bundle`,
            includes: ['release details', 'launch events', 'failure reason', 'request IDs', 'launch report', 'rollback status'],
            requestIds: [],
        },
        sla: [
            { tier: 'Starter', promise: 'Background review, basic launch history, and recoverable report records.' },
            { tier: 'Pro', promise: 'Priority verification, rollback target selection, and support bundles.' },
            { tier: 'Agency', promise: 'Client reports and multi-workspace history.' },
            { tier: 'Business', promise: 'Audit logs, approvals, scoped secrets, release details, and SSO later.' },
        ],
    }
}

function PreviewLink({ href, emptyText }: { href: string | null | undefined, emptyText: string }) {
    if (!href) {
        return <div className='mt-1 text-[11px] text-[#8c95a5]'>{emptyText}</div>
    }

    return (
        <a
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            className='mt-1 inline-flex max-w-full items-center gap-1 text-[11px] text-[#3056d3]/85 underline decoration-[#3056d3]/25 underline-offset-4 transition-colors hover:text-[#2546a8]'
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
        <div className='flex items-center justify-between gap-3 rounded-lg bg-[#f8fafc] px-2.5 py-2 text-xs text-[#596170] outline outline-[#dfe5ee]'>
            <span className='min-w-0 truncate'>{label}</span>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${ready ? 'bg-emerald-500/12 text-emerald-700' : 'bg-amber-500/12 text-amber-700'}`}>
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
        { label: `Launch target: ${vmName || 'choose a target'}`, state: vmName ? 'ready' : 'needs_input' },
        { label: `Domain profile: ${domain}`, state: 'automatic' },
        { label: 'SSL certificate after route is live', state: 'automatic' },
        { label: `Health check: ${port || 'port'}${healthPath || '/'}`, state: port && healthPath ? 'ready' : 'needs_input' },
        { label: envPlaceholders.length ? `${envPlaceholders.length} env placeholder${envPlaceholders.length === 1 ? '' : 's'} detected` : 'No env placeholders detected', state: 'automatic' },
        { label: `Access policy: ${accessPolicy.replaceAll('_', ' ')}`, state: 'ready' },
        { label: 'Build logs, launch events, and rollback target recorded', state: 'automatic' },
    ]

    return {
        title: `${environment === 'production' ? 'Production' : 'Staging'} infrastructure profile`,
        domain,
        ssl: 'Automatic after domain route responds',
        logs: 'Build, health check, preview, and launch events',
        rollback: 'Previous launch is selectable from launch history',
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
        return <span className='shrink-0 rounded-full bg-[#3056d3]/14 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#3056d3]'>Open</span>
    }

    if (lastChangedPath === path) {
        return <span className='shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-700'>Changed</span>
    }

    if (recentPaths.includes(path)) {
        return <span className='shrink-0 rounded-full bg-[#eef3ff] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#667085]'>Recent</span>
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
            return 'Launch started'
        case 'release_recorded':
            return 'Launch report recorded'
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

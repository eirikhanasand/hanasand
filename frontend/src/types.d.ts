type Theme = 'light' | 'dark' | undefined

type Cookie = {
    name: string
    value: string
}

type Commit = {
    sha: string
    node_id: string
    commit: InnerCommit
}

type InnerCommit = {
    author: Author
    committer: Committer
    message: string
    tree: CommitTree
    url: string
    comment_count: number
    verification: Verification
}

type Author = {
    name: string
    email: string
    date: string
}

type Committer = {
    name: string
    email: string
    date: string
}

type CommitTree = {
    sha: string
    url: string
}

type Verification = {
    verified: boolean
    reason: string
    signature: null
    payload: null
    verified_at: null
}

type Article = {
    id: string
    size: number
    created: string
    modified: string
    metadata: {
        image: string
        description: string
        wordCount: number
        estimatedMinutes: number
    }
    title: string
    content: string
}

type GithubContent = {
    name: string
    path: string
    sha: string
    size: number
    url: string
    html_url: string
    git_url: string
    download_url: string
    type: string
    _links: ContentLinks
}

type ContentLinks = {
    self: string
    git: string
    html: string
}

type GitHubContentFile = {
    name: string
    path: string
    sha: string
    size: number
    url: string
    html_url: string
    git_url: string
    download_url: string
    type: string
    content: string
    encoding: string
    _links: ContentLinks
}

type GitHubFile = {
    name: string
    text: string
    commits: Commit[]
}

type Share = {
    id: string
    path: string
    content: string
    wordCount: number
    estimatedMinutes: number
    timestamp: string
    git: string | null
    locked: boolean
    owner: string
    parent: string
    alias: string
}

type ShareWithTree = Share & { tree: Tree }

type Link = {
    id: string
    path: string
}

type FullLink = {
    id: string
    path: string
    visits: number
    timestamp: string
}

type File = {
    id: string
    path: string
    content: string
    timestamp: string
}

type PostFileResponse = {
    id: string
}

type Breach = {
    ok: boolean
    count: number
    message: string
}

type BreachFile = {
    file: string
    line: number
}

type Articles = {
    recent: Article[]
    articles: Article[]
}

type User = {
    id: string
    name: string
    avatar: string
    active?: boolean
    deactivated_at?: string | null
    deactivated_by?: string | null
}

type UserWithRole = User & HighestRole

type Thought = {
    id: string
    title: string
    created_at: string
    created_by: string
    updated_at: string
}

type Note = {
    id: string
    title: string
    content: string
    source: string
    owner_id: string
    created_at: string
    updated_at: string
}

type MinimalRole = {
    user_id: string
    role_id: string
    assigned_by: string
    assigned_at: string
}

type Role = {
    id: string
    name: string
    description: string
    priority: number
    created_by: string
    created_at: string
    updated_at: string
}

type Updates = {
    path?: string
    content?: string
    name?: string
}

type LoadTestTimePoint = {
    time: string | number
}

type LoadTestRpsPoint = LoadTestTimePoint & {
    value: number
}

type LoadTestLatencyPoint = LoadTestTimePoint & {
    p50?: number
    p95?: number
}

type LoadTestErrorPoint = LoadTestTimePoint & {
    count: number
}

type LoadTestSummary = {
    requests?: number
    failureRate?: number
    duration?: {
        p50?: number
        p95?: number
        avg?: number
        min?: number
        max?: number
    }
    rps?: LoadTestRpsPoint[]
    latency?: LoadTestLatencyPoint[]
    errors?: LoadTestErrorPoint[]
}

type Test = {
    id: string
    url: string
    timeout: number
    stages: object & { default: boolean }
    status: string
    logs: string[]
    errors: string[]
    duration: { milliseconds: number }
    created_at: string
    finished_at: string
    exit_code: number
    visits: number
    summary: LoadTestSummary
    latest_run_summary?: LoadTestSummary
    previous_run_summary?: LoadTestSummary
    latest_run_number?: number
    p95_delta_ms?: number | null
}

type FileItemBase = {
    id: string
    name: string
    alias: string | null
    parent: string | null
}

type FileFile = FileItemBase & {
    type: 'file'
}

type FileFolder = FileItemBase & {
    type: 'folder'
    children: FileItem[]
}

type FileItem = FileFile | FileFolder

type Log = {
    content: string
    timestamp: string
    type: 'stdout' | 'stderr'
}

type Tree = FileItem[]

type Certificate = {
    id: string
    public_key: string
    name: string
    owner: string
    created_at: string
    created_by: string
}

type BlocklistEntry = {
    id: number
    type: 'ip' | 'user_agent'
    value: string
    is_vpn: boolean
    is_proxy: boolean
    is_tor: boolean
    owner?: string
    country?: string
    region?: string
    city?: string
}

type IPMetrics = {
    ip: string
    top_paths: TopPath[]
    most_common_user_agent: string | null
}

type UAMetrics = {
    user_agent: string
    top_paths: TopPath[]
    most_common_ip: string | null
}

type DomainTPS = {
    name: string
    tps: number
}

type FetchRequest = {
    type: RequestType
    path: string
    created: string
}

type RequestType = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE' | string

type Parameter = {
    parameter: string
    value: string
}

type SearchResult = {
    action: string
    text: string
    metadata?: {
        file?: string
        line?: number
    }
}

type OpenFile = {
    id: string
    name: string
}

type SystemMetric = {
    name: string
    value: string | number
    icon?: React.ReactNode
}

type SystemMemorySnapshot = {
    used: number
    total: number
    percent: string
}

type SystemSnapshot = {
    load: number[]
    memory: SystemMemorySnapshot
    swap: string
    disk: string
    temperature: string
    powerUsage: string
    processes: number
    ipv4: string[]
    ipv6: string[]
    os: string
}

type SystemMetricsApiResponse = {
    system: SystemSnapshot
}

type DockerContainer = {
    id: string
    name: string
    status: 'running' | 'stopped' | 'paused'
    cpu: number
    memory: number
    created_at?: string
}

type VM = {
    name: string
    owner: string
    created_by: string
    access_users: string[]
    always_running_premium: boolean
    always_running_enabled: boolean
    failover_premium: boolean
    failover_enabled: boolean
    primary_host: string
    failover_host: string | null
    status: string
    type: string
    architecture: string
    created: string
    last_used: string
    config_image_description: string
    config_image_os: string
    config_image_version: string
    limits_cpu: string
    limits_memory: string
    device_eth0_ipv4_address: string
    last_checked: string
}

type VMMetrics = {
    id: number
    name: string
    cpu_usage_percent: number
    cpu_cores: number
    cpu_temperature: number
    ram_used_mb: number
    ram_total_mb: number
    gpu_usage_percent: number
    gpu_memory_used_mb: number
    gpu_memory_total_mb: number
    gpu_temperature: number
    system_temperature: number
    disk_used_mb: number
    disk_total_mb: number
    disk_read_iops: number
    disk_write_iops: number
    net_in_kbps: number
    net_out_kbps: number
    power_state: 'on' | 'off' | 'suspended' | 'idle'
    power_consumption_watts: number
    powered_on_at?: string
    powered_off_at?: string
    uptime_seconds: number
    uptime_total_seconds: number
    load_average_1: number
    load_average_5: number
    load_average_15: number
    created_at: string
}

type MetricSummary = {
    value: string
    hits_today: number
    hits_last_week: number
    hits_total: number
}

type RequestLog = {
    metric: 'ip' | 'user_agent' | 'path'
    value: string
    path: string
    hits: number
    last_seen: string
    created_at: string
}

type DomainTPS = {
    name: string
    tps: number
}

type UAMetrics = {
    user_agent: string
    most_common_ip?: string
    top_paths: { path: string; hits: number }[]
}

type IPMetrics = {
    ip: string
    most_common_user_agent?: string
    top_paths: { path: string; hits: number }[]
}

type BlocklistEntry = {
    id?: number
    type: 'ip' | 'user_agent'
    value: string
    is_vpn?: boolean
    is_proxy?: boolean
    is_tor?: boolean
}

type HighestRole = {
    highest_role_id: string
    highest_role_name: string
    highest_role_priority: number
}

type Project = {
    alias: string
    owner: string
    editors: string[]
    file_count: number
    total_size: number
    last_updated: string
}

type VMDetails = {
    name: string
    status: string
    type: string
    architecture: string
    created: string
    last_used: string
    config_architecture: string
    config_image_architecture: string
    config_image_description: string
    config_image_label: string
    config_image_os: string
    config_image_release: string
    config_image_serial: string
    config_image_type: string
    config_image_version: string
    limits_cpu: string
    limits_memory: string
    volatile_base_image: string
    volatile_cloud_init_instance_id: string
    volatile_eth0_hwaddr: string
    volatile_last_state_power: string
    volatile_uuid: string
    volatile_uuid_generation: string
    volatile_vsock_id: string
    device_eth0_ipv4_address: string
    device_eth0_name: string
    device_eth0_network: string
    device_eth0_type: string
    ephemeral: string
    stateful: string
    description: string
    profiles: string[]
}

type ChatSession = {
    clientName: string
    conversationId: string
    messages: GPT_ChatMessage[]
    isSending: boolean
    metrics: GPT_ModelMetrics
}

type GptSocketMessage = {
    type?: string
    participants?: number
    client?: GPT_Client
    clients?: GPT_Client[]
    conversationId?: string
    clientName?: string | null
    delta?: string
    content?: string
    error?: string
    metrics?: GPT_ModelMetrics
    artifacts?: AIArtifact[]
    toolId?: string
    toolLabel?: string
    toolState?: 'running' | 'completed' | 'error'
    toolDetail?: string | null
}

type GPT_ChatMessage = {
    id: string
    role: GPT_ChatRole
    content: string
    pending?: boolean
    error?: boolean
}

type GPT_Client = {
    name: string
    displayName?: string | null
    modelId?: string | null
    profile?: string | null
    ram: GPT_RAM[]
    cpu: GPT_CPU[]
    gpu: GPT_GPU[]
    lanes?: GPT_ModelLaneMetrics[]
    power?: GPT_ModelPowerMetrics
    model: GPT_ModelMetrics
}

type GPT_ModelMetrics = {
    conversationId: string | null
    status: GPT_ModelStatus
    currentTokens: number
    maxTokens: number
    promptTokens: number
    generatedTokens: number
    contextTokens: number
    contextMaxTokens: number
    tps: number
    lastUpdated: string | null
    lastError: string | null
}

type AIWorkspaceKind = 'share' | 'repo'

type AIConversationMessage = {
    id: string
    role: 'user' | 'assistant' | 'tool'
    content: string
    pending?: boolean
    error?: boolean
    modelName?: string | null
    metadata?: Record<string, unknown>
    createdAt: string
    updatedAt?: string
}

type AIArtifact = {
    kind: 'screenshot' | 'log' | 'command' | 'http' | 'file' | 'link' | 'diff'
    title: string
    path?: string | null
    url?: string | null
    content?: string | null
    language?: string | null
    dataUrl?: string | null
}

type AIConversation = {
    id: string
    ownerId: string
    title: string
    preferredModel: string | null
    activeModel: string | null
    modelStrategy: 'auto' | 'pinned'
    workspaceId: string | null
    workspaceKind: AIWorkspaceKind | null
    shareIds: string[]
    workspaceMeta: Record<string, unknown>
    messages: AIConversationMessage[]
    collaboration: AIConversationCollaboration
    metrics: GPT_ModelMetrics
    archivedAt?: string | null
    createdAt: string
    updatedAt: string
}

type AIConversationCollaboration = {
    role: 'owner' | 'reviewer' | 'editor'
    canInvite: boolean
    seatLimit: number
    seatCount: number
    remainingSeats: number
    collaborators: AIConversationCollaborator[]
}

type AIConversationCollaborator = {
    userId: string
    name: string | null
    avatar: string | null
    role: 'reviewer' | 'editor'
    invitedBy: string | null
    createdAt: string
}

type AIStackType = 'nextjs_docker' | 'fastify_postgres' | 'fastify_worker_redis' | 'unknown'

type AIDeploymentAccessPolicy = 'owner_only' | 'collaborators' | 'public_preview'

type AIDeploymentEnvironment = 'staging' | 'production'

type AIReleaseStatus = 'current' | 'superseded' | 'failed' | 'rollback_target' | 'rolled_back' | 'restored_source'

type AIRelease = {
    id: string
    ownerId: string
    conversationId: string
    deploymentId: string | null
    vmName: string
    stackType: AIStackType
    accessPolicy: AIDeploymentAccessPolicy
    status: AIReleaseStatus
    previewUrl: string | null
    createdBy: string | null
    createdAt: string
    updatedAt: string
    notes: string | null
}

type AIUsageEventKind =
    | 'conversation_created'
    | 'message_written'
    | 'ai_run_completed'
    | 'ai_run_failed'
    | 'ai_run_platform_error'
    | 'browser_proof_completed'
    | 'build_minutes_recorded'
    | 'deploy_minutes_recorded'
    | 'cache_hit'
    | 'deployment_started'
    | 'release_recorded'
    | 'rollback_marked'
    | 'collaborator_invited'
    | 'collaborator_removed'

type AIUsageEvent = {
    ownerId: string
    ownerName: string | null
    actorId: string | null
    actorName: string | null
    conversationId: string | null
    deploymentId: string | null
    releaseId: string | null
    kind: AIUsageEventKind
    units: number
    metadata: Record<string, unknown>
    createdAt: string
}

type AIOwnershipSummary = {
    ownerIds: string[]
    repositoryOwnerIds: string[]
    vmOwnerIds: string[]
    ownedConversationCount: number
    sharedConversationCount: number
    collaboratorSeatCount: number
    repositoryCount: number
    externalRepositoryCount: number
    deploymentCount: number
    releaseCount: number
    externalVmCount: number
    usageEventCount24h: number
    usageUnitCount24h: number
    deploymentEventCount24h: number
    activeActorCount24h: number
    boundaryWarnings: string[]
    recentUsage: AIUsageEvent[]
}

type AIRuntimeStatus = 'offline' | 'idle' | 'preparing' | 'generating' | 'error'

type AIRuntimeToolState = 'running' | 'completed' | 'error'

type AIRuntimeToolRun = {
    conversationId: string | null
    label: string
    detail: string | null
    state: AIRuntimeToolState
    updatedAt: string
}

type AIRuntimeFailure = {
    source: 'model' | 'tool' | 'conversation'
    message: string
    conversationId: string | null
    updatedAt: string
}

type AIRuntimeWorkspace = {
    conversationId: string | null
    workspaceId: string | null
    workspaceKind: AIWorkspaceKind | null
    shareIds: string[]
    workspaceMeta: Record<string, unknown>
}

type AIRuntimeState = {
    status: AIRuntimeStatus
    connectedClientCount: number
    connectedModelNames: string[]
    activeConversationId: string | null
    activeWorkspace: AIRuntimeWorkspace
    lastToolRun: AIRuntimeToolRun | null
    lastFailure: AIRuntimeFailure | null
    lastUpdatedAt: string | null
}

type RateLimitScope = 'anonymous' | 'authenticated' | 'internal'

type RateLimitRule = {
    windowMs: number
    maxRequests: number
}

type RateLimitOverride = {
    id: string
    enabled: boolean
    method: string
    route: string
    scope: RateLimitScope
    windowMs: number
    maxRequests: number
}

type RateLimitSettings = {
    enabled: boolean
    defaults: Record<RateLimitScope, RateLimitRule>
    overrides: RateLimitOverride[]
    updatedAt: string | null
    updatedBy: string | null
}

type RateLimitRoute = {
    method: string
    route: string
}

type ApiKeyPeriodLimits = {
    perSecond: number | null
    perMinute: number | null
    perHour: number | null
    perDay: number | null
}

type ApiKeyTierPreset = 'starter' | 'growth' | 'business' | 'internal' | 'custom'

type ApiKeyTierDefinition = {
    id: ApiKeyTierPreset
    label: string
    description: string
    defaultLimits: ApiKeyPeriodLimits
}

type ApiKeyScopeRule = {
    id: string
    enabled: boolean
    method: string
    route: string
    limits: ApiKeyPeriodLimits
}

type ApiKeySummary = {
    id: string
    ownerId: string
    name: string
    tier: ApiKeyTierPreset | string
    description: string | null
    enabled: boolean
    keyPrefix: string
    createdAt: string
    updatedAt: string
    expiresAt: string | null
    lastUsedAt: string | null
    scopes: ApiKeyScopeRule[]
}

type ApiKeyCreateResult = {
    apiKey: ApiKeySummary
    secret: string
}

type AIWorkspaceBundle = {
    conversations: AIConversation[]
    repositories: AIImportedRepo[]
    deployments: AIDeployment[]
    releases: AIRelease[]
    deployQuota: AIDeployQuota | null
    ownershipSummary: AIOwnershipSummary | null
    runtimeState: AIRuntimeState | null
}

type AIImportedRepoFile = {
    path: string
    name: string
    content: string
}

type AISyncProgress = {
    syncedFiles: number
    totalFiles: number
    currentPath: string | null
}

type AIRepositorySyncEvent = {
    timestamp: string
    status: 'ready' | 'syncing' | 'error'
    source: 'import' | 'refresh' | 'sync'
    message: string
}

type AIImportedRepo = {
    id: string
    ownerId: string
    accessScope: 'owned' | 'shared_conversation'
    name: string
    fullName: string
    branch: string
    defaultBranch: string
    sourcePath: string
    sourceUrl: string
    authMode: 'public' | 'github_token'
    authHint: string | null
    syncStatus: 'ready' | 'syncing' | 'error'
    lastSyncedAt: string | null
    lastSyncError: string | null
    syncHistory: AIRepositorySyncEvent[]
    stackType: AIStackType
    stackReason: string | null
    stackSupported: boolean
    files: AIImportedRepoFile[]
    truncated: boolean
    importedAt: string
    credential: AIRepositoryCredentialSummary
}

type AIRepositoryCredentialSummary = {
    provider: 'github_pat'
    hasCredential: boolean
    tokenHint: string | null
    attachedAt: string | null
    lastUsedAt: string | null
    lastValidatedAt: string | null
}

type AIGitStatusFile = {
    path: string
    index: string
    workingTree: string
    selected: boolean
}

type AIGitStatus = {
    files: AIGitStatusFile[]
    branchSummary: string | null
}

type GPT_ModelStatus = 'idle' | 'preparing' | 'generating' | 'error'

type GPT_ChatRole = 'system' | 'user' | 'assistant'

type GPT_RAM = {
    name: string
    load: number
}

type GPT_CPU = {
    name: string
    load: number
}

type GPT_GPU = {
    name: string
    load: number
    memoryUsedMb?: number
    memoryTotalMb?: number
    powerDrawWatts?: number
    powerLimitWatts?: number
    temperatureC?: number
}

type GPT_ModelLaneMetrics = {
    id: string
    index: number
    url: string
    model?: string
    label?: string
    tier?: 'fast' | 'strong'
    gpuIndex: number
    gpuIndices?: number[]
    gpuName: string
    gpuLoad: number
    activeRequests: number
    maxRequests: number
    queuedRequests: number
    availableRequests: number
    contextMaxTokens: number
    memoryUsedMb: number
    memoryTotalMb: number
    powerDrawWatts: number
    powerLimitWatts: number
    temperatureC: number
}

type GPT_ModelPowerMetrics = {
    totalWatts: number
    monthlyKwh: number
    sampledAt: string
}

type GPT_Client = {
    name: string
    displayName?: string | null
    modelId?: string | null
    profile?: string | null
    ram: GPT_RAM[]
    cpu: GPT_CPU[]
    gpu: GPT_GPU[]
    lanes?: GPT_ModelLaneMetrics[]
    power?: GPT_ModelPowerMetrics
    model: GPT_ModelMetrics
}

type GPT_Client = {
    name: string
    displayName?: string | null
    modelId?: string | null
    profile?: string | null
    ram: GPT_RAM[]
    cpu: GPT_CPU[]
    gpu: GPT_GPU[]
    lanes?: GPT_ModelLaneMetrics[]
    power?: GPT_ModelPowerMetrics
    model: GPT_ModelMetrics
}

type GPT_ModelMetrics = {
    conversationId: string | null
    status: GPT_ModelStatus
    currentTokens: number
    maxTokens: number
    promptTokens: number
    generatedTokens: number
    contextTokens: number
    contextMaxTokens: number
    tps: number
    lastUpdated: string | null
    lastError: string | null
}

type VMConnectionDetails = {
    vmName: string
    vmIp: string
    username: string
    sshCommand: string | null
    certificateCount: number
    certificates: Certificate[]
}

type AgentVmMissingCapability = {
    key: 'remote_command_execution' | 'remote_file_write' | 'remote_terminal_stream' | 'remote_repo_sync'
    reason: string
}

type AgentVmTarget = {
    id: string
    name: string
    owner: string
    createdBy: string
    accessUsers: string[]
    status: string
    type: string
    architecture: string
    imageDescription: string
    createdAt: string
    lastUsedAt: string
    lastCheckedAt: string
    network: {
        ipv4: string
        sshHost: string | null
        sshUser: string
    }
    resources: {
        cpu: string
        memory: string
    }
    capabilities: {
        canView: boolean
        canConnect: boolean
        canManage: boolean
        canSyncAuthorizedKeys: boolean
        canExecuteRemoteCommands: boolean
        canWriteRemoteFiles: boolean
        supportedActions: Array<'start' | 'stop' | 'restart'>
        supportedConnectionMethods: Array<'ssh'>
        missingCapabilities: AgentVmMissingCapability[]
    }
    endpoints: {
        summary: string
        details: string
        connection: string
        syncAuthorizedKeys: string
        request: string
        actions: Partial<Record<'start' | 'stop' | 'restart', string>>
    }
    suggestedFlow: {
        selection: 'vm' | 'unavailable'
        connect: string | null
        prerequisites: string[]
        notes: string[]
    }
}

type AgentExecutionTarget = {
    id: string
    label: string
    kind: 'local_workspace' | 'vm'
    transport: 'local_process' | 'hanasand_vm_api'
    summary: string
    readiness: 'ready' | 'partial'
    trustBoundary: 'local' | 'remote'
    target: AgentVmTarget | {
        kind: 'local_workspace'
        supportedWorkspaceKinds: Array<'share' | 'repo'>
        supportedOperations: string[]
        missingCapabilities: string[]
    }
}

type AIDeploymentStatus = 'planned' | 'syncing' | 'building' | 'running' | 'healthchecking' | 'blocked' | 'failed'

type AIDeploymentStage = 'planned' | 'sync_access' | 'clone' | 'sync' | 'install' | 'build' | 'run' | 'healthcheck' | 'healthcheck_failed' | 'blocked' | 'manual_step_required'

type AIDeploymentEvent = {
    stage: AIDeploymentStage
    message: string
    timestamp: string
}

type AIDeployment = {
    id: string
    ownerId: string
    conversationId: string
    repositoryId: string | null
    workspaceKind: AIWorkspaceKind | null
    workspaceId: string | null
    vmName: string
    serviceName: string
    stackType: AIStackType
    accessPolicy: AIDeploymentAccessPolicy
    startedBy: string | null
    status: AIDeploymentStatus
    previewUrl: string | null
    healthcheckUrl: string | null
    events: AIDeploymentEvent[]
    failureReason: string | null
    createdAt: string
    updatedAt: string
    completedAt: string | null
}

type AIStackType = 'nextjs_docker' | 'fastify_postgres' | 'fastify_worker_redis' | 'unknown'

type AIDeploymentAccessPolicy = 'owner_only' | 'collaborators' | 'public_preview'

type AIDeploymentEnvironment = 'staging' | 'production'

type AIReleaseStatus = 'current' | 'superseded' | 'failed' | 'rollback_target' | 'rolled_back' | 'restored_source'

type AIRelease = {
    id: string
    ownerId: string
    conversationId: string
    deploymentId: string | null
    vmName: string
    stackType: AIStackType
    accessPolicy: AIDeploymentAccessPolicy
    status: AIReleaseStatus
    previewUrl: string | null
    createdBy: string | null
    createdAt: string
    updatedAt: string
    notes: string | null
}

type AIUsageEventKind =
    | 'conversation_created'
    | 'message_written'
    | 'ai_run_completed'
    | 'ai_run_failed'
    | 'ai_run_platform_error'
    | 'browser_proof_completed'
    | 'build_minutes_recorded'
    | 'deploy_minutes_recorded'
    | 'cache_hit'
    | 'deployment_started'
    | 'release_recorded'
    | 'rollback_marked'
    | 'collaborator_invited'
    | 'collaborator_removed'

type AIUsageEvent = {
    ownerId: string
    ownerName: string | null
    actorId: string | null
    actorName: string | null
    conversationId: string | null
    deploymentId: string | null
    releaseId: string | null
    kind: AIUsageEventKind
    units: number
    billableUnits?: number
    estimatedCostNok?: number
    billingMode?: string
    outcome?: string
    metadata: Record<string, unknown>
    createdAt: string
}

type AIOwnershipSummary = {
    ownerIds: string[]
    repositoryOwnerIds: string[]
    vmOwnerIds: string[]
    ownedConversationCount: number
    sharedConversationCount: number
    collaboratorSeatCount: number
    repositoryCount: number
    externalRepositoryCount: number
    deploymentCount: number
    releaseCount: number
    externalVmCount: number
    usageEventCount24h: number
    usageUnitCount24h: number
    deploymentEventCount24h: number
    activeActorCount24h: number
    boundaryWarnings: string[]
    recentUsage: AIUsageEvent[]
}

type AIDeployQuota = {
    used: number
    limit: number
    remaining: number
    windowMinutes: number
    resetsAt: string
    activeRunning: number
    maxRunning: number
    runningRemaining: number
    sharedAcrossCollaborators: boolean
}

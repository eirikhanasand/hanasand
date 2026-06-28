import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import indexHandler from './handlers/index.ts'
import loginHandler from './handlers/auth/login.ts'
import getUser from './handlers/user/get.ts'
import postUser from './handlers/user/post.ts'
import logoutHandler from './handlers/auth/logout.ts'
import postPwned from './handlers/pwned/post.ts'
import tokenHandler from './handlers/auth/token.ts'
import { completePasswordReset, requestPasswordReset, verifyPasswordResetCode } from './handlers/auth/passwordReset.ts'
import getRole from './handlers/roles/get.ts'
import postRole from './handlers/roles/post.ts'
import putRole from './handlers/roles/put.ts'
import deleteRole from './handlers/roles/delete.ts'
import getArticles, { getArticle } from './handlers/articles/get.ts'
import postArticle from './handlers/articles/post.ts'
import putArticle from './handlers/articles/put.ts'
import getTest from './handlers/test/get.ts'
import postTest from './handlers/test/post.ts'
import rerunTest from './handlers/test/rerun.ts'
import { getMyRecentTests, getRecentTests } from './handlers/test/list.ts'
import restartHandler from './handlers/restart/getRestart.ts'
import getRoles from './handlers/roles/getRoles.ts'
import getRolesForUser from './handlers/roles/getRolesForUser.ts'
import putUser from './handlers/user/putUser.ts'
import deleteUser from './handlers/user/deleteUser.ts'
import deleteSelf from './handlers/user/deleteSelf.ts'
import restoreSelf from './handlers/user/restoreSelf.ts'
import authorizedUserHandler from './handlers/user/fullUser.ts'
import getUsers from './handlers/user/getUsers.ts'
import deleteArticle from './handlers/articles/delete.ts'
import getThought from './handlers/thoughts/get.ts'
import getThoughts from './handlers/thoughts/getThoughts.ts'
import postThought from './handlers/thoughts/post.ts'
import putThought from './handlers/thoughts/put.ts'
import deleteThought from './handlers/thoughts/delete.ts'
import getRandomThought from './handlers/thoughts/getRandomThought.ts'
import postThoughtByTitle from './handlers/thoughts/postThoughtByTitle.ts'
import assignRole from './handlers/roles/assignRole.ts'
import unassignRole from './handlers/roles/unassignRole.ts'
import putSelf from './handlers/user/putSelf.ts'
import getVisits from './handlers/test/getVisits.ts'
import getCertificate from './handlers/certificates/get.ts'
import postCertificate from './handlers/certificates/post.ts'
import putCertificate from './handlers/certificates/put.ts'
import deleteCertificate from './handlers/certificates/delete.ts'
import getUserCertificates from './handlers/certificates/getUserCertificates.ts'
import getVM from './handlers/vms/get.ts'
import postVM from './handlers/vms/post.ts'
import getAccessibleVMs from './handlers/vms/getAccessibleVMs.ts'
import deleteVM from './handlers/vms/delete.ts'
import getVMMetrics from './handlers/vms/metrics/get.ts'
import postVMMetrics from './handlers/vms/metrics/post.ts'
import putVMMetrics from './handlers/vms/metrics/put.ts'
import deleteVMMetrics from './handlers/vms/metrics/delete.ts'
import getVMNames from './handlers/vms/getNames.ts'
import postVMDetails from './handlers/vms/postVMDetails.ts'
import deleteVMs from './handlers/vms/deleteVMs.ts'
import shutdownVMs from './handlers/vms/shutdown.ts'
import getVMDetails from './handlers/vms/getVMDetails.ts'
import getVmConnection from './handlers/vms/getConnection.ts'
import getAgentTarget from './handlers/vms/getAgentTarget.ts'
import getAgentTargets from './handlers/vms/getAgentTargets.ts'
import postAgentTargetSyncAccess from './handlers/vms/postAgentTargetSyncAccess.ts'
import postAgentTargetRequest from './handlers/vms/postAgentTargetRequest.ts'
import stopVms from './handlers/vms/stopVms.ts'
import putVmHostFeatures from './handlers/vms/putHostFeatures.ts'
import postVmFailover from './handlers/vms/postFailover.ts'
import getMetrics from './handlers/metrics/getMetrics.ts'
import getDocker from './handlers/docker/getDocker.ts'
import vmAction from './handlers/vms/action.ts'
import getStatus from './handlers/status/get.ts'
import ingestStatus from './handlers/status/ingest.ts'
import deactivateUser from './handlers/user/deactivateUser.ts'
import { getSessions, revokeSession, revokeSessions } from './handlers/auth/sessions.ts'
import httpRequestTool from './handlers/tools/httpRequest.ts'
import browserTaskTool from './handlers/tools/browserTask.ts'
import getExecutionTargets from './handlers/tools/getExecutionTargets.ts'
import aiTool from './handlers/tools/ai.ts'
import { cancelVerificationJob, getVerificationJob, getVerificationJobs, postVerificationJob } from './handlers/tools/verificationJobs.ts'
import { getLogs, getLogServices, getRealtimeLogs } from './handlers/logs/get.ts'
import ingestLog from './handlers/logs/ingest.ts'
import {
    getLegacyBlocklistOverview,
    getLegacyTrafficDomains,
    getLegacyTrafficIps,
    getLegacyTrafficMetrics,
    getLegacyTrafficRecent,
    getLegacyTrafficRecords,
    getLegacyTrafficSummary,
    getLegacyTrafficTps,
    getLegacyTrafficUserAgents,
} from './handlers/traffic/legacy.ts'
import getAiWorkspace from './handlers/ai/getWorkspace.ts'
import getAiRuntime from './handlers/ai/getRuntime.ts'
import postAiConversation from './handlers/ai/postConversation.ts'
import putAiConversation from './handlers/ai/putConversation.ts'
import deleteAiConversation from './handlers/ai/deleteConversation.ts'
import upsertAiMessage from './handlers/ai/upsertMessage.ts'
import postAiRepository from './handlers/ai/postRepository.ts'
import getAiModels from './handlers/ai/getModels.ts'
import importRepository from './handlers/ai/importRepository.ts'
import { getGitWorkspaceStatus, postGitWorkspaceCommit, postGitWorkspacePull, postGitWorkspacePush } from './handlers/ai/gitWorkspace.ts'
import putRepositoryCredential from './handlers/ai/putRepositoryCredential.ts'
import deleteRepositoryCredential from './handlers/ai/deleteRepositoryCredential.ts'
import { getAiDeployments, postAiDeployment } from './handlers/ai/deployments.ts'
import { getAiEconomics } from './handlers/ai/economics.ts'
import { deleteAiConversationCollaborator, postAiConversationCollaborator } from './handlers/ai/collaborators.ts'
import { getAiReleases, getAiReleaseSupportBundle, postAiRollback } from './handlers/ai/releases.ts'
import { getAiPreview } from './handlers/ai/preview.ts'
import getMailOverview from './handlers/mail/getOverview.ts'
import postSendMail from './handlers/mail/postSend.ts'
import postMailAction from './handlers/mail/postAction.ts'
import postMailbox from './handlers/mail/postMailbox.ts'
import postMailFilter from './handlers/mail/postFilter.ts'
import deleteMailFilter from './handlers/mail/deleteFilter.ts'
import getMailBlob from './handlers/mail/getBlob.ts'
import { deleteNote, getNote, getNotes, postNote, putNote } from './handlers/notes.ts'
import { downloadAppUpdate, downloadNamedAppUpdate, getAppUpdate, getTauriAppUpdate } from './handlers/app/get.ts'
import getRateLimitSettingsHandler from './handlers/rateLimit/getSettings.ts'
import putRateLimitSettingsHandler from './handlers/rateLimit/putSettings.ts'
import getApiKeysHandler from './handlers/rateLimit/getApiKeys.ts'
import postApiKeyHandler from './handlers/rateLimit/postApiKey.ts'
import putApiKeyHandler from './handlers/rateLimit/putApiKey.ts'
import deleteApiKeyHandler from './handlers/rateLimit/deleteApiKey.ts'
import { getDesktopAgentPresence, postDesktopAgentPresence } from './handlers/desktopAgent/presence.ts'
import { deleteAutomation, getAutomation, getAutomations, postAutomation, postAutomationRunNow, putAutomation } from './handlers/automations.ts'
import { getSystemCronJobs, putSystemCronJob } from './handlers/systemCron.ts'
import { getImpersonationCurrent, getImpersonationEvents, startImpersonation, stopImpersonation } from './handlers/impersonation.ts'
import {
    getAdminAuditEvents,
    getSupportAccessRecoveryApprovals,
    getSupportInspection,
    getSupportOrganization,
    getSupportUser,
    postSupportAccessRecovery,
    postSupportAccessRecoveryApprove,
    postSupportAccessRecoveryDeny,
    postSupportOrganizationInvite,
} from './handlers/adminSupport.ts'
import { deleteProject, deleteShare, getProject, getShare, getShareTree, getUserProjects, getUserShares, postShare, putShare, toggleShareLock } from './handlers/share.ts'
import postTiSearch, { postTiSearchBatch } from './handlers/ti/search.ts'
import { getTiEnrichment, postTiEnrichmentRun } from './handlers/ti/enrichment.ts'
import { getTiPipeline, postTiPipelineRun } from './handlers/ti/pipeline.ts'
import {
    deleteOrganizationWatchlist,
    deleteOrganizationMember,
    getOrganization,
    getOrganizationAlertReadiness,
    getOrganizationInvites,
    getOrganizationMembers,
    getOrganizationSettings,
    getOrganizations,
    getOrganizationWatchlists,
    postOrganization,
    postOrganizationInviteAccept,
    postOrganizationInvites,
    postOrganizationOwnershipTransfer,
    postOrganizationWatchlist,
    putOrganizationSettings,
} from './handlers/organizations.ts'
import {
    deleteDwmWebhookDestination,
    getDwmWebhookDeliveries,
    getDwmWebhookDestinations,
    postDwmWebhookDelivery,
    postDwmWebhookDestination,
    postDwmWebhookDestinationTest,
    putDwmWebhookDestination,
} from './handlers/dwm/webhooks.ts'

/**
 * Defines the routes available in the API.
 *
 * @param fastify Fastify Instance
 * @param _ Fastify Plugin Options
 */
export default async function apiRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    void options

    // Index handler
    fastify.get('/', indexHandler)
    fastify.get('/health', async () => ({ ok: true, service: 'hanasand_api' }))

    // Desktop app update feed
    fastify.get('/app', getAppUpdate)
    fastify.get('/app/:target/:version', getTauriAppUpdate)
    fastify.get('/app/download', downloadAppUpdate)
    fastify.get('/app/download/:name', downloadNamedAppUpdate)

    // Auth handlers
    fastify.get('/auth/logout/:id', logoutHandler)
    fastify.get('/auth/token/:id', tokenHandler)
    fastify.get('/auth/sessions', getSessions)
    fastify.post('/auth/login/:id', loginHandler)
    fastify.post('/auth/password-reset/request', requestPasswordReset)
    fastify.post('/auth/password-reset/verify', verifyPasswordResetCode)
    fastify.post('/auth/password-reset/complete', completePasswordReset)
    fastify.post('/auth/sessions/revoke', revokeSessions)
    fastify.delete('/auth/sessions/:token_id', revokeSession)

    // Impersonation
    fastify.get('/impersonation', getImpersonationCurrent)
    fastify.post('/impersonation/start', startImpersonation)
    fastify.delete('/impersonation', stopImpersonation)
    fastify.get('/impersonation/events', getImpersonationEvents)
    fastify.get('/admin/audit-events', getAdminAuditEvents)
    fastify.get('/admin/support/inspect', getSupportInspection)
    fastify.get('/admin/support/users/:id', getSupportUser)
    fastify.get('/admin/support/organizations/:id', getSupportOrganization)
    fastify.get('/admin/support/access-recovery', getSupportAccessRecoveryApprovals)
    fastify.post('/admin/support/organizations/:id/invites', postSupportOrganizationInvite)
    fastify.post('/admin/support/organizations/:id/access-recovery', postSupportAccessRecovery)
    fastify.post('/admin/support/access-recovery/:requestId/approve', postSupportAccessRecoveryApprove)
    fastify.post('/admin/support/access-recovery/:requestId/deny', postSupportAccessRecoveryDeny)

    // User handlers
    fastify.get('/users', getUsers)
    fastify.get('/user/:id', getUser)
    fastify.get('/user/full/:id', authorizedUserHandler)
    fastify.post('/user', postUser)
    fastify.put('/user/:id', putUser)
    fastify.put('/user/:id/active', deactivateUser)
    fastify.put('/user/self', putSelf)
    fastify.post('/user/restore', restoreSelf)
    fastify.delete('/user/:id', deleteUser)
    fastify.delete('/user/self', deleteSelf)

    // Roles handlers
    fastify.get('/role/:id', getRole)
    fastify.get('/roles', getRoles)
    fastify.get('/roles/user/:id', getRolesForUser)
    fastify.post('/role', postRole)
    fastify.post('/role/assign/:id', assignRole)
    fastify.post('/role/unassign/:id', unassignRole)
    fastify.put('/role/:id', putRole)
    fastify.delete('/role/:id', deleteRole)

    // Pwned handler
    fastify.post('/pwned', postPwned)

    // Threat intelligence
    fastify.post('/ti/search', postTiSearch)
    fastify.post('/ti/search/batch', postTiSearchBatch)
    fastify.get('/ti/enrichment', getTiEnrichment)
    fastify.post('/ti/enrichment/run', postTiEnrichmentRun)
    fastify.get('/ti/pipeline', getTiPipeline)
    fastify.post('/ti/pipeline/run', postTiPipelineRun)

    // DWM customer notifications
    fastify.get('/dwm/webhook-destinations', getDwmWebhookDestinations)
    fastify.post('/dwm/webhook-destinations', postDwmWebhookDestination)
    fastify.put('/dwm/webhook-destinations/:id', putDwmWebhookDestination)
    fastify.delete('/dwm/webhook-destinations/:id', deleteDwmWebhookDestination)
    fastify.post('/dwm/webhook-destinations/:id/test', postDwmWebhookDestinationTest)
    fastify.get('/dwm/webhook-deliveries', getDwmWebhookDeliveries)
    fastify.post('/dwm/webhook-deliveries', postDwmWebhookDelivery)

    // Article handlers
    fastify.get('/articles', getArticles)
    fastify.get('/article/:id', getArticle)
    fastify.post('/article/:id', postArticle)
    fastify.put('/article/:id', putArticle)
    fastify.delete('/article/:id', deleteArticle)

    // Test handlers
    fastify.get('/tests/recent', getRecentTests)
    fastify.get('/tests/mine', getMyRecentTests)
    fastify.get('/test/:id', getTest)
    fastify.get('/test/visits/:id', getVisits)
    fastify.post('/test', postTest)
    fastify.post('/test/:id/rerun', rerunTest)

    // Restart handler
    fastify.get('/restart/:id', restartHandler)

    // Thought handlers
    fastify.get('/thoughts', getThoughts)
    fastify.get('/thought/random', getRandomThought)
    fastify.get('/thought/:id', getThought)
    fastify.post('/thoughts', postThought)
    fastify.post('/thought/title', postThoughtByTitle)
    fastify.put('/thought/:id', putThought)
    fastify.delete('/thought/:id', deleteThought)

    // Notes
    fastify.get('/notes', getNotes)
    fastify.get('/notes/:id', getNote)
    fastify.post('/notes', postNote)
    fastify.put('/notes/:id', putNote)
    fastify.delete('/notes/:id', deleteNote)

    // Organizations
    fastify.get('/organizations', getOrganizations)
    fastify.post('/organizations', postOrganization)
    fastify.post('/organizations/invites/:inviteId/accept', postOrganizationInviteAccept)
    fastify.get('/organizations/:id/invites', getOrganizationInvites)
    fastify.post('/organizations/:id/invites', postOrganizationInvites)
    fastify.get('/organizations/:id/members', getOrganizationMembers)
    fastify.delete('/organizations/:id/members/:userId', deleteOrganizationMember)
    fastify.post('/organizations/:id/ownership-transfer', postOrganizationOwnershipTransfer)
    fastify.get('/organizations/:id/settings', getOrganizationSettings)
    fastify.put('/organizations/:id/settings', putOrganizationSettings)
    fastify.get('/organizations/:id/alert-readiness', getOrganizationAlertReadiness)
    fastify.get('/organizations/:id/watchlists', getOrganizationWatchlists)
    fastify.post('/organizations/:id/watchlists', postOrganizationWatchlist)
    fastify.delete('/organizations/:organizationId/watchlists/:itemId', deleteOrganizationWatchlist)
    fastify.get('/organizations/:id', getOrganization)

    // Share workspaces
    fastify.get('/share/tree/:id', getShareTree)
    fastify.get('/share/user/:id', getUserShares)
    fastify.get('/share/lock/:id', toggleShareLock)
    fastify.get('/share/:id', getShare)
    fastify.post('/share', postShare)
    fastify.put('/share/:id', putShare)
    fastify.delete('/share/:id', deleteShare)
    fastify.get('/projects/user/:id', getUserProjects)
    fastify.get('/project/:alias', getProject)
    fastify.delete('/project/:alias', deleteProject)

    // Certificates
    fastify.get('/certificates/:id', getCertificate)
    fastify.get('/certificates/user/:id', getUserCertificates)
    fastify.post('/certificates', postCertificate)
    fastify.put('/certificates/:id', putCertificate)
    fastify.delete('/certificates/:id', deleteCertificate)

    // Vms
    fastify.get('/vms/agent/targets', getAgentTargets)
    fastify.get('/vm/metrics', getVMMetrics)
    fastify.get('/vm/metrics/:id', getVMMetrics)
    fastify.post('/vm/metrics', postVMMetrics)
    fastify.put('/vm/metrics/:id', putVMMetrics)
    fastify.delete('/vm/metrics/:id', deleteVMMetrics)
    fastify.get('/vm/:id/agent-target', getAgentTarget)
    fastify.post('/vm/:id/agent-target/sync-access', postAgentTargetSyncAccess)
    fastify.post('/vm/:id/request', postAgentTargetRequest)
    fastify.get('/vm/:id', getVM)
    fastify.get('/vm/:id/connection', getVmConnection)
    fastify.put('/vm/:id/host-features', putVmHostFeatures)
    fastify.post('/vm/:id/failover', postVmFailover)
    fastify.get('/vm/details/:name', getVMDetails)
    fastify.get('/vms', getVM)
    fastify.get('/vms/stop', stopVms)
    fastify.get('/vms/names', getVMNames)
    fastify.get('/vms/:user', getVM)
    fastify.get('/vms/access/:user', getAccessibleVMs)
    fastify.post('/vm', postVM)
    fastify.post('/vm/:id/:action', vmAction)
    fastify.post('/vm/details', postVMDetails)
    fastify.post('/vms/shutdown', shutdownVMs)
    fastify.post('/vms/stop', stopVms)
    fastify.delete('/vm/:id', deleteVM)
    fastify.delete('/vms', deleteVMs)

    // Server metrics
    fastify.get('/metrics', getMetrics)
    fastify.get('/status', getStatus)
    fastify.post('/status/ingest', ingestStatus)

    // Legacy CDN/Queenbee traffic read compatibility
    fastify.get('/traffic/summary', getLegacyTrafficSummary)
    fastify.get('/traffic/recent', getLegacyTrafficRecent)
    fastify.get('/traffic/tps', getLegacyTrafficTps)
    fastify.get('/traffic/ips', getLegacyTrafficIps)
    fastify.get('/traffic/uas', getLegacyTrafficUserAgents)
    fastify.get('/traffic/domains', getLegacyTrafficDomains)
    fastify.get('/traffic/metrics', getLegacyTrafficMetrics)
    fastify.get('/traffic/records', getLegacyTrafficRecords)
    fastify.get('/blocklist/overview', getLegacyBlocklistOverview)

    // Desktop agent direct-connect discovery
    fastify.get('/desktop-agent/presence', getDesktopAgentPresence)
    fastify.post('/desktop-agent/presence', postDesktopAgentPresence)

    // Docker stats
    fastify.get('/docker', getDocker)
    fastify.get('/system/cron', getSystemCronJobs)
    fastify.put('/system/cron/:id', putSystemCronJob)

    // Rate limiting
    fastify.get('/rate-limit/settings', getRateLimitSettingsHandler)
    fastify.put('/rate-limit/settings', putRateLimitSettingsHandler)
    fastify.get('/rate-limit/keys', getApiKeysHandler)
    fastify.post('/rate-limit/keys', postApiKeyHandler)
    fastify.put('/rate-limit/keys/:id', putApiKeyHandler)
    fastify.delete('/rate-limit/keys/:id', deleteApiKeyHandler)

    // Coding tools
    fastify.get('/tools/execution-targets', getExecutionTargets)
    fastify.post('/tools/http/request', httpRequestTool)
    fastify.post('/tools/browser/task', browserTaskTool)
    fastify.get('/tools/verification-jobs', getVerificationJobs)
    fastify.post('/tools/verification-jobs', postVerificationJob)
    fastify.get('/tools/verification-jobs/:id', getVerificationJob)
    fastify.post('/tools/verification-jobs/:id/cancel', cancelVerificationJob)
    fastify.post('/tools/ai', aiTool)

    // Agent automations
    fastify.get('/automations', getAutomations)
    fastify.post('/automations', postAutomation)
    fastify.get('/automations/:id', getAutomation)
    fastify.put('/automations/:id', putAutomation)
    fastify.delete('/automations/:id', deleteAutomation)
    fastify.post('/automations/:id/run', postAutomationRunNow)

    // AI workspace
    fastify.get('/ai/workspace', getAiWorkspace)
    fastify.get('/ai/runtime', getAiRuntime)
    fastify.get('/ai/economics', getAiEconomics)
    fastify.get('/ai/models', getAiModels)
    fastify.get('/ai/previews/:id', getAiPreview)
    fastify.get('/ai/previews/:id/*', getAiPreview)
    fastify.post('/ai/import-repository', importRepository)
    fastify.post('/ai/conversations', postAiConversation)
    fastify.put('/ai/conversations/:id', putAiConversation)
    fastify.delete('/ai/conversations/:id', deleteAiConversation)
    fastify.post('/ai/conversations/:id/collaborators', postAiConversationCollaborator)
    fastify.delete('/ai/conversations/:id/collaborators/:userId', deleteAiConversationCollaborator)
    fastify.put('/ai/conversations/:id/messages', upsertAiMessage)
    fastify.post('/ai/repositories', postAiRepository)
    fastify.get('/ai/repositories/:id/git/status', getGitWorkspaceStatus)
    fastify.post('/ai/repositories/:id/git/pull', postGitWorkspacePull)
    fastify.post('/ai/repositories/:id/git/commit', postGitWorkspaceCommit)
    fastify.post('/ai/repositories/:id/git/push', postGitWorkspacePush)
    fastify.get('/ai/deployments', getAiDeployments)
    fastify.post('/ai/deployments', postAiDeployment)
    fastify.get('/ai/releases', getAiReleases)
    fastify.get('/ai/releases/:id/support-bundle', getAiReleaseSupportBundle)
    fastify.post('/ai/releases/:id/rollback', postAiRollback)
    fastify.put('/ai/repositories/:id/credentials/github', putRepositoryCredential)
    fastify.delete('/ai/repositories/:id/credentials/github', deleteRepositoryCredential)

    // Mail
    fastify.get('/mail/overview', getMailOverview)
    fastify.post('/mail/send', postSendMail)
    fastify.post('/mail/mailboxes', postMailbox)
    fastify.post('/mail/message/:id/action', postMailAction)
    fastify.post('/mail/filters', postMailFilter)
    fastify.delete('/mail/filters/:id', deleteMailFilter)
    fastify.get('/mail/blob/:mailboxUser/:blobId/:name', getMailBlob)

    // Logs
    fastify.get('/logs', getLogs)
    fastify.get('/logs/services', getLogServices)
    fastify.get('/logs/realtime', getRealtimeLogs)
    fastify.post('/logs/ingest', ingestLog)
}

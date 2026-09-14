import { automationReadScope } from './automationAccess.ts'

// Resource links are assigned by server administrators, never inferred from names in case text.
// Compare the recorded target: repointing a monitor must not share a different host's cases.
export function monitoringCaseReadScope(alias: string, admin: string, viewer: string) {
    return `(${automationReadScope(alias, admin, viewer)} OR (${alias}.organization_id IS NULL AND EXISTS (
        SELECT 1 FROM monitoring_case_vms resource JOIN vms vm ON vm.name = resource.vm_name
        WHERE resource.automation_id = ${alias}.id AND resource.target_url = ${alias}.target_url
            AND vm.deleted_at IS NULL
            AND vm_user_has_access(vm.name, ${viewer})
    )))`
}

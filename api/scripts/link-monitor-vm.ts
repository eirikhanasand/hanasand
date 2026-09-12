import run from '../src/utils/db.ts'

// Run on the server after verifying the monitor's target belongs to the VM.
const [automationId, vmName] = process.argv.slice(2)
if (!automationId || !vmName) throw new Error('Usage: bun scripts/link-monitor-vm.ts MONITOR_ID VM_NAME')
try {
    const result = await run(`INSERT INTO monitoring_case_vms (automation_id, vm_name, target_url)
        SELECT a.id, v.name, a.target_url FROM agent_automations a CROSS JOIN vms v
        WHERE a.id = $1 AND v.name = $2 AND v.deleted_at IS NULL
            AND a.organization_id IS NULL AND a.target_url IS NOT NULL
        ON CONFLICT (automation_id, vm_name) DO UPDATE SET target_url = EXCLUDED.target_url
        RETURNING automation_id, vm_name`, [automationId, vmName])
    if (!result.rows.length) throw new Error('Monitor or active VM not found, or monitor belongs to an organization.')
    console.log(JSON.stringify(result.rows[0]))
    process.exit(0)
} catch (error) {
    console.error(error instanceof Error ? error.message : 'Could not link monitor to VM')
    process.exit(1)
}

import { Crown, Pencil, Shield, Trash2 } from 'lucide-react'

export default function DashboardRole({ role, editable, disabled, onEdit, onDelete }: {
    role: Role
    editable: boolean
    disabled: boolean
    onEdit: () => void
    onDelete: () => void
}) {
    return (
        <div className='flex items-start justify-between gap-3 rounded-lg border border-ui-border/8 bg-ui-panel/3 px-3 py-3'>
            <div className='flex min-w-0 items-center gap-3'>
                <div className='grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ui-border/10 bg-ui-panel/5'>
                    <Shield className='h-4 w-4 text-ui-warning' />
                </div>
                <div className='min-w-0'>
                    <div className='wrap-break-word text-sm font-medium text-ui-text/88'>{role.name}</div>
                    {role.description && <div className='wrap-break-word whitespace-normal text-xs text-ui-text/45'>{role.description}</div>}
                </div>
            </div>
            <div className='flex shrink-0 flex-wrap items-center justify-end gap-1'>
                <span className='px-1 text-sm text-ui-text/65' aria-label={`Priority ${role.priority}`}>
                    {role.priority === 0 ? <Crown className='h-4 w-4 text-ui-warning' /> : role.priority}
                </span>
                {editable && <>
                    <button type='button' disabled={disabled} aria-label={`Edit ${role.name}`} title='Edit role' onClick={onEdit} className='rounded p-2 text-ui-muted hover:bg-ui-raised hover:text-ui-text disabled:opacity-50'><Pencil className='h-4 w-4' /></button>
                    <button type='button' disabled={disabled} aria-label={`Delete ${role.name}`} title='Delete role' onClick={onDelete} className='rounded p-2 text-ui-muted hover:bg-ui-raised hover:text-ui-danger disabled:opacity-50'><Trash2 className='h-4 w-4' /></button>
                </>}
            </div>
        </div>
    )
}

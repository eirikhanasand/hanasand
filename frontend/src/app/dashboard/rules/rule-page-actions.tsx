import Button from '@/components/misc/button'

type RulePageActionsProps = {
    showCreate: boolean
    showImports: boolean
    onToggleCreate: () => void
    onToggleImports: () => void
}

export default function RulePageActions({ showCreate, showImports, onToggleCreate, onToggleImports }: RulePageActionsProps) {
    return (
        <div className='flex max-w-full flex-wrap items-center gap-3'>
            <Button
                text='Create'
                variant='ghost'
                className='h-10 px-4 text-sm font-semibold'
                aria-expanded={showCreate}
                aria-controls='event-rule-create'
                onClick={onToggleCreate}
            />
            <Button
                text='Import'
                variant='ghost'
                className='h-10 px-4 text-sm font-semibold'
                aria-expanded={showImports}
                aria-controls='event-rule-imports'
                onClick={onToggleImports}
            />
            <Button
                text='Cases'
                path='/cases'
                variant='ghost'
                className='h-10 px-4 text-sm font-semibold'
            />
        </div>
    )
}

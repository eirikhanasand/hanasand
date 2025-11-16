import DashboardRole from './dashboardRole'

export default async function Roles({ roles }: { roles: Role[] }) {
    return (
        <div className='grid w-full p-2 outline-1 outline-dark h-fit rounded-lg gap-2'>
            <div className='flex justify-between'>
                <h1 className='font-semibold text-lg self-center'>Roles</h1>
                <h1 className='self-center text-gray-500'>Priority</h1>
            </div>
            {(roles as Role[]).map((role) => <DashboardRole key={role.id} role={role} />)}
        </div>
    )
}

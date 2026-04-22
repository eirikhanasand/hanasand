import { redirect } from 'next/navigation'

export default async function BackupPage() {
    redirect('/dashboard/db')
}

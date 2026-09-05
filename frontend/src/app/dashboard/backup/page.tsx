import { redirect } from 'next/navigation'

export default async function BackupPage() {
    redirect('/db/backups')
}

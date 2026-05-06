import ErrorNotice from '@/components/error/errorNotice'

export default function ArticleNotification({ message }: { message: string }) {
    return <ErrorNotice message={message} className='max-w-3xl' />
}

type ArticleProps = {
    title: string
    description: string
    meta: string
}

export default function Featured() {
    const images = [
        {
            title: 'Library Safety Manager',
            image: '/images/assets/abstract.jpg',
            description: 'Package malware checks for Artifactory flows.',
            meta: 'Security tooling'
        },
        {
            title: 'React Native Event Management Application',
            image: '/images/assets/art.jpg',
            description: 'A mobile-first event workflow for planning, scanning, and managing attendees.',
            meta: 'Mobile application'
        },
        {
            title: 'Discord Bot for organization and IaC management',
            image: '/images/assets/city.jpg',
            description: 'Operational chat commands for organization, infrastructure, and deployment routines.',
            meta: 'Automation'
        }
    ]

    return (
        <div className='p-4 md:p-16'>
            <h1 className='text-2xl font-semibold text-ui-text'>Featured Projects</h1>
            <div className='mt-4 grid place-items-center gap-4 md:grid-cols-2 md:grid-rows-2'>
                {images.map((image) => <Project
                    key={image.title}
                    title={image.title}
                    description={image.description}
                    meta={image.meta}
                />)}
            </div>
        </div>
    )
}

function Project({ title, description, meta }: ArticleProps) {
    return (
        <article className='h-full w-full rounded-lg border border-ui-border bg-ui-panel p-5 text-ui-text shadow-sm transition-colors hover:bg-ui-raised'>
            <div className='grid gap-3'>
                <p className='w-fit rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-[11px] font-medium uppercase tracking-normal text-ui-muted'>{meta}</p>
                <h2 className='text-lg font-semibold text-ui-text'>{title}</h2>
                <p className='text-sm leading-6 text-ui-muted'>{description}</p>
            </div>
        </article>
    )
}

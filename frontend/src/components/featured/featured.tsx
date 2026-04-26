type ArticleProps = {
    title: string
    description: string
}

export default function Featured() {
    const images = [
        {
            title: 'Library Safety Manager',
            image: '/images/assets/abstract.jpg',
            description: 'Package malware checks for Artifactory flows. Source: <a href=\'https://github.com/eirikhanasand/lsm\' target=\'_blank\' rel=\'noopener noreferrer\' style=\'color:rgb(89, 89, 255); position: relative; top: 0.5px;\'>github.com/eirikhanasand/lsm</a>.'
        },
        {
            title: 'React Native Event Management Application',
            image: '/images/assets/art.jpg',
            description: 'React Native event management app.'
        },
        {
            title: 'Discord Bot for organization and IaC management',
            image: '/images/assets/city.jpg',
            description: 'Discord workflows for organization and infrastructure tasks.'
        }
    ]

    return (
        <div className='p-4 md:p-16'>
            <h1 className='text-foreground text-2xl'>Featured Projects</h1>
            <div className='grid md:grid-rows-2 md:grid-cols-2 gap-8 place-items-center mt-4'>
                {images.map((image) => <Project
                    key={image.title}
                    title={image.title}
                    description={image.description}
                />)}
            </div>
        </div>
    )
}

function Project({ title, description }: ArticleProps) {
    return (
        <article className='outline-1 outline-dark cursor-pointer hover:scale-[1.03] w-full h-fit md:h-full pb-2 md:pb-0 overflow-hidden rounded-3xl'>
            {/* <article className='bg-dark w-full h-[55vh] overflow-hidden rounded-3xl'> */}
            {/* <Image className='w-full h-[62%] object-cover' src={image} alt={title} width={800} height={450} /> */}
            <div className='m-5 text-foreground grid gap-2'>
                <h1>{title}</h1>
                <p className='text-gray-500' dangerouslySetInnerHTML={{ __html: description }} />
                <h1 className='text-red-400'>Coming soon.</h1>
                {/* <h1 className='text-foreground text-lg'>See more &#x2192;</h1> */}
            </div>
        </article>
    )
}

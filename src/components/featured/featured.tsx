import Image from 'next/image'

type ArticleProps = {
    title: string
    description: string
    image: string
}

export default function Featured() {
    const images = [
        {
            title: "Library Safety Manager",
            image: "/images/assets/abstract.jpg",
            description: "Library Safety Manager for Artifactory. Checks that your packages do not contain malware before downloading them. We check against the open source OSV database. This project is not ready yet, but you can find it on <a href='https://github.com/eirikhanasand/lsm' target='_blank' rel='noopener noreferrer' style='color:rgb(89, 89, 255); position: relative; top: 0.5px;'>https://github.com/eirikhanasand/lsm</a>. Please let me know if you try it, feedback is much appreaciated and will help prioritize what to focus on going forward."
        },
        {
            title: "React Native Event Management Application",
            image: "/images/assets/art.jpg",
            description: "React Native application for event management, more about this another time : )"
        },
        {
            title: "Discord Bot for organization and IaC management",
            image: "/images/assets/city.jpg",
            description: "Kinda crazy project atp ngl but the structure is perfect for scaling so I just keep adding"
        },
        {
            title: "well this is awkward, im not sure what project would fit here... hmm",
            image: "/images/assets/project.jpg",
            description: ""
            // description: "Laboris et do proident ad cupidatat duis. Anim adipisicing velit laborum velit non pariatur laborum ullamco velit ullamco est adipisicing. Velit do non duis exercitation ea nisi ipsum incididunt ipsum laboris amet elit in. Est exercitation voluptate labore quis et. "
        }
    ]

    return (
        <div className="bg-normal p-16">
            <h1 className="text-foreground text-2xl">Featured Projects</h1>
            <div className="grid grid-rows-2 grid-cols-2 gap-8 place-items-center mt-4">
                {images.map((image) => <Article
                    key={image.title}
                    image={image.image} 
                    title={image.title} 
                    description={image.description}
                />)}
            </div>
        </div>
    )
}

function Article({title, description, image}: ArticleProps) {
    console.log(image)
    return (
        <article className='bg-dark w-full h-[22vh] overflow-hidden rounded-3xl'>
        {/* <article className='bg-dark w-full h-[55vh] overflow-hidden rounded-3xl'> */}
            {/* <Image className="w-full h-[62%] object-cover" src={image} alt={title} width={800} height={450} /> */}
            <div className='mx-5 mt-5 text-foreground'>
                <h1>{title}</h1>
                {/* @ts-ignore */}
                <p dangerouslySetInnerHTML={{__html: description}} />
                <h1 className='text-red-400'>This section is coming soon! &lt;3</h1>
                {/* <h1 className="text-foreground text-lg">See more &#x2192;</h1> */}
            </div>
        </article>
    )
}

import Image from 'next/image'

type ArticleProps = {
    title: string
    description: string
    image: string
}

export default function Articles() {
    const images = [
        {
            title: "How to create server side themes for NextJS?",
            image: "/images/assets/abstract.jpg",
            description: "In this article I explain how to setup proper ssr themes for NextJS without FODT (Flash Of Default Theme) and other common problems when dealing with themes. It also integrates well with custom themes and does not rely on any library at all (although I use tailwind for preference)."
        },
        {
            title: "How to set up performant low latency caching?",
            image: "/images/assets/art.jpg",
            description: "I use NextJS, and even though its more than enough most of the time, sometimes NextJS' caching just doesnt cut it. This is a simple approach to a < 5ms cache setup that allows to be easily extended and modified to your needs, without complex logic or abstractions."
        },
        {
            title: "How to create a scalable Discord bot that you can extend to your needs?",
            image: "/images/assets/city.jpg",
            description: "In this article we will review how to create a custom, reliable Discord bot that you can use for role management, mirror game servers, create documentation pages on your wiki solutions, one click Infrastructure As Code deployment in multiple environments, and other things you might use a Discord Bot for. (It even updates itself without downtime!)"
        },
        {
            title: "How to create a event management React Native Application?",
            image: "/images/assets/project.jpg",
            description: "Maybe your organization hosts a lot of events? Football, running, bowling or any other social initiatives in your organization will quickly pile up and become difficult to keep track of. Thats why I created a simple application with notifications, dates and everything else you need to keep track of whats going on in your organization."
        }
    ]

    return (
        <div className="p-16">
            <h1 className="text-foreground text-2xl">Articles</h1>
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
        <article className='bg-dark w-full h-[20vh] overflow-hidden rounded-3xl'>
        {/* <article className='bg-dark w-full h-[55vh] overflow-hidden rounded-3xl'> */}
            {/* <Image className="w-full h-[62%] object-cover" src={image} alt={title} width={800} height={450} /> */}
            <div className='mx-5 mt-5 text-foreground'>
                <h1>{title}</h1>
                <p>{description}</p>
                {/* <h1 className="text-foreground text-lg">See more -&gt;</h1> */}
                <h1 className='text-red-400'>This section is coming soon! &lt;3</h1>
            </div>
        </article>
    )
}

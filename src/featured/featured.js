import './featured.css';

export default function Featured() {
    const images = [
        {
            title: "Abstract",
            image: require("../assets/abstract.jpg"),
            description: "Laboris et do proident ad cupidatat duis. Anim adipisicing velit laborum velit non pariatur laborum ullamco velit ullamco est adipisicing. Velit do non duis exercitation ea nisi ipsum incididunt ipsum laboris amet elit in. Est exercitation voluptate labore quis et. "
        },
        {
            title: "Art",
            image: require("../assets/art.jpg"),
            description: "Laboris et do proident ad cupidatat duis. Anim adipisicing velit laborum velit non pariatur laborum ullamco velit ullamco est adipisicing. Velit do non duis exercitation ea nisi ipsum incididunt ipsum laboris amet elit in. Est exercitation voluptate labore quis et. "
        },
        {
            title: "City",
            image: require("../assets/city.jpg"),
            description: "Laboris et do proident ad cupidatat duis. Anim adipisicing velit laborum velit non pariatur laborum ullamco velit ullamco est adipisicing. Velit do non duis exercitation ea nisi ipsum incididunt ipsum laboris amet elit in. Est exercitation voluptate labore quis et. "
        },
        {
            title: "Project",
            image: require("../assets/project.jpg"),
            description: "Laboris et do proident ad cupidatat duis. Anim adipisicing velit laborum velit non pariatur laborum ullamco velit ullamco est adipisicing. Velit do non duis exercitation ea nisi ipsum incididunt ipsum laboris amet elit in. Est exercitation voluptate labore quis et. "
        }
    ]

    return (
        <div className="featured_main">
            <h1 className="featured_title">Featured Projects</h1>
            <div className="grid_container">
                {images.map((image) => {
                    return (
                        <Article
                            key={image.title}
                            image={image.image} 
                            title={image.title} 
                            description={image.description}
                        />
                    )
                })}
            </div>
        </div>
    )
}

function Article({title, description, image}) {
    return (
        <article>
            <img className="article_image"src={image}/>
            <h1 className="article_title">{title}</h1>
            <p className="article_description">{description}</p>
            <h1 className="article_more">See more -&gt;</h1>
        </article>
    )
}
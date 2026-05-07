import './nav.css'
import Image from 'next/image'

export default function Nav() {
    return (
        <nav>
            <Social />
            <div>
                <h1><a href='https://github.com/eirikhanasand'>Projects</a></h1>
                <h1><a href='mailto:eirik.hanasand@gmail.com'>Contact me</a></h1>
            </div>
        </nav>
    )
}

function Social() {
    const social = [
        {
            name: 'github',
            url: 'https://github.com/eirikhanasand',
            icon: '/images/assets/social/github.png'
        },
        {
            name: 'linkedin',
            url: 'https://linkedin.com/in/eirikhanasand',
            icon: '/images/assets/social/linkedin.png'
        },
        {
            name: 'facebook',
            url: 'https://facebook.com/eirikhanasand',
            icon: '/images/assets/social/facebook.png'
        },
        {
            name: 'instagram',
            url: 'https://instagram.com/eirikhanasand',
            icon: '/images/assets/social/instagram.png'
        },
        {
            name: 'mail',
            url: 'mailto:eirik.hanasand@gmail.com',
            icon: '/images/assets/social/mail.png'
        },
        {
            name: 'discord',
            url: 'https://discordapp.com/users/376827396764073997',
            icon: '/images/assets/social/discord.png'
        },
    ]
    return (
        <div className='socialDiv'>
            {social.map((social) => {
                return (
                    <a href={social.url} key={social.name}>
                        <Image
                            className='socialImage'
                            alt={social.name}
                            src={social.icon}
                            width={450}
                            height={900}
                        />
                    </a>
                )
            })}
        </div>
    )
}

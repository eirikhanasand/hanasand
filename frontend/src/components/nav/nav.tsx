import './nav.css'
import github from '../assets/social/github.png'
import linkedin from '../assets/social/linkedin.png'
import facebook from '../assets/social/facebook.png'
import instagram from '../assets/social/instagram.png'
import mail from '../assets/social/mail.png'
import discord from '../assets/social/discord.png'
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
            icon: github
        },
        {
            name: 'linkedin',
            url: 'https://linkedin.com/in/eirikhanasand',
            icon: linkedin
        },
        {
            name: 'facebook',
            url: 'https://facebook.com/eirikhanasand',
            icon: facebook
        },
        {
            name: 'instagram',
            url: 'https://instagram.com/eirikhanasand',
            icon: instagram
        },
        {
            name: 'mail',
            url: 'mailto:eirik.hanasand@gmail.com',
            icon: mail
        },
        {
            name: 'discord',
            url: 'https://discordapp.com/users/376827396764073997',
            icon: discord
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

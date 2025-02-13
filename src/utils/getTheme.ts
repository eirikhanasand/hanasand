import { cookies } from "next/headers"

export default function getServerSideProps() {
    const unsafeTheme = cookies().get('theme') as Cookie || { name: 'theme', value: 'dark' }
    const theme = unsafeTheme.value === 'dark' || unsafeTheme.value === 'light' ? unsafeTheme.value : 'dark'
    // const root = document.documentElement

    // if (theme === 'dark') {
    //     root.style.setProperty('--foreground-rgb', '255, 255, 255')
    //     root.style.setProperty('--background-start-rgb', '24, 24, 24')
    //     root.style.setProperty('--background-end-rgb', '24, 24, 24')
    // } else {
    //     root.style.setProperty('--foreground-rgb', '0, 0, 0')
    //     root.style.setProperty('--background-start-rgb', '24, 24, 24')
    //     root.style.setProperty('--background-end-rgb', '24, 24, 24')
    // }

    return { theme }
}

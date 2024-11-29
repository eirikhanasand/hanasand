'use client'

import { BROWSER_API } from "@parent/constants"
import getItem, { removeItem, setItem } from "./localStorage"

// Function to login the user
export async function sendLogin(user: LoginUser): Promise<true | string> {
    try {
        const response = await fetch(`${BROWSER_API}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({...user, password: 'disabled'})
        })

        if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error)
        }

        const result: LoginResponse = await response.json()
        const userResult: User = {
            name: result.name,
            username: result.username,
            time: result.time,
            score: result.score,
            solved: result.solved,
        }

        setItem('token', result.token)
        setItem('user', JSON.stringify(userResult))
        // window.location.reload()
        return true
    } catch (error: unknown) {
        const err = error as Error
        return err.message
    }
}

// Function to logout the user
export async function sendLogout(): Promise<Boolean | string> {
    try {
        const token = getItem('token')
        const user = getItem('user')

        if (!token || !user) {
            // Removes user items from localstorage if the user wants to log out
            removeItem('token')
            // removeItem('user')
            window.location.href = '/login'
            return "Logged out successfully."
            
        }

        // Removes user items from localstorage if the user wants to log out
        removeItem('token')
        removeItem('user')
        // removeItem('user')
        window.location.reload()

        // const response = await fetch(`${API}/login`, {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Authorization': token
        //     },
        //     body: JSON.stringify(user)
        // })

        // if (!response.ok) {
        //     const data = await response.json()

        //     throw Error(data.error)
        // }

        return true
    } catch (error) {
        return `Failed to log out: ${error}`
    }
}

// Function to delete the user
export async function sendDelete(): Promise<Boolean | string> {
    try {
        const user = getItem('user')

        if (!user) {
            // Removes user items from localstorage if the user wants to delete their account
            // removeItem('user')
            getRedirect('/')
            return "Deleted account."
        }

        // Removes user items from localstorage if the user wants to delete their account
        // removeItem('user')

        const response = await fetch(`${BROWSER_API}/account/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(user)
        })

        if (!response.ok) {
            const data = await response.json()

            throw Error(data.error)
        }

        getRedirect('/')
        return true
    } catch (error) {
        return `Failed to delete account: ${error}`
    }
}

// Function to register the user
export async function sendRegister(user: RegisterUser): Promise<true | string> {

    try {
        const response = await fetch(`${BROWSER_API}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({...user, password: 'disabled'})
        })


        if (!response.ok) {
            const data = await response.json()

            throw Error(data.error)
        }

        // Redirects to login page on successful registration
        setItem('redirect', '/login')
        getRedirect()

        return true
    } catch (error: unknown) {
        const err = error as Error
        return err.message
    }
}

// Checks if the user has a user object and is therefore likely to be logged in
// Note that this only checks what icons to display, and it will still be
// properly checked if the user clicks this icon or navigates to a page that
// requires login
export default function isLoggedIn() {
    if (typeof localStorage === 'undefined') {
        return false
    }

    const user: User | undefined = getItem('user') as User | undefined

    if (!user) {
        return false
    }

    return user.username
}

// Redirects the user to the page they were trying to access after successful login or register
export function getRedirect(alternative?: string): void {
    const redirect = localStorage.getItem('redirect')

    if (redirect) {
        window.location.href = redirect
        localStorage.removeItem('redirect')
    }

    if (alternative) {
        window.location.href = alternative
    }
}

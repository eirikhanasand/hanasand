// Used for type specification when recieving requests
import { Request, Response } from 'express'
import { API, TOKEN } from './env'

/**
 * Posts a comment to the given course
 * @param req Request object
 * @param res Response object
 */
export async function postTicket(req: Request, res: Response): Promise<any> {
    const ticketData = req.body

    try {
        const response = await fetch(`${API}/tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token token=${TOKEN}`
            },
            body: JSON.stringify(ticketData)
        })

        if (!response.ok) {
            const data = await response.json();
            return res.status(response.status).json(data.error)
        }

        const data = await response.json()
        res.status(201).json(data.id)
    } catch (error) {
        console.error('Error creating ticket:', error)
        res.status(500).json({ error: 'An error occurred while creating the ticket.' })
    }
}

/**
 * Posts a comment to the given course
 * @param req Request object
 * @param res Response object
 */
export async function postUser(req: Request, res: Response): Promise<any> {
    const userData = req.body

    try {
        const response = await fetch(`${API}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token token=${TOKEN}`
            },
            body: JSON.stringify(userData)
        })

        if (!response.ok) {
            const data = await response.json();
            return res.status(response.status).json(data.error)
        }

        const data = await response.json()
        res.status(201).json(data.id)
    } catch (error) {
        console.error('Error creating customer:', error)
        res.status(500).json({ error: 'An error occurred while creating the customer.' })
    }
}

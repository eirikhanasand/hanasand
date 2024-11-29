// Used for type specification when recieving requests
import { Request, Response } from 'express'
import { API, TOKEN } from './env'

// Closes the ticket with the passed id
export async function closeTicket(req: Request, res: Response): Promise<any> {
    const { ticketID, author } = req.params

    try {
        if (!ticketID || !author) {
            throw new Error(`Missing ticketID (${ticketID}) or author (${author}).`)
        }

        const response = await fetch(`${API}/ticket/${ticketID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token token=${TOKEN}`
            },
            body: JSON.stringify({
                "group_id": 37,
                "customer_id": 3116,
                "article": {
                    "body": `Closed by ${author}.`,
                    "type": "email",
                    "internal": false
                },
                "state": "closed",
            })
        })

        if (!response.ok) {
            const data = await response.json();
            return res.status(response.status).json(data.error)
        }

        const data = await response.json()
        res.status(201).json(data.id)
    } catch (error) {
        console.error('Error deleting ticket:', error)
        res.status(500).json({ error: 'An error occurred while deleting the ticket.' })
    }
}

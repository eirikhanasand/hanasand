// Used for type specification when recieving requests
import { Request, Response } from 'express'
import { API, TOKEN } from './env'

export async function putTicket(req: Request, res: Response): Promise<any> {
    const ticketData = req.body
    const { ticketID, author, recipient } = req.params
    const closeMessage = {
        "group_id": 37,
        "customer_id": 1,
        "article": {
            "body": `Closed by ${author || ''}.`,
            "type": "email",
            "internal": false,
            "to": recipient || ''
        },
        "priority_id": 2,
        "due_at": "2024-09-30T12:00:00Z",
        "state": "closed"
    }

    try {
        const response = await fetch(`${API}/tickets/${ticketID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token token=${TOKEN}`
            },
            body: JSON.stringify(author && recipient ? closeMessage : ticketData)
        })

        if (!response.ok) {
            const data = await response.json();
            return res.status(response.status).json(data.error)
        }

        const data = await response.json()
        res.status(201).json(data.id)
    } catch (error) {
        console.error('Error creating ticket:', error)
        res.status(500).json({ error: 'An error occurred while creating / updating the ticket.' })
    }
}

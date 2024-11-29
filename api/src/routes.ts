// Imports express to host the API
import express from 'express'

// Imports all GET handlers from the handlers folder
import getTicketMessages, { 
    getIndexHandler, 
    getHealthHandler,
    getGroups,
    getUsers,
    getUser,
    getTicket,
    getUserByMail,
    getAttachment
} from './handlers/get'

// Imports all POST handlers from the handlers folder
import { 
    postTicket,
    postUser,
} from './handlers/post'

// Imports all PUT handlers from the handlers folder
import { 
    putTicket, 
} from './handlers/put'

// Imports all DELETE handlers from the handlers folder
import {
    closeTicket,
} from './handlers/delete'

// Creates a new express router
const router = express.Router()

// Defines all GET routes that are available on the API
router.get('/', getIndexHandler)
router.get('/health', getHealthHandler)
router.get('/groups', getGroups)
router.get('/users', getUsers)
router.get('/users/:userID', getUser)
router.get('/users/:mail', getUserByMail)
router.get('/tickets/:ticketID', getTicket)
router.get('/attachment/:id/:ticket_id/:attachment_id', getAttachment)
router.get('/ticket/:ticketID/:recipient', getTicketMessages)

// Defines all PUT routes that are available on the API
router.put('/ticket/:ticketID', putTicket)
router.put('/ticket/:ticketID/:author/:recipient', putTicket)

// Defines all POST routes that are available on the API
router.post('/ticket', postTicket)
router.post('/users', postUser)

// Defines all DELETE routes that are available on the API
// router.delete('/ticket/:ticketID/:author', closeTicket)

// Exports the router
export default router

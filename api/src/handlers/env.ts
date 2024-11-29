import dotenv from 'dotenv'

dotenv.config()

const { API, TOKEN } = process.env

if (!API || !TOKEN) {
    console.error("Missing API url or token.")
}

export { API, TOKEN }
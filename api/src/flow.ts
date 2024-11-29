// Purpose: Provides a caching mechanism for the API using Redis.
import { createClient } from 'redis'

// Imports the dotenv module to read environment variables from the .env file
import dotenv from 'dotenv'

// Configures the environment variables
dotenv.config()

// Destructures the environment variables from the process environment
const { REDIS_HOST, REDIS_PORT, CACHE_TTL } = process.env

// Uses the passed values, or defines default values for the Redis host and port
const redisHost = REDIS_HOST || 'localhost'
const redisPort = REDIS_PORT || 6379

// Creates and configure Redis client
const redisClient = createClient({
    url: `redis://${redisHost}:${redisPort}`
})

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Connects to the Redis client
(async () => {
    try {
        await redisClient.connect()
        console.log('Redis client connected')
    } catch (err) {
        console.error('Could not connect to Redis', err)
    }
})()

// Cache TTL (time to live) in seconds
const TTL = Number(CACHE_TTL) || 3600

/**
 * Wrapper for cache function, first checks cache for data, if not found, fetches data from source
 * @param cacheKey Key to retrieve data from cache if possible
 * @param fetchFunction Function to fetch data from source if not found in cache
 * @param ttl Time to live for the cache in seconds
 * @returns Data from cache if possible, otherwise fetched data from source
 */
export default async function cache(
    cacheKey: string,
    fetchFunction: () => Promise<any>,
    ttl: number = TTL
): Promise<any> {
    // Wrapped in a try-catch block to handle potential errors gracefully
    try {
        const cachedData = await redisClient.get(cacheKey)

        // Returns cache hit if possible
        if (cachedData) {
            return JSON.parse(cachedData)
        } else {
            // If cache miss, fetches data from the source
            const data = await fetchFunction()
            // Stores the fetched data in cache with TTL
            await redisClient.set(cacheKey, safeStringify(data), {
                EX: ttl,
            })

            return data
        }
    } catch (error) {
        console.error('Cache error:', error)
        throw error
    }
}

/**
 * Updates the cache for the given key with the provided data
 * @param cacheKey Key to update
 * @param data Data to store for the passed key
 * @param ttl Time to live for the cache in seconds
 */
export function updateCache(cacheKey: string, data: any, ttl: number = TTL) {
    redisClient.set(cacheKey, safeStringify(data), {
        EX: ttl,
    })
}

/**
 * Invalidates the cache for the given key
 * @param cacheKey Key to invalidate
 */
export function invalidateCache(cacheKey: string) {
    redisClient.del(cacheKey)
}

// Properly close the Redis client when the application exits
process.on('exit', () => {
    redisClient.quit()
})

/**
 * Safely stringifies an object, preventing circular references
 * @param obj Object to stringify
 * @param space Space to use for indentation
 * @returns Stringified object
 */
function safeStringify(obj: any, space?: number): string {
    // Creates a WeakSet to store seen objects
    const seen = new WeakSet()

    // Uses replacer function to handle circular references
    return JSON.stringify(obj, function(_, value) {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return
            }

            // Adds the value to the set if it is an object
            seen.add(value)
        }

        // Returns the value if it is not a circular reference
        return value
    }, space)
}

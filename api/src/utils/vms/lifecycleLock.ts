import { withDatabaseAdvisoryLock } from '#db'

export const vmLifecycleLock = <T>(name: string, work: () => Promise<T>) => withDatabaseAdvisoryLock(`vm-lifecycle:${name.toLowerCase()}`, work)

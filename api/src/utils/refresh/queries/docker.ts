import { isRuntimeLogSourceAvailable, listRuntimeContainersWithStats } from '#utils/docker/engine.ts'

export default async function getDocker() {
    try {
        const containers = await listRuntimeContainersWithStats()
        return {
            status: 200,
            data: {
                containers,
                source: 'docker_engine',
                docker_socket_available: true,
                generated_at: new Date().toISOString(),
            },
        }
    } catch (error) {
        return {
            status: 200,
            data: {
                containers: [],
                source: 'unavailable',
                docker_socket_available: isRuntimeLogSourceAvailable(),
                unavailable_reason: error instanceof Error ? error.message : 'Docker telemetry is unavailable.',
                generated_at: new Date().toISOString(),
            },
        }
    }
}

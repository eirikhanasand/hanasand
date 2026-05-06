import os from 'os'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import si from 'systeminformation'
import getGpuUsage from './gpu/mac.ts'
import { getModelLaneSnapshot } from './modelLanes.ts'
import { getModelState } from './modelState.ts'

const execFileAsync = promisify(execFile)
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const powerStatePath = path.resolve(moduleDir, '../../runtime/power-month.json')

type NvidiaGpuSample = {
    index: number
    name: string
    utilizationGpu: number
    memoryTotalMb: number
    memoryUsedMb: number
    powerDrawWatts: number
    powerLimitWatts: number
    temperatureC: number
}

let powerState: {
    month: string
    kwh: number
    sampledAt: number
} | null = null
let nvidiaSmiUnavailable = false
let nvidiaSmiWarningEmitted = false

async function readPowerState() {
    if (powerState) {
        return powerState
    }

    try {
        const parsed = JSON.parse(await fs.readFile(powerStatePath, 'utf8')) as typeof powerState
        powerState = parsed
    } catch {
        powerState = null
    }

    return powerState
}

async function writePowerState(state: NonNullable<typeof powerState>) {
    powerState = state
    await fs.mkdir(path.dirname(powerStatePath), { recursive: true })
    await fs.writeFile(powerStatePath, JSON.stringify(state, null, 2))
}

function currentMonth() {
    return new Date().toISOString().slice(0, 7)
}

async function sampleNvidiaGpus(): Promise<NvidiaGpuSample[]> {
    if (nvidiaSmiUnavailable) {
        return []
    }

    let stdout = ''
    try {
        const result = await execFileAsync('nvidia-smi', [
            '--query-gpu=index,name,utilization.gpu,memory.total,memory.used,power.draw,power.limit,temperature.gpu',
            '--format=csv,noheader,nounits',
        ])
        stdout = result.stdout
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            nvidiaSmiUnavailable = true
            return []
        }

        if (!nvidiaSmiWarningEmitted) {
            nvidiaSmiWarningEmitted = true
            console.warn('Unable to sample NVIDIA GPU metrics:', error)
        }
        return []
    }

    return stdout.trim().split('\n').filter(Boolean).map((line) => {
        const [index, name, utilizationGpu, memoryTotalMb, memoryUsedMb, powerDrawWatts, powerLimitWatts, temperatureC] = line
            .split(',')
            .map((part) => part.trim())

        return {
            index: Number(index),
            name,
            utilizationGpu: Number(utilizationGpu) || 0,
            memoryTotalMb: Number(memoryTotalMb) || 0,
            memoryUsedMb: Number(memoryUsedMb) || 0,
            powerDrawWatts: Number(powerDrawWatts) || 0,
            powerLimitWatts: Number(powerLimitWatts) || 0,
            temperatureC: Number(temperatureC) || 0,
        }
    })
}

async function updateMonthlyPower(totalWatts: number) {
    const now = Date.now()
    const month = currentMonth()
    const previous = await readPowerState()
    const base = previous && previous.month === month
        ? previous
        : { month, kwh: 0, sampledAt: now }
    const elapsedHours = Math.max(0, Math.min(now - base.sampledAt, 5 * 60 * 1000)) / 1000 / 60 / 60
    const next = {
        month,
        kwh: base.kwh + (totalWatts / 1000) * elapsedHours,
        sampledAt: now,
    }
    await writePowerState(next)
    return next.kwh
}

export default async function metrics(): Promise<GPT_Client> {
    const name = os.hostname()

    // RAM info
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const ram: GPT_RAM[] = [
        {
            name: 'System RAM',
            load: usedMem / totalMem,
        }
    ]

    // CPU info
    const cpuInfo = await si.cpu()
    const loadInfo = await si.currentLoad()
    const cpu: GPT_CPU[] = loadInfo.cpus.map((core, index) => ({
        name: `${cpuInfo.manufacturer} ${cpuInfo.brand} Core ${index + 1}`,
        load: core.load / 100,
    }))

    // GPU info
    let gpu: GPT_GPU[]
    let lanes: GPT_ModelLaneMetrics[] = []
    let power: GPT_ModelPowerMetrics | undefined
    const graphics = await si.graphics()
    const mac = process.platform === 'darwin'
    if (mac) {
        let gpuMetrics: Awaited<ReturnType<typeof getGpuUsage>> | null = null
        try {
            gpuMetrics = await getGpuUsage()
        } catch (error) {
            console.warn('Falling back to zeroed GPU metrics:', error)
        }

        gpu = graphics.controllers.map((g) => ({
            name: g.model,
            load: gpuMetrics?.hwActiveResidency || 0,
            cores: g.cores,
            metrics: gpuMetrics || undefined,
        }))
    } else {
        const nvidiaGpus = await sampleNvidiaGpus()

        gpu = nvidiaGpus.length
            ? nvidiaGpus.map((g) => ({
                name: g.name,
                load: g.utilizationGpu / 100,
                memoryUsedMb: g.memoryUsedMb,
                memoryTotalMb: g.memoryTotalMb,
                powerDrawWatts: g.powerDrawWatts,
                powerLimitWatts: g.powerLimitWatts,
                temperatureC: g.temperatureC,
            }))
            : graphics.controllers.map((g) => ({
                name: g.model,
                load: (g.utilizationGpu || 0) / 100,
            }))

        const laneSnapshot = getModelLaneSnapshot()
        lanes = laneSnapshot.map((lane) => {
            const laneGpuIndices = lane.gpuIndices?.length ? lane.gpuIndices : [lane.gpuIndex]
            const gpuSamples = laneGpuIndices
                .map((gpuIndex) => nvidiaGpus.find((sample) => sample.index === gpuIndex))
                .filter((sample): sample is NvidiaGpuSample => Boolean(sample))
            const primaryGpuSample = gpuSamples[0]
            return {
                ...lane,
                gpuName: primaryGpuSample?.name || `GPU ${lane.gpuIndex}`,
                gpuLoad: gpuSamples.length ? Math.max(...gpuSamples.map((sample) => sample.utilizationGpu / 100)) : 0,
                memoryUsedMb: gpuSamples.reduce((sum, sample) => sum + sample.memoryUsedMb, 0),
                memoryTotalMb: gpuSamples.reduce((sum, sample) => sum + sample.memoryTotalMb, 0),
                powerDrawWatts: gpuSamples.reduce((sum, sample) => sum + sample.powerDrawWatts, 0),
                powerLimitWatts: gpuSamples.reduce((sum, sample) => sum + sample.powerLimitWatts, 0),
                temperatureC: gpuSamples.length ? Math.max(...gpuSamples.map((sample) => sample.temperatureC)) : 0,
            }
        })

        const totalWatts = nvidiaGpus.reduce((sum, sample) => sum + sample.powerDrawWatts, 0)
        power = {
            totalWatts,
            monthlyKwh: await updateMonthlyPower(totalWatts),
            sampledAt: new Date().toISOString(),
        }
    }

    return {
        name,
        displayName: process.env.HANASAND_MODEL_DISPLAY_NAME || process.env.HANASAND_VLLM_MODEL_REPO || process.env.HANASAND_MODEL_PROFILE || name,
        modelId: process.env.HANASAND_VLLM_MODEL_REPO || process.env.HANASAND_MODEL_PROFILE || null,
        profile: process.env.HANASAND_MODEL_PROFILE || null,
        ram,
        cpu,
        gpu,
        lanes,
        power,
        model: getModelState(),
    }
}

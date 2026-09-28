import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const frameCount = 180
const droppedFrame = 30
const recoveryFrame = 60
const scratch = mkdtempSync(join(tmpdir(), 'hanasand-h264-check-'))
const encodedPattern = join(scratch, 'encoded-%03d.h264')

function runGst(args: string[]) {
    try {
        return execFileSync('gst-launch-1.0', ['-e', '-v', ...args], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 8 * 1024 * 1024,
        })
    } catch (error) {
        const detail = error as NodeJS.ErrnoException & { stderr?: Buffer | string }
        throw new Error(`GStreamer pipeline failed: ${String(detail.stderr || detail.message)}`, { cause: error })
    }
}

function frameFiles(pattern: string) {
    const prefix = pattern.slice(0, pattern.indexOf('%'))
    const directory = pattern.slice(0, pattern.lastIndexOf('/'))
    const filenamePrefix = prefix.slice(prefix.lastIndexOf('/') + 1)
    return readdirSync(directory)
        .filter(name => name.startsWith(filenamePrefix))
        .sort()
        .map(name => join(directory, name))
}

function nalTypes(bytes: Buffer) {
    const types: number[] = []
    for (let index = 0; index < bytes.length - 4;) {
        let header = -1
        if (bytes[index] === 0 && bytes[index + 1] === 0 && bytes[index + 2] === 1) header = index + 3
        else if (bytes[index] === 0 && bytes[index + 1] === 0 && bytes[index + 2] === 0 && bytes[index + 3] === 1) header = index + 4
        if (header < 0) {
            index++
            continue
        }
        types.push(bytes[header] & 31)
        index = header + 1
    }
    return types
}

function decode(input: string, outputPattern: string) {
    runGst([
        'filesrc', `location=${input}`, '!',
        'h264parse', '!',
        'avdec_h264', '!',
        'videoconvert', '!',
        'videoscale', '!',
        'video/x-raw,format=GRAY8,width=64,height=36', '!',
        'multifilesink', 'next-file=buffer', `location=${outputPattern}`,
    ])
    return frameFiles(outputPattern).map(path => readFileSync(path))
}

try {
    const started = performance.now()
    const caps = runGst([
        'videotestsrc', `num-buffers=${frameCount}`, 'pattern=ball', '!',
        'video/x-raw,format=NV12,width=1920,height=1080,framerate=60/1', '!',
        'x264enc', 'bitrate=4000', `key-int-max=${recoveryFrame}`, 'bframes=0', 'rc-lookahead=0', 'sliced-threads=false', '!',
        'h264parse', 'config-interval=-1', '!',
        'video/x-h264,stream-format=byte-stream,alignment=au', '!',
        'multifilesink', 'next-file=buffer', `location=${encodedPattern}`,
    ])
    const encodedFiles = frameFiles(encodedPattern)
    if (encodedFiles.length !== frameCount) throw new Error(`Expected ${frameCount} encoded access units, got ${encodedFiles.length}`)

    const keyframes: number[] = []
    for (const [index, path] of encodedFiles.entries()) {
        const types = nalTypes(readFileSync(path))
        const slices = types.filter(type => type === 1 || type === 5)
        if (slices.length !== 1) throw new Error(`Access unit ${index} contains ${slices.length} video slices`)
        if (types.includes(5)) keyframes.push(index)
    }
    if (String(keyframes) !== '0,60,120') throw new Error(`Unexpected IDR access units: ${keyframes}`)
    const profile = caps.match(/profile=\(string\)([^,\s]+)/)?.[1]
    if (!profile || !caps.includes('level=(string)4.2')) {
        throw new Error('The negotiated H.264 caps do not include a profile and level 4.2')
    }

    const completeStream = join(scratch, 'complete.h264')
    writeFileSync(completeStream, Buffer.concat(encodedFiles.map(path => readFileSync(path))))
    const lostStream = join(scratch, 'lost-frame.h264')
    writeFileSync(lostStream, Buffer.concat(encodedFiles.filter((_path, index) => index !== droppedFrame).map(path => readFileSync(path))))

    const complete = decode(completeStream, join(scratch, 'complete-%03d.gray'))
    const damaged = decode(lostStream, join(scratch, 'damaged-%03d.gray'))
    if (complete.length !== frameCount) throw new Error(`Expected ${frameCount} decoded frames, got ${complete.length}`)
    if (damaged.length !== frameCount - 1) throw new Error(`Expected ${frameCount - 1} frames after dropping one access unit, got ${damaged.length}`)
    if (complete.some((frame, index) => index < droppedFrame && !frame.equals(damaged[index]))) {
        throw new Error('Frames before the simulated loss changed')
    }

    const corruptRange = damaged.slice(droppedFrame, recoveryFrame - 1)
    if (!corruptRange.some((frame, index) => !frame.equals(complete[droppedFrame + index + 1]))) {
        throw new Error('The missing reference frame did not affect later decoded pictures')
    }
    if (!damaged[recoveryFrame - 1]?.equals(complete[recoveryFrame])) {
        throw new Error('The next IDR did not restore the exact decoded picture')
    }
    for (let index = recoveryFrame; index < damaged.length; index++) {
        if (!damaged[index].equals(complete[index + 1])) throw new Error(`Decoded frame ${index + 1} did not recover after the IDR`)
    }

    const elapsedSeconds = (performance.now() - started) / 1000
    const digest = createHash('sha256').update(Buffer.concat(complete)).digest('hex').slice(0, 16)
    console.log(`H.264: 1080p60 ${profile} level 4.2; IDRs ${keyframes}; recovered after frame loss; ${frameCount / elapsedSeconds | 0} FPS; ${digest}`)
} finally {
    rmSync(scratch, { recursive: true, force: true })
}

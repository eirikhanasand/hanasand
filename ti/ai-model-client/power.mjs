import { readFileSync, writeFileSync, renameSync } from 'node:fs';

export function samplePower(host, previous, now = Date.now()) {
  const sampledAt = Date.parse(host?.sampledAt);
  const gpuIds = new Set((host?.gpus || []).map(gpu => gpu.id));
  const readings = (host?.power || []).filter(sensor => gpuIds.has(sensor.label) && sensor.unit === 'W');
  if (!Number.isFinite(sampledAt) || now - sampledAt > 120_000 || sampledAt > now ||
      !gpuIds.size || readings.length !== gpuIds.size ||
      readings.some(sensor => !Number.isFinite(sensor.value) || sensor.value < 0)) return null;
  const totalWatts = readings.reduce((sum, sensor) => sum + sensor.value, 0);
  const month = new Date(sampledAt).toISOString().slice(0, 7);
  const sameMonth = previous?.month === month;
  const elapsed = sameMonth ? sampledAt - previous.sampledAt : 0;
  const kwh = (sameMonth ? previous.kwh : 0) +
    (elapsed > 0 && elapsed <= 120_000 ? (previous.watts + totalWatts) / 2 * elapsed / 3_600_000_000 : 0);
  return { month, kwh, sampledAt, watts: totalWatts };
}

export function readPower() {
  try {
    const host = JSON.parse(readFileSync(process.env.HANASAND_AI_HOST_METRICS_FILE || '/host-metrics/host.json', 'utf8'));
    const path = process.env.HANASAND_AI_POWER_STATE_FILE || '/power-state/month.json';
    let previous;
    try { previous = JSON.parse(readFileSync(path, 'utf8')); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const state = samplePower(host, previous);
    if (!state) return null;
    if (state.sampledAt !== previous?.sampledAt) {
      writeFileSync(path + '.tmp', JSON.stringify(state));
      renameSync(path + '.tmp', path);
    }
    return { totalWatts: state.watts, monthlyKwh: state.kwh, sampledAt: new Date(state.sampledAt).toISOString() };
  } catch (error) {
    console.error('GPU power telemetry unavailable:', error.code || error.name);
    return null;
  }
}

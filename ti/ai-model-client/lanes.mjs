export function modelEndpoints(base, ports) {
  const url = new URL(base);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!local || !ports.includes(Number(url.port || (url.protocol === 'https:' ? 443 : 80)))) return [base];
  return [...new Set(ports)].map(port => { const lane = new URL(base); lane.port = String(port); return lane.href; });
}

export function createLanePool(maxRequests) {
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1) throw new Error('Model lane capacity must be a positive integer.');
  const active = new Map();
  let cursor = 0;
  const count = url => active.get(url) || 0;
  return {
    get activeRequests() { return [...active.values()].reduce((sum, value) => sum + value, 0); },
    stats(url) { return { activeRequests: count(url), maxRequests, queuedRequests: 0, availableRequests: Math.max(0, maxRequests - count(url)) }; },
    acquire(endpoints) {
      const urls = [...new Set(endpoints)];
      if (!urls.length) throw new Error('No healthy model lane is available.');
      // Prefer available capacity, rotating ties instead of filling lane 1 first.
      const ordered = urls.map((_, i) => urls[(cursor + i) % urls.length]);
      const url = ordered.reduce((best, candidate) => count(candidate) < count(best) ? candidate : best);
      if (count(url) >= maxRequests) throw new Error('All model lanes are busy; retry the request.');
      cursor = (urls.indexOf(url) + 1) % urls.length;
      active.set(url, count(url) + 1);
      let released = false;
      return { url, release() {
        if (released) return;
        released = true;
        const remaining = count(url) - 1;
        if (remaining) active.set(url, remaining); else active.delete(url);
      } };
    },
  };
}

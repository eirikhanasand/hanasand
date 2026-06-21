import type { CapacityEstimate, RuntimeResourceSnapshot } from "./resourceTypes.ts";

export function assertCapacityWithinBudget(estimate: CapacityEstimate): void {
  if (estimate.estimatedMb > estimate.ceilingMb) {
    throw new Error(`estimated scraper capacity ${estimate.estimatedMb} MB exceeds normal ceiling ${estimate.ceilingMb} MB`);
  }
  if (estimate.estimatedMb > estimate.targetMb) {
    throw new Error(`estimated scraper capacity ${estimate.estimatedMb} MB exceeds target ${estimate.targetMb} MB`);
  }
}

export function assertWithinResourceBudget(snapshot: RuntimeResourceSnapshot): void {
  if (snapshot.memory.status === "critical") {
    throw new Error(`RSS memory ${snapshot.memory.rssMb} MB exceeds configured scraper budget`);
  }
  if (snapshot.queue.status === "critical") {
    throw new Error(`queue size ${snapshot.queue.currentItems} exceeds configured scraper budget`);
  }
}

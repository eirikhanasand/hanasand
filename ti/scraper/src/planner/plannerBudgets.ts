// @ts-nocheck
export const BUDGETS = {
  interactive_live_search: [10, 3, 192_000, 30_000, 45_000],
  interactive_search: [12, 4, 256_000, 60_000, 90_000],
  analyst_deep_dive: [60, 20, 1_000_000, 1_200_000, 120_000],
  public_channel_window: [40, 12, 256_000, 180_000, 45_000],
  public_channel_probe: [20, 6, 192_000, 120_000, 30_000],
  background_refresh: [40, 40, 512_000, 3_600_000],
  broad_daily_sweep: [200, 80, 512_000, 21_600_000, 300_000],
  source_health_probe: [25, 25, 64_000, 600_000],
  restricted_darknet_metadata_sweep: [30, 8, 64_000, 1_800_000, 300_000, true]
};

export function profile(input) {
  const key = input.budgetClass ?? (input.includeDarknetMetadata && input.priority !== "urgent" ? "restricted_darknet_metadata_sweep" : input.priority === "urgent" ? "interactive_search" : input.priority === "high" ? "analyst_deep_dive" : "background_refresh");
  const [maxTasks, immediateTaskLimit, maxBytesPerTask, deadlineMs, backgroundDelayMs, includeDarknetMetadata] = BUDGETS[key];
  return { class: key, maxTasks, immediateTaskLimit, maxBytesPerTask, deadlineMs, backgroundDelayMs, includeDarknetMetadata };
}

export function iso(from, addMs) {
  return new Date(Date.parse(from) + addMs).toISOString();
}

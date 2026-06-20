const root = new URL("..", import.meta.url).pathname;
const storage = `${root}/.apify-smoke-storage`;

await Bun.spawn(["rm", "-rf", storage], { stdout: "inherit", stderr: "inherit" }).exited;
await Bun.spawn(["mkdir", "-p", `${storage}/key_value_stores/default`], { stdout: "inherit", stderr: "inherit" }).exited;
await Bun.write(`${storage}/key_value_stores/default/INPUT.json`, JSON.stringify({
  queries: ["APT42"],
  maxRowsPerQuery: 10
}, null, 2));

const proc = Bun.spawn({
  cmd: ["bun", "run", "src/main.ts"],
  cwd: root,
  env: {
    ...process.env,
    APIFY_LOCAL_STORAGE_DIR: storage,
    TI_ACTOR_FIXTURE_PATH: `${root}/fixtures/apt42.json`
  },
  stdout: "inherit",
  stderr: "inherit"
});

const code = await proc.exited;
if (code !== 0) process.exit(code);

const output = await Bun.file(`${storage}/key_value_stores/default/OUTPUT.json`).json() as Array<Record<string, unknown>>;
if (!Array.isArray(output) || output.length < 4) {
  throw new Error(`Expected at least 4 output rows, got ${Array.isArray(output) ? output.length : "non-array"}`);
}
for (const row of output) {
  if (row.rawContentIncluded !== false) throw new Error("rawContentIncluded must be false");
  if (JSON.stringify(row).toLowerCase().includes("password")) throw new Error("Output contains forbidden password text");
}
const profile = output.find((row) => row.rowType === "profile");
if (profile?.sourceCount !== 1 || profile?.sourceFamilyCount !== 1 || profile?.evidenceGrade !== "single_source") {
  throw new Error("Internal status sources must not increase evidence grade or source-family coverage");
}
if (output.some((row) => row.rowType === "source" && row.sourceType === "system")) {
  throw new Error("Internal status rows must not be included in marketplace evidence output");
}
if (output.some((row) => Array.isArray(row.warningCodes) && row.warningCodes.includes("darknet_metadata_only"))) {
  throw new Error("Coverage capability alone must not produce a darknet evidence warning");
}
const activity = output.find((row) => row.rowType === "activity");
if (activity?.claimType !== "campaign" || activity?.publisherCount !== 1) {
  throw new Error("Activity rows must preserve claim classification and publisher count");
}
if (activity?.firstReportedAt !== "2026-06-20T01:00:00.000Z" || activity?.lastReportedAt !== "2026-06-20T02:00:00.000Z") {
  throw new Error("Activity rows must preserve the public reporting window");
}

console.log(`Smoke passed with ${output.length} safe metadata rows.`);

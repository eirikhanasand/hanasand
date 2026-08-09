import { PostgresScraperStore } from "../src/storage/postgresScraperStore.ts";

const store = await PostgresScraperStore.create({
  runMaintenanceMigrations: true,
  hydrate: false,
  onStartupPhase: (phase) => console.log(JSON.stringify({ phase }))
});
try {
  console.log(JSON.stringify({ maintenanceMigrations: "complete", health: await store.databaseHealth() }));
} finally {
  await store.close();
}

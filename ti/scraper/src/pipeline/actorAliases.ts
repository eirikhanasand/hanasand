import { ACTOR_ALIAS_RECORDS } from "./actorAliasRecords.ts";
export { ACTOR_ALIAS_RECORDS } from "./actorAliasRecords.ts";
export type { ActorAliasRecord } from "./actorAliasTypes.ts";

export function actorAliasesFor(canonical: string): string[] {
  return ACTOR_ALIAS_RECORDS.find((record) => record.canonical === canonical)?.aliases ?? [];
}

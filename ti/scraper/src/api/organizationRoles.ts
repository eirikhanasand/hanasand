// Analyst is retained for existing intelligence-only organizations. Account Members
// and Viewers are legacy read-only roles during the account migration.
export function canEditOrganization(role: string | undefined): boolean {
  return ["owner", "admin", "editor", "analyst"].includes(role ?? "");
}

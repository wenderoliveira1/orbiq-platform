import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Runs only against the named local Docker database. Every change, including
// fixtures and migration DDL, is rolled back. No remote credentials are used.
const baseline = process.argv.includes("--baseline");
const migration = [
  "20260917151758_security_membership_and_catalog_permissions.sql",
  "20260917152845_security_tenant_reference_guards.sql",
].map((file) => readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8")
  .replace(/^\s*(begin|commit);\s*$/gim, "")).join("\n");
const tests = readFileSync(new URL("../tests/security/database.sql", import.meta.url), "utf8");
// Older local databases may have the original organization-insert seed trigger.
// Reconcile the repository's existing bootstrap fix inside the same rollback.
const bootstrap = readFileSync(new URL(
  "../supabase/migrations/20260825155500_fix_first_organization_bootstrap.sql", import.meta.url,
), "utf8").replace(/^\s*(begin|commit);\s*$/gim, "");
const sql = "begin;\nset local statement_timeout = '20s';\n" +
  `set local security_test.baseline = '${baseline}';\n` +
  bootstrap + "\n" +
  tests.replace("-- APPLY_SECURITY_MIGRATION", () => baseline ? "" : migration) +
  "\nrollback;\n";
const result = spawnSync("docker", ["exec", "-i", "supabase_db_orbiq-platform",
  "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
  input: sql, encoding: "utf8", timeout: 120_000,
});
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);

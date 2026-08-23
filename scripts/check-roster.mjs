// The roster's hand-curated ids, checked at build time.
//
// src/auth/roster.ts links a signed-in user to an Org person by id, and nothing
// at runtime can tell a typo from someone who genuinely owns nothing — a broken
// orgId just silently stops the owner gate ever firing.
//
// The rules themselves live in src/auth/validateRoster.ts, not here, because the
// Users settings page runs the same ones before it will save. A rule that lived
// only in this script would let that page write something the next `npm run
// check` refuses; a rule that lived only in the page would not survive somebody
// editing roster.ts by hand. One function, two callers.
//
// This checks the AUTHORED roster. Local edits made on the settings page live in
// the browser and are validated there.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "warn" });

try {
  // Loaded through Vite rather than read as text for the same reason
  // check-validator-fires.mjs does it: these are TypeScript modules. roster.ts
  // is TypeScript rather than YAML because it is reached from the entry chunk
  // and must not drag a YAML parser in with it — see the header there.
  const { AUTHORED_ROSTER } = await server.ssrLoadModule("/src/auth/roster.ts");
  const { validateRoster } = await server.ssrLoadModule("/src/auth/validateRoster.ts");

  const orgs = parse(readFileSync("src/graph/facts/orgs.yaml", "utf8"));
  const problems = validateRoster(AUTHORED_ROSTER, orgs);

  if (problems.length === 0) {
    const claiming = AUTHORED_ROSTER.filter((u) => u.orgId).length;
    console.log(`  ok    roster: ${AUTHORED_ROSTER.length} users, ${claiming} claiming an org person`);
  } else {
    for (const problem of problems) {
      const who = problem.userId ? `${problem.userId}: ` : "";
      console.log(`  FAIL  ${who}${problem.message}`);
    }
    console.log(`\n${problems.length} problem(s)\n`);
    process.exitCode = 1;
  }
} finally {
  await server.close();
}

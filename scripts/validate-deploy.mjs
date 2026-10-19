import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(
  new URL("../server/package.json", import.meta.url),
);
const { parse } = require("yaml");
const read = async (path) => readFile(new URL(path, import.meta.url), "utf8");
const compose = parse(await read("../deploy/compose.yml"));
assert.deepEqual(Object.keys(compose.services).sort(), [
  "api",
  "caddy",
  "migrate",
  "mysql",
]);
const { api, mysql, migrate, caddy } = compose.services;
assert.equal(mysql.ports, undefined);
assert.equal(api.ports, undefined);
assert.equal(api.read_only, true);
assert.equal(api.environment.DB_USER, "trogon_app");
assert.equal(migrate.environment.DB_USER, "trogon_migrator");
assert.equal(
  api.depends_on.migrate.condition,
  "service_completed_successfully",
);
assert.equal(caddy.depends_on.api.condition, "service_healthy");
assert.ok(api.volumes.includes("media_data:/data/media"));
assert.ok(api.environment.AUTH_SECRET.includes("${AUTH_SECRET:?"));
const workflow = parse(await read("../.github/workflows/ci.yml"));
assert.ok(workflow.on.includes("pull_request"));
assert.equal(workflow.jobs.verify.services.mysql.image, "mysql:8.4");
assert.ok(
  workflow.jobs.verify.steps.some((step) =>
    step.run?.includes("test:integration"),
  ),
);
const dockerfile = await read("../Dockerfile");
assert.match(dockerfile, /USER trogon/);
assert.match(dockerfile, /HEALTHCHECK/);
assert.doesNotMatch(dockerfile, /COPY.*\.env/);
console.log(
  "Deployment config passed: YAML, private database ports, migration ordering, runtime account, volumes and container user.",
);
console.log(
  "Docker image/HTTPS runtime must still be verified on a Docker host.",
);

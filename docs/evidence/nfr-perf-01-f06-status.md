# NFR-PERF-01 F-06 Benchmark Status

**Status: UNMEASURED.** The seven-type benchmark fixture is implemented in `server/scripts/benchmark-read.ts`, but no F-06 latency result is available yet.

**Command attempted:** `npm run bench:read --prefix server`

**Actual outcome:** Prisma identified the dedicated `surveyhub_test` database at `localhost:54519`, then failed before measuring because `npx prisma migrate deploy` could not start the schema engine. `docker info --format '{{.ServerVersion}}'` also failed because the Docker Desktop engine pipe was unavailable.

No p50, p95, or p99 values are reported. The existing `nfr-perf-01.json` records an earlier single-choice workload, so it does not verify the seven-type F-06 form or the 300 ms p95 target. Rerun the command after the test database is reachable; the benchmark writes the measured seven-type result to that JSON file.

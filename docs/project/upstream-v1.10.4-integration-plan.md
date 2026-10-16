# Upstream v1.10.4 integration

## Approval summary

Upgrade the fork and both GitOps environments to upstream stable v1.10.4 while
preserving required consumer, authentication, storage and sandbox contracts.
The user explicitly requested the latest version and an executable goal after
updating the governing plan with Astra. This is an executable batch under the
[16 October continuation](2026-09-19-storage-recovery-upstream-v1.4.0-plan.md).
Required human production release approval remains binding.

Freeze upstream v1.10.4 at `a62d69e05a4541ac9a20722ac7ff3fcfecb6ed24`,
verified through the official latest-release API and fetched tag. Fork baseline
is main at `b53af0e3833f2b9a03036e87c9d56842bad0ca2f`; merge base is
`c8b3e1490416753b6f633e4cdbf9100e93aeb849`. Refresh latest-release metadata
before production readiness. Assess a later release explicitly instead of
silently changing a verified rollout target.

Merge upstream without squash and keep the smallest required fork behavior.
Retain issuer and tenant boundaries, signed runner requests, public/internal
wire separation, bounded execution and cancellation, values-free/nonfatal
telemetry, external storage, namespace/KVM isolation and Argo/KEDA ownership.
Adopt upstream's anonymous-pipe runtime and its validation rather than restoring
the removed socket implementation. Publish through the existing commit-image
workflow; the fork never creates stable tags or releases.

The significant compatibility work is the upstream pipe/runtime build change
and the overlapping transport/OpenAPI changes. Source comparison is not runtime
acceptance. Finish only after CI/build/review, exact revision agreement,
consumer/artifact checks and cleanup pass in staging and then production. New
trust boundaries, schema migration, identities, data destinations, increased
capacity or unrelated release effects require a concrete decision before the
dependent live action.

## CI access constraint

The user requires CI to have no Kubernetes cluster access. Source tests, image
builds and cloud-only infrastructure checks remain eligible. This overrides
any deployment step below that assumes the existing cluster-authenticated
Pulumi app jobs can run. Keep those jobs held until an explicitly agreed
deployment route satisfies this boundary. Do not install a Kubernetes client,
fetch cluster credentials or substitute another cluster client in CI.

The ready-capacity package has the same constraint: Azure policy and Pulumi
state reconciliation belong on its cloud-only route; node, device and runner
acceptance use existing host connectivity. The source integration remains
independent. This constraint grants no new identity, permission, host cloud
write or ownership migration.

## Execution details

Main owns implementation, integration, secret handling, delivery and final proof.
Astra reviews the frozen plan; configured independent reviewers cover the
changed seams and integrated source outcome. Execution mode is standard.
Branch is `rs/upstream-v1.10.4`, targeting fork main. Keep this plan path stable
when a PR is created. No product primitive is intentionally added by the fork;
this reconciles an approved upstream version. No new ADR is needed for retaining
existing contracts; a changed trust, ownership or persistence model re-arms it.

### Research and patch decisions

The official release is [v1.10.4](https://github.com/LibreChat-AI/code-interpreter/releases/tag/v1.10.4).
Use source and existing tests as evidence. The local read-only comparison found
these logical decisions; final path accounting and changed-seam verification
remain required before publication. The canonical replay ledger remains
[docs/fork/patches.md](../fork/patches.md).

| Behavior | Decision and upstream evidence | Source seams |
| --- | --- | --- |
| Exact-SHA fork images and disabled releases | Retain. Upstream images.yml publishes only in the upstream repository; its registry and tag contract do not replace fork image pins. | .github/workflows/build-codeapi-images.yml, images.yml, release.yml; docs/RELEASING.md; CONTRIBUTING.md |
| Readable sandbox executable roots | Reapply only required readable permissions to the current upstream build stages. Upstream still uses execute-only spec-guard permissions. Retain existing smoke coverage; do not duplicate upstream test steps. | api/Dockerfile; docker/Dockerfile.worker-sandbox; launcher/Dockerfile; .github/workflows/ci.yml |
| Namespace isolation and external replica/secret ownership | Retain. Upstream lacks the fork namespace and external-controller switches. Preserve new metrics and image inputs. | helm/codeapi/values.yaml and the existing deployment, secrets, network-policy, HPA, package-init and PVC templates |
| PVC package initialization | Retain the existing fallback mode and Argo lifecycle. Upstream still uses Helm hooks. Keep image-baked packages as the deployed mode. | helm/codeapi/templates/package-init-job.yaml, pvc.yaml; values.yaml; README.md |
| Completion polling and Redis recovery | Retain. Upstream routers still wait on queue events and its egress retry can terminate. Preserve newer admission validation. | service/src/queue-wait.ts, queue.ts, job-cancellation.ts, egress-ledger.ts; existing router call sites |
| Issuer-keyed JWT and tenant isolation | Retain. Upstream remains single-issuer; preserve all newer signed-worker validation. | service/src/auth/librechat-jwt.ts and test; docker-compose.yaml; bridge/pairing.ts verification |
| Public versus sandbox wire contracts | Retain as active behavior: the historical Draft ledger label is stale because the contract commit is on fork main. Integrate newer upstream admission fields without exposing internal sandbox fields. | api/openapi.yaml; service/openapi.yml; service/src/openapi-contract.test.ts; router/types/workers seams |
| Values-free logs and nonfatal telemetry | Retain the central sinks and fault guard. Upstream lacks equivalents. Delete the retired socket proxy with upstream, and inspect the new pipe execution/log forwarding seams. | shared/operational-log.ts, telemetry-core.ts and tests; api/service logger constructors, job.ts; new pipe files; service build includes |
| Missing-bucket readiness | Retain. Upstream lacks the fork's failing readiness result for a missing artifact bucket. | service/src/file-server.ts and file-server-readiness.test.ts |
| Refused-connection retry, absolute deadline and cancellation | Retain. Upstream's overlapping redirect prohibition is already part of the fork behavior; preserve it once. Never retry an ambiguously accepted request. | service/src/sandbox-backend/http.ts and test; service/src/service/exec-timeout.test.ts |
| Earlier readiness and trusted-worker resources | Retain. These fork controls are not replaced upstream. | helm/codeapi/templates/worker-sandbox-deployment.yaml; values.yaml; tests/block_root_package_delivery.sh |
| Duplicated bridge timeout coverage and removed socket code | Retire only proven duplicates and upstream-deleted implementation. Preserve distinct negative cases and the new pipe tests. | service/src/bridge/router.test.ts; api/src/tool-call-socket-proxy.ts |

A merge-tree simulation identifies nine conflicts: `api/Dockerfile`,
`api/src/tool-call-socket-proxy.ts` (modify/delete),
`docker/Dockerfile.worker-sandbox`, `helm/codeapi/Chart.yaml`,
`launcher/Dockerfile`, `service/openapi.yml`,
`service/src/bridge/router.test.ts`, `service/src/sandbox-backend/http.test.ts`
and `service/src/sandbox-backend/http.ts`. Auto-merged seams still require
semantic verification. Preserve upstream Chart.yaml dependency changes and
release metadata; commit SHA remains the deployment identifier.

### Compatibility decisions required by the source assessment

- **Workspace admission persistence stays inactive.** Upstream constructs
  `RedisWorkspaceRequests` when `isBridgeEnabled()` is true, retaining request
  and result records for twenty-four hours. This package preserves the HTTP/KVM
  execution deployment: intended GitOps values explicitly select
  `CODEAPI_SANDBOX_BACKEND=http`, `CODEAPI_BRIDGE_AUTH_MODE=static`,
  `CODEAPI_BRIDGE_DYNAMIC_WORKERS=false` and an empty `CODEAPI_BRIDGE_TOKEN`.
  Verify these exact configuration semantics against `bridge/enabled.ts` before
  rollout, including secret projection keys without reading their values. A
  token reference, paired mode, dynamic workers or remote-bridge activation holds
  rollout for a concrete persistence decision; do not enable this new storage
  behavior implicitly. No new fork feature switch or module is planned.
- **Accept the upstream package engine floor.** `packages/code/package.json`
  requires Node >=22.21 and upstream CI covers Node 22/24. Retain this floor
  rather than adding an untested Node 20 compatibility patch. This package does
  not publish the worker CLI or an npm package. Existing HTTP consumers retain
  their wire contract; the API/worker images use their upstream Bun runtime.
  If an identified supported Node 20 package consumer is discovered, hold source
  publication for its explicit disposition. Run the existing Node 22/24 package
  checks and Bun image checks to validate their separate runtime boundaries.

The imported upstream file manifest is frozen by the exact command
`git diff --diff-filter=A --name-only c8b3e1490416753b6f633e4cdbf9100e93aeb849 a62d69e05a4541ac9a20722ac7ff3fcfecb6ed24`.
This includes the anonymous-pipe C/TypeScript helpers, Python runtime support,
nsjail patch and their upstream tests. Import those paths without inventing
fork-authored replacements. No new fork-authored source module or test file is
planned; changes stay in existing seams named in the matrix. The approved plan
and existing replay ledger are the documentation artifacts.

### Delegation map

| Slice | Owner | Dependency and completion check |
| --- | --- | --- |
| 1: source reconciliation and ledger | main | Reviewed plan; frozen upstream merged, conflicts resolved and every active fork path accounted for. Independent of capacity runtime acceptance. |
| 2: source validation and publication | main | Slice 1; native suites/builds/rendering, required reviews, source CI, merge ancestry and commit-image publication pass. |
| 3: STG software rollout | main | Slice 2 and separately accepted STG ready capacity; exact pins and synthetic consumer/artifact acceptance pass. |
| 4: PRD release and closeout | main | Applicable STG acceptances, reviewed complete promotion delta and recorded human release approval; exact production pins and equivalent acceptance pass. |

### Slices and acceptance

1. **Reconcile source and ledger — main.** Commit this reviewed plan first, then
   merge the frozen tag with history preserved. Resolve the nine conflicts from
   current upstream behavior and the matrix above. Update the replay ledger from
   the final trees, including the missing readiness and startup/resource entries.
   Assign every active fork path once or name a shared seam explicitly. Record
   historical-only and retired remnants so a future sync cannot resurrect them.
2. **Validate and publish source — main.** Run the existing API/service/code
   package suites and builds, deployment configuration checks, Rust/C launcher
   checks where changed, chart rendering against existing values, and upstream
   pipe/runtime image checks. Retain repository tools and lockfiles. Use the
   existing container or CI toolchains; do not start an application merely for
   configuration checks. Resolve focused risk, simplification and integrated
   final review findings. Open a draft PR, require all applicable source CI, then
   perform the authorized history-preserving main merge and verify merged CI.
   Build and publish all existing commit-addressed fork images; prove the frozen
   upstream commit and prior fork baseline are ancestors.
3. **Staging software rollout — main.** First complete the separately governed
   STG ready-capacity acceptance on the old software. Before merging new values,
   use the separately agreed deployment route to pin the existing Application's
   values source to its verified baseline commit. Confirm unchanged chart,
   images, health and convergence. STG follows values `main`, so merging values
   before this freeze could deploy new images with the old chart.

   In helm-charts change `codeapi/stg/values.yaml` commit-image tags and the
   explicit inactive-bridge settings above. Render the baseline pair and the
   proposed new chart/values pair before either merge; land values only after
   all referenced images exist and the baseline freeze is verified. In df-cloud
   change the STG chart and values revisions in `src/apps/codeapi/functions.ts`
   and applicable existing function tests. Through the agreed deployment route,
   adopt both tested immutable revisions in one update to the existing
   Application. Preserve Pulumi ownership and all other Application fields.
   Verify full source previews and recovery pins, Argo convergence, and
   prove exact deployed digests/revisions and external replica ownership. Run the
   existing reviewed artifact and first-after-idle probes against the upgraded
   revision, exact synthetic download/reuse, guest timeout, cleanup and canaries.
   When changed, exercise actual cancellation independently of timeout. New pipe
   runtime must execute the synthetic guest correctly under existing isolation.

   After acceptance, restore STG's existing values-`main` tracking only when a
   fresh comparison proves that its CodeAPI values match the tested commit and
   the Application has no active operation. Confirm the resolved revision and
   unchanged workloads afterward. A changed values tree holds this restoration
   for review; it cannot silently introduce an unrelated promotion. Neither the
   freeze nor restoration grants host deployment authority or CI cluster access.
4. **Production release and closeout — main.** Review the entire normal stg-to-prd
   promotion delta and require its recorded human approval. Hold unrelated
   effects. Promote the exact accepted source/image/chart: the PRD revision
   entry in df-cloud `src/apps/codeapi/functions.ts` and the corresponding image
   tags/inactive-bridge settings in helm-charts `codeapi/prd/values.yaml`.
   Complete source previews and image availability before the values merge and
   adopt the tested chart/values revisions together through the agreed deployment
   route. Keep PRD values immutable, with the same prerequisite ordering as STG.
   Stop on any unapproved path/delta, missing recovery pin or failed acceptance.
   Repeat the staging-accepted synthetic
   consumer/artifact and idle-floor checks; do not evict production nodes or
   destroy caches to manufacture a cold start. Verify canaries and stop owned
   tests, watches and service port-forwards. Refresh release metadata and report
   the frozen accepted version and any newer unassessed release accurately.

### Preserve successful completion during pipe shutdown

The packaged runtime can complete a tool call and still return exit 137. The
relay owns the request writer until it has reaped the invocation. Its clean
shutdown can therefore deliver request EOF before the relay process returns;
treating that EOF as failure lets the broker kill a successful relay.

Correct `api/src/tool-call-pipe-broker.ts`: close gracefully at a complete frame
boundary, retain failure for an incomplete frame, and make failure callbacks
idempotent after closure. Keep the C relay, descriptor implementation, filters
and parent-death behavior unchanged. No shutdown grace period is introduced.

Extend existing `tests/pipe_runtime_image.cjs` with deterministic clean EOF,
partial header/body, malformed frame, active error and late error cases against
the packaged broker export. The old broker must fail the clean EOF case. Reuse
its actual packaged round trip and `tests/tool_call_pipes.py` for lost-reader,
flood and parent-death termination. Require repeated successful round trips
and those negative cases before accepting this correction. The existing orphan
reaping test must also wait within its existing deadline when adoption has not
yet made the descendant a child of the subreaper; preserve its exact SIGKILL
status check after adoption. No new test file, dependency, privilege or
deployment action is needed.

### Reproduced asynchronous cleanup assertion

The imported `api/src/pipe-process.test.ts` immediately scans owned pipe inodes
after child completion. Reproduction shows Bun-owned duplicate descriptors can
remain briefly while asynchronous cleanup drains. Waiting for FileSink end and
all wrapper close events did not eliminate the race; replacing these streams
with standard filesystem streams failed the existing runtime contracts. Keep
the upstream runtime implementation. Adapt only the existing leak test to wait
for exact owned-inode disappearance with a bounded event-loop check. Preserve
the empty-set assertion and qualify it against an intentionally retained
synthetic descriptor. A persistent leak must still fail. No fixed sleep, new
module or new maintained test file is needed. Run the focused test repeatedly,
then the full API suite and native sandbox checks before accepting this change.

### Explicit source CI execution

The source CI workflow also accepts an explicit manual dispatch of its existing
checks on the task ref. This supplies a supported execution path when no pull
request run is created. It adds no live environment access or new job authority.
The fork release job remains disabled and deployment remains separately gated.

### Test portfolio

| Risk | Obligation and primary seam | Distinct acceptance |
| --- | --- | --- |
| Issuer/tenant or signed worker regression | none: reuse service/src/auth/librechat-jwt.test.ts and existing bridge signature/tenant tests; preserve their cases unchanged. | Cross-entry and tenant negatives, legacy compatibility and current signature validation pass. |
| Public/internal response mixing | extend existing: service/src/openapi-contract.test.ts for the incoming admission fields while preserving public/internal separation; existing router/type checks remain. | Public responses omit internal fields while new upstream admission fields remain valid. |
| Lost completion, duplicate dispatch, deadline or cancellation failure | none: reuse queue-wait, job-cancellation, exec-timeout and sandbox-backend/http tests against the semantic merge. | Event lag recovers, refusal-only retry stays bounded, accepted/ambiguous requests are not replayed, caller abort and deadline remain distinct. |
| Telemetry or logging failure leaks/breaks requests | none: reuse API/service central logger and telemetry fault tests; inspect new pipe/job forwarding call sites for a sink that bypasses them. | Sensitive synthetic sentinels are absent from output and telemetry failures preserve request behavior. |
| New pipe runtime or sandbox permission regression | replace/consolidate: adopt upstream pipe/process/supervisor tests and remove only duplicated bridge timeout coverage; retain existing spec-guard smoke and image builds. | Pipe helpers and guests work under the actual built sandbox image and existing isolation. |
| Argo ownership, storage or package initialization regression | none: reuse full chart/deployment tests, block_root_package_delivery.sh and file-server-readiness tests; render the current GitOps values and inactive-bridge contract. | Same intended owners/namespace/placement, correct package mode, external storage readiness and no unintended workload delta. |
| Release metadata or mechanical pins | none: existing workflow schema/build, ancestry checks and exact revision verification suffice. | Fork release job stays inert; all images use the tested source commit. |
| Actual consumer regression | none: reuse the reviewed in-memory-token artifact and idle-floor fixtures without adding a live harness. | STG then PRD execution, exact-byte artifacts/reuse, timeout enforcement, cleanup, retained floor and canaries pass. |

Add a test only for a reproduced consequential behavior that existing protection
does not cover. Name its file and failure in this plan before adding it. No copy,
prose, seed-data or documentation-pinning tests. No browser contract changes are
planned; screenshots do not apply.

### Recovery and evidence

Record the prior verified chart/image/application pins privately before each
rollout. Recover a failed application through an ordinary source/GitOps revert
branch for that environment after the same required checks and release approval.
Restore the verified chart and values pair together through the agreed route;
do not expose a mixed pair during recovery. Keep a failed STG upgrade pinned
until its verified baseline is restored before considering values-`main` tracking.
Preserve accepted node/runner capacity, storage and snapshots unless that exact
component caused the regression. A failed staging gate blocks production.

Use only existing user connectivity and approved Infisical profile scopes; keys
remain in memory. Operational observations and receipts stay in ignored local
review directories, never tracked plans, CI output or PR/MR bodies. The existing
retention monitor keeps its owner, schedule, historical resources, genuine aging
fixtures and recovery authority independently of this package.

## Progress

Status: the frozen upstream tree is reconciled, the nine conflicts are resolved
and the replay ledger accounts for active fork behavior. API and service builds,
focused fork-contract tests, the native service suite, isolated real-Redis
admission checks, Node package checks and deployment configuration checks have
passing source evidence. The full API suite now passes after adapting its
existing exact-inode leak assertion for asynchronous Bun descriptor cleanup.
The bounded assertion passes repeated runs and rejects a retained synthetic
pipe. Native supervisor-policy, pipe relay and DNS checks pass. The packaged
broker correction preserves normal exit at clean EOF while incomplete frames
and active errors still fail once. Local packaged guest checks and repeated
cancellation/orphan cleanup checks pass. The integrated source review has passed.
Hosted platform CI remains blocking; source merge and publication are held.

The CI access constraint and source-derived logging-test reuse were approved by
the same Astra planner as a focused plan amendment. No test file was added;
the OpenAPI contract test now covers upstream workspace protocol routes and
removes one prose assertion. Source delivery may use a draft PR with these
remaining checks identified. Both environment acceptances remain outstanding.
Required delivery layer is verified production rollout; no deployment is claimed
from source verification. Current live status and blockers remain private.

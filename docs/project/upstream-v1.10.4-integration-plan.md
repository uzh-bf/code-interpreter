# Upstream v1.10.5 integration

## Approval summary

Upgrade the fork and both GitOps environments to upstream stable v1.10.5 while
preserving required consumer, authentication, storage and sandbox contracts.
The user explicitly requested the latest version and an executable goal after
updating the governing plan with Astra. This is an executable batch under the
[16 October continuation](2026-09-19-storage-recovery-upstream-v1.4.0-plan.md).
Required human production release approval remains binding.

Freeze upstream v1.10.5 at `58a023da4c47452f5e40114934679d0348c39064`,
verified through the official latest-release API and fetched tag. Fork baseline
is main at `880c3822e0986043d99b0d75c12f45e7703c9614`; merge base is
`a62d69e05a4541ac9a20722ac7ff3fcfecb6ed24` (v1.10.4). Refresh latest-release metadata
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

The official release is [v1.10.5](https://github.com/LibreChat-AI/code-interpreter/releases/tag/v1.10.5).
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
3. **Staging software rollout — main.** Use the approved values-only GitOps
   amendment below. Retain the separately accepted ready-capacity prerequisite
   and all source, runtime, isolation and cleanup checks. Chart-source alignment
   and the production owner-update route remain separate open work.
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

The existing source CI checks also run on pushes to the exact
`rs/upstream-v1.10.4` integration branch, with unchanged jobs and permissions.
This route does not depend on pull-request event delivery or default-branch
registration of a manual trigger. It adds no live environment access or new
job authority. The fork release job remains disabled and deployment remains
separately gated.

Manual dispatch remains declared for use once its trigger is present on the
default branch, as required by the [GitHub manual-run contract](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow?tool=cli).
A trigger added only on the integration branch does not satisfy that condition.
Require an actual hosted run before accepting CI; if the validated push creates
none, preserve evidence and hold without widening the trigger or changing
repository settings.

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
rollout. The values-only staging recovery is defined in the amendment below.
For later paired-chart or production adoption, restore the verified chart and
values pair together through its explicitly agreed route after required checks
and production approval. Preserve accepted capacity, storage and snapshots
unless the exact component caused the regression. A failed staging gate blocks
production.

Use only existing user connectivity and approved Infisical profile scopes; keys
remain in memory. Operational observations and receipts stay in ignored local
review directories, never tracked plans, CI output or PR/MR bodies. The existing
retention monitor keeps its owner, schedule, historical resources, genuine aging
fixtures and recovery authority independently of this package.

## Historical progress: v1.10.4 source work

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

## v1.10.5 patch continuation

Continue the executable batch under the user's latest-stable request. Main owns
this source preparation, verification and draft PR. A new default-branch merge
requires named authority and applicable human review. The environment sequence
and all deployment gates above remain binding.

Merge both upstream patch commits with history preserved. Their four paths are
`.github/workflows/ci.yml`, `api/src/entrypoint.sh`,
`tests/sandbox_pipe_addon_image.ts` and `tests/supervisor_policy.py`. The guest
entrypoint supplies the installed anonymous-pipe addon path after the rootfs
COPY/VM boundary, preserving an explicit override. No dependency, identity,
schema, capacity or deployment configuration changes are included.

The CI increment adds privileged Docker guest executions and two image-build
matrix jobs, each capped at twenty minutes. Run them only on disposable
GitHub-hosted runners, with synthetic signing keys, disabled container networking
and read-only workspace mounts. Supply no deployment credentials or cluster
access. The fork Release job remains unconditionally disabled.

Add the upstream guest-addon image regression test for unset, empty and custom
addon paths. Replace/consolidate the touched NsJail startup-failure assertion:
the same command with a valid executable must succeed, while a missing
executable must fail within five seconds. Assert process behavior rather than
diagnostic prose. Preserve the other supervisor-filter checks. Record this small
downstream test deviation in the existing replay ledger.

Commit this amendment before source integration. Run focused syntax/workflow
checks and actual hosted guest-image cases, preserving unsigned-request
rejection and exact synthetic stdout/stderr. Apply the existing source review
gates and open a draft PR with outstanding qualification stated. Source
qualification, merged CI, image publication and environment acceptance remain
separate. Preserve the original plan location, private receipt directory,
recovery branches and independent retention follow-ups.

Source integration and commit-addressed image publication are qualified. The
approved staging amendment below governs runtime verification; production and
full chart-source alignment retain their separate gates. Operational acceptance
and detailed current checkpoints remain in ignored private receipts.


## Approved values-only staging GitOps amendment

Approval mode: executable batch. The user approved this amended staging sequence
and goal. It replaces only the former staging values freeze, atomic Application
chart/values update and values-tracking restoration, and their staging paired
recovery. The existing delegation map, test portfolio, source acceptance,
ready-capacity dependency and independent snapshot obligations remain binding.
Execution mode remains standard; main owns integration, external effects,
existing-context verification, secret handling, evidence and cleanup.

The complete candidate render under the selected chart must be equivalent to
the upstream chart render except chart-version metadata labels. Package-init,
metrics and bridge activation gates must be checked from actual templates and
values; configured inactive images are not running workloads. Retaining the
compatible chart for this runtime slice defers full chart-source alignment; it
does not close the original staging-and-production integration objective.

### Approved sequence and acceptance

1. Freshly fetch source and GitOps repositories. Require exact reviewed MR188
   source, required successful CI/reviews, resolved discussions, applicable human
   policy and an effective merge delta limited to codeapi/stg/values.yaml.
   Validate image availability, prior ready-capacity acceptance on old software,
   existing Application identity/source selection, healthy convergence and no
   active operation. Reuse accepted unchanged source checks; unexpected relevant
   drift holds for comparison and affected checks.
2. Persist this amendment before deployment and correct the MR's obsolete freeze
   requirement. Keep all environment observations in ignored private receipts.
   Mark the reviewed MR ready and merge into main with a merge commit, no squash
   and source branch retained. Verify parents, merged tree, merged CI and values
   content. No host Pulumi, deployment credential setup, CI cluster access,
   Application-pointer mutation, new connection or capacity change is needed.
3. Let existing Argo reconciliation deploy the values. Use a bounded observer
   through convergence and the entire functional/burst/idle verification window.
   Bind the unchanged chart selection, effective CodeAPI values and actual image
   revisions/configuration throughout; unrelated commits with identical effective
   values do not invalidate evidence. Relevant drift or an observation gap holds
   affected acceptance. Require expected active images/digests, replica ownership,
   namespace/security policy and a Ready standby runner. Record first execution
   after natural rollout separately; do not manipulate caches, nodes or replicas
   to manufacture a cold start.
4. Use the existing reviewed in-memory-token artifact/guest fixtures and exact
   codeapi-stg secret read scope. Require exact artifacts, metadata/reuse, guest
   timeout and pipe execution, owned-object cleanup/input404 and both storage
   canaries. Exercise actual cancellation independently when its implementation
   changed; timeout does not prove cancellation. Use the accepted bounded burst
   fixture and observers to prove a single demand counter above one, automatic
   scale-out and return to the minimum. Observe an uninterrupted interval longer
   than twenty minutes without synthetic keepalive, retained Ready minimum and
   first-after-idle execution. Old-runtime capacity evidence alone cannot accept
   the new software. A warmed retry never clears a failed sample.
5. Stop owned probes, watchers and service port-forwards and verify cleanup and
   current health. Preserve private evidence and report STG acceptance separately
   from chart-source alignment and production delivery.

### Conditional staging recovery

On a failed runtime gate, hold promotion and preserve evidence. Use the existing
Helm recovery branch rs/codeapi-stg-v1.10.5-recovery. Fetch current target before
preparation and again before readiness/merge. Restore only the rollout's verified
values delta from its privately bound pre-merge baseline, preserving intervening
approved edits to the same file, every other path and all history. Validate the
scoped inverse delta and effective merge tree; conflicts or target movement hold
for disposition instead of overwriting later work.

Run applicable source/render/lint checks, then mark the one-file recovery MR
ready and merge with history/source branch retained only after required checks
and approvals pass and it restores the accepted baseline under the unchanged
chart. Let Argo reconcile and verify baseline images, health and canaries. No
live patch, blind retry, storage cleanup or production-pointer change is covered.
If the bounded recovery cannot meet these conditions, report the exact blocker.

### Remaining integration work and review

Production retains its recorded human release gate and immutable values pointer.
Its legitimate owner-update route must satisfy the user's no-cluster-in-CI
constraint. Host Pulumi, the legacy cluster-authenticated job, floating production
tracking and ownership migration are not substitutes authorized here. Full
upstream chart-source alignment remains open under the original goal.

The frozen amendment passed the existing two-round native planning review after
corrections for same-file recovery preservation, configuration binding throughout
acceptance and reuse of old-runtime capacity acceptance as a prerequisite. The
existing source reviews and complete render proof remain valid for unchanged
source. Final integrated verification/review remains required. Real-environment
results belong only in ignored receipts; this plan records intended contracts.

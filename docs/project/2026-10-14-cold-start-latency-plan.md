# Faster sandbox readiness and 20-minute idle retention

## Approval summary

Approval mode: executable batch. Execution mode: standard. The user approved
persisting this plan, implementing the 20-minute keepalive and earlier readiness
in STG, verifying cold starts and artifact E2E, then rolling out to PRD when all
checks pass. This continues the existing storage/upstream project; the governing
history is in `2026-09-19-storage-recovery-upstream-v1.4.0-plan.md` in the existing
storage investigation checkout. No new goal or separate chat is required.

The candidate retains the last idle sandbox runner for 1200 seconds, matching
the existing pool-waker window. KEDA's burst scale-down stabilization remains
300 seconds, so this does not retain every peak replica for 20 minutes. The
runner readiness probe uses its existing healthcheck, starts after five seconds
and repeats every five seconds. Its seven-second timeout, failure threshold,
liveness policy, security settings and absolute request budgets stay intact.
Earlier failed readiness checks do not restart the container. No startup probe
is needed solely to run readiness earlier; add none without a demonstrated
startup/liveness failure requiring an in-scope correction.

Scope includes source/task-branch pushes, draft PR/MRs, required reviews, CI,
history-preserving merges with source branches retained, scoped GitLab CodeAPI
app applies, GitOps rollout, synthetic E2E and owned test cleanup. The normal
main-merge image workflow may publish commit-tagged images, but deployed image
pins remain e0b8c440: this chart change needs no new runtime image or stable tag.
No on-demand node, min-capacity increase, node/registry/disk change, dependency,
new secret scope, workload privilege change, snapshot-policy change, Alertmanager
or fork stable tag/release is included. Real idle verification extends test
runtime; steady-state minimums and node ceilings remain unchanged.

STG acceptance requires exact source/render/live agreement, passing source CI
and reviews, three independent zero-runner starts with successful artifact E2E
and measured readiness, at least one fresh node/uncached image, a request after
more than five idle minutes reusing the retained runner, and genuine return to
zero after the 20-minute idle window. PRD follows only after STG passes and its
existing release/human-review gates and scoped preview pass. Preserve the prior
hold on unrelated promotion changes: do not merge broad release !679 merely to
advance CodeAPI. If that hold or a required recorded human approval is unresolved,
finish independent preparation and report the precise blocked PRD branch.

## Binding evidence and working context

Baseline: source main53ce639, deployed STG chart8eb246c, PRD charte0b8c440,
PRD values74296284, Helm main3992918, df-cloud stgc92aa88 and prd7069d94.
Refresh these before authoritative mutations. The observed latest full cold
request took340.517s:149.9s node scheduling,39.9s KVM setup,94.2s image pull,
43s container/readiness and13.5s residual; code101ms. Cached-node zero-runner
requests took36.026/68.673s with31-32s container-to-Ready. No SLA is inferred.
The same five-second healthcheck and fd/clock checks remain the readiness gate.
API/worker480000ms, manifest540s and egress900s remain the bounded recovery path.

Use the existing task clone's Git worktree at
`trees/storage-reliability-investigation/trees/startup-readiness`, branch
`rs/codeapi-startup-readiness`, based on origin/main53ce639. Primary checkout
contains unrelated untracked work and protects its Git metadata; preserve it.
Helm worktree is `/private/tmp/codeapi-snapshots-20261012.MXrwGT/helm-charts/trees/codeapi-idle-keepalive`,
branch`rs/codeapi-idle-keepalive`, origin/main3992918. df-cloud STG worktree is
`/private/tmp/codeapi-snapshots-20261012.MXrwGT/df-cloud/trees/codeapi-startup-stg`,
branch`rs/codeapi-startup-stg`, origin/stgc92aa88. PRD preparation uses a separate
named task branch only after STG acceptance. Host Git/gh/glab own forge effects;
Pulumi runs only in GitLab CI, and GitOps owns workloads. Static/render checks
need no local application or DevPod runtime.

## Ownership and source sequence

Main owns authority, secret/live access, integration, CI/forge effects, plan and
final proof. A trusted native executor owns only the two application chart edits.
Main owns the single-field Helm overlay edits and exact df-cloud source pins:
these are mechanical and coupled to source/rollout ordering. A native read-only
planner challenges this draft before plan commit/implementation. Reuse applicable
unchanged algorithm/security reviews; a focused trusted slice reviewer checks
changed runtime/reconciliation seams, and trusted Claude CLI performs the final
source review on immutable ranges. No simplifier is needed for literal-only
probe/retention edits unless implementation gains real control flow/complexity.

1. Persist this reviewed plan before implementation. Source package files:
   `helm/codeapi/templates/worker-sandbox-deployment.yaml` (only runner readiness
   initialDelaySeconds30->5 and periodSeconds10->5), `helm/codeapi/Chart.yaml`
   (chart metadata0.3.2->0.3.3), and this plan. Keep appVersion unchanged.
   Use existing healthcheck/render tests and hosted CI, with no new maintained
   test for literal YAML edits. Render with actual STG and PRD values and prove
   every object equals its deployed baseline except approved runner readiness
   and ordinary chart metadata. Inherited trusted-worker resource changes must
   be inert for each current environment or treated as a separate promotion hold.
2. Helm STG package touches only
   `codeapi/companion/stg/keda-sandbox-runner.yaml` cooldownPeriod300->1200 and
   `project/2026-10-14-codeapi-startup-rollout-plan.md` as a minimal plan pointer. All queue triggers, HPA
   stabilization300, min0/max3, fallback and waker stay unchanged. PRD file is
   unchanged until STG passes. Render Kustomize and prove exact delta, one HPA
   owner and Argo ignore policy. These small per-repository packages are exempt
   from the packaging floor because together they form one release outcome.
3. df-cloud STG package changes only the STG entry of
   `CODE_INTERPRETER_TARGET_REVISION` in `src/apps/codeapi/functions.ts` to the
   immutable reviewed chart-source head, plus `project/2026-10-14-codeapi-startup-rollout-plan.md` as a plan pointer.
   Keep all values/image pins and PRD entry unchanged. Obtain actual GitLab
   CodeAPI app previews; accept only the intended Application source pin and
   proven unchanged defaults/bookkeeping, with no unrelated deployment, delete
   or replacement. CodeAPI source PR targets main, Helm MR main, df-cloud MR stg.
   Keep required CI/reviews, merge without squash and retain branches. Main-merge
   image publication is existing CI behavior; do not deploy those new images.
4. Apply only the merged STG CodeAPI app child after its actual preview passes;
   verify live source/image/probe/scaler values, health and replica ownership.
   Helm main auto-syncs the STG-only retention change. PRD remains at baseline.
   Finish all source review gates before ready/merge claims. Publishing early
   draft PR/MRs for CI is allowed while checks/reviews are explicitly pending.

### Delegation Map and test portfolio

| Slice | Owner | Dependency and acceptance |
| --- | --- | --- |
| Application readiness source | trusted native executor | reviewed plan; literal diff, healthcheck tests, baseline render parity and source CI |
| STG retention overlay and chart pin | main | immutable application head; Kustomize parity, scoped app preview, replica ownership and review |
| STG runtime acceptance | main | exact deployed candidate; three cold E2Es, measured readiness gain, same-UID six-minute proof and genuine expiry |
| PRD source and adoption | main | all STG gates, release gates and unrelated-delta disposition; same source/retention, PRD cold/warm/idle proof |
| Recovery and receipts | main | observed regression or completion; scoped declarative restore if needed, sanitized committed checkpoint and owned-process cleanup |

| Risk | Maintained test delta | Evidence |
| --- | --- | --- |
| Readiness safety and actual latency | none | existing healthcheck tests, exact rendered probe delta, three real starts with start/Ready timestamps, healthy E2E and zero restart/flap |
| Idle retention and expiry | none | unchanged queue/HPA contract, actual same-UID retention after six minutes, native zero watch and scaler lastActiveTime cutoff |
| Promotion and render integrity | none | all-object baseline comparison, exact source/image pins, scoped GitLab previews, CI, immutable source review and Argo readback |

Slices must not expand this portfolio without a consequential uncovered failure.
Static checks need no local service/container runtime. Rival planning review is
not armed: these literal timing changes preserve architecture, security/data
boundaries and the public API contract; their runtime seam risk is covered by
the native planner and focused slice/final reviews.

## Runtime acceptance and recovery

Use existing probes `docs/project/_local/reviews/codeapi-stg-e2e-diagnostic-auth.mjs`
and `codeapi-prd-e2e-diagnostic-auth.mjs` in the governing storage investigation
checkout, importing its reviewed `codeapi-v140-stg-e2e-diagnostic.mjs`, and existing
Infisical profiles/scopes only, keeping signing keys/tokens in memory. Observe
lifecycle from the actual producing run, including Pod/Node UIDs, image pull
and container-start/Ready times. Store sanitized receipts under this branch's
ignored`docs/project/_local/reviews/2026-10-14-startup-rollout/`; governing project
checkpoints reference these and retain existing storage receipts.

STG: start from verified zero desired/current/ready runners and no runner Pods.
Use one genuine fresh-node request if the pool is naturally empty; otherwise
wait for natural node retirement with a2400-second native-watch deadline,
never force-delete nodes. STG runtime acceptance is bounded to150minutes total,
PRD to75minutes; healthy operations remain with their existing watchers. A
failed/inconclusive condition holds only dependent rollout steps. Run three independent
zero-runner E2Es; natural 1200-second idle expiry can separate requests on cached
nodes. Every E2E must pass exact input/artifact bytes, guest timeout SIGKILL137,
three synthetic deletes and input404. Take at least three ready-runner samples.
Measure candidate container-to-Ready against the existing31-32s floor; require
all routed requests healthy and no restarts/flapping, and require median container-start-to-Ready below25seconds (at least6seconds
better than the31-32second baseline) across those three starts. All must remain
healthy with zero restarts/flapping; inconclusive or absent improvement holds
PRD. Report gains only where comparable timestamps show them. Node/pull variance does not establish a
probe gain or regression on its own. Fresh-node requests must complete inside
the existing deadline without warm retry; failures hold dependent PRD work.

After one completed trial, leave the runner idle for at least six minutes and
prove the same runner remains Ready under Argo self-heal before a warm E2E;
record and match its UID immediately before and after that E2E in each environment.
Record scaler lastActiveTime and restart the expiry clock after that request.
Idle observations require an uninterrupted interval: genuine queue activity
restarts the measured idle clock, with at most one restart per idle observation
and the environment-wide deadline still binding. Record interference rather
than treating an active queue as a failed cooldown. Require no scale-to-zero
before lastActiveTime+1200seconds and zero runners by that time+90seconds;
unavailable timestamps, repeated interference or deadline exhaustion are
inconclusive blockers. Then
observe actual1200-second expiry, with bounded90-second reconciliation allowance,
and verify zero runners/no leftover Pods. Use native event watches with one
watcher per operation and no manual live scaling, KEDA deletion, or shortened
cooldown. This last genuine expiry must pass before PRD promotion.

PRD: add the PRD entry change in `src/apps/codeapi/functions.ts` on a new branch
from current stg and merge it to stg after source checks/review. It takes effect
in PRD only through the normal stg->prd release. Prepare the same 1200-second
cooldown in `codeapi/companion/prd/keda-sandbox-runner.yaml` on its dedicated Helm
branch and the identical
tested chart-source pin through the normal df-cloud stg->prd release path. Keep
an unrelated-delta hold and required recorded human release approval. Because
PRD companion auto-syncs Helm main, all STG gates, release approval, unrelated
delta disposition and applicable previews must pass BEFORE the PRD Helm merge
as well as before the PRD source-pin apply. Do not activate a partial PRD
package merely because one MR is mergeable. No branch
protection changes or approval requests to other people are authorized. Inspect
actual PRD app preview before scoped apply. After all gates pass, merge/apply
the approved branches and verify one cold artifact E2E plus three ready-runner
samples, same-UID six-minute retention, genuine20-minute return-to-zero, health,
canaries and unchanged storage/security. The three STG independent cold trials
and existing PRD trials support this bounded environment-adoption check; no
population percentiles or HA/SLA claim is made.

On source/runtime regression, hold dependent PRD promotion and preserve receipts.
Use reviewed GitOps recovery branches`rs/codeapi-startup-rollback-stg` or
`rs/codeapi-startup-rollback-prd` to restore that environment's prior chart pin
and cooldown300 as needed, with scoped CI preview/apply. Preserve unrelated
promotion deltas, source branches, images, historical snapshots/PVCs/Jobs and
current snapshot schedule. Clean only newly owned synthetic objects and stop
owned tunnels/watchers; no manual production pod/node deletion or live patch.

## Progress

Native planner Pauli approved round2 after all four round1 findings were
accepted: measurable readiness gain, pre-Helm PRD gates, bounded uninterrupted
idle observations, and complete ownership/test portfolio. Approval recorded
before implementation. Source implementation has not started. Test delta planned: zero new/changed/removed maintained tests; focused
existing render/healthcheck contracts plus actual runtime acceptance.
Terminal: verified STG and PRD adoption with sanitized receipts, committed/pushed
checkpoints and owned-process cleanup; or a precise remaining source/review/CI/
release-authority/runtime blocker after independent authorized work is complete.

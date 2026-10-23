# CodeAPI reliability and upstream maintenance roadmap

## Approval summary

Approval mode: executable batch. The user accepted the setup-review recommendations and requested that this roadmap be persisted before execution. The goal is to make the maintained fork easier to upgrade, keep reliability regressions continuously tested, complete the existing staged release, and make consumer acceptance repeatable.

Start with the smallest source package: retain and explicitly guard the existing native startup-cancellation CI lane, correct the descendant-reaping test race using upstream's helper and regression cases, and update the fork patch ledger to account for the current lifecycle behavior. This package changes tests, CI and documentation, not deployed execution semantics. Continue the existing production release qualification independently, preserving its normal staging-to-production route, recorded human approval, source-only CI and guarded operator/GitOps registration contract. Then reconcile the latest upstream stable release and consolidate the approved consumer verification procedure. Availability and capacity work remains a design decision until service objectives and its cost are accepted.

The approval covers implementation, focused verification, scoped reviews, commits, ordinary task-branch pushes and draft delivery. Existing named merge/deployment authority survives only for its original targets and conditions. It does not authorize unrelated infrastructure promotion, new production diagnostics, cluster access from CI, new secret scopes, higher capacity or cost, new fork tags/releases, destructive cleanup, or a new release's merge/publication/deployment without its concrete gate.

The first deliverable is a reviewed draft source package with proof that the native lifecycle tests execute and the orphan-reaping regression distinguishes absent, live and reaped descendants. The complete roadmap finishes only after its source, runtime, consumer, observability and recovery acceptance are recorded at their respective gates. Real-environment observations and operational receipts remain in ignored private project artifacts.

## Execution details

### Contracts and continuity

The maintained behavior remains: upstream history and release versions, fork commits on top, immutable software pins, GitOps workload ownership, KEDA replica ownership, externally synchronized secrets and the existing default execution profile. Reuse the accepted contracts in [the observability and E2E plan](2026-10-18-codeapi-observability-e2e-plan.md), [the upstream integration plan](upstream-v1.10.4-integration-plan.md), and [the storage/recovery plan](2026-09-19-storage-recovery-upstream-v1.4.0-plan.md). Older progress text is historical; current environment evidence belongs in the private continuation.

No product primitive, API contract, ownership model or runtime behavior changes in the first package. It does not meet the ADR threshold. New availability ownership, storage architecture or public-contract changes re-arm design review before implementation. No UI changes are planned; screenshots do not apply to the source package.

### Roadmap and ownership

Execution mode: standard. Main owns integration, authority, cross-repository qualification, production effects and final proof. One bounded native implementation worker may own the test-helper port; main owns CI and ledger integration. Required planner/review passes operate read-only. No new user-visible chat is needed.

| Milestone | Owner and dependency | Acceptance and delivery boundary |
| --- | --- | --- |
| Lifecycle regression reliability | Main plus bounded test worker; first package | Existing native fork/startup coverage remains required and cannot pass with a missing bridge; descendant-race regression and integration pass; ledger accounts for active fork paths; reviewed task branch and draft PR |
| Complete existing production acceptance | Main; prior STG contract, refreshed whole-release scope and recorded human gate | Qualified source promotion, prerequisite-first GitOps rollout, exact deployed candidate, production consumer/provider artifact proof, metrics/dashboard and runner/scaling/idle verification; cleanup and recovery evidence |
| Upstream stable reconciliation | Main; first source package integrated or deliberately carried into the approved candidate | Compare current stable to the fork, preserve required behavior semantically, retire equivalent patches, run affected checks and stage immutable images before any separately gated production release |
| Repeatable consumer acceptance | Main; existing consumer test draft and source/runtime contracts | Maintained values-free operator entrypoint/runbook, durable paths, clear prerequisites, four scenarios and real-provider smoke with ownership-bound cleanup; no Kubernetes or production credentials in CI |
| Availability and capacity | Main; service-objective decision | Review interruption tolerance, recovery objectives, stable KVM baseline/Spot burst alternatives and storage redundancy; concrete cost and deployment approval precede changes |

A blocked milestone holds only dependent effects. Continue independent source work and qualification. Preserve branches, historical recovery resources and accepted evidence. Snapshot verification follows its existing acceptance and monitor-lifecycle contract; daily backup and canary ownership remains unchanged.

### Delegation map

| Bounded slice | Route and exclusive owner | Dependency and acceptance |
| --- | --- | --- |
| Plan, CI guard/regression wiring and integration | Main; critical-path coupling across the workflow and verification | Planning review, then exact command/source inspection and native tests |
| Descendant helper and focused Python regression | Native worker; only the two named Python test paths | Approved plan; regression catches prior defect and port preserves signal assertions |
| Fork ledger and path accounting | Main; unresolved ownership classification | Exact current comparison refs; every path explicitly classified |
| Release, upstream, consumer and availability milestones | Main; future separable work receives bounded ownership before implementation | Prior milestone contracts and each row's acceptance above; no new effects inferred |

### First package: lifecycle tests and ledger

Repository target: `uzh-bf/code-interpreter` `main`. Task branch: `rs/codeapi-lifecycle-ci`, under the existing governing checkout's `trees/codeapi-lifecycle-ci`. Artifacts stay in `docs/project/`; this roadmap lands with implementation and remains the shared roadmap for subsequent milestone progress.

1. Main retains the existing native amd64/arm64 CI lane and adds an executable-bridge preflight before its existing API pipe-process test command. The fast API job may continue skipping optional native cases because the required native lane already executes them. Do not add a duplicate execution lane or compiler dependency. A missing bridge must fail the authoritative native step. Preserve all existing checks and publication behavior.
2. The bounded test worker updates `tests/tool_call_pipes.py` with the descendant-wait helper from upstream commit `71ef714` (reachable from stable `v1.10.10` at `77bcd2ec2e63be523bfab2dfa11159a2ceec0088`) and adds that same immutable commit's focused `tests/test_tool_call_pipes.py` regression coverage. Preserve the fork's graceful SIGTERM/143 assertions. Run `python3 tests/test_tool_call_pipes.py`: an already-reaped absent PID succeeds; a live unadopted PID fails at the bounded deadline; adopted-child exit status is checked. Preserve controller-death SIGKILL checking alongside the graceful SIGTERM assertions. Replace the upstream test's incidental prose regex with an exception-type assertion. Main wires that focused regression into the existing relevant CI job so it cannot silently remain unexecuted.
3. Main updates `docs/fork/patches.md` with caller-disconnect cancellation, guest cleanup/release, bounded disabled-by-default synthetic observation, signed session binding and pipe startup ownership. At baseline fork `50cc28028a11fa8aff052dc23e389806f1950c10`, compare merge base `58a023da4c47452f5e40114934679d0348c39064` to the fork final tree and upstream stable `77bcd2ec2e63be523bfab2dfa11159a2ceec0088` to the fork final tree. Recompute at the final source head. Assign every active path to a behavior, explicit shared seam, documentation reference or byte-equivalent upstream port; hold unexplained paths. Mark old coverage totals as historical instead of asserting obsolete completeness. Preserve historical source evidence and record upstream helper equivalence without retiring distinct assertions.
4. Run the focused checks in a dependency-equipped ephemeral container, inspect the complete diff, commit the qualified slice, complete its applicable simplification/final review, and deliver an ordinary pushed task branch with a draft PR. The package is CI-unblocking and coherent even if its substantive change is small. It creates no deployment or image publication.

### Verification portfolio

| Consequential failure | Existing evidence and test obligation | Primary seam |
| --- | --- | --- |
| Startup cancellation silently skipped | None: reuse verified native execution; retain the three tests and require the existing bridge before the authoritative native command | API `pipe-process.test.ts` through the actual CI commands |
| Already reaped descendant falsely fails cleanup | Add new: upstream focused regression; show the prior behavior fails the absent-PID case | `wait_for_killed_descendant` in the existing Python integration test |
| Graceful shutdown contract lost during port | None: preserve fork's SIGTERM/143 assertions; run native integration in its existing container target | `tests/tool_call_pipes.py` and packaged broker/relay |
| CI or publication scope widens | None: workflow syntax and exact diff review; required checks retain their triggers and no deployment/secret capability is added | `.github/workflows/ci.yml` |
| Upstream merge loses fork behavior | None: mechanical active-path accounting plus source review of shared seams; no tests pin prose | `docs/fork/patches.md` against exact Git tree comparisons |
| Green delivery metadata mistaken for runtime acceptance | None: reuse prior proof only for unchanged source/toolchain/environment boundary; bind later rollout to actual operation, images and functional cases | Existing private operator receipts and release contracts |

### Release qualification and later source work

Refresh host Git/gh/glab metadata before authoritative checks. A normal release's branch name is not a scope guarantee: inspect the full current target-to-source diff and all contributing validation. Source-only CodeAPI CI cannot qualify unrelated infrastructure changes. Preserve the user's no-Kubernetes-in-CI rule; do not clear a missing gate with a local Pulumi route or new credentials.

The production sequence retains the previous exact prerequisite, chart, companion scrape-policy and values ordering. Record its current forward/inverse guards privately before applying any previously authorized operator change. A changed release scope or failed condition must be resolved before dependent effects. Source/runtime merge authority is never inferred from reviewer success.

For upstream reconciliation, refresh the stable release at execution time and compare both the active fork surface and the reconciliation delta. Preserve newer upstream inputs/tests as well as accepted fork semantics. The helper port in the first package should become byte-equivalent upstream behavior when the release is merged, while fork-specific signal and lifecycle tests remain explicit. Do not enable optional upstream services or capabilities as a side effect of the update. Preserve the no-fork-tags policy.

The consumer workflow must reuse the existing exact Infisical profiles and established connections. Inject approved values only into memory, suppress auth traces, and clean only owned synthetic resources. A missing production session, provider or connection is a concrete blocker; do not create another diagnostic registration or broaden secret scope to evade it.

Availability work first names the required first-execution latency, interruption tolerance, recovery time and data-loss window. One ready runner, burst pods, node scaling and storage recovery are separate properties. Implement a capacity/HA choice only after its exact scope and cost have been accepted.

### Research and review

Evidence for the first source package is the existing code and upstream descendant-adoption correction. Current upstream release and fork overlap were inspected during the preceding review. KEDA's documented distinction between cooldown-to-zero and HPA scaling informs the later capacity assessment; it changes no implementation here. Operational findings stay outside this tracked document.

Skills: `rs-sliced-development-workflow`, `rs-model-routing`, `rs-upstream-patching`, and `writing-for-agents`; use the existing container tooling for dependency-backed verification. No broad security audit or new dependency is part of this package.

## Progress

- User approved the review recommendations and requested persistence followed by execution.
- Roadmap drafted before implementation. Initial planning review requested narrower native-CI scope, pinned upstream test provenance, explicit delegation/test obligations and complete ledger accounting; the draft incorporates those corrections. The same planner approved the corrected draft after focused recheck.
- First package baseline: fork main `50cc28028a11fa8aff052dc23e389806f1950c10`.
- Implemented: upstream descendant-wait helper and four focused regressions, existing native-lane bridge preflight, and current fork behavior/path accounting.
- Focused container regression passes. Removing the absent-PID success branch makes its bounded negative control fail without signaling a real process. Workflow YAML and diff checks pass. Full native integration is pending hosted CI after the local image build could not reach its registry.
- Delivery required: verified/reviewed task branch and draft PR for the first package; later milestones retain their concrete merge and deployment gates.
- Private receipt home: the governing checkout's ignored `docs/project/_local/reviews/2026-10-23-setup-review/`, with source-package checks/reviews under this worktree's ignored `docs/project/_local/reviews/`.
- Next action: complete source review, publish the draft and verify the hosted native CI lanes.

# Fork patch ledger

This file records logical UZH fork behavior for replay onto newer upstream
versions. Historical commits are evidence, not an automatic cherry-pick series.

## Inventory basis

- Fork ref and SHA: `uzh/main` at
  `5e459dd4f2d8bea6ae7a3004f15051dff26abae0` before reconciliation
- Upstream ref and SHA: `origin/main` at
  `2c7fb8fcd7113f0f78b2085e80adf651ea4e5359`
- Merge base: `3fa1f6cd6897e60be32b09dae132ae656ccff11d`
- Audited date: 2026-08-30
- Method: `audit-fork.sh`, stable patch IDs, both required final-tree diffs,
  source and test inspection, and a semantic merge of the exact refs above
- Limitation: the fork SHA identifies the audited pre-reconciliation branch;
  the reconciliation PR records the resulting exact head and GitHub merge SHA

### Re-audit basis: upstream v1.1.0 integration (2026-09-17)

This ledger was re-inventoried when the fork merged upstream release v1.1.0. The
dispositions and contract text above were re-checked against the new upstream
tree; the patch index and every required-behavior section below reflect that
re-check. Where a section's source-evidence quotes the older `2c7fb8fc`
baseline, the v1.1.0 status is recorded in the same section.

- Fork ref and SHA: `uzh/main` at
  `f5bf3b4c17cd6f83cec4323256805957a46a8475` (PR #23 nonfatal telemetry)
- Upstream ref and SHA: LibreChat-AI/code-interpreter tag `v1.1.0` at
  `b35c503fd2fe7be412d95c0eef6db50a09aad280` (chart 0.3.1, appVersion 2.0.0)
- Merge base: `2c7fb8fcd7113f0f78b2085e80adf651ea4e5359` (PR #17 reconcile point)
- Audited date: 2026-09-17
- Method: semantic merge of the exact refs above (scratch clone), per-patch
  source and test inspection against v1.1.0, rendered Helm verification, and the
  reconciliation PR recording the exact head
- Delta: 108 upstream commits since the merge base. Eight conflicted files were
  resolved; Helm templates, `values.yaml`, `ci.yml`, `egress-ledger.ts`, and the
  logger sinks auto-merged and were verified rather than replayed.
- Limitation: the fork SHA identifies the pre-integration fork branch; the
  reconciliation PR records the resulting exact head and GitHub merge SHA.

### Follow-up basis: upstream v1.2.0 release-workflow port (2026-09-18)

Recorded when the fork ported upstream's release version-resolution fix. Only
the release-automation files were re-checked; the v1.1.0 dispositions above are
unchanged.

- Fork ref and SHA: `uzh/main` at
  `55840f32f3e0204f0f459832d17be33ecfc2c5cc` (PR #24 v1.1.0 merge)
- Upstream ref and SHA: LibreChat-AI/code-interpreter tag `v1.2.0` at
  `fd9a4fa65e0a5189957032c0046eb286311fda62` (also `upstream/main`)
- Ported as `b67791e` (cherry-pick): `.github/scripts/resolve-release-version.sh`,
  `.github/workflows/release.yml`, and `tests/release-version-resolution.sh` are
  byte-identical to `v1.2.0`, and the `ci.yml` release-version-resolution step is
  identical. `ci.yml` keeps the fork's own `chmod 0555` line and does not carry
  the `#222` and `#227` test steps from trees the fork does not have.
- Delta: the port also picks up upstream `c688b30` (#225), which the fork's
  byte-identical-to-v1.1.0 `release.yml` had been missing.

### Re-audit basis: upstream v1.2.0 integration (2026-09-18)

Recorded when the fork merged upstream release v1.2.0. Every disposition above
was re-checked against the merged tree; all ten behaviors remain Active and
none needed re-derivation.

- Fork ref and SHA: `uzh/main` at
  `529d9c0ee18f0f4fb8e91ef726a2528db87335e8` (PR #25 release guard)
- Upstream ref and SHA: LibreChat-AI/code-interpreter tag `v1.2.0` at
  `fd9a4fa65e0a5189957032c0046eb286311fda62` (also `upstream/main`)
- Merge base: `b35c503fd2fe7be412d95c0eef6db50a09aad280` (tag `v1.1.0`)
- Audited date: 2026-09-18
- Method: semantic merge of the exact refs above in the scratch clone (clean,
  zero conflicts), file-overlap analysis between the fork's 55-file delta over
  `v1.1.0` and the merge's 28-file delta, a logging-sink grep over the newly
  introduced upstream files, and byte-checks of the release-automation files
- Delta: three upstream commits. `#226` (`4c7b224`, bounded
  repository-instruction discovery) and `#222` (`95bfcbd`, selected coding
  project registration) add new `packages/code` and `service` files; `#227`
  (`672e195`) reports workspace admission capacity from `service/src/bridge`.
  `#225` and `#233` were already ported (see the two bases above).
- Overlap: the only file both the fork delta and the merge touch is
  `.github/workflows/ci.yml`, where upstream appends two test steps and the
  fork's `chmod 0555` and release-version-resolution lines are unchanged. The
  merged `.github/scripts/resolve-release-version.sh` and
  `tests/release-version-resolution.sh` stay byte-identical to `v1.2.0`, and
  `release.yml` differs from `v1.2.0` only by the fork guard described below.
- No merged upstream file introduces a logging sink, so the values-free policy
  (below) gains no new surface.
- Limitation: the fork SHA identifies the pre-integration `main`; the
  integration PR records the resulting exact head and the GitHub merge SHA.

States: Active, Review on sync, Draft, History only, Retired.

## Patch index

| Logical patch | State | Source | Depends on |
| --- | --- | --- | --- |
| Publish exact-SHA UZH images | Active | `3d57f88` | GitHub Actions and GHCR |
| Keep sandbox root paths readable for spec-guard | Active | `73292bd` | Sandbox image builds |
| Split and harden the untrusted sandbox namespace | Active | `09b6abf`, `df458d6`, `2b36efd`, `5eb4124` | Upstream Helm chart |
| Cede deployment ownership to external controllers | Active | `5eb4124`, `4d6fd52`, `2665489` | Argo CD, KEDA, managed Redis and external secrets |
| Keep PVC package initialization Argo-safe | Active | `646ed2e`, `12d3760`, `c1509a8` | Upstream `packages.source=pvc` mode |
| Recover job completion when BullMQ events lag | Active | `b66e87e` | Upstream execution profiles and completion timeout |
| Reconnect the egress ledger after Redis outages | Active | `5e459dd` | Managed Redis |
| Keep public and sandbox wire contracts distinct | Draft | `0b66a3a`, `3ac5e8f` | Optional upstream contract maintenance |
| Bind JWT trust to verified issuers | Active | `f68acf0` | JWT verification keys and issuer configuration |
| Keep operational logs values-free | Active | `c87a14d`, `bf83dbe`, `689be7d`, `42a9743` | Winston and Pino logging sinks and public failures |
| Preserve requests through telemetry failures | Active | PR #23 (`f5bf3b4`) | OpenTelemetry SDK and the shared telemetry core |
| Never publish fork tags or releases | Active | PR #25 (port `b67791e`, disable `e9f6fa0`) | GitHub Actions events and the ported upstream resolver |

## Publish exact-SHA UZH images

Required behavior:

- Build and publish all seven deployed CodeAPI images to the UZH GHCR namespace
  on every push to `main`.
- Tag each image with the exact source SHA as well as `main` so GitOps can pin a
  source-identical release.
- Publish `codeapi-sandbox-runner` from the baked package target selected by
  the reconciled chart's `source=image` mode.

Owned paths:

- `.github/workflows/build-codeapi-images.yml`

Source and current-upstream evidence:

- Commit `3d57f88ab0ad0e123ab0c5de561f301015a83080` introduced the workflow.
- Upstream `2c7fb8fcd7113f0f78b2085e80adf651ea4e5359` has no equivalent workflow for
  publishing images under `ghcr.io/uzh-bf/code-interpreter`.

Replay and drop condition:

- Reapply the UZH publication workflow after adopting upstream image or target
  changes; keep the matrix aligned with the images and package source selected
  by GitOps.
- Drop only when another reviewed workflow publishes the same seven UZH-owned
  images from every `main` SHA and GitOps no longer depends on this workflow.

## Keep sandbox root paths readable for spec-guard

Required behavior:

- Make the directories traversed by `spec-guard` and its executed runtimes
  readable while retaining the sandbox's restrictive filesystem posture.
- Compile and smoke-test `spec-guard` in CI before image publication.

Owned paths:

- `.github/workflows/ci.yml`
- `api/Dockerfile`
- `docker/Dockerfile.worker-sandbox`
- `launcher/Dockerfile`

Source and current-upstream evidence:

- Commit `73292bde26900095e8bbd52385a2fa4f84cb25ce` defines the final behavior.
- Upstream `2c7fb8fcd7113f0f78b2085e80adf651ea4e5359` does not include the UZH
  readable-root changes or the matching CI compile-and-smoke check.
- Upstream `v1.1.0` adds `docker/rootfs-setup.c`, `api/src/guest-dns.sh`, and the
  bind-mount rootfs handling, but still compiles both binaries with `chmod 0111`.
  The merge adopts the new rootfs setup and the hosted-app launcher while keeping
  `chmod 0555` on both `spec-guard` and `sandbox-rootfs-setup` in `api/Dockerfile`,
  `docker/Dockerfile.worker-sandbox`, and `launcher/Dockerfile`.

Replay and drop condition:

- Start from upstream Dockerfiles and retain only the directory permissions
  required by the current `spec-guard` execution path and CI smoke.
- Apply the same 0555 delta to any new compiled sandbox binary upstream adds; the
  v1.1.0 merge shows this patch must be re-derived per compiled binary, not
  replayed as a wholesale file replacement.
- Drop when upstream images pass an equivalent CI check and the deployed
  sandbox can execute all supported runtimes without the UZH permission delta.

## Split and harden the untrusted sandbox namespace

Required behavior:

- Allow the sandbox runner, its ServiceAccount, Service, package Job, PVC, and
  NetworkPolicy to live in a separate PSA-labelled namespace.
- Use cross-namespace FQDNs and exact NetworkPolicy peers for communication with
  the control plane, egress gateway, and DNS.
- Disable service-link injection and optionally drop all Linux capabilities and
  privilege escalation for the KVM runner.

Owned paths:

- `helm/codeapi/templates/network-policy.yaml`

Shared paths:

- `helm/codeapi/templates/package-init-job.yaml` — also owns the Argo-safe PVC
  package lifecycle.
- `helm/codeapi/templates/pvc.yaml` — also owns the Argo-safe PVC package
  lifecycle.
- `helm/codeapi/templates/worker-sandbox-deployment.yaml` — also owns external
  replica and rollout-controller behavior.
- `helm/codeapi/values.yaml` — shared configuration contract for all three UZH
  chart patches.

Source and current-upstream evidence:

- Commits `09b6abf05c42eec797cda88bb8ae25821bdf015a`,
  `df458d60eb8ea219b1d3b6c17b871386d593060a`,
  `2b36efdaf06601c8a3cd7056cc279d376ba38120`, and
  `5eb4124b86f892c21bdc53a62eb842b0a8250d63` form the final behavior.
- Upstream `2c7fb8fcd7113f0f78b2085e80adf651ea4e5359` remains single-namespace and
  does not expose the UZH namespace or hardening values.

Replay and drop condition:

- Adapt the current upstream chart rather than replaying the four incremental
  commits. Preserve new upstream validation, image package mode, and execution
  profiles around the UZH namespace seam.
- Drop only when upstream supports the same two-namespace deployment, exact
  cross-namespace NetworkPolicies, disabled service links, and KVM-compatible
  restricted security context, proven by rendering the UZH overlays.

## Cede deployment ownership to external controllers

Required behavior:

- Allow external secrets, managed Redis with optional TLS, and external
  autoscalers to own their resources without Helm or Argo competing with them.
- Omit sandbox-runner replicas when KEDA owns them and suppress the chart HPA
  when an external autoscaler is selected.
- Avoid service-worker surge rollouts that require capacity unavailable during
  scale-to-zero operation.
- Allow control-plane pods to disable unnecessary ServiceAccount token mounts.

Owned paths:

- `helm/codeapi/templates/api-deployment.yaml`
- `helm/codeapi/templates/egress-gateway-deployment.yaml`
- `helm/codeapi/templates/file-server-deployment.yaml`
- `helm/codeapi/templates/secrets.yaml`
- `helm/codeapi/templates/tool-call-server-deployment.yaml`
- `helm/codeapi/templates/worker-hpa.yaml`

Shared paths:

- `helm/codeapi/templates/worker-sandbox-deployment.yaml` — also owns the split
  sandbox namespace and KVM hardening.
- `helm/codeapi/values.yaml` — shared configuration contract for all three UZH
  chart patches.

Source and current-upstream evidence:

- Commits `5eb4124b86f892c21bdc53a62eb842b0a8250d63`,
  `4d6fd52db6804d0868c74d5aa057e13ea0f1b520`, and
  `2665489bef368bab18409b86d5be07fa0afd050e` define the final behavior.
- Upstream `2c7fb8fcd7113f0f78b2085e80adf651ea4e5359` still renders chart-owned
  secrets/HPA/replicas and lacks the UZH external-controller switches.

Replay and drop condition:

- Preserve upstream deployment inputs and add only explicit ownership toggles.
  Pair replica omission with the exact Argo ignore rules maintained in
  `df-cloud`; neither side is sufficient alone.
- Drop individual toggles only when upstream exposes equivalent ownership
  controls and both UZH environment renders plus live Argo/KEDA readback prove
  there is one owner for each affected field and resource.

## Keep PVC package initialization Argo-safe

Required behavior:

- In upstream's compatibility-only `packages.source=pvc` mode, create the PVC
  and package-init Job as retained Argo-managed resources at sync wave `-5`.
- Run the immutable Job once, without Helm hooks or TTL recreation waking the
  scale-to-zero sandbox pool on every sync.
- Keep upstream's baked-image package source as the default.

Shared paths:

- `helm/codeapi/README.md` — also documents issuer-scoped JWT trust.
- `helm/codeapi/templates/package-init-job.yaml` — also supports the split
  sandbox namespace.
- `helm/codeapi/templates/pvc.yaml` — also supports the split sandbox
  namespace.
- `helm/codeapi/values.yaml` — shared configuration contract for all three UZH
  chart patches.

Source and current-upstream evidence:

- Commits `646ed2ef3e214e74179e4f8f6d9c7e0b98a4680c`,
  `12d3760720bd64a3e8df89c547de8f145f902624`, and
  `c1509a88a3189aaf666fe9409ec0c9c539f30c1d` define the final lifecycle.
- Upstream `2c7fb8fcd7113f0f78b2085e80adf651ea4e5359` introduced baked-image and PVC
  package sources, but its PVC Job remains a Helm hook with a TTL.
- Upstream `v1.1.0` (chart 0.3.1) still renders the PVC package-init Job as a Helm
  hook with a TTL. The merge retains the Argo-managed retained Job and PVC at sync
  wave `-5`, and renders exactly one package-init Job plus PVC only when
  `packages.source=pvc`.

Replay and drop condition:

- Keep upstream's `source=image` chart default and apply the UZH lifecycle only
  to `source=pvc` resources. Existing UZH environments must explicitly retain
  `source=pvc` while their old directory-root image is pinned, then switch to
  `source=image` only with a matching baked runner SHA.
- Retirement review: production now runs baked images, so this patch is rollback
  compatibility only. Re-check it once every UZH environment has moved to
  `source=image` and the pinned directory-root image is no longer needed for
  rollback; the patch can then be retired with the compatibility mode.
- Drop when upstream's PVC mode renders a retained non-hook Job/PVC that remains
  a no-op across unchanged Argo syncs and supports the split sandbox namespace.

## Recover job completion when BullMQ events lag

Required behavior:

- Race BullMQ completion/failure events with bounded Redis job-state polling so
  a missed or lagging event does not turn a completed request into a timeout.
- Preserve upstream execution-profile queue names, trace attributes, and the
  expanded backend-cleanup completion timeout.
- Remove listeners and stop the losing wait path after either source reaches a
  terminal result.

Owned paths:

- `service/src/queue-wait.test.ts`
- `service/src/queue-wait.ts`

Shared paths:

- `service/src/queue.ts` — also owns upstream execution-profile queue names.
- `service/src/service/programmatic-router.ts` — also owns upstream execution
  profiles, stateful runtime paths, and dynamic completion timeout.
- `service/src/service/router.ts` — also owns upstream execution profiles,
  session behavior, and dynamic completion timeout.

Source and current-upstream evidence:

- Commit `b66e87ef50fc145e16f8692bfbdf1772f25e1aa4` defines the fallback.
- Upstream `2c7fb8fcd7113f0f78b2085e80adf651ea4e5359` adds execution-profile queues
  and `jobCompletionWaitTimeoutMs`, but still waits only on QueueEvents.

- Upstream `v1.1.0` adds `waitForJobWithCancellation`. The merge composes the
  fork poll race into it. The completion event settles from its own payload, as
  BullMQ's `waitUntilFinished` does, so an evicted completed job is not reported
  as an error; the composed poll owns an abort signal and stops once any other
  outcome settles.
- Retention depth is part of this contract: a completed job must still exist in
  Redis while the poll fallback can observe it. Both enqueue sites in
  `service/src/service/programmatic-router.ts` keep `removeOnComplete.count=100`
  (upstream ships `1`), matching `service/src/service/router.ts`.

Replay and drop condition:

- Start from upstream routers and route their current timeout through
  `waitForJobFinished`; never replace upstream queue names or timeout inputs
  with the historical fork versions.
- Drop when upstream races event delivery with terminal job-state recovery and
  equivalent tests cover event completion, polling completion/failure, missing
  jobs, timeout, and listener cleanup.

## Reconnect the egress ledger after Redis outages

Required behavior:

- Retry Redis indefinitely with capped backoff so the singleton egress ledger
  recovers after a transient managed-Redis outage instead of remaining in the
  terminal `end` state while liveness stays green.

Owned paths:

- `service/src/egress-ledger.ts`

Source and current-upstream evidence:

- Commit `5e459dd4f2d8bea6ae7a3004f15051dff26abae0` defines the final retry policy.
- Upstream `2c7fb8fcd7113f0f78b2085e80adf651ea4e5359` still stops reconnecting after
  five attempts.
- Upstream `v1.1.0` now reconnects the queue and cancellation Redis clients
  indefinitely through `redisReconnectDelay` in `service/src/redis-options.ts`, so
  only the singleton egress ledger keeps the UZH policy. `queue.ts` uses the
  upstream reconnect helper; the fork's finite-retry concern there is resolved.

Replay and drop condition:

- Preserve upstream ledger behavior and replace only its finite retry strategy.
- Narrowed to `service/src/egress-ledger.ts`; do not replay the old queue-client
  retry policy over the upstream `redisReconnectDelay` helper.
- Drop when upstream retries indefinitely or a supervised lifecycle reliably
  recreates the Redis client after terminal disconnect, with a readiness
  recovery test covering an outage longer than five attempts.

## Keep public and sandbox wire contracts distinct

Required behavior:

- Keep this package optional and runtime-neutral. No UZH feature, source gate,
  image, or deployment depends on it.
- Preserve the established exported `ExecuteResponse` sandbox transport while
  naming the flat `/v1/exec` result `PublicExecuteResponse` for service-owned
  producers and consumers.
- Describe the public execution, upload, batch-upload, listing, metadata,
  deletion, and download wire shapes separately from the internal
  `/api/v2/execute` contract.
- Keep the internal input filename optional and distinguish inline inputs from
  stored-file references in the schema.

Owned paths:

- `api/openapi.yaml`
- `service/openapi.yml`
- `service/src/openapi-contract.test.ts`

Shared paths:

- `service/src/service/programmatic-router.ts`
- `service/src/service/replay-state.ts`
- `service/src/types/service.ts`
- `service/src/workers.ts`

Source and current-upstream evidence:

- Commit `0b66a3a722bdafbcb48b8a32f91bb2ae0997a685` defines the separate public
  type, corrected OpenAPI documents, and contract tests. Commit
  `3ac5e8fec1fb7d551ca903aab259be9c983bdd69` removes the runtime response
  change so this package remains contract maintenance only.
- The root, API, and service manifests at baseline
  `83c4f7b105b6b3e69eda12701ad4ec437acba08f` have no package exports or
  `publishConfig`; these are deployed applications, not published libraries.
- Complete-tree searches at the UZH baseline and upstream
  `297fead1a0cd997b0e3e6e55f77fbe83b376be1a` found `ExecuteResponse` only in
  its definition, OpenAPI names, and the internal sandbox backend adapter.
- GitHub searches across `uzh-bf` found no external `ExecuteResponse` or direct
  source import. The upstream fork network search found the same type
  definition in eight indexed forks and no separate consumer contract.
- GitLab searches of `ai-infrastructure/deployment` and local AI and Klicker
  source-checkout searches found no `ExecuteResponse` or direct import from the
  CodeAPI source tree. The legacy export remains unchanged regardless.

Replay and drop condition:

- Reapply the public schemas around the current service routes and the internal
  schema around the current sandbox request validator; do not rename the
  established sandbox transport for source consumers.
- Drop when upstream publishes equivalent public and internal schemas, a
  separately named flat public type, and matching executable contract tests.

## Keep operational logs values-free

Required behavior:

- Normalize runtime log messages to fixed event text and retain only
  code-declared operational metadata from an explicit allowlist.
- Remove identifiers, filenames, payloads, arbitrary errors and stacks, child
  process output, network details, credentials, and caller-provided values
  before Winston or Pino serializes them.
- Keep reason, stage, route, method, component, language, worker, and error
  categories closed; unknown errors become `internal`.
- Sanitize without mutating caller-owned values or throwing on nested,
  circular, repeated, buffered, array, error, or throwing-getter inputs.
- Return a fixed download failure body with HTTP 500 and never include the
  upstream error message or a `details` field.

Owned paths:

- `api/src/logger.test.ts`
- `api/src/logger.ts`
- `service/src/logger.test.ts`
- `service/src/logger.ts`
- `shared/operational-log.ts`

Shared paths:

- `api/src/job.ts` — removes the identifier-bearing Pino child binding.
- `api/src/tool-call-socket-proxy.ts` — keeps its standalone console failure
  message fixed and removes the raw startup error.
- `service/src/fileServerLogger.ts` and
  `service/src/toolCallServerLogger.ts` — apply the shared policy to their
  separately constructed Winston sinks.
- `service/src/service/router.ts` — logs download failures through the
  values-free sink and returns only the fixed public body.
- `service/rollup.config.js`, `service/tsconfig.esm.json`, and
  `service/tsconfig.json` — include the shared policy in service builds.

Source and current-upstream evidence:

- Commits `c87a14d755a406f50333bf6f8fd782ebd315ddec` and
  `bf83dbe26a82cbdde97a377e5b416a5cc17729ec` define the central policy, sink
  integrations, strict allowlist, bypass corrections, and capture tests.
- Commits `689be7da1f948c8dae036a92a356ed80ae32e71e` and
  `42a97437fc7ef783d35b29cbd1b93b9d762c8afa` define the final inline generic
  public download failure while retaining detailed diagnostics in sanitized
  logs.
- Upstream `297fead1a0cd997b0e3e6e55f77fbe83b376be1a` and the reconciled UZH
  baseline `83c4f7b105b6b3e69eda12701ad4ec437acba08f` serialize runtime messages,
  identifiers, child output, and arbitrary error details without this policy.
- Re-inventoried for v1.1.0: the four upstream-added logger consumers
  (`api/src/hosted-app.ts`, `service/src/hosted-app/queue.ts`,
  `service/src/hosted-app/worker.ts`, and `service/src/workspace-tools/outcome.ts`)
  import the sanitized sinks and pass structured values for the allowlist to
  drop. The only direct console call is the known fixed message in
  `api/src/tool-call-socket-proxy.ts`, and the policy is centralized in sink
  creation (`api/src/logger.ts` via `createOperationalLogger`;
  `service/src/logger.ts` via `operationalLogFormat`). No enabled-path bypass was
  found.

Replay and drop condition:

- Reapply the shared allowlist at every enabled Winston and Pino constructor,
  then re-inventory direct console, raw stream, child binding, serializer,
  transport, and child-process forwarding bypasses.
- Drop only when upstream provides an equivalent values-free sink policy with
  capture tests, a generic public download failure, and a current enabled-path
  inventory containing no unknowns.

## Bind JWT trust to verified issuers

Required behavior:

- Select a trust entry by unverified issuer only to locate policy, then verify
  its key, algorithm, issuer, audience, and principal source before accepting a
  principal.
- Fail startup for malformed or ambiguous modern trust configuration and keep
  each loaded key assigned to exactly one issuer entry.
- Preserve the legacy single-issuer environment contract when no modern trust
  table is configured.
- Support reusable external principal sources through the bounded lowercase
  `external:<slug>` namespace without embedding a consumer-specific source,
  and isolate their tenant storage namespaces by that validated source.

- When more than one trust entry shares the verifier, bound the upstream
  `code_worker_id` claim per entry through an explicit prefix allowlist so an
  external issuer cannot name another issuer's bridge worker.

Owned paths:

- `docker-compose.yaml`
- `service/src/auth/librechat-jwt.test.ts`
- `service/src/auth/librechat-jwt.ts`

Shared paths:

- `helm/codeapi/README.md` — also documents the retained PVC package mode.

Source and current-upstream evidence:

- Commit `f68acf095486d3692f2b972103e1de0c5dc8190d` defines the issuer-scoped
  trust behavior and its negative tests.
- Upstream `297fead1a0cd997b0e3e6e55f77fbe83b376be1a` and the reconciled UZH
  baseline `83c4f7b105b6b3e69eda12701ad4ec437acba08f` retain only one effective
  issuer policy.

- Upstream `v1.1.0` adds the `code_worker_id` claim. The merge integrates it
  into the fork trust table and adds `codeWorkerIdPrefixes`: a multi-entry
  table must declare the prefixes its external entry may mint, while a
  single-entry table stays unconstrained for backward compatibility.

Replay and drop condition:

- Reapply the trust-table seam around the current upstream verifier rather than
  replacing later claim, key-loading, or cache behavior.
- Drop when upstream supports equivalent issuer-keyed trust, exact key
  assignment, fail-closed configuration, bounded external sources, and legacy
  fallback with matching positive and cross-entry negative tests.

## Preserve requests through telemetry failures

Required behavior:

- Keep optional OpenTelemetry instrumentation from failing a request: a failing
  tracer, propagator, exporter, processor, resource, provider, registration, or
  shutdown path must degrade telemetry without propagating to the request or
  response lifecycle.
- Route every optional telemetry construction and lifecycle step through the
  shared `optionalTelemetry` guard so a single fault cannot abort request
  handling.

Owned paths:

- `shared/telemetry-core.ts`
- `shared/telemetry-test-suite.ts`
- `api/src/telemetry.test.ts`
- `service/src/telemetry.test.ts`

Source and current-upstream evidence:

- PR #23 (`f5bf3b4c17cd6f83cec4323256805957a46a8475`), "fix(telemetry): preserve
  requests through instrumentation failures", introduced the guard and the
  shared fault matrix.
- Upstream `v1.1.0` has no `optionalTelemetry` guard in `shared/telemetry-core.ts`;
  `api/src/telemetry.ts` and `service/src/telemetry.ts` are otherwise identical to
  upstream, so the fork delta is confined to the shared core and the shared test
  suite.

Replay and drop condition:

- Re-apply the guard around the current upstream `telemetry-core.ts` construction
  and shutdown paths, keeping upstream's config shape and request attributes.
- Drop when upstream isolates optional instrumentation failures so no fault in the
  OpenTelemetry construction or lifecycle reaches the request path, with a test
  matrix covering each fault class.

## Never publish fork tags or releases

Required behavior:

- Track upstream releases and add fork commits on top; deployments pin a commit
  SHA, so the fork never cuts a tag or publishes a GitHub release of its own.
- Vendor upstream's release automation — `.github/scripts/resolve-release-version.sh`,
  `.github/workflows/release.yml`, `tests/release-version-resolution.sh`, and the
  `ci.yml` step — so merge-sync stays trivial and the ported resolver stays tested.
- Keep the vendored `release.yml` inert: its job carries `if: ${{ false }}`, so no
  trigger can create a tag or release.

Owned paths:

- `.github/workflows/release.yml` (the job condition and the header note only;
  every other line, including upstream’s triggers, tracks `v1.2.0`
  byte-for-byte)
- `docs/RELEASING.md` and `CONTRIBUTING.md` (a fork note at the top of the
  release process; upstream text is otherwise unchanged)

Source and current-upstream evidence:

- Upstream `fd9a4fa` (tag `v1.2.0`, PR #233) fixed #228 (untagged abort) and #229
  (rerun-resume rejected its own tag) by extracting the resolver into
  `.github/scripts/resolve-release-version.sh`; ported verbatim as `b67791e`.
- GitHub's workflow schema requires the `on` key
  (`json.schemastore.org/github-workflow.json`), so a trigger-less `release.yml`
  is not valid; the disable is a job condition rather than an empty `on` block.
- The fork has no tags or releases on `origin` (`git ls-remote --tags` empty),
  and nothing consumes fork releases: df-cloud pins chart revision
  `c1509a88a3189aaf666fe9409ec0c9c539f30c1d` and images by commit SHA from
  `ghcr.io/uzh-bf/code-interpreter/*`.
- The vendored `docs/RELEASING.md` documents cutting a tag by hand
  (`git tag -a … && git push origin …`), which the disabled job cannot stop, so
  both it and `CONTRIBUTING.md` carry a fork note saying the fork does not cut
  tags or releases.

Replay and drop condition:

- Replay by restoring upstream's job `if:` condition and the `workflow_run`
  trigger block.
- Drop only on a deliberate policy change: if the fork starts cutting its own
  tags and releases, remove this row and the disable.

## Retired debris

- Merge commit `356123a` is history-only transport for the package-init fix;
  `c1509a8` defines the replayable final behavior.
- The historical pre-profile queue constants and raw `env.JOB_TIMEOUT` waiter
  calls were retired during this reconciliation. Upstream execution-profile
  queue names and `jobCompletionWaitTimeoutMs` are authoritative.
- The upstream text describing package-init as a Helm hook was not replayed;
  the retained Argo-managed Job is the active UZH behavior.

## Coverage check

- Every one of the 23 paths in the active merge-base-to-fork final-tree diff is
  assigned above. The chart values, package resources, worker deployment, queue
  module, and two routers are named shared seams in every contributing patch.
- Fork-authored non-merge commits were collapsed into the nine logical final
  behaviors above. The values-free logging package adds thirteen owned or shared
  paths outside the original 23-path audit. The issuer-trust package adds three
  owned paths outside that audit and shares the existing Helm README path. PR #23
  adds the telemetry patch above. This branch adds one public-contract behavior
  with eight owned or shared paths. The only fork merge commit is classified as
  history-only; no fork-authored final-tree path is left unowned.
- v1.1.0 integration coverage: the replay and re-audit above account for all ten
  logical behaviors, including the narrowed egress-ledger patch (only
  `service/src/egress-ledger.ts` remains fork-owned) and the telemetry patch added
  by PR #23. The auto-merged paths (Helm templates, `values.yaml`, `ci.yml`,
  `egress-ledger.ts`, logger sinks) were verified against v1.1.0 rather than
  replayed; no fork-authored final-tree path is left unowned after the merge.
- v1.2.0 release-workflow coverage: the port adds upstream files that are not
  fork patches, and the disable adds one fork-owned path,
  `.github/workflows/release.yml`, recorded above. No other fork path changed in
  this port.

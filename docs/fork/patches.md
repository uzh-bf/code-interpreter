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

### Re-audit basis: upstream v1.4.0 integration (2026-09-19)

- Fork baseline: `ccc225985ff2f6aec6a3fe1472515d8e9bf188bf`.
- Upstream release: `277fa7742d383eb1b6606ec228cdafe36af043a4`.
- Three incoming commits add repository-scoped GitHub App credential routing,
  authenticated bot lookup and optional workspace command timeout metadata.
- The clean merge preserves both histories. All fourteen incoming paths match
  upstream exactly, and none overlaps a fork-modified path relative to v1.2.0.
  Existing fork patch dispositions remain active. The disabled Release workflow
  is unchanged; deployments continue to use commit images without fork tags.
- Service and package tests passed; live storage and consumer acceptance remain
  separately gated in the [execution plan](../project/2026-09-19-storage-recovery-upstream-v1.4.0-plan.md).

States: Active, Review on sync, Draft, History only, Retired.

### Re-audit basis: upstream v1.10.4 integration (2026-10-16)

- Fork baseline: `b53af0e3833f2b9a03036e87c9d56842bad0ca2f`.
- Upstream release: `a62d69e05a4541ac9a20722ac7ff3fcfecb6ed24`.
- Merge base: `c8b3e1490416753b6f633e4cdbf9100e93aeb849`.
- Upstream replaces the socket transport with anonymous pipes. Preserve its
  implementation, helpers, validation and tests; the deleted socket proxy is
  retired rather than replayed. The three sandbox Dockerfiles retain only the
  required readable spec-guard/rootfs permissions alongside the new helpers.
- Upstream's image workflow publishes only for its own repository and uses a
  different namespace/tag contract. The fork's exact-SHA publication workflow
  remains necessary. The upstream release metadata is adopted without cutting
  a fork tag or release.
- Issuer-keyed trust, values-free logging, nonfatal telemetry, external replica
  ownership, missing-bucket readiness and refusal-only retry still lack
  equivalent upstream behavior. Shared router, schema and image seams require
  semantic verification even where Git merges them automatically.
- The historical Draft public-contract entry is active on fork main through
  `43ed62c`. Its distinct timeout-metadata negative tests are retained alongside
  upstream lane-git coverage; no duplicate is removed without equivalent cases.
- The integration plan records runtime/package compatibility and rollout gates:
  [upstream v1.10.4](../project/upstream-v1.10.4-integration-plan.md).
  Source reconciliation does not prove deployment or runtime acceptance.

### Re-audit basis: upstream v1.10.5 patch continuation

- Fork baseline: `880c3822e0986043d99b0d75c12f45e7703c9614`.
- Upstream release: `58a023da4c47452f5e40114934679d0348c39064`.
- Merge base: `a62d69e05a4541ac9a20722ac7ff3fcfecb6ed24` (v1.10.4).
- Adopt upstream's installed guest-addon default and production guest-image
  coverage. Existing fork behavior and the disabled Release job are preserved.
- The startup-handshake regression uses bounded process results and a successful
  control instead of matching diagnostic prose, as recorded below.

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
| Keep public and sandbox wire contracts distinct | Active | `0b66a3a`, `3ac5e8f` | Optional upstream contract maintenance |
| Bind JWT trust to verified issuers | Active | `f68acf0` | JWT verification keys and issuer configuration |
| Keep operational logs values-free | Active | `c87a14d`, `bf83dbe`, `689be7d`, `42a9743` | Winston and Pino logging sinks and public failures |
| Preserve requests through telemetry failures | Active | PR #23 (`f5bf3b4`) | OpenTelemetry SDK and the shared telemetry core |
| Never publish fork tags or releases | Active | PR #25 (port `b67791e`, disable `e9f6fa0`) | GitHub Actions events and the ported upstream resolver |
| Fail readiness for a missing artifact bucket | Active | `61c729c`, `201aad9` | Existing external object storage |
| Retry only refused sandbox connections within an absolute deadline | Active | `39cbcd2`, `15416c4`, `055709d` | HTTP sandbox backend and cancellation |
| Preserve early readiness and trusted-worker resource overrides | Active | `8eb246c`, `53ce639`, `b3c2e22` | Existing Helm deployment ownership |
| Preserve normal exit during clean tool-pipe shutdown | Active | `api/src/tool-call-pipe-broker.ts`, `tests/pipe_runtime_image.cjs` | Relay-owned request transport |
| Await asynchronous pipe descriptor reclamation in tests | Retired | `api/src/pipe-process.test.ts` | Bun FileSink cleanup |
| Check bounded NsJail startup failure without diagnostic prose | Active | `tests/supervisor_policy.py` | Upstream startup handshake |
| Cancel abandoned execution and await guest cleanup | Active | `api/src/api/v2.ts`, `service/src/service/router.ts` | Queue cancellation and execution identity ownership |
| Observe one bounded synthetic lifecycle case | Active | `shared/live-cancellation-registration.ts` | Signed manifest binding and disabled-by-default diagnostics |
| Discover metrics across sandbox namespaces | Active | `helm/codeapi/templates/podmonitor.yaml` | Existing Prometheus Operator and restricted scrape peers |
| Exercise upstream descendant cleanup in native CI | Active | Upstream helper `71ef714`; fork bounded negative control | Existing native CI lane |

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
- The former `api/src/tool-call-socket-proxy.ts` integration is retired with
  upstream's deletion; new pipe transport uses the retained central logger.
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

- Track upstream trigger and resolver changes while retaining the fork job's
  unconditional false condition; replay never enables tag or release publication.
- Drop only on a deliberate policy change: if the fork starts cutting its own
  tags and releases, remove this row and the disable.

## Fail readiness for a missing artifact bucket

Required behavior: the file server is not Ready when its configured artifact
bucket is missing or dependency probes fail. Retain bounded timeouts and the
read-only health contract.

Owned paths: `service/src/file-server.ts` and
`service/src/file-server-readiness.test.ts`.

Upstream v1.10.4 does not include the missing-bucket failure added by `61c729c`.
Drop when upstream provides equivalent readiness and bounded-failure coverage.

## Retry only refused sandbox connections within an absolute deadline

Required behavior: retry only ECONNREFUSED before an accepted response, preserve
signed bytes, prohibit redirects, and enforce one absolute deadline and caller
cancellation across attempts. Re-arm distant timers without 32-bit overflow.
A timeout, reset, response or ambiguous acceptance never permits a replay.

Owned paths: `service/src/sandbox-backend/http.ts`,
`service/src/sandbox-backend/http.test.ts` and
`service/src/service/exec-timeout.test.ts`.
Shared paths: `service/src/job-cancellation.ts` and
`service/src/job-cancellation.test.ts` with completion polling.

Upstream v1.10.4 adds the redirect prohibition but still lacks the bounded
refusal-retry loop. The fork already includes that prohibition. Drop only when
upstream preserves all retry/deadline/cancellation semantics with matching tests.

## Preserve early readiness and trusted-worker resource overrides

Required behavior: readiness checks begin promptly for the sandbox runner, and
trusted service-worker resources may differ from the untrusted runner resources
without changing external replica ownership or pod isolation.

Shared paths: `helm/codeapi/templates/worker-sandbox-deployment.yaml`,
`helm/codeapi/values.yaml` and `tests/block_root_package_delivery.sh`.

Upstream v1.10.4 does not replace these controls. Drop when the current upstream
chart has equivalent independently configurable resources and readiness behavior
with the complete deployment-object contract protected.

## Preserve normal exit during clean tool-pipe shutdown

The relay holds its broker-facing request writer until invocation completion.
The broker treats EOF at a complete frame boundary as graceful closure and
invokes failure at most once for malformed input or an active-channel error.
This prevents successful relay teardown from being replaced by SIGKILL.

Owned paths: `api/src/tool-call-pipe-broker.ts` and
`tests/pipe_runtime_image.cjs`, and `tests/tool_call_pipes.py`. The orphan-reaping
test waits for subreaper adoption within its existing deadline while retaining
the SIGKILL status assertion. Preserve the relay's lost-reader, flood and
parent-death enforcement. Retire when upstream provides equivalent EOF and
late-error behavior with packaged regression coverage.

## Await asynchronous pipe descriptor reclamation in tests

Bun may retain its internal duplicate descriptors briefly after child and stream
close events. The existing pipe leak test waits for the exact allocated inodes
to disappear within a bounded interval, then still requires an empty set. An
intentionally retained synthetic pipe must fail this assertion. No runtime
transport implementation or syscall permission changes are part of this patch.

Shared path: `api/src/pipe-process.test.ts`; its native startup-cancellation
cases also belong to the cancellation entry below. Retire only the descriptor
wait hunk when
upstream provides equivalent bounded cleanup coverage or the runtime guarantees
that its descriptors are reclaimed before the observed close events.

Current disposition: retired in the v1.10.10 integration. Adopt upstream's
bounded descriptor wait without replaying the fork's equivalent polling hunk.
The separate startup-cancellation cases remain owned by the cancellation entry.

## Check bounded NsJail startup failure without diagnostic prose

Required behavior and owned path:

- `tests/supervisor_policy.py` checks that a valid executable starts successfully
  and a missing executable fails within five seconds under the same supervisor
  and NsJail configuration.
- Upstream v1.10.5 still asserts a particular startup-error log sentence. The
  fork retains the regression behavior without coupling it to log wording.

Replay and drop condition:

- Preserve the other supervisor-filter assertions and the upstream guest-addon
  tests. Drop this test-only delta when upstream checks the same bounded failure
  with a valid startup control and no diagnostic-text assertion.

## Cancel abandoned execution and await guest cleanup

Required behavior: caller disconnects from regular execution cancel queued or
running work through the existing durable cancellation contract. Admission,
lost-enqueue replies and completion races retain ownership. Guest cleanup waits
for the owned child to exit before deleting its workspace or releasing its
identity. A stalled termination reports failure while retaining that identity.

Owned paths: `service/src/service/router-cancellation.test.ts`,
`service/src/job-cancellation-commit.test.ts`, `api/src/api/v2-cleanup.test.ts`,
`api/src/job-cleanup.test.ts`, and `api/src/cleanup.integration.test.ts`.

Shared seams:

- `service/src/service/router.ts`, `service/src/service/programmatic-router.ts`,
  `service/src/job-cancellation.ts`, `service/src/job-cancellation.test.ts`,
  `service/src/workers.ts`, and `service/src/types/service.ts` also carry the
  public contract, retry/deadline and completion-polling behaviors.
- `api/src/api/v2.ts`, `api/src/job.ts`, `api/src/nsjail.ts`,
  `api/src/nsjail.test.ts`, `api/src/workspace-isolation.ts`, and
  `api/src/workspace-isolation.test.ts` share cleanup and observation seams.
- `api/src/tool-call-pipe-broker.ts`, `api/src/tool-call-pipe-bridge.c`,
  `api/src/pipe-process.test.ts`, `tests/pipe_relay_backpressure.py`,
  `tests/pipe_runtime_image.cjs`, and `tests/tool_call_pipes.py` cover graceful
  termination, startup signals, blocked writes, EOF and parent-death handling.
- `.github/workflows/ci.yml` runs native tests in its existing NsJail image on
  both supported native architectures. The fast API job may skip native cases;
  the authoritative native lane requires an executable bridge first.

Source history: `12aad45` and `31c9ba2`. Upstream v1.10.10 does not replace
these cancellation or broker/relay changes. Keep graceful SIGTERM/143 distinct
from parent-death SIGKILL when reconciling pipe tests. Drop only when upstream
provides equivalent admission cancellation, child reaping and identity-release
ordering with the corresponding behavioral tests.

## Observe one bounded synthetic lifecycle case

Required behavior: diagnostics are disabled by default. An explicitly selected,
expiring synthetic case is bound at the gateway to its server-owned execution
and output session, then carried through the signed manifest. The guest emits
only the bounded diagnostic schema and checks real process absence, output
absence and acknowledged identity release. Missing or uncertain evidence fails.
Ordinary execution rejects caller-supplied diagnostic binding.

Owned paths: `shared/live-cancellation-registration.ts`,
`api/src/live-cancellation-observer.ts`,
`api/src/live-cancellation-observer.test.ts`, and `api/src/config.ts`.

Shared seams:

- `service/src/egress-grant.ts` and `service/src/egress-grant.test.ts` own
  registration selection and one-shot binding alongside normal egress grants.
- `service/src/execution-manifest.ts`, `service/src/execution-manifest.test.ts`,
  `api/src/execution-manifest.ts`, and
  `api/src/execution-manifest-request.test.ts` validate the signed optional
  session binding without exporting its encrypted write capability.
- `api/src/api/v2.ts`, `api/src/job.ts`, `api/src/nsjail.ts`, and
  `api/src/workspace-isolation.ts` share lifecycle facts with cleanup ownership.
- `launcher/src/main.rs` permits the explicit guest diagnostic configuration;
  its tests retain the guest environment allowlist.
- `service/rollup.config.js`, `service/tsconfig.json`, and
  `service/tsconfig.esm.json` include the shared registration helper alongside
  values-free logging and telemetry helpers.
- `helm/codeapi/templates/egress-gateway-deployment.yaml`,
  `helm/codeapi/templates/worker-sandbox-deployment.yaml`,
  `helm/codeapi/values.yaml`, `helm/codeapi/Chart.yaml`, and
  `tests/sandbox_runner_metrics.sh` preserve default-empty gateway/guest
  configuration and its render contract.

Source history: `31c9ba2` and the chart-hook continuation merged by `50cc280`.
Upstream v1.10.10 has no equivalent selected lifecycle observation or signed
binding. Drop only when an accepted upstream mechanism proves the same
cancellation/release facts without widening normal data exposure. This entry
records source behavior, not diagnostic activation or live acceptance.

## Discover metrics across sandbox namespaces

Required behavior: the runner PodMonitor selects its configured namespace;
monitors accept discovery labels without changing workload selectors; explicit
scrape peers add only intended ingress while preserving egress. Metrics remain
opt-in. A rendered dashboard is not proof of successful scraping.

Owned path: `helm/codeapi/templates/podmonitor.yaml`.
Shared paths: `helm/codeapi/templates/network-policy.yaml`,
`helm/codeapi/values.yaml`, `helm/codeapi/README.md`,
`helm/codeapi/Chart.yaml`, and `tests/sandbox_runner_metrics.sh`.

Upstream v1.10.10 does not include these chart discovery and restricted-peer
changes. Drop when its chart has equivalent namespace/label selection and
opt-in peer behavior protected by render checks. Deployment and dashboard
ownership stay with the external GitOps repositories.

## Exercise upstream descendant cleanup in native CI

The controller-death integration test distinguishes a live unadopted descendant
from a process already reaped by its original parent. ECHILD alone is
inconclusive. An absent `/proc/<pid>` ends the wait successfully; an adopted
child still requires SIGKILL exit status; a live descendant fails at the deadline.

Shared path: `tests/tool_call_pipes.py`, which also retains graceful shutdown
assertions. The helper is upstream-owned after integrating v1.10.10; its former
fork port is retired. Owned test path: `tests/test_tool_call_pipes.py`; its synthetic
cases preserve upstream behavior while bounding the absent-PID regression and
avoiding a diagnostic-prose match. `.github/workflows/ci.yml` explicitly invokes
those decision regressions.

Keep the distinct SIGTERM/143 assertions, parent-death check, safe bounded
negative control and actual CI invocation. Drop this remaining test delta when
upstream bounds the absent-PID negative control without real signals and runs
the same focused cases in its native CI lane. This is a test repair, not a change
to production termination.

## Retired debris

- Merge commit `356123a` is history-only transport for the package-init fix;
  `c1509a8` defines the replayable final behavior.
- The historical pre-profile queue constants and raw `env.JOB_TIMEOUT` waiter
  calls were retired during this reconciliation. Upstream execution-profile
  queue names and `jobCompletionWaitTimeoutMs` are authoritative.
- The upstream text describing package-init as a Helm hook was not replayed;
  the retained Argo-managed Job is the active UZH behavior.

## Historical coverage check

The totals below describe their named earlier audits. Current accounting and
post-v1.10.5 additions are recorded in the final section.

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


### v1.10.4 path accounting

The source integration must account for every final-tree path differing from
v1.10.4. `.gitignore` preserves private review exclusions; `docs/fork/patches.md`
is this ledger. Project plans are historical or execution references, not replay
units. `service/src/bridge/router.test.ts` retains distinct configured-timeout
negative cases; it shares the signed worker contract with the upstream tests.
All other active paths belong to the logical behaviors and shared seams above.
The old socket proxy has no active path and must stay retired.

### v1.10.5 path accounting

The patch continuation adds `tests/supervisor_policy.py` as a test-only fork
delta. The entrypoint fix and guest-addon image coverage are upstream behavior,
not new replay units. Existing project-plan and ledger changes remain execution
references. The other v1.10.4 fork paths and their dispositions are unchanged.


### Lifecycle and metrics continuation accounting

Baseline fork: `50cc28028a11fa8aff052dc23e389806f1950c10`. Its active surface is
measured from merge base `58a023da4c47452f5e40114934679d0348c39064` (v1.10.5).
The separate reconciliation comparison is upstream stable
`77bcd2ec2e63be523bfab2dfa11159a2ceec0088` (v1.10.10) against the fork final tree.
Incoming upstream-only paths in that comparison are not new fork patches.

The cancellation, observation, metrics and descendant-test entries account for
later source/test/build/chart additions. Shared files retain each named
behavior; a path's presence here is not semantic equivalence evidence. The
helper is an upstream-equivalent port. The descriptor-wait hunk is a
review-on-sync candidate because v1.10.10 has equivalent bounded cleanup,
while startup-cancellation cases in that file remain active. The retired socket
proxy stays retired.

`.gitignore` owns private artifact exclusions and `docs/fork/patches.md` owns
this ledger. Active project paths are references, not replay units:

- `docs/project/2026-09-09-nonfatal-telemetry-plan.md`
- `docs/project/2026-09-17-upstream-v1.1.0-integration-plan.md`
- `docs/project/2026-09-18-upstream-v1.2.0-integration-plan.md`
- `docs/project/2026-09-19-storage-recovery-upstream-v1.4.0-plan.md`
- `docs/project/2026-09-19-storage-reliability-investigation.md`
- `docs/project/2026-10-14-cold-start-latency-plan.md`
- `docs/project/2026-10-18-codeapi-observability-e2e-plan.md`
- `docs/project/upstream-v1.10.4-integration-plan.md`
- `docs/project/2026-10-23-codeapi-reliability-roadmap.md`

Recompute both comparisons at the reviewed head. Every active path must be
assigned to an entry, shared seam or reference above; unexplained paths hold
ledger qualification. Keep detailed path checks in private review receipts,
not a prose-pinning CI test.


### Re-audit basis: upstream v1.10.10 continuation

- Fork source baseline `50cc28028a11fa8aff052dc23e389806f1950c10`; carried lifecycle
  repair `3353cb1b9e257c4894bd0e44b6e5be3a827740b8`.
- Integrated upstream `77bcd2ec2e63be523bfab2dfa11159a2ceec0088`, from previous
  upstream ancestor `58a023da4c47452f5e40114934679d0348c39064`.
- Adopt upstream's pinned Node build/runtime versions, restored-module handling,
  worker enrollment/recovery, workspace import and separate extraction package.
  The latter retains its own validation workflow and standalone Compose file;
  no primary deployment is added by this reconciliation.
- Keep the managed HTTP/static/non-dynamic contract. Development Compose retains
  upstream's paired/dynamic profile and advertised import capability; actual
  workspace dispatch still requires remote-bridge worker selection. Browser
  enrollment also requires recovery configuration and an admin token. The
  source profiles and acceptance tests are specified in the
  [reliability roadmap](../project/2026-10-23-codeapi-reliability-roadmap.md).
- Retire the equivalent descriptor-wait hunk and descendant-helper port.
  Preserve startup-cancellation, graceful termination and safe negative-control
  assertions. Upstream's dependency pin supersedes the source delta proposed
  separately for `proxy-addr`; this ledger does not close a PR.
- All other named fork behaviors remain active: upstream has no equivalent
  issuer trust map, values-free sinks, nonfatal telemetry guard, external
  controller ownership, missing-bucket readiness, refusal-only retry/deadline,
  caller cancellation, selected lifecycle observation or chart scrape peers.
  Shared auto-merged seams retain both upstream additions and those behaviors.
- After this merge, both active-surface and reconciliation comparisons use
  v1.10.10 as the ancestor. Upstream-only additions are no longer fork patches.
  Rebuild path ownership at the final reviewed commit; source CI and review
  qualify the candidate separately from image publication and runtime rollout.

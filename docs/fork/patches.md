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
| Keep operational logs values-free | Active | `c87a14d`, `bf83dbe`, `689be7d`, `42a9743` | Winston and Pino logging sinks and public failures |

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

Replay and drop condition:

- Start from upstream Dockerfiles and retain only the directory permissions
  required by the current `spec-guard` execution path and CI smoke.
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

Owned paths:

- `helm/codeapi/README.md`

Shared paths:

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

Replay and drop condition:

- Keep upstream's `source=image` chart default and apply the UZH lifecycle only
  to `source=pvc` resources. Existing UZH environments must explicitly retain
  `source=pvc` while their old directory-root image is pinned, then switch to
  `source=image` only with a matching baked runner SHA.
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

Replay and drop condition:

- Preserve upstream ledger behavior and replace only its finite retry strategy.
- Drop when upstream retries indefinitely or a supervised lifecycle reliably
  recreates the Redis client after terminal disconnect, with a readiness
  recovery test covering an outage longer than five attempts.

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

Replay and drop condition:

- Reapply the shared allowlist at every enabled Winston and Pino constructor,
  then re-inventory direct console, raw stream, child binding, serializer,
  transport, and child-process forwarding bypasses.
- Drop only when upstream provides an equivalent values-free sink policy with
  capture tests, a generic public download failure, and a current enabled-path
  inventory containing no unknowns.

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
- Fork-authored non-merge commits were collapsed into the eight logical final
  behaviors above. The values-free logging package adds thirteen owned or shared
  paths outside the original 23-path audit. The only fork merge commit is
  classified as history-only; no fork-authored final-tree path is left
  unowned.

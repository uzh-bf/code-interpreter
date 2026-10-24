# CodeAPI capabilities and adoption guide

This assessment describes source capabilities, prerequisites and acceptance work. It does not assert that an optional service is deployed or qualified. Detailed environment observations and experiment results belong in the private qualification receipts. The source baseline is fork `4105b53ecfeef1f9eea7a246a36601e181de11cf`; the patch comparison is upstream `v1.10.13` at `2fa9f0d43e8e38b7d6240bc76e2483c6a47c64c7`.

## Most useful next steps

| Capability                                               | Useful outcome                                                                          | Adoption decision                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Independent REST execution and storage files             | Applications submit calculations and retrieve owned results without a chat UI           | Qualify first with the bounded client package                                         |
| Additional stateless runtimes                            | Reuse JavaScript/TypeScript libraries or run short shell transformations                | Qualify deterministic examples before recommending a language to consumers            |
| Replay programmatic tool calling                         | Code orchestrates several agent tools without holding a sandbox between calls           | Adopt for a concrete agent workflow; measure continuation and cancellation behavior   |
| Attached remote workspaces                               | Work against an existing repository or dataset on an operator-owned machine             | Separate design and operational package with pairing, lifecycle and storage ownership |
| Hosted apps, extraction and alternative sandbox backends | Preview applications, parse supported documents, or evaluate another isolation platform | Separate opt-in packages; source presence alone is insufficient                       |

## Independent REST execution

`POST /v1/exec` accepts code, a language alias, optional file references and a runtime cap. It returns execution output and generated-file references. Clients can upload a file, execute against that owned input, download the generated result and reuse it in a later execution. These operations require no LibreChat UI or LibreChat client import. The public wire contract is [service/openapi.yml](../../service/openapi.yml), especially `ExecuteRequest`, `ExecuteResponse` and the `/exec` route.

The caller must distinguish three outcomes: a rejected HTTP request, a completed execution whose guest failed, and an execution whose output delivery failed. HTTP 200 does not prove successful code or intact artifacts. Validate exit code, signal/status, artifact-delivery fields, expected outputs and actual downloaded bytes. The request's `timeout` caps guest runtime; it does not cap queueing or the HTTP transport. Clients need their own whole-request deadline. Queue time also consumes the service job deadline; a longer client timeout cannot fix an overloaded queue. See [router](../../service/src/service/router.ts), [worker](../../service/src/workers.ts) and [deadline calculation](../../service/src/config.ts).

Authentication is a server trust decision. The JWT implementation binds issuer, audience, key, algorithm and allowed principal sources. A second application needs an approved issuer/trust integration or an existing approved token broker. Copying a signing key into a frontend is not an integration. The legacy `user_id` field does not choose the authenticated owner. Send `X-CodeAPI-Expected-Profile` so a routing mistake produces a profile-mismatch response before work is enqueued. See [JWT trust implementation](../../service/src/auth/librechat-jwt.ts) and [profile fencing](../../service/src/execution-profile.ts).

Request-rate limits, queue-consumer concurrency/start limits and sandbox resources govern different parts of the path. A 429 with `Retry-After` is admission control, not a guest failure. File operations have independent buckets. Per-principal isolation and application fairness still need qualification under a realistic workload; a direct synthetic-token test does not establish a new application's identity lifecycle.

The package [@librechat/code](../../packages/code/README.md) implements attached-worker protocols and a CLI. Its existence does not provide a supported general REST client SDK. The qualification client deliberately uses the published HTTP contract and standard Node modules.

## Stateless languages and curated packages

Source maps Python, Node.js, Bun JavaScript, Bun TypeScript and bash aliases to runtime identities. The baseline maps Python 3.14.4, Node 24.22.1, Bun 1.4.2 and bash 5.2.0; these are source mappings, not a promise about an arbitrary deployed image. See [language mapping](../../service/src/config.ts) and [sandbox runtimes](../../api/README.md#supported-runtimes).

Python's documented image includes scientific, plotting, statistical, embedded analytic and geospatial packages. Node/Bun use curated offline packages. The upstream patch candidate moves Bun from 1.4.2 to 1.4.4 in its runtime/build mapping; qualification must bind to the selected version. This supports CSV transformations, charts, numerical work and short data-processing scripts. It is not a general package-install service. Check the exact candidate image before promising a particular package or native dependency.

Stateless execution gives each request a fresh sandbox. Files survive between requests through explicitly owned storage references, rather than arbitrary process memory or a shared shell. Outbound access is restricted by the selected isolation/backend and egress configuration. Short scripts should not assume Internet access, arbitrary package downloads, an interactive terminal or host filesystem access. The NsJail path documents a separate network namespace and bounded CPU, memory, PID, file and runtime resources in [api/README.md](../../api/README.md).

Acceptance: execute deterministic examples in each required language; verify effective runtime limits and timeout behavior; check the actual packages a consumer needs; test exact artifact bytes. Performance measurements must separate Python dispatch from the other-language queue.

## Storage files and metadata

The stable HTTP surface supports single and bounded batch uploads, listing, metadata, download and deletion. Session kinds distinguish user, skill and agent resources. A reference includes storage session and object identity; a filename alone is insufficient. Generated outputs can be reused as later inputs while retaining ownership checks. See the `/upload`, `/upload/batch`, `/files`, `/download` and `/sessions/.../objects` routes in [OpenAPI](../../service/openapi.yml).

This object-storage lifecycle is distinct from a persistent worker workspace. Deleting a visible object and receiving a follow-up 404 proves the public object contract, not forensic erasure, backup deletion or a backend TTL policy. A test must retain ownership references before validating a response and clean only its own returned objects. Partial upload or output-delivery failure requires explicit handling; ignoring it creates false success and potential orphaned test data.

Acceptance: upload/download exact bytes, list and inspect the same owned object, reuse generated input, reject another principal's access, delete every returned owned object and verify absence. Qualify partial failures separately from the happy path.

## Programmatic tool calling

Programmatic tool calling lets sandbox code request agent tools, receive their results and continue. Replay mode is the source default: the sandbox can exit between rounds, tool results persist in Redis, and a continuation starts a fresh sandbox with recorded history. Blocking mode keeps a process alive and is a legacy opt-in. Tool-history entries and aggregate history have configured bounds. See [PTC configuration](../../service/src/config.ts), [programmatic router](../../service/src/service/programmatic-router.ts) and [replay state](../../service/src/service/replay-state.ts).

Replay reduces the need to keep a sandbox occupied while an external tool runs. It also changes the programming model: code before the next tool boundary can be replayed. A workflow must respect the protocol's side-effect/commit semantics and handle history bounds, competing continuations, expiration and cancellation. A running tool-call server does not establish that a particular agent/client implements this protocol correctly.

Remote bridge and Lambda backends reject blocking PTC. Attached bash replay additionally requires its negotiated worker capability, Bash 5.2+, `jq`, native sandbox commands and the relay. The attached-workspace implementation uses a disposable copy-on-write probe before the final commit pass; do not generalize that protection to an arbitrary client implementation. See [remote bridge](../../docs/remote-bridge/README.md) and [worker CLI](../../packages/code/README.md).

Acceptance: use one concrete agent workflow with successful continuation, tool error, duplicate/competing continuation and Stop. Measure round-trip overhead and confirm cancellation/cleanup. These routes extend beyond the stable OpenAPI path set, so bind the client to an exact source protocol.

## Attached workspaces and bring-your-own-machine workers

Remote Code Bridge connects an operator-owned execution machine outbound to CodeAPI. CodeAPI remains the authentication, policy, queue and result boundary. The worker can keep an existing repository/workspace across turns and restarts. It can run on a suitable Azure VM or another supported machine; this design does not require AWS Lambda. See [bridge guide](../../docs/remote-bridge/README.md), [worker runbook](../../docs/remote-bridge/worker-runbook.md) and [CLI](../../packages/code/README.md).

This requires the remote-bridge backend, a compatible stateful session configuration and authenticated worker selection. Paired mode binds workers to tenant/principal identities. Pairing and worker credentials have finite lifetimes and proof-of-possession requests bind method, path, body, time and nonce. Static authentication is documented as a development compatibility route, not a replacement for managed pairing.

Persistence transfers responsibility: the worker owns the workspace and its local data; CodeAPI/Redis own authorization, assignment, fencing and durable-request state. Redis durability and eviction behavior become part of correctness. Lost or ambiguous mutation settlement may fence a workspace and require explicit reset/discard. A reconnect is not proof that an interrupted mutation is safe to replay.

Native SRT needs the documented OS/runtime tools. Command execution and workspace writes are opt-in; egress requires an explicit policy. Default execution capacity is bounded, and operations on the same workspace root serialize. Negotiated independent-root concurrency is a different capability from parallel writes to one root. Docker/NsJail is an optional adapter with additional host/runtime requirements.

Acceptance: pairing/revocation, owner isolation, reconnect, real workspace persistence, interrupted mutation/fencing, cleanup and durable state recovery. Adopt this for an identified repository/data workflow rather than as an assumed upgrade to stateless `/exec`.

## Workspace tools and durable requests

The workspace API exposes listing, text search, reading, writing, edit preview/application, commands and import. It confines paths to registered roots and bounds results. Read-only tooling is the default subset; writes and commands require their explicit worker policies. A normal HTTP backend cannot serve remote workspace operations. See [workspace router](../../service/src/workspace-tools/router.ts), [selection](../../service/src/bridge/selection.ts) and [OpenAPI workspace routes](../../service/openapi.yml).

`import_file` bridges an owned uploaded object into a workspace using a bounded one-object read grant. It requires the remote bridge, writes and the egress gateway. The import size/free-space policy and root identity protections are consequential: an uploaded filename is not authorization to write any worker path. The upstream patch comparison includes corrections for missing parent directories and root replacement; qualify these before adopting import.

Durable workspace requests can return acceptance before completion and expose later status/results. Their queued/admitted/completed/failed/cancelled states require a client that follows the lifecycle. An accepted durable mutation must not be silently retried through a synchronous fallback. Result-retention duration is not the same as workspace-data retention.

Acceptance: negotiated capabilities, root confinement, writes disabled by default, import ownership and exact bytes, durable status/reconnect/cancellation, and explicit handling of ambiguous settlement.

## Stateful Lambda sessions and hosted apps

The optional AWS Lambda MicroVM backend offers warm-session reuse and checkpoint/restore. It requires its AWS region/service support, IAM, connector/image configuration, quotas and checkpoint storage. Stateless, affinity and strict modes make different reuse promises. Checkpoint bytes and transfer time are bounded; persistence is not unlimited memory or indefinite VM lifetime. See [Lambda guide](../../docs/lambda-microvm/README.md).

Hosted apps are an experimental stateful Lambda capability. They run an immutable app revision from a workspace checkpoint using a dedicated app-host image and preview gateway. They require preview-origin/signing configuration, DNS/TLS and a separate exposure/lifecycle policy. Documented restrictions include finite VM lifetime, no WebSockets and incomplete automatic reclamation of retained revisions. Launch environment variables are not a secret-management service.

Acceptance: checkpoint and restore exact contents, session expiry, quotas and cost, immutable revision binding, preview authorization, termination and retained-revision cleanup. This is a separate deployment and exposure decision; ordinary CodeAPI artifact success does not qualify it.

## Document extraction

Extraction is a separate package/service, not an implicit `/exec` feature. Its protocol extracts structured text from PDF or DOCX and returns an input digest, format and ordered segments. It deliberately rejects unsupported/ambiguous documents rather than silently recovering every format. It does not provide OCR, broad Office rendering, image understanding or a general document-processing pipeline. See [protocol](../../packages/extraction/src/protocol.ts), [server](../../packages/extraction/src/server.ts) and [isolated parser backend](../../packages/extraction/src/backend.ts).

Baseline limits include bounded input, text, result size, segment count, deadline and concurrent requests. PDF font/encoding limitations and the restricted DOCX body/table model are advertised capabilities, not implementation details clients can ignore. Errors such as unsupported content, encrypted document, output/resource limit and unavailable backend need deliberate consumer handling.

The baseline uses a separate isolated Unix-socket Compose service. Upstream `v1.10.13` changes its network/credential boundary: an internal network, provisioned credential and hardened endpoint contract replace that earlier local arrangement. Do not copy a baseline setup guide across that update without reviewing its isolation/container tests. Adoption needs a separate image, caller, credential/sync plan and representative-document acceptance.

## OpenShell

[OpenShell](../../docs/openshell/README.md) is an evaluation track. There is no enabled backend or accepted production adapter. The offline probe covers its own lifecycle, while runner compatibility, the signed execution/artifact contract and a live gateway remain unqualified. Root-workload restrictions conflict with existing runner requirements in the documented evaluation. This is a research option, not a feature available by changing a backend name.

## Upstream patch disposition

[Stable upstream v1.10.13](https://github.com/LibreChat-AI/code-interpreter/releases/tag/v1.10.13) contains extraction boundary changes, workspace root/import correctness and runtime/build alignment. Applicability depends on enabled capabilities. Optional extraction/import fixes do not by themselves establish a defect in every stateless deployment. Preserve the fork's existing trust, cancellation, telemetry and GitOps contracts during source reconciliation.

The current package records applicability and measures an immutable deployment. Source integration, exact images, staged runtime acceptance and production release authorization remain distinct. Upgrading source is not a substitute for measuring the queue/worker/runner configuration.

## Qualification and evidence

The [execution plan](2026-10-24-codeapi-capacity-contract-plan.md) owns the independent-client and finite load experiment. Run `node --test scripts/qualification/codeapi.test.mjs` for offline controls. Live operator use requires an explicit endpoint, authenticated synthetic token supplier, private receipt path and current safety guard. The module deliberately has no default remote endpoint or automatic retry.

Detailed measurements belong in ignored private receipts. A passing short Service-path run supports that exact client, workload, configuration and transport; it does not prove all packages, ingress, new issuer onboarding, sustained capacity, fairness, fault recovery or a service SLA.

# PR 18: CodeAPI issuer trust, public contract, and values-free logging

Status: draft pull request open

## Goal

Prepare the public CodeAPI repository for a future Klicker tutor integration by
binding JWT trust to issuers, publishing a truthful v1 execution and file API
contract, and removing linkable client values from operational logs.

This package stops at a pushed, verified, review-complete draft pull request.
Image publication, deployment, cluster access, live proof, and merge remain
separate decisions.

## Baseline and authority

- Repository: `uzh-bf/code-interpreter`
- Worktree: `trees/codeapi-trust-contract-logging`
- Branch: `rs/codeapi-trust-contract-logging`
- Base: `origin/main`
- Pull request: [#18](https://github.com/uzh-bf/code-interpreter/pull/18)
- Planning SHA: `83c4f7b105b6b3e69eda12701ad4ec437acba08f`
- Required delivery layer: `pr_ready`
- Authorized terminal layer: `pr_ready`
- Boundary owner: current execution orchestrator
- Pause conditions: a material contract change, secret or personal-data
  exposure, upstream integration requirement, or any withheld external action

The user approved the roadmap and local execution as a goal, then separately
authorized pushing the reviewed branch and opening draft pull request
[#18](https://github.com/uzh-bf/code-interpreter/pull/18). Integration, merge,
image publication, deployment, cluster access, live proof, branch deletion,
and worktree cleanup remain withheld.

## Research and planning review

Source inspection used the exact planning SHA and the repository's existing
tests, OpenAPI files, runtime routes, exported types, loggers, CI workflow, and
deployment configuration checks.

The configured Claude Opus advisor could not review this package because its
OAuth token had expired. The terminal error was `401 OAuth access token has
expired`; no fallback is represented as an Opus review.

The required native planning review completed with `DONE`. It accepted the
issuer-bound design with these corrections:

- trust entries use a strict, closed JSON schema;
- modern and legacy policy modes are mutually exclusive;
- loaded key IDs are unique and map bijectively to modern trust entries;
- issuer selection may inspect unverified `iss`, but every other field is
  checked only under the selected policy before a principal is accepted;
- the migration helper emits an explicit LibreChat entry and does not print a
  key ID.

No unresolved product or technical decision requires another user ruling.

## Product primitives and architectural decision

This package extends three existing primitives:

1. JWT trust policy changes from one global verifier policy to explicit
   issuer-bound entries owned by the CodeAPI operator and consumed by
   LibreChat and Klicker.
2. The CodeAPI v1 execution and file contract is corrected to describe existing
   runtime behavior. This package does not add a new execution feature.
3. Operational evidence remains useful through bounded classes, statuses,
   durations, counts, and byte totals while linkable client values leave logs.

The JWT choice passes the ADR gate because it changes an external security
contract and has meaningful alternatives. Slice 1 creates
`docs/adr/0001-issuer-bound-jwt-trust.md`. No domain glossary is needed.

## Frozen trust contract

`CODEAPI_JWT_TRUST_ENTRIES_JSON` is a strict JSON array. Every entry contains
exactly:

- `issuer`: one non-empty exact issuer;
- `audiences`: a non-empty unique list;
- `keyIds`: a non-empty unique list;
- `allowedAlgorithms`: a non-empty unique subset of `EdDSA`, `RS256`, and
  `HS256`;
- `principalSources`: a non-empty unique subset of `librechat_jwt`,
  `openid_reuse`, and `klicker_jwt`.

Unknown fields, unknown values, duplicate values, empty values, duplicate
issuers, duplicate loaded key IDs, keys assigned to multiple entries, missing
configured keys, and orphan loaded keys fail configuration. Declared or
inferred key types must be compatible with the entry's algorithms.

If the variable is present, even if empty, modern mode applies. Modern mode
rejects simultaneous `CODEAPI_JWT_ISSUER`, `CODEAPI_JWT_AUDIENCE`, or
`CODEAPI_JWT_ALLOWED_ALGS`. Existing key-material inputs and global clock skew,
maximum token lifetime, cache lifetime, and tenant-isolation settings remain.

If the variable is absent, CodeAPI normalizes the current legacy issuer,
audience, allowed algorithms, and all loaded keys into one LibreChat entry that
accepts `librechat_jwt` and `openid_reuse`. Existing claims, fallback aliases,
tenant behavior, key rotation, and error taxonomy remain compatible.

Verification decodes unverified payload data only to select an entry by exact
issuer. It then constrains algorithm and key ID, verifies the signature, and
enforces that entry's audience, principal source, and global time rules.
Unknown issuers report `wrong_issuer`; known issuers with unassigned keys report
`unknown_kid` where compatible with the current taxonomy.

Documentation and tests may contain synthetic Klicker examples that accept
only `klicker_jwt`. No live issuer, key, credential, or production value enters
the repository.

## Test portfolio

| Consequential behavior | Stable evidence seam | Slice |
| --- | --- | --- |
| Cross-entry combinations fail closed | Table-driven verifier tests swap issuer, key, algorithm, audience, and source one field at a time | S1 |
| LibreChat migration remains equivalent | Existing JWT, startup, principal, session, rate-limit, and setup-script tests cover legacy and explicit modes | S1 |
| Configuration and rotation are deterministic | Malformed, coexistence, duplicate, orphan, missing-key, fingerprint, and cache-expiry tests | S1 |
| Public contract matches runtime | Parsed OpenAPI assertions plus TypeScript compile/build evidence | S2 |
| Public errors stay generic | Timeout, rate-limit, download, authorization, and upstream-failure tests | S2 |
| Logs contain no linkable values | Winston and Pino sentinel captures reject raw, hashed, encoded, nested, message, and stack representations | S3-S4 |
| Metrics and traces remain useful | Existing telemetry privacy checks and low-cardinality metric assertions | S3-S4 |
| Exact package is buildable | Full API/service tests and builds plus deployment configuration checks | S5 |

No dependency is added solely for tests. Each new test protects an observable
security, privacy, or public-contract behavior.

## Delegation map

| Workstream | Owner | Dependency | Acceptance boundary |
| --- | --- | --- | --- |
| S1 issuer trust | Main session | Plan commit | Security and migration tests pass; slice reviews resolved |
| S2 public contract | One trusted executor | S1 decisions frozen; one writer at a time | Main session inspects the diff and reruns contract, type, and build checks |
| S3 service-edge logging | Main session | S2 integrated | Service sentinel captures and safe evidence assertions pass |
| S4 runtime logging | Main session | S3 safe logging seam | Remaining log inventory and dual-logger captures pass |
| S5 integration proof | Main session | S1-S4 reviewed | Exact-head full verification and final review pass |

S1 remains in the main session because it sets the security boundary. S3 and S4
remain there because they set the privacy boundary. S5 is critical-path
integration. S2 is bounded and decision-frozen enough for a trusted executor.

## Slices

### S1: Bind JWT trust by issuer

Implement the frozen trust contract in the existing verifier and startup path.
Preserve downstream `CodeApiPrincipal` semantics. Update configuration examples,
the local setup helper, focused tests, and ADR 0001.

Acceptance:

- strict modern configuration and legacy normalization are both covered;
- every cross-entry issuer, key, algorithm, audience, and source mismatch fails;
- LibreChat `librechat_jwt` and `openid_reuse` behavior remains;
- key rotation and configuration fingerprint behavior remain deterministic;
- the setup helper emits an explicit LibreChat entry without printing key IDs;
- service-focused tests and build pass.

Commit: `fix(auth): bind JWT trust by issuer`

After commit, run one simplifier and one security/architecture slice reviewer on
the immutable plan-to-S1 range. Apply only verified findings and rerun affected
checks.

### S2: Make the public contract truthful

Keep the flat v1 execution result as the public exported contract. Rename or
move the wrapped execution type so it is clearly an internal sandbox transport.
Correct `service/openapi.yml` for actual v1 execution, upload, batch upload,
file-reference, listing, metadata, deletion, download, rate-limit, timeout, and
safe-error behavior. Keep `api/openapi.yaml` explicitly internal and aligned
with `/api/v2/execute`. Replace the download route's raw internal error detail
with a generic response.

Acceptance:

- parsed OpenAPI assertions cover the listed public operations and responses;
- the public execution response is flat and the legacy wrapper is not exported
  as the public response;
- the internal sandbox route is not advertised as public v1;
- 429 headers and body, 504 timeout, and generic errors match runtime behavior;
- focused tests and API/service builds pass.

Commit: `fix(api): align the public CodeAPI contract`

After commit, run one simplifier and one public-contract slice reviewer.

### S3: Remove client values from service-edge logs

Use the smallest shared safe-classification helpers needed by auth,
request-error, rate-limit, public router, file authorization, programmatic
router, and replay paths. Emit static event names, normalized route classes,
stable reason/status, durations, counts, and bytes. Remove raw paths, client
request IDs, identities, sessions and keys, filenames and object names, code and
outputs, response bodies, hashes, and arbitrary errors.

Acceptance:

- synthetic auth, execution, upload, download, rate-limit, request-error, and
  programmatic sentinels do not appear raw, encoded, hashed, nested, or in error
  messages and stacks;
- useful low-cardinality reason, status, count, duration, and byte fields remain;
- existing service behavior, metrics, and telemetry privacy tests pass.

Commit: `fix(logging): remove client values from service logs`

After commit, run one simplifier and one privacy/security slice reviewer.

### S4: Sanitize internal and sandbox logs

Audit remaining operational logger and console calls in `service/src/**` and
`api/src/**`, including file server, workers, tool-call server, egress, runtime
sessions, checkpoints, workspace/input handling, sandbox routes, and jobs. Keep
returned stdout, stderr, files, and execution behavior unchanged.

Acceptance:

- Winston and Pino captures reject identifier, filename, code/output,
  response-body, and error-stack sentinels in every remaining path;
- bounded class, status, duration, count, and byte evidence remains;
- telemetry and metrics stay low-cardinality;
- full focused logging tests and package builds pass.

Commit: `fix(logging): sanitize runtime and sandbox logs`

After commit, run one simplifier and one privacy/security slice reviewer.

### S5: Prove the exact local head

Run the repository's complete API and service installs, tests, and builds on the
same exact commit. Run the existing deployment configuration shell checks.
Update this Progress section with command outcomes and the exact SHA, then run a
final reviewer over the complete base-to-head range.

No repository mutation follows a clean final review. One bounded correction
pass may address verified material findings, followed by affected verification
and review.

## Scope exclusions

- Klicker implementation, token minting, production configuration, and live
  issuer or key values;
- remote JWKS retrieval, a new key provider, per-entry tenant or TTL policy, or
  a new dependency;
- relabelling internal `/api/v2/execute` as public v1;
- telemetry redesign, execution-output redaction, storage redesign, or a
  rate-limit behavior change;
- upstream merge or rebase, image publication, deployment, cluster access, live
  proof, merge, branch deletion, or worktree cleanup.

## Progress

- 2026-08-30: Roadmap W1 selected and exact public CodeAPI baseline pinned at
  `83c4f7b105b6b3e69eda12701ad4ec437acba08f`.
- 2026-08-30: Source inventory completed for auth, API contracts, logging, and
  CI verification seams.
- 2026-08-30: Claude Opus advisor unavailable because its OAuth token expired;
  no Opus review claimed.
- 2026-08-30: Mandatory native planner returned `DONE` and its fail-closed
  corrections were incorporated.
- 2026-08-30: User approval is recorded for local execution through
  `local_review_complete`; external delivery remains withheld.
- 2026-08-30: S1 committed at `d5f1ea0` with a follow-up test simplification at
  `e860e58`; focused trust, migration, startup, and build checks passed, and
  the required simplifier and security/architecture review were resolved.
- 2026-08-30: S2 committed at `ce11d7f` with a follow-up contract-test
  simplification at `8eba719`; parsed OpenAPI, type, focused behavior, and
  package build checks passed, and the required simplifier and public-contract
  review were resolved.
- 2026-08-30: S3 committed at `7d0546f`; service-edge Winston captures and
  focused auth, request, router, programmatic, rate-limit, and telemetry checks
  passed. The privacy/security reviewer found no issue. Two simplifier ideas
  targeted unrelated pre-existing CI and router structure and were rejected as
  outside the logging slice.
- 2026-08-30: S4 completed a source-wide operational-log and telemetry audit.
  Pino and Winston sentinel captures, the complete API suite, the
  repository-defined service suite (`569` tests), and both package builds
  passed. Existing Rollup export, circular-dependency, and two TS2352 warnings
  remain unchanged.
- 2026-08-30: S4 committed at
  `0be1654b052bcceaea9e4b585a502dbdbd50ec9e`. Its required simplifier and
  privacy/security reviewer both returned `DONE`; neither found a material
  correction.
- 2026-08-30: S5 exact-source verification used `0be1654`. `bun ci` reported
  no dependency changes in either package. API tests and build passed; the
  repository-defined service tests passed `569/569`, and the service build
  passed with the unchanged warnings above. Both
  `tests/block_root_package_delivery.sh` and
  `tests/sandbox_runner_healthcheck.sh` passed.
- 2026-08-30: A diagnostic bare `bun test` in `service/` is not the
  repository-defined suite: it also discovers the k6 stress script and fails
  because Bun cannot resolve `k6/http`. This result is not represented as a
  service-suite pass or failure; `bun run test` is the configured CI command.
- 2026-08-30: The integrated final reviewer covered correctness, plan
  compliance, maintainability, security, and architecture across
  `83c4f7b..0be1654` and returned `DONE` with no findings.
- 2026-08-30: Draft pull request
  [#18](https://github.com/uzh-bf/code-interpreter/pull/18) opened for the
  reviewed package; this metadata-only rename records its identifier.
- Current slice: delivery complete through the draft PR boundary.
- Required delivery layer: `pr_ready`.
- Achieved delivery layer: `pr_ready` through draft pull request
  [#18](https://github.com/uzh-bf/code-interpreter/pull/18); source review and
  verification remain anchored at `0be1654`, with later commits limited to
  plan metadata.
- Delivery status: exact-head GitHub checks remain the merge blocker.
  Integration, merge, image publication, deployment, cluster access, and live
  proof remain withheld.

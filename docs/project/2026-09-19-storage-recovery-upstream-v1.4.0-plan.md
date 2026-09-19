# Storage recovery and upstream v1.4.0 integration

## Approval summary

Approval mode: executable batch. On 2026-09-19 the user approved the preceding
storage-reliability proposal and changed the upstream target to v1.4.0.
The active goal covers this complete conditional sequence, including GitOps
merges and staged STG then PRD deployment after successful acceptance checks.

Restore artifact storage without removing existing volumes or changing the
SeaweedFS image. Use disk-derived allocation limits with 2048 MiB volumes,
single-volume growth, and an explicit low-space guard. Establish a usable
recovery point and isolated restoration evidence, add detection for storage
failure, and verify complete artifact round trips. Then merge upstream v1.4.0
into the fork with its history preserved, validate the resulting fork revision
in STG, and conditionally promote storage and application changes to PRD.

Preserve existing data, credential boundaries, KEDA ownership, and the policy of
no fork release tags or releases. No blanket data expiration, storage migration,
HA redesign, broad cleanup, production-data export, or unrelated infrastructure
changes are authorized. Required human reviews remain binding. Do not request
reviewers or notify people. Synthetic checks may remove only their own objects.

Completion requires separate receipts for source, CI, desired state, running
images, storage topology, and authenticated consumer/artifact acceptance in both
environments. Stop only dependent branches on failed checks or a material scope
decision. A healthy Argo application or HTTP 200 execution does not substitute
for delivered and downloadable artifacts. Recovery must preserve new writes;
reverting the storage limit to eight is not a safe rollback.

## Execution details

Historical evidence and exact-version sizing rationale are in
[the investigation](2026-09-19-storage-reliability-investigation.md). Its release
target is superseded here. Upstream v1.4.0 is
277fa7742d383eb1b6606ec228cdafe36af043a4, published 2026-09-19 18:51:13 UTC.
In addition to v1.3.x GitHub credential routing, it advertises a workspace
command timeout ceiling in the bridge protocol. Review that public-contract
addition and its tests as part of the integration. The field is optional,
only applies to execute_command-capable workers, and is capped at 300000 ms.
Extend existing router tests for a lower configured value, no configuration,
no command capability, and invalid values. Compare advertised and enforced
command ceilings; legacy clients must tolerate omission. This is separate
from HTTP cold-start deadlines, execution job timeout, cancellation, and TTL.

Main session owns integration, secrets, cluster effects, and final acceptance.
Execution mode: standard; a native planner is available in this turn, unlike
the preceding investigation. Native review and eligible implementation workers
use clean context with bounded ownership. Existing successful local storage
experiment evidence is reused; do not re-run it solely for a new work phase.

### Workstreams and delivery boundaries

1. **Recovery and STG storage — main.** Refresh exact live state; discover the
   in-environment backup/snapshot mechanism and existing monitoring owner.
   Both isolated restoration and physical-reserve acceptance below are
   mandatory before merging storage configuration, because Argo auto-syncs.
   Obtain a recovery point and verify isolated restoration within the same
   environment before shared-storage mutation. Preserve data locality. Pause
   for a material new service/cost/data boundary. Source changes belong in a
   STG-only helm-charts task branch, targeting main; render and validate before
   push/review/merge. Set the three proposed flags and copy_1 environment value.
   Never modify both environment paths in the same rollout merge.
2. **Storage detection — main with bounded worker.** Add storage metrics and
   a bounded synthetic write/read/hash/delete check through the existing
   platform monitoring mechanism. Verify detection of missing/zero writable
   capacity, allocation errors, physical space, and artifact failures. Validate
   the 5 GiB cutoff and proposed 10/7 GiB warning/critical levels in isolated
   tests before freezing them. Preserve read-only access during dependency
   failure; liveness must not trigger restart loops. No blanket retention.
3. **Upstream and readiness — bounded worker plus main integration.** Use this
   fork task checkout, starting at ccc225985ff2f6aec6a3fe1472515d8e9bf188bf.
   Merge v1.4.0 without squash. Correct the file-server readiness boolean for
   a missing bucket and add focused behavioral coverage. Preserve all fork
   contracts and disabled Release workflow. Run repository-native tests and
   CI, then merge through the approved target main with required reviews.
4. **STG application acceptance — main.** Coordinate the chart revision in
   df-cloud and image pins in helm-charts for one built fork SHA. Use CI-only
   Pulumi preview/apply and GitOps reconciliation; no local Pulumi or live
   patch. Verify KEDA replica ownership. Exercise actual intended consumer
   entry points plus authenticated input upload, execution, artifact delivery,
   content-checked download and reuse; prove cold and warm execution, timeout
   and cancellation behavior. Verify Trypost storage remains functional.
5. **PRD promotion — main.** After STG storage, detection, recovery, and CodeAPI
   acceptance pass, establish fresh PRD recovery evidence, promote only PRD
   storage changes, and run bounded synthetic checks. Then promote the same
   tested CodeAPI SHA through the normal environment branch workflow. Repeat
   consumer acceptance and record the terminal receipts.

Helm-charts artifacts root is project/. CodeAPI artifacts root is docs/project/.
Cross-repository MRs link this governing plan and include scoped local delivery
notes. The existing primary checkouts are inspection-only. Use task checkouts
under writable roots; the helm and infrastructure primary paths are sandbox
read-only. This does not prevent ordinary branch delivery from isolated clones.

### Delegation map and exact delivery paths

| Slice                                       | Sole implementation owner | Dependency and acceptance                                                                                                                                                                       |
| ------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan, recovery design and live effects      | main                      | Planner review; in-environment consistent recovery evidence before storage merge                                                                                                                |
| Bounded physical-space prototype            | native executor Dalton    | Exact-image local synthetic filesystem; no shared data; acceptance below                                                                                                                        |
| Upstream merge                              | main                      | Merge v1.4.0 commit into task branch preserving both parents; CI and ancestry checks                                                                                                            |
| Readiness correction and timeout tests      | native executor           | After upstream local merge; owns service/src/file-server.ts, new service/src/file-server-readiness.test.ts and existing service/src/bridge/router.test.ts; no delivery or infrastructure access |
| GitOps storage/configuration and monitoring | main                      | Coupled recovery, permissions and deployment decisions; paths below; CI and applicable independent review before merge                                                                          |
| Consumer verification and promotion         | main                      | Credential and environment boundary; only synthetic identified data                                                                                                                             |

Helm changes target main in separate STG and PRD MRs. Existing paths are
seaweedfs/{stg,prd}/deployment.yaml, service.yaml, networkpolicy.yaml,
pvc.yaml and codeapi/{stg,prd}/values.yaml (verify exact filenames before edit).
Proposed new monitoring manifests are seaweedfs/{stg,prd}/monitoring.yaml;
recovery manifests, if their design is accepted, are
seaweedfs/{stg,prd}/recovery.yaml. Do not implement these pending designs simply
because paths are named. The df-cloud owner is src/apps/seaweedfs/index.ts for
bootstrap and Argo kind permissions, and src/apps/codeapi/index.ts for the
chart revision. Start from origin/stg; promote relevant commits through the
existing prd branch process. Preserve unrelated drift. No local Pulumi.

CodeAPI integration may progress independently of the recovery block. Before
main merge verify both ccc225985ff2f6aec6a3fe1472515d8e9bf188bf and upstream
277fa7742d383eb1b6606ec228cdafe36af043a4 are ancestors of the proposed head.
Verify again against the resulting remote main. Use merge commits, no squash.
Fork release/tag workflows stay disabled; publish immutable commit images only.

For each environment, build all images before changing desired state. Render
the chosen chart revision with its values before coordinated promotion; use
CI-only df-cloud preview/apply for the chart revision and helm-charts for all
seven image references: api, worker, sandbox-runner, package-init,
file-server, tool-call-server and egress-gateway (confirm value paths when editing).
Sandbox-waker inherits its image from the chart and is verified separately.
Record baseline chart and seven pins first, then proposed and reconciled values.
A failed application check restores that recorded compatible chart/image set
while retaining repaired storage settings. Do not promote PRD until STG passes.

### Recovery and detection prerequisites

Current preflight: neither cluster has a VolumeSnapshotClass. Snapshot CRDs
exist, but this alone does not establish a functioning controller. Azure CLI
cannot refresh its token because the sandbox rejects its token-cache lock.
No credential caches may be copied to bypass this limitation. Resolve supported
snapshot capability before implementing a recovery mechanism. The SeaweedFS
AppProject currently excludes VolumeSnapshot, CronJob, ServiceMonitor,
PrometheusRule and ConfigMap; bootstrap and permission additions belong to
Pulumi, with normal CI preview/apply and review.

Recovery must capture the entire PVC, including volume data and filer metadata.
A live disk snapshot is crash-consistent, not proof of application consistency.
Preferred consistency method is a bounded write-quiescence window with a clean
SeaweedFS shutdown, followed by snapshot and isolated same-environment restore.
That maintenance window and any new cloud snapshot/restore cost require a
concrete decision after capability discovery; they are not inferred from this
plan. Never automatically restore over live data. Record source PVC UID,
snapshot/content identity, completion time and restore PVC UID. Recovery evidence
must be collected in the same environment immediately before its storage merge
(maximum age one hour); if writes resumed, record that later writes are outside
the snapshot and must be retained by configuration recovery. Isolated restoration
must start the exact image without production endpoints, restore filer metadata,
and verify synthetic object hashes and a new synthetic write/read cycle. Do not
list or output real object names/content. Failure blocks that environment's merge.

Existing one-replica Recreate rollout interrupts storage access. Do not replay
failed application work automatically. A failed storage rollout blocks application
promotion and preserves all existing volumes and new writes; only a reviewed,
data-preserving configuration correction is allowed. The max=8 setting is not a
rollback after additional volumes have been allocated. Destructive restoration
and deletion of recovery resources remain separately gated.

Before STG storage merge, test the exact SeaweedFS image on a bounded synthetic
filesystem with proportionally scaled volume size/reserve: writes succeed above
the reserve, fail below it, reads preserve hashes during the failure, and writes
recover after removing only test-created filler. Record observation delay and
recognize that reserve enforcement is periodic, not a transactional disk quota.
The passed allocation/restart experiment remains reusable.

PRD has no configured Alertmanager; source intentionally enables it only in STG
(src/infra/observability.ts and tests). Do not silently change that policy or send
notifications. Both environments require recurring write/read/hash detection,
missing-series detection, capacity/allocation errors and physical-space rules.
Existing authorized delivery must be demonstrated without notifying people;
if no existing destination is authorized, that gate remains open pending a
specific routing decision. Thresholds 10/7 GiB and reserve 5 GiB remain provisional
until reserve acceptance and metric availability are verified.

### Verification portfolio

| Risk                        | Portfolio disposition and primary seam                            | Acceptance                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Allocation starvation       | Extend existing exact-image local experiment                      | Physical reserve test above; live topology has writable codeapi-files and spare slots                                                                 |
| Recovery                    | Add new environment receipt, no production-data fixtures          | Consistent whole-PVC recovery plus isolated restore before storage merge                                                                              |
| Readiness                   | Add new file-server-readiness.test.ts at HTTP handler seam        | Missing bucket gives 503; present bucket gives 200; Redis/S3 errors give 503; liveness remains 200                                                    |
| v1.4.0 timeout              | Extend existing bridge/router.test.ts                             | Lower ceiling, upper clamp, absent capability/config, invalid values, legacy omission and actual enforcement bound                                    |
| Upstream/fork contracts     | None new beyond targeted regressions                              | Existing service/API/package/build/CI suite and both ancestry checks pass                                                                             |
| Artifact delivery           | Extend existing synthetic environment checks                      | Authenticated upload, execution, nonempty artifact_delivery, download hash, reuse in next execution; no duplicate on retry                            |
| Cold start and cancellation | Extend existing synthetic environment checks                      | Original cold request completes within configured client deadline; warm call passes; cancellation reaches terminal state and produces no late success |
| Recurring detection         | Add monitoring manifests only after design prerequisites resolved | Fresh canary metric, bounded failure and missing-series alarm; existing authorized destination proof; 15-minute observation after recovery            |

Intended consumers are the deployed CodeAPI API through the existing authenticated
client, the deployed LibreChat code-interpreter integration where configured,
and STG Trypost's trypost-media storage integration. First confirm exact consumer
configuration and available synthetic credentials; unavailable consumer access is
an explicit acceptance gap, never a successful direct-API substitute. Required
buckets are codeapi-files in both environments and trypost-media in STG; no new
production tenant is part of acceptance. Use unique per-run synthetic IDs, byte
hashes, scoped GETs and deletion of only the test's own objects.

Record effective client cold-request deadline, JOB_TIMEOUT (currently 300000 ms),
manifest TTL (currently 360 seconds), polling/cancellation settings and retry
policy before tests. Do not change them to force a passing run. Use a single
cold request and one warm request, one bounded timeout and one cancellation,
then verify no late artifact success for cancelled work over the configured
retention interval. Record each operation's ID/status without secrets/content.

## Progress

Planning review: APPROVED after one correction round on 2026-09-19. No cluster
mutations have occurred. Azure snapshot capability discovery is blocked by the
sandbox token-cache lock. Snapshot consistency/window and PRD alert delivery are
open decisions; dependent storage merges are blocked. Independent upstream
integration, readiness tests and local capacity proof may proceed after review.

Open helm-charts MR !101 (Plane staging) adds a SeaweedFS component that replaces
its entire args script. It currently repeats the unsafe default allocation
settings. It is not merged or enabled in current main. Do not merge or activate
that component before it preserves the repaired capacity flags; otherwise it
would reintroduce this defect. Do not modify that other owner's branch without
coordination. Record this dependency in storage delivery notes.

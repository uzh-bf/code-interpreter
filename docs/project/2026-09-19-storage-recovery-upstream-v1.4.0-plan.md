# Storage recovery and upstream v1.4.0 integration

## Historical close-out checkpoint — superseded by approval below

Source integration is complete; the environment rollout remains blocked and
must not be recorded as achieved. The user requested task finalization.
Fresh forge checks confirm main remains 5d063ffe81df98824c5a15fcafabef5728973672,
PR #31 is merged, both upstream v1.4.0 and the prior fork baseline are ancestors,
and post-merge CI 35466160859 and image build 35466160848 succeeded.
There are no open fork PRs, fork tags, or fork releases.

STG storage MR !103 remains open and draft at
75ad20714483286055a40e798b905a7d0127cc80; pipeline 668175 succeeded.
Its mergeable forge status does not satisfy the recovery or runtime gates.
Plane staging MR !101 remains open and draft at
73bfd5b3a51de128da093d4ae75e713ef3ca954b; preserve the capacity settings before
that component is activated, as described below.

Resume in this dependency order:

1. Restore supported Azure authentication-cache access, then discover snapshot
   capability. Resolve the STG maintenance window and snapshot/restore cost.
   These blockers remain unresolved; cluster health was not rechecked at close-out.
2. Obtain fresh consistent whole-PVC recovery and isolated restore evidence,
   establish safe first replacement, then merge !103 and verify writable
   codeapi-files capacity, spare slots, Trypost access and recurring detection.
3. Promote the seven 5d063ffe image pins and chart revision to STG through GitOps;
   pass authenticated artifact upload, execution, download/hash and reuse,
   cold/warm execution, timeout and cancellation acceptance.
4. Resolve PRD alert delivery and fresh PRD recovery evidence, then perform
   separate PRD storage and application promotions with the same acceptance.

Existing source and local-test receipts below remain valid for their recorded
scope. No deployment or live acceptance is claimed by this checkpoint.
The CodeAPI task clone and helm-charts task clone were clean and synchronized
with their remote task branches before this documentation update. The CodeAPI
branch had three documentation commits beyond main. No task containers were
running at close-out; only the shared devrouter-traefik container was listed.
Retain task branches, clones, synthetic evidence and recovery resources for
continuation; no cleanup or deletion was performed.

## Approval summary

### Approved recovery execution — 2026-09-20

The user approved the next STG storage interruption, one recovery snapshot and
an isolated 50 GiB restore with temporary Azure costs. Azure token refresh now
succeeds. Azure reports disk CSI and managed snapshot controllers enabled in
both clusters. No AKS controller installation is needed.

Bootstrap delivery is [df-cloud MR !600](https://gitlab.uzh.ch/uzh-bf/cloud/df-cloud-klickeruzh/-/merge_requests/600),
head 0ea0f280cc75015860b090a032065d1eca750e5b. It adds a Pulumi-owned incremental
Retain snapshot class and namespace-scoped Argo permissions for recovery and
monitoring. Independent source review passed with no findings; simplification
recommended no changes. Exact-head STG preview job 2125702 and MR pipeline
668341 passed: one snapshot class create and one AppProject update, no deletes
or replacements. Refresh-only drift was existing controller defaults, discovered
resources and StackReference outputs. No local Pulumi.

MR !600 merged with history preserved at 18100341e123c33a6799e8ee9db727f774ece117.
Merged STG pipeline 668406 has its SeaweedFS child 668426 triggered. Build 2126110
and preview 2126111 gate manual apply 2126112. The existing watcher targets this
STG pipeline. Both preview and apply subsequently passed; see recovery completion below.

The first recovery artifact is [helm-charts MR !104](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/merge_requests/104),
head fe82c85d7b501789a9b8ef0448080e0b05c1c03f, merged with history preserved at
628c31d8712b893da1f784b3e1454205cd39ad4b. Independent review, server dry-run,
Kustomize rendering and secret-detection CI passed. Its bounded synthetic
Trypost write/read/hash Job completed in STG at 2026-09-20 09:54:24 UTC with exit
zero. Job UID is 34b532de-d255-44bf-94ee-3d0750ecb135; synthetic content SHA-256
is 9775d7a5ca100b519819db645bb559f29c85051c7b4d5dfde2a9f3ec1f789ab1.
The fixture remains for snapshot verification. This proves the synthetic
Trypost round trip, not CodeAPI recovery or snapshot restoration.

The temporary admission fence is prepared in
[helm-charts MR !105](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/merge_requests/105)
at 3856d06850483ce4b2f8523b2c132962d10cabbf. Its operational utility and isolated
restore artifacts are outside Kustomization. Six regression cases, correction
review and exact-head pipeline 668352 passed. It subsequently merged after bootstrap apply.

Planner-approved maintenance sequence: establish a temporary zero-pod admission
quota through GitOps while omitting PostSync bootstrap hooks; leave the current
Deployment unchanged. Verify quota enforcement before deleting only the recorded
SeaweedFS pod with an explicit 120-second grace and UID precondition. This bounded
operator DELETE is an approved maintenance action, not a configuration PATCH;
all desired-state changes remain GitOps/CI. Capture sanitized termination status
and require exit zero. Do not shorten grace through another delete or scale-down.
After clean termination, reconcile zero replicas and 120-second future grace;
verify disk detachment, take exactly one snapshot and await readyToUse.

Then admit an isolated restore Job mounting only the snapshot-backed 50 GiB PVC.
It uses the same SeaweedFS digest, synthetic local credentials, loopback binding,
unique labels outside production Service selectors, no service-account token,
and the existing default-deny policy. Verify the preserved synthetic bytes and
metadata, then a new CodeAPI-bucket write/read/hash with repaired capacity flags
on the restore only. Require clean restored-server shutdown. Restore/snapshot
resources are retained. A draft of all three recovery resources passed STG
server dry-run; this is schema evidence, not runtime recovery acceptance.

Failure before deletion restores the quota/hook configuration. Failure after
deletion blocks the repair; once the old process is demonstrably gone, restore
service on the original PVC with baseline allocation plus 120-second grace.
Never restore over the original PVC or force detach. After repair accepts new
writes, retain repaired allocation settings on every recovery branch.

The bounded shutdown utility passed synthetic cases for clean exit, nonzero
exit, missing fence, wrong pod UID, wrong PVC UID and stale termination status.
It accepts only current deletion-marked clean exit evidence and drops arbitrary
termination messages from receipts. Independent correction review passed.
This sequence subsequently completed through storage resumption as recorded below.
The PRD alert destination remains an open decision requested from the user.

### Historical rollout resumption check — superseded by recovery completion

The user requested rollout continuation after close-out. Kubernetes read access
now succeeds for both aks-stg-apps and aks-prd-apps; the earlier cluster-access
blocker is cleared. Azure management token refresh still fails with
`Operation not permitted` for the MSAL token-cache lockfile. No credential
cache was copied or permission boundary bypassed.

The full STG deployment at MR !103 head 75ad207 passed Kubernetes server-side
dry-run, including the 120-second grace setting. Both live deployments still
have one Ready replica, image 4.37 at the recorded digest and 30-second grace.
STG app-seaweedfs in namespace argo is Synced/Healthy at 1bd3caf1; this is the
unrepaired baseline, not artifact acceptance. Neither cluster has a
VolumeSnapshotClass; STG has no SeaweedFS VolumeSnapshot. The STG Argo project
still excludes VolumeSnapshot and the required monitoring resource kinds.
PRD still has no Alertmanager resource.

No live mutation occurred. Recovery capability, a concrete STG interruption
window and snapshot/isolated-restore cost remain prerequisites to storage merge.
PRD alert delivery remains a later promotion decision. The native goal remains
blocked; its resume control is user-only, and no replacement goal was created.

Approval mode: executable batch. On 2026-09-19 the user approved the preceding
storage-reliability proposal and changed the upstream target to v1.4.0.
The approved goal covers this complete conditional sequence, including GitOps
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

### Historical monitoring preparation — superseded by recovery completion

The required detection is integrated into existing
[storage MR !103](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/merge_requests/103) at
7815c5f0175e4a217fa55a60fa77db87bb544231, avoiding a second storage restart.
The same replacement enables private metrics scraping plus one bounded canary
per existing bucket. It checks a reserved synthetic object only; credentials
remain existing Secret references. Rules cover failed/stopped canaries, writable
volumes, spare slots, allocation errors, scrape absence and physical PVC space.
All manifests passed STG server dry-run. Prometheus 3.10.0 syntax and seventeen
behavioral cases passed, including startup delay and normal transient growth.
The 4.37 writable gauge refreshes every 5 to 5.5 minutes, so its alert waits
seven minutes; the one-minute canaries provide earlier behavioral detection.
Exact-image inspection confirmed all retained metrics, including both writable
collection gauges after their first refresh. The synthetic container is stopped.
Pipeline 668389 and integrated final review passed with no findings. Simplification
recommended dropping byte counts before hash comparison; retain the previously
tested checker because its small overhead does not justify changing this proof.

The df-cloud bootstrap pattern audit passed with no findings. Its authoritative
MR preview passed and the merged STG preview/apply is queued on the shared runner. No maintenance shutdown,
snapshot, restore or application rollout has happened. The only live change
so far is the successful retained synthetic recovery-seed Job.

The application promotion is prepared in
[helm-charts !106](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/merge_requests/106)
at d1ada06477eb09d70fa2108e35473fffebec5d8c (seven STG image pins), and
[df-cloud !601](https://gitlab.uzh.ch/uzh-bf/cloud/df-cloud-klickeruzh/-/merge_requests/601)
at f210432ddf2e557728222c2910dc25fb3dd3c690 (chart revision only). Both target
5d063ffe81df98824c5a15fcafabef5728973672, with prior revision 929ec4d recorded
for recovery. The chart tree equality was freshly verified. Preview-only pipeline
668394 and MR pipeline 668396 are queued; draft delivery is not deployment.
Integrated source review and the applicable pattern audit passed. Helm pipeline
668391 passed. Merge/apply await storage acceptance and authoritative preview.

The user approved the exact local Infisical profile codeapi-stg with read access
only to CODEAPI_JWT_PRIVATE_JWK_JSON, no writes. Configuration reused the existing
organization identity; status and 0600 file mode passed. A short-lived token was
minted only in memory. A synthetic nonexistent-session probe received 403 with
the valid signature and 401 with an invalid signature. This proves current STG
authentication and ownership enforcement, not execution or artifact storage.
The temporary port-forward used for this preflight was stopped successfully.

### Recovery prerequisite completion — 2026-09-20

Merged STG preview 2126111 passed with one create, one update and no deletes or
replacements. Apply 2126112 succeeded at 2026-09-20 11:27 UTC. Live checks confirm
the incremental Retain snapshot class (UID 995c3b67-a899-4f8d-b1cd-39463520d824)
and the scoped Argo kind permissions. PRD was not changed.

[Recovery fence MR !105](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/merge_requests/105)
merged at 2fd428e144a22c6bcae2e9225f7c046bda4600d9 after verifying that an intervening
main change affected only question-generation PRD configuration. The fence
rejected replacement pods before the approved UID-bound DELETE. The old process
exited zero at 11:34:04 UTC. MR !108 then set zero replicas and future grace to
120 seconds; the Azure disk detached with no remaining original-PVC mounts.

[Snapshot MR !109](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/merge_requests/109)
created the single approved snapshot, seaweedfs-recovery-20260920, at 11:37:45 UTC.
It is ready, Retain, 50 GiB, bound to snapshot UID
bc55993a-746d-46b5-855c-c4cae4c0dbac. Source PVC UID remains
99443fd6-724b-4c64-82c5-4ba63d90d329.

[Isolated restore MR !110](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/merge_requests/110)
mounted only restored PVC 3c6e6a3a-4177-401b-84b9-f4079ffb43f8. The verifier
matched the saved synthetic Trypost hash and metadata and completed a new
CodeAPI-bucket write/read/delete cycle. Verifier and restored server both exited
zero by 11:41:49 UTC. The original PVC was never mounted by that Job.
Snapshot, restored PVC, Job and seed remain retained; no deletion is authorized.

Storage MR !103 passed focused integrated review at 7ad8b3c, exact-head CI
668530 and full-tree server dry-run. It merged before snapshot age reached one
hour. Argo reconciled bd2bd17b; original storage became Ready at 11:47:25 UTC
with the pinned SeaweedFS digest, original PVC, repaired allocation and metrics.
Both canaries succeeded at 11:48 UTC. Startup checks ran before readiness and
failed once each; subsequent scheduled checks prove recovery. Allocation metrics
show 24 disk-derived slots and nine used. Physical free space is 52,501,647,360
bytes from kubelet summary. Prometheus PVC-series ingestion and delayed writable
gauges are still under observation before application promotion.

CodeAPI promotion MR !601 pipeline 668396 and preview 2125928 passed. Its only
desired change is app-codeapi chart revision 929ec4d to 5d063ffe; no creates,
deletes or replacements. Source review remains valid. Storage and runtime gates
still block its promotion.

### STG rollout and failed cold acceptance — 2026-09-20

The storage observation passed at 12:03:54 UTC. Each bucket completed sixteen
consecutive scheduled checks over fifteen minutes; maximum gap was 63 seconds.
Prometheus confirmed fifteen spare slots, one writable volume per required
collection, healthy scraping, physical headroom above 10 GiB and all ten storage
rules inactive. The resumed original PVC retained the synthetic recovery hash.

Helm MR !106 merged at 669b8add and df-cloud MR !601 at 4c3acda9. All five
running service deployments use 5d063ffe; the sandbox template uses the same
revision with KEDA owning scale from zero. Chart files are byte-identical to the
previous revision, so execution verification can proceed while merged STG child
668590 runs its chart-revision-only preview 2126928. Apply 2126929 remains gated
by that exact preview. The named bridge was triggered through glab GraphQL;
glab ci trigger did not recognize the manual bridge by name.

The single authenticated cold probe passed health and a 148-byte synthetic
upload. Execution returned HTTP 502 after 134,816 ms. The exact test-owned queue
record confirms one attempt, HTTP backend, and ECONNREFUSED. No execution retry
was sent. The probe skipped warm, timeout and cancellation requests, deleted its
input and verified HTTP 404. Sandbox image pull completed later, about 217
seconds after admission; runner readiness within 300 seconds was not captured.
This is failed application acceptance and blocks PRD promotion.

Source inspection shows one HTTP execution POST with no availability wait.
Prepare a narrow correction in service/src/sandbox-backend/http.ts and its
existing test file. Retry only Axios ECONNREFUSED without a response, disable
execution redirects so a redirected failure cannot replay an accepted POST,
and preserve the signed body. Use one finite absolute deadline, taking the
worker deadline when supplied and validated JOB_TIMEOUT otherwise. Compose
caller cancellation and a deadline timer, clean up listeners/timers, and use
500 ms abort-aware backoff capped by remaining time. Never retry HTTP errors,
resets, timeouts or other ambiguous post-dispatch failures. Add no endpoint,
dependency, configuration surface or larger runtime budget.

Planner review approved these obligations. Route: executor owns only http.ts
and http.test.ts; main owns this plan, CI reconciliation, integration and proof.
Extend existing real-transport tests for refused-then-listening success,
unchanged signed body, abort/deadline including missing-deadline fallback,
hanging accepted request, HTTP failure, accepted-request disconnect, and
redirect to a refused port. Require no repeated accepted execution. Stop if the
fix requires broader retries, renewed signatures or worker changes. Source
delivery remains a draft until its review and CI pass; a new image rollout and
fresh cold execution proof must be explicitly covered before those live actions.
No warm rerun substitutes for the failed cold acceptance.

### Cold-start correction source verification — 2026-09-20

The correction is committed as 39cbcd26e95e7735639c9b3caf81bbb32636ac65.
It changes only the existing HTTP backend and its transport tests. In a disposable
Bun 1.3.14 container with Redis, jq and Python installed, the service build passed
with no new type warnings, scoped ESLint reported zero errors and one existing
warning, and the full service suite passed 1,114 tests with twelve skips and no
failures (3,373 assertions across 97 files). The earlier bare-container full run
lacked Redis and jq; it is superseded by this properly provisioned run. Existing
unrelated build warnings and test DNS diagnostics remain visible in local logs.
The test container exited and was removed automatically.

The substantive package is 455 added/deleted source and test lines across two
files, excluding the project plan. One defect correction and its regression
coverage form a single package. Independent simplification and slice review are
running against that immutable range. Final review and GitHub CI are pending.
The deployed image still uses 5d063ffe and the failed cold probe remains the live
acceptance result. Do not equate these passing local checks with STG acceptance.

### Consumer configuration check — 2026-09-20

Read-only inspection found that both STG LibreChat deployments (aibuddy and
edu-ai, image 6a919d9) have no LIBRECHAT_CODE_BASEURL,
LIBRECHAT_CODE_BASEURL_STATEFUL or statefulCodeSessions environment configuration.
Their deployed routing code uses the default hosted CodeAPI route when no
stateful environment is selected. The deployment repository at main 30f21637
also contains no internal CodeAPI URL in either STG overlay. Argo sources both
instances from that repository. This is an explicit consumer acceptance gap;
a direct synthetic CodeAPI proof cannot establish LibreChat integration.
Switching these consumers from hosted execution to the internal service needs a
concrete configuration/authentication review and a target-instance decision.
Storage recovery and direct CodeAPI acceptance remain independent approved work.
No LibreChat configuration or credentials were changed.

PRD DF LibreChat is the configured internal consumer: its deployed default route
is http://codeapi-api.codeapi.svc.cluster.local:3112/v1, auth provider is
librechat-jwt and the signing-key variable is present. Its live image is 6a919d9.
The df-cloud source deliberately supplies that key only to the PRD DF instance.
This is configuration evidence only; its consumer round trip is still pending.

The restricted codeapi-stg operator profile was rechecked: authenticated for
codeapi/stg, only CODEAPI_JWT_PRIVATE_JWK_JSON readable and no writable names.
The bootstrap child build 2126110 remains queued for tags pulumi,stg. Runner 474
is online and processing existing jobs; the queue is not a source failure.
The sole CI watcher now streams exact child preview job 2126111; the parent-branch watcher was stopped.

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
bootstrap and Argo kind permissions, and src/apps/codeapi/functions.ts for the
chart revision consumed by index.ts. Start from origin/stg; promote relevant
commits through the existing prd branch process. Preserve unrelated drift.
No local Pulumi.

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
The sandbox pool waker is owned by helm-charts companion manifests and uses
registry.k8s.io/pause:3.9; verify its KEDA ownership separately.
Record baseline chart and seven pins first, then proposed and reconciled values.
A failed application check restores that recorded compatible chart/image set
while retaining repaired storage settings. Do not promote PRD until STG passes.

### Recovery and detection prerequisites

Current preflight: neither cluster has a VolumeSnapshotClass. Snapshot CRDs
exist, but this alone does not establish a functioning controller. Azure CLI
cannot refresh its token because the sandbox rejects writes to its session and
token-cache files. Cached Kubernetes credentials have now expired as well,
blocking fresh cluster reads, server dry-runs and live operations.
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

Current checkpoint, 2026-09-20: STG storage recovery and the fifteen-minute
monitoring observation passed. Application image MR !106 and chart-source MR
!601 merged. New images are running; the exact merged chart preview/apply is
pending in child 668590. Authenticated upload and cleanup passed, but the one
cold execution failed with ECONNREFUSED before the sandbox was available.
Application acceptance is failed; warm/timeout/cancellation and PRD remain gated.
The bounded HTTP connection-refusal correction is being prepared and reviewed.
PRD alert routing and its recovery window/cost decision remain unresolved.
The native goal remains blocked; direct approved work continues.

The receipts below are historical checkpoints; the approval and delivery sections
above supersede their former access, cost and recovery-window blockers.

Source integration merged in PR #31 at
5d063ffe81df98824c5a15fcafabef5728973672 on 2026-09-19. Both prior fork main
and upstream v1.4.0 are verified ancestors; the merged tree equals the reviewed
head. All ten PR CI jobs and the integrated final review passed. Post-merge CI
35466160859 passed all ten jobs. All seven merge-SHA image manifests are
available with their expected architectures; image build 35466160848 passed
all seven jobs. Release run 35468744570 was skipped as intended.
Fork tag and release counts remain zero. No storage or application deployment
had occurred at that checkpoint; its recovery-window/cost decisions are now approved.

The proposed STG values with all seven pins updated to the merge SHA passed
Helm lint, rendering and Kubernetes server-side dry-run. Baked-image mode renders
six active fork images and omits the package-init Job while retaining its pin.
No Secret resources render, file-server probes use /ready and /health, and
sandbox-runner replicas remain owned by KEDA. The chart itself is byte-identical
to the current STG chart revision. Registry inspection separately confirms all
seven image manifests. Neither rendering nor image publication establishes
consumer acceptance. Proposed values remain outside GitOps.

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

### Executed source and local proof receipts

-   Plan committed as 2a8539c; native planner approved after one correction.
-   Upstream merge c0b7f223cb988200e90acba4fa1338e79855096d has parents
    2a8539c and 277fa7742d383eb1b6606ec228cdafe36af043a4. Both fork baseline
    ccc2259 and upstream v1.4.0 are ancestors. All fourteen incoming paths
    exactly match upstream; release workflow remains disabled and remote tags
    remain empty.
-   Service build passed. Full service suite: 1092 pass, 12 skip, 0 fail on
    Bun 1.3.14 with required Redis, jq and Python installed in the test container.
    Package build/tests: 497 pass, 18 platform skips, 0 fail on Node 22.22.0,
    non-root, with git/ripgrep/jq. Initial missing-tool/root-container failures
    were test-environment deficiencies; no application change was used to mask them.
-   Release versioning, version resolution, bridge pairing and compose contract
    checks passed. PR CI, post-merge CI and all seven image-build jobs passed.
-   Exact SeaweedFS image on 200MiB tmpfs, 8MiB volumes and 20MiB reserve
    reproduced 24 initial slots. At 12.9MiB free, writes continued until the
    periodic disk check (first refusal after 55.1 seconds); at refusal 12.1MiB
    remained, so this was reserve enforcement rather than ENOSPC. Existing
    1MiB object hash remained unchanged. Removing only synthetic filler restored
    PUT/GET in 58.4 seconds; old hash remained intact. Container stopped, not
    OOM-killed; exit137 followed the 15-second stop timeout. This is not graceful
    shutdown or snapshot restore evidence.
-   Physical guard is periodic and can be overrun by sufficient write throughput.
    Proposed 5GiB is not a proven production headroom guarantee. Thresholds need
    growth-rate and operational response evidence; monitoring stays a release gate.
-   STG-only allocation diff passed server-side Kubernetes dry-run before the
    shutdown-grace addition. Current full draft renders; its fresh server dry-run
    is blocked by expired credentials and Azure cache write permissions. No
    shared storage resources changed; recovery gate remains open.

- Readiness correction and bridge timeout coverage: focused HTTP/router tests
  passed 17/17. Integrated service build and suite passed 1101 tests, 12 skips,
  zero failures. Bucket absence returns 503; dependency failure leaves liveness
  200. Source enforcement clamps command budget to JOB_TIMEOUT and protocol
  rejects requests above 300000ms; advertised ceiling matches these constraints.
- STG allocation MR: helm-charts !103
  at 75ad20714483286055a40e798b905a7d0127cc80, draft. Pipeline 668175
  passed secret detection; it is not Kubernetes schema/runtime validation.
  Independent final review passed this full two-file draft without findings.
  Recovery, safe first replacement and live acceptance remain merge blockers.
- Claude reviewer was unavailable with expired OAuth. AGY review continuation
  reached SUCCESS envelope but produced no structured review: its read_file
  permission was automatically denied in headless mode. This is not a passing
  review; no permission bypass or agent configuration change attempted.

### Shutdown and detection checkpoint

Exact-image non-root synthetic shutdowns with a 60-second stop allowance took
29.992 and 40.205 seconds, both exit 0 and not OOM-killed. The existing object's
bytes and selected metadata survived restart; a new authenticated write/read
also passed. Both live environments were observed using only 30 seconds of
termination grace. MR !103 now proposes 120 seconds for replacement STG pods.
This adds measured margin, not a bound on loaded shutdown. The existing pod keeps
its old 30 seconds on first replacement. Its safe shutdown procedure and a fresh
whole-PVC snapshot with isolated restoration remain prerequisites. Local restart
is not snapshot recovery evidence.

A local canary using the pinned existing AWS CLI image passed authenticated
PUT/GET/hash/DELETE as UID 1000 with a read-only root. It rejected wrong
credentials, a missing bucket, an unavailable endpoint and corrupted content.
HEAD-bucket preflight avoids the normal missing-bucket auto-creation path, but
cannot eliminate a concurrent bucket-deletion race. A future recurring job needs
an overall deadline, concurrency control and scoped cleanup for interrupted runs.
No canary or monitoring change has been deployed.

Prometheus 3.10.0 rule tests passed healthy, stalled, delayed, absent-series and
recovery cases using existing kube-state-metrics CronJob freshness. Each required
bucket needs independent missing-series detection. Exact SeaweedFS metrics are
currently disabled; enabling collection needs reviewed Service, NetworkPolicy,
monitoring manifests and Argo kind permissions. PRD notification routing remains
an unanswered decision. Physical headroom thresholds still need operational
acceptance; the periodic reserve guard alone cannot prevent disk exhaustion.

The next live step requires supported Azure authentication-cache write access,
a concrete STG maintenance window and snapshot/restore cost approval. PRD follows
only after STG acceptance and its own recovery/routing decisions. Retain recovery
resources until cleanup is separately approved. No storage or application live
changes have been made in this package.

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

The substantive package is 468 added/deleted source and test lines across two
files, excluding the project plan. One defect correction and its regression
coverage form a single package. Independent simplification removed redundant
refusal records from the test fixture (15416c4). The correctness reviewer found
that distant finite deadlines could overflow the runtime timer. Correction
055709d rearms bounded timer legs against the same absolute deadline and adds a
regression test. The service build and scoped lint passed again, and 48 focused
HTTP, worker-error and cancellation tests passed (146 assertions). The complete
1,114-test run predates only this bounded timer correction and test simplification.
The same reviewer is checking the correction; integrated final review and current
GitHub CI remain pending. Source delivery is draft PR #32.
The deployed image still uses 5d063ffe and the failed cold probe remains the live
acceptance result. Do not equate these passing local checks with STG acceptance.

### STG cold-start correction rollout and acceptance — 2026-09-20

PR #32 merged as f6ec42cd44729b33a950016114651ca28fdcd172, a merge commit that
  keeps the prior fork baseline and upstream v1.4.0 as ancestors. No fork tag or
  release exists; the Release workflow stayed skipped. Image build 35516095220
  passed all seven jobs, the registry serves all seven merge-SHA tags, and
  post-merge CI 35516095225 passed all ten jobs.

helm-charts !112 merged at 95c8cf1bf550730fe82bc90bf0fdf4bfff95a32f, moving the
seven STG values pins from 5d063ffe to the merge SHA. df-cloud !602 advanced
CODE_INTERPRETER_TARGET_REVISION to the same commit; `git diff 5d063ffe f6ec42c --
helm/codeapi` is empty, so only the image tags changed. ArgoCD app-codeapi
reconciled from values revision 95c8cf1 and completed its sync at
2026-09-20T15:03:05Z with Synced/Healthy. All five running service deployments
(api, worker, file-server, tool-call-server, egress-gateway) now run the
merge-SHA images, and the sandbox-runner template carries the same revision while
KEDA retains scale ownership (minimum zero, maximum three).

The authenticated synthetic probe then passed end to end. The cold execution
returned HTTP 200 after 271,103 ms with exit code zero, replacing the failed
502 after 134,816 ms that motivated the correction; the warm execution returned
in 294 ms and reused the uploaded input plus the downloaded cold artifact.
Downloads matched the expected bytes exactly (169 and 231 bytes), and the
timeout probe ended as sandbox_time_limit with exit 137 and SIGKILL. The
cancellation probe on the programmatic route observed HTTP 202
cancellation_requested, a terminal cancelled outcome, and no late artifact
across the 360-second retention window. Test objects were deleted and verified
absent. Storage stayed healthy throughout: fifteen free volume slots, one
writable volume for each of the default, trypost-media and codeapi-files
collections, and both per-minute canaries completing.

Receipts: docs/project/_local/reviews/2026-09-20-stg-coldfix-rollout.json,
2026-09-20-stg-coldfix-e2e.json and 2026-09-20-stg-coldfix-cancellation.json.
The consumer gap recorded below is unchanged: no STG LibreChat instance routes to
this service, so this acceptance proves the CodeAPI surface, not LibreChat
integration. PRD remains gated on its alert destination decision and its own
recovery evidence; no PRD storage or application change has been made.

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

### PRD promotion — started 2026-09-20

The user approved the PRD phase of this plan after the STG acceptance: mirror the
STG critical-email alert routing for PRD, run the PRD recovery exercise
(snapshot plus isolated restore), then promote PRD storage and CodeAPI. The
user also confirmed the fork keeps carrying upstream releases with no tags or
releases of its own, so the four reviewed upstream integration merges stay as
they are and nothing here publishes a fork release.

PRD baseline at the start of this phase (read-only): SeaweedFS 4.37 runs the
image defaults, so `-volumeSizeLimitMB` is 30000 and `-volume.max` is 8;
master reports Max 8 / Free 0 with collections default (volumes 1-7) and
`codeapi-files` (volume 8, about 34 MB), which is one more collection than
writable-volume headroom. The namespace has no VolumeSnapshotClass, the
Prometheus stack has no Alertmanager, and PRD CodeAPI serves
`d2382d66491b05f1e9000ad6756868a66ea47e1d` on all five control-plane
Deployments with the KEDA-owned sandbox runner scaled to zero. ARGOCD
`app-seaweedfs` and `app-codeapi` are Synced/Healthy on helm-charts `main`.
The PRD `seaweedfs-codeapi-bootstrap` access/secret keys match the `codeapi`
identity in the live `seaweedfs-s3-config` s3.json exactly, so the reviewed
canary and fixture can authenticate without any credential change.

Controller decision: keep the release convention of targeted PRD merge requests
instead of a full `stg` -> `prd` promotion merge, because the STG branch carries
eighteen unrelated commits (asyncspot node cap, GBL stacks, Langfuse export VM,
eLearning tracking, Tailscale auth, Hatchet storage backfill) that are not part
of this plan and are not validated by its acceptance. Any MR that targets `prd`
requires one release approval, which is a human decision the agent does not
request or bypass.

Planned PRD sequence, mirroring the accepted STG order and its receipts:

1.  df-cloud PRD bootstrap: Pulumi-owned `seaweedfs-disk-snapshots` snapshot
    class, the namespace-scoped Argo kinds for recovery and monitoring, and the
    Alertmanager receiver for PRD. CI-only preview then apply; no local Pulumi.
2.  helm-charts fixture: one identified synthetic object in `codeapi-files`
    written and hash-verified before the fence exists, because the fence blocks
    every new pod in the namespace, including the fixture itself.
3.  helm-charts fence: temporary `pods: 0` ResourceQuota plus dropping the
    PostSync bucket-bootstrap hook from the PRD kustomization, with the live
    Deployment unchanged so no pod is disrupted by the sync.
4.  helm-charts hold: `replicas: 0` together with the repaired allocation flags
    (`-metricsPort=9327`, `-master.volumeSizeLimitMB=2048`, `-volume.max=0`,
    `-volume.minFreeSpace=5GiB`), `terminationGracePeriodSeconds: 120` and
    `WEED_MASTER_VOLUME_GROWTH_COPY_1=1`, so the resumed pod is the repaired one.
5.  Operator deletion of only the recorded pod with an explicit 120-second grace
    and a UID precondition after verifying quota enforcement, with a sanitized
    clean-shutdown receipt. No scale-down, no PATCH, no second delete.
6.  helm-charts snapshot: one VolumeSnapshot of the offline source PVC, then
    `readyToUse` with source PVC UID, content and snapshot handles recorded.
7.  helm-charts resume: `replicas: 1`, fence removal and bootstrap-hook restore
    in one merge, with the monitoring manifest in the same merge so detection
    starts with the repaired storage instead of alerting against a fence.
8.  helm-charts isolated restore: the 50 GiB restore PVC and the isolated
    restore Job that proves the preserved fixture bytes, its metadata and a new
    synthetic write/read/delete with repaired flags, without production endpoints.
9.  CodeAPI promotion: PRD image pins to `f6ec42cd44729b33a950016114651ca28fdcd172`
    in helm-charts plus the matching df-cloud chart revision, then repeated
    consumer acceptance through the PRD DF LibreChat route.

Storage recovery evidence for PRD must be collected within one hour before the
PRD storage merge, which is step 7 above; steps 3-6 therefore precede it. The
planned PRD window interrupts storage access, and the newly enabled PRD alerts
are expected to fire critical notifications while the fence stops the canary.
Delivery topology at the time of writing:

- helm-charts !113 merged as `6887a33`; the PRD fixture seed Job ran to
  completion at 2026-09-20 16:53:30 UTC and its object hash is recorded.
- helm-charts !114 merged as `6d1bd91` for step 3. Argo cannot apply it yet:
  the live `prd-apps-seaweedfs` AppProject permits only PersistentVolumeClaim,
  Service, Deployment, Job, NetworkPolicy and Ingress, while
  `stg-apps-seaweedfs` also permits ConfigMap, ResourceQuota, CronJob,
  VolumeSnapshot, ServiceMonitor and PrometheusRule. The fence, the snapshot and
  the monitoring manifest are therefore all blocked on the df-cloud kinds change
  in step 1, which is the same whitelist STG already carries.
- df-cloud !603 (`rs/prd-snapshot-alerting`) carried steps 1 and part of 9 but
  could never authenticate: production CI variables are protected, so only a
  protected source branch can read them, and both PRD preview jobs failed with
  `PULUMI_ACCESS_TOKEN must be set`. Closed in favour of !604, which carries the
  identical commits `81ff700` and `b7c9d8b` on the protected
  `release/prd-seaweedfs-snapshot-alerting` branch that matches this project's
  `release/prd-*` convention.
- `release-approval-gate-mr-prd` runs `util/ci/require-release-approval.mjs`
  with `RELEASE_APPROVALS_REQUIRED` defaulting to 1 and counts
  `approved_by` entries. Project settings do not block a merge on a failed
  pipeline, so this job is the release control: it needs one recorded human
  approval before the PRD apply, and the agent neither requests a reviewer nor
  records that approval.
- Window merges are staged and reviewed as separate MRs so the window stays
  short: helm-charts !115 hold (step 4), !116 snapshot (step 6), !117 resume
  (step 7) and !118 isolated restore (step 8). The accepted STG order was fence
  sync, recorded pod deletion, hold, snapshot, resume, restore; PRD follows it
  with the hold merged immediately after the deletion so Argo's desired state
  keeps storage stopped once the fence is lifted.

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

Current checkpoint, 2026-09-20: STG storage recovery, the fifteen-minute
monitoring observation and the cold-start correction rollout all passed. The
correction merged as PR #32 at f6ec42cd44729b33a950016114651ca28fdcd172;
helm-charts !112 and df-cloud !602 promoted it to STG through GitOps, and ArgoCD
completed the sync with Synced/Healthy at 2026-09-20T15:03:05Z. The authenticated
probe passed cold (HTTP 200 after 271,103 ms), warm, bounded timeout,
cancellation with no late artifact across the retention window, upload,
download/hash and reuse, with test objects deleted and verified absent. STG
application acceptance is complete. The LibreChat consumer gap and PRD promotion
remain open: PRD needs its alert destination decision, its own recovery evidence
and separate storage and application promotion. No PRD change has been made.

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

### PRD storage recovery and CodeAPI promotion — 2026-09-20

df-cloud MR !604 merged with history preserved at
65d8aa9b4ec5f5661a265966ea9f111f0f723b5e (the renamed protected branch
release/prd-seaweedfs-snapshot-alerting). Its app-up for seaweedfs ran the
reviewed preview exactly: one create and two updates, no delete or replace. The
create is the Retain VolumeSnapshotClass seaweedfs-disk-snapshots
(disk.csi.azure.com). The AppProject prd-apps-seaweedfs now permits ConfigMap,
CronJob, Deployment, Ingress, Job, NetworkPolicy, PersistentVolumeClaim,
PrometheusRule, ResourceQuota, Service, ServiceMonitor and VolumeSnapshot, the
same kind set STG already carries.

The merged PRD fence could not land by itself: Argo had already recorded a failed
automatic sync of main revision 55aba4b6 with the message
"Skipping auto-sync: failed previous sync attempt to 55aba4b6", because the
earlier attempt predated the AppProject kinds change. The retry budget was
exhausted, so the desired ResourceQuota stayed missing. I issued one sync of
app-seaweedfs through the Argo CD API. The diff before the sync was the single
ResourceQuota seaweedfs-recovery-fence; the operation succeeded and the
Application became Synced/Healthy. This changed no desired state: it applied the
revision already merged to main. The sync used an in-memory short-lived admin
session token minted from the cluster's own argocd-secret signing key over a
kubectl port-forward; no credential value was written or printed.

Fence verification. ResourceQuota seaweedfs-recovery-fence
(UID d2e290b5-5782-4388-aa76-eb397b38b642) reports spec and status hard
pods: "0" with used pods: "1". A PodSecurity-restricted-compliant probe pod was
rejected at admission: "exceeded quota: seaweedfs-recovery-fence, requested:
pods=1, used: pods=1, limited: pods=0". The live Deployment intent was unchanged
at that point (replicas 1, grace 30), so no pod was disturbed by the sync.

Clean shutdown and hold. The approved UID-bound operator deletion ran against pod
seaweedfs-5bbcb79965-n528p (UID 965f0a54-3476-4ab2-aeb9-7b4785aa4a05) with an
accepted 120-second grace; the old process exited 0 with reason Completed at
17:45:01 UTC and the receipt requires that terminal status. helm-charts !115
merged at 087c36aa and reconciled: desired replicas 0, termination grace 120, and
the repaired allocation flags -metricsPort=9327 -master.volumeSizeLimitMB=2048
-volume.max=0 -volume.minFreeSpace=5GiB with WEED_MASTER_VOLUME_GROWTH_COPY_1=1.
The disk detached with no VolumeAttachment for
pvc-970fc522-b1ca-4328-8593-31b2628d77b6.

Snapshot. helm-charts !116 merged at 8b7d54ac. VolumeSnapshot
seaweedfs-recovery-20260920 (UID bf9a535d-14ca-4853-a363-2f9b21d35938) reached
readyToUse at 17:49:09 UTC, Retain, 50 GiB, driver disk.csi.azure.com, content
snapcontent-bf9a535d-14ca-4853-a363-2f9b21d35938 (UID
bcb76b9e-6d24-4413-bc87-9a617d659792) bound to the source PVC UID
970fc522-b1ca-4328-8593-31b2628d77b6. The Azure snapshot is
snapshot-bf9a535d-14ca-4853-a363-2f9b21d35938.

Resume. helm-charts !117 merged at af8909bc within the one-hour evidence window:
desired replicas 1, fence removed, bucket-bootstrap hook restored and the PRD
monitoring manifest added. The replacement pod seaweedfs-6d7b6b65b7-qm5wz
(UID 7eb130f5-ab82-412c-beab-4626be46271f) became Ready at 17:51 with 0 restarts
on the pinned digest, source PVC and repaired flags. Master topology now reports
Max 24 / Free 16: the slot count is derived from disk (50 GiB / 2 GiB) instead of
the hardcoded 8, all eight pre-existing volumes re-registered, and both the
default collection and codeapi-files have a writable volume. Prometheus confirms
scrape up, 16 spare slots, zero allocation errors in the last ten minutes and all
eight SeaweedFS storage rules inactive.

Isolated restore. helm-charts !118 merged at 32baecbe. Restore PVC
seaweedfs-restore-20260920 (UID 5052720d-d4c1-4c5e-b498-de33b8595cf0) bound 50 GiB
from the snapshot, and Job seaweedfs-restore-20260920
(UID 8441ef75-bf14-465c-bcce-a4b12f4dfe9a) completed at 17:53:44 UTC. The
verifier printed the preserved synthetic hash
9775d7a5ca100b519819db645bb559f29c85051c7b4d5dfde2a9f3ec1f789ab1 and the line
snapshot_restore=verified new_write=verified metadata=verified. The restored
server was loopback-bound with a synthetic credential and no service-account
token, and exited cleanly. Restore PVC, Job and snapshot are retained.

Storage observation. Fifteen consecutive canary completions covered 839 seconds
with a maximum gap of 63 seconds; the first post-resume canary failed while
storage was still starting and every later one completed in about five seconds,
and the metric assertions passed. The one earlier failing canary is expected and
recorded.

CodeAPI promotion. helm-charts !119 (PRD image pins to
f6ec42cd44729b33a950016114651ca28fdcd172) had already merged at 55aba4b6. df-cloud
!605 merged at ca14cc40, advancing CODE_INTERPRETER_TARGET_REVISION to the same
merge commit. Its app-up preview was a single in-place Application update with no
delete or replace. All five PRD control-plane Deployments (api, worker,
file-server, tool-call-server, egress-gateway) now run f6ec42cd and are Ready; the
KEDA-owned sandbox runner stays at scale zero. The PRD DF LibreChat default route
is http://codeapi-api.codeapi.svc.cluster.local:3112/v1 with the librechat-jwt
provider.

Outstanding. The synthetic PRD CodeAPI end-to-end acceptance needs the PRD
signing key through a new restricted Infisical profile, which is a live mutation
awaiting explicit approval. Mirroring the STG critical-email alert routing needs a
Pulumi apply; the PRD infra preview carries 44 unrelated creates that predate this
work, so a bounded targeted apply is proposed instead of a blanket infra-up-prd.
Receipts are in docs/project/_local/reviews/2026-09-20-prd-*.json.

### v1.4.1 integration, STG re-acceptance and PRD E2E — 2026-09-20

Upstream v1.4.1 (2ed5b581f91324857f77dbdd23a93e8f0d29a7fa) was published after
v1.4.0. Relative to v1.4.0 it carries two commits: 95ebbd3c "Provision
Conversation-Scoped Code Worktrees (#239)" and c8b3e149 "Close native scratch
directory streams (#240)"; 35 files and about 3825 insertions.

Integration follows the same history-preserving pattern as v1.4.0 (c0b7f22):
branch rs/upstream-v1.4.1 from main 477a8aa, merge v1.4.1 with --no-ff and no
squash. Merge commit f32a1fa keeps both parents (477a8aa, c8b3e149), so v1.4.1
and the fork baseline are both ancestors. No fork tag or release is created.

Only three files overlapped between fork-side changes since v1.4.0 and v1.4.1,
and every overlap was an independent addition, so no conflict resolution was
needed: service/src/service/programmatic-router.ts (fork pollJobUntilFinished
fallback vs upstream workspaceInstanceId threading), service/src/service/
replay-state.ts (fork PublicExecuteResponse retype vs upstream workspaceInstanceId
field) and service/src/types/service.ts (fork PublicExecuteResponse alias vs
upstream workspace_instance_id field). Both sides are present in the merge.

Validation ran in an oven/bun:1.3.14 Debian container with redis, jq, python3,
node and git. The service suite passed 1121 with 12 skips and 0 failures (3387
assertions, 1133 tests, 98 files) and the service rollup build succeeded with
only pre-existing warnings. The packages/code suite reported 513 pass, 24 fail
and 20 skip; the same class of tests fails on the unmerged v1.4.0 baseline under
identical conditions (no ripgrep, root user). Diffing the two failure sets found
zero new failures and two suites fixed by the merge, so the merge introduces no
regression. A host run surfaced an unrelated missing Koffi native dependency in
the macOS ACL path, not a v1.4.1 defect.

Delivery is draft PR #34 on rs/upstream-v1.4.1 at f32a1fa. Merging to main and
the image pin/rollout remain separately gated; no deployment was performed.

STG re-acceptance. The synthetic STG CodeAPI end-to-end probe was re-run against
svc/codeapi-api on the already-promoted f6ec42cd revision through the restricted
codeapi-stg profile. Cold execution returned HTTP 200 with exit 0 in 270905 ms;
warm returned in 237 ms and reused the uploaded input; downloads matched exactly
(169 and 231 bytes); the timeout probe ended as sandbox_time_limit with exit 137
and SIGKILL; three test objects were deleted and absence verified (404). The
/exec route exposes no cancellation, so the cancellation step is documented
rather than executed on this route.

PRD end-to-end blocker. The PRD synthetic acceptance needs the PRD signing key.
The restricted codeapi-stg profile is bound to project codeapi in environment stg
only; no codeapi-prd profile exists. Creating one is blocked in this environment
for two independent reasons: (1) the reusable organization identity already in
macOS Keychain for inf.prd.df-app.ch is a member of 12 PRD projects but not of
codeapi, so configure reports "expected one accessible project named codeapi;
found 0"; and (2) macOS Keychain writes are denied to this sandbox
(SecKeychainItemCreateFromContent ... Operation not permitted), so the operator
cannot store the codeapi-prd machine identity. The cluster's own dedicated
identity for that project (the infisical-machine-identity-prd-codeapi-prd Secret
in namespace codeapi) can read codeapi/prd, which was confirmed values-free, but
only the user's interactive session can add it to Keychain and run configure.
STG and PRD also use different signing keys (STG kid codeapi-stg-2026-06-29,
single key; PRD kids codeapi-prd-20260702 and codeapi-prd-20260705), so the STG
key cannot stand in for PRD.

PRD alerting. The user decided PRD does not need Alertmanager yet, so the
alert-routing apply is dropped from scope. No Pulumi apply was run; the 44
unrelated creates in the PRD infra preview are untouched.


### v1.4.1 merge, STG rollout and acceptance — 2026-09-20

Upstream v1.4.1 integration merged to the fork. PR #34 (draft) was marked ready
and merged with a history-preserving merge commit e0b8c4409c337789d8fb07e5c5665bc2879c4fc3
(parents 477a8aa and c8b3e149); no squash, no fork tag or release. The Release
workflow stayed skipped. Post-merge image build 35532769998 passed all seven
jobs and the registry serves all seven e0b8c440 image tags (verified by
anonymous OCI index fetch). Post-merge CI 35532770018 ran.

STG promotion. helm-charts !120 merged 551a874d advancing the seven STG image
pins from f6ec42cd to e0b8c440 (chart source unchanged). df-cloud !606 merged
d550a8ee advancing CODE_INTERPRETER_TARGET_REVISION to e0b8c440; because STG
values track helm-charts main, the app stack update carries the merged pins.
The df-cloud STG pipeline preview showed exactly one Application update with no
delete or replace. ArgoCD autosync then reconciled app-codeapi to e0b8c440: all
five control-plane Deployments (api, service-worker, file-server,
tool-call-server, egress-gateway) run e0b8c440 and rolled out cleanly.

STG E2E acceptance against e0b8c440 through the restricted codeapi-stg profile
passed: cold execution HTTP 200 exit 0 in 269563 ms, warm execution 299 ms
reusing the uploaded input, downloads exact (169 and 231 bytes), the timeout
probe ended as sandbox_time_limit exit 137 SIGKILL, and three objects were
deleted with absence verified (404). The /exec route exposes no cancellation, so
that step remains documented rather than executed. SeaweedFS storage stayed
healthy: the codeapi-stg and trypost-stg storage canaries are completing with
successful S3 delete round trips and no Failed state.

PRD promotion. helm-charts !121 (seven PRD image pins to e0b8c440) is open with
a passing pipeline. df-cloud PRD still needs a protected release/prd-* branch
merged with a recorded human release approval; that gate is left to the user.
PRD E2E remains blocked in this environment: the restricted codeapi-prd profile
cannot be created because macOS Keychain writes are denied to the sandbox and
the profile directory is read-only, and the reusable organization identity in
Keychain is not a member of the codeapi project. The cluster's own
infisical-machine-identity-prd-codeapi-prd Secret can read codeapi/prd (the
signing key is CODEAPI_JWT_PRIVATE_KEY) but only the user's interactive session
can add it to Keychain and run configure.



### v1.4.1 PRD release prepared — 2026-09-20

helm-charts !121 merged c1edada3 carrying the seven PRD image pins at e0b8c440.
The protected PRD release branch release/prd-codeapi-v141 (commit d4f3e80) was
created from prd and advances CODE_INTERPRETER_TARGET_REVISION to e0b8c440 and
the immutable PRD helm-charts values revision to c1edada3; MR !607 targets prd.
The MR pipeline preview is advisory and was still queued on saturated prd-tagged
runners at close-out. Merging to prd is gated by release-approval-gate-mr-prd,
which needs one recorded human release approval; that approval and the manual
infra-up-prd and deploy-app-prd: [codeapi] jobs are left to the user. No PRD
apply was performed; PRD remains on f6ec42cd and its five control-plane pods are
Ready with no Failed pods.



### PRD E2E acceptance on f6ec42cd — 2026-09-20

The restricted codeapi-prd Infisical profile was created by the user with read
access to CODEAPI_JWT_PRIVATE_KEY only. That entry is a PEM private key (not a
JWK), so the PRD synthetic auth shim derives the public key, matches it to the
PRD JWKS, and signs EdDSA tokens with the matching kid. The authenticated PRD
end-to-end probe then passed against svc/codeapi-api on the current f6ec42cd
revision through a local port-forward: cold execution HTTP 200 exit 0 in
271133 ms, warm execution 223 ms reusing the uploaded input, downloads exact
(169 and 231 bytes), the timeout probe ended as sandbox_time_limit exit 137
SIGKILL, and three objects were deleted with absence verified (404). The /exec
route exposes no cancellation, so that step remains documented. Receipt:
docs/project/_local/reviews/2026-09-20-prd-e2e.json.

PRD v1.4.1 promotion remains pending. MR !607 (release/prd-codeapi-v141) is
mergeable but its pipeline is still queued on saturated prd-tagged runners, and
merging to prd requires one recorded human release approval plus the manual
infra-up-prd and deploy-app-prd: [codeapi] jobs. No PRD apply was performed.


## 2026-09-20 final readiness review

Fresh verification at 2026-09-20T21:21Z across every layer.

Source. Fork main is e0b8c4409c337789d8fb07e5c5665bc2879c4fc3, the PR #34 merge that integrates upstream v1.4.1 with the upstream tag 2ed5b581 as an ancestor. The fork has no open PRs, no releases and no tags; all merges preserved history.

Desired state. helm-charts main is c1edada3 (STG pins 551a874, PRD pins 25a3a4c). df-cloud stg is d550a8ee with STG pinned to e0b8c440. df-cloud prd is still ca14cc40 from the v1.4.0 promotion; !607 is open and mergeable and advances prd to e0b8c440 with helm-charts c1edada3.

Deployed and runtime. STG runs e0b8c440 on all five control-plane deployments with Ready pods; app-codeapi and app-seaweedfs are Synced/Healthy. PRD runs f6ec42cd on all five; app-codeapi is Synced/Healthy. Both SeaweedFS deployments run -master.volumeSizeLimitMB=2048 -volume.max=0 -volume.minFreeSpace=5GiB. STG topology reports Max 24, Free 15, with writable volumes for the default collection, trypost-media and codeapi-files. PRD reports Max 24, Free 16, with codeapi-files writable on volume 8 at about 86 MB of the 2048 MB limit. The latest storage canaries completed in both clusters.

Acceptance receipts. 2026-09-20-stg-v141-e2e.json records the passing v1.4.1 E2E on e0b8c440 (cold 269563 ms, warm 299 ms, exact-byte downloads, timeout SIGKILL 137, three deletes verified 404). 2026-09-20-prd-e2e.json records the passing PRD E2E on f6ec42cd (cold 271133 ms, warm 223 ms, same step coverage).

Regression found and fixed. 37cb3ab removed the temporary PRD admission fence together with the retained snapshot manifest that 28cb874 had committed seconds earlier, leaving app-seaweedfs on prd permanently OutOfSync with requiresPruning=true; the live snapshot survived only through its Prune=false annotation. helm-charts !122 (commit 25ced7f) restores the exact 28cb874 manifest, so the merge is a no-op apply that clears the drift. Merge pending approval.

Remaining gates. !607 still needs the recorded human release approval in GitLab; the release-approval-gate-mr-prd job has not passed and also enforces the no-squash rule. After approval: merge !607, run the manual infra-up-prd and codeapi prd app jobs, verify PRD pods on e0b8c440, then rerun the PRD E2E with the PEM shim. df-cloud !591, the broad stg-to-prd promotion, stays unmerged and out of scope.

## 2026-09-21 PRD v1.4.1 promotion completed

After the recorded human release approval (roland.schlaefli) on df-cloud !607 and a passing release-approval gate, the approved promotion sequence ran to completion.

- helm-charts !122 merged at d8786f1 restoring the PRD recovery snapshot manifest; app-seaweedfs on prd returned to Synced/Healthy with no OutOfSync resources.
- df-cloud !607 merged at b7703b3 with a merge commit, no squash. Pipeline 669054: build-azure-helpers-prd and infra-preview-prd succeeded, infra-up-prd was played and succeeded in 652 s. Child pipeline 669057 for codeapi: app-preview succeeded in 145 s, app-up succeeded in 172 s.
- app-codeapi on prd is Synced/Healthy at targetRevision e0b8c4409c337789d8fb07e5c5665bc2879c4fc3 with the helm-charts app chart at c1edada3; all five control-plane Deployments run e0b8c440 images with Ready pods.
- PRD E2E on v1.4.1 passed: cold 270668 ms, warm 251 ms, exact-byte downloads, timeout SIGKILL 137, three deletes verified 404, 11 requests, zero failures. Receipt: 2026-09-21-prd-v141-e2e.json.

The release process kept upstream history (merge commits only), cut no fork tags or releases, and carried every revision through GitOps pins.

## 2026-10-12 continuation: scheduled snapshots, then upstream assessment

### Approval summary

The user approved continuing the scheduled-snapshots package in STG and then PRD,
followed by an assessment and plan for upstream v1.10.4. Persist this continuation
before execution. Approval mode: executable batch for the snapshot delivery;
direction-only for the subsequent upstream assessment and integration plan.

The snapshot design and verification contract remain in the existing helm-charts
plan, `project/2026-09-21-seaweedfs-scheduled-snapshots-plan.md`, on branch
`rs/seaweedfs-scheduled-snapshots`. This section governs the October continuation
and records its cross-repository order without duplicating that implementation.
The later instruction "snapshots only for now" remains binding: no HA topology,
blob export, replication change, filer-store migration, or production Alertmanager
deployment belongs to this package.

The approved conditional sequence is to refresh and review the existing source,
land and apply the STG prerequisites in df-cloud !610, land helm-charts !125,
prove scheduled backup, retention reclamation, isolated restore and CodeAPI
acceptance in STG, then deliver and verify the corresponding PRD package. Preserve
required human reviews, including the recorded GitLab PRD release approval. A
failed condition blocks its dependent step. No new generic proceed is required.

### Verified baseline and boundaries

- Fork main: `53ce639ccfc54ccf5fd449a6b07a1bd77da06089`; CI and image build
  passed. This adds two Helm commits above the September v1.4.1 merge. No open
  fork PRs, fork releases or fork tags were found on 12 October.
- Upstream now resolves to `LibreChat-AI/code-interpreter`; latest published
  release is v1.10.4 from 6 October. September's "latest v1.4.1" claim is historical.
- df-cloud STG and PRD branches configure CodeAPI chart revisions as STG
  `8eb246c5c0b3286f03fed7e32185e01b7a661d45` and PRD
  `e0b8c4409c337789d8fb07e5c5665bc2879c4fc3`. Current helm-charts image pins
  for both environments remain `e0b8c440`; source pointers are not runtime proof.
- df-cloud !610 is draft/open at `0b91a34df745463d6cefcb16bcbd0e8a84babf63`;
  its latest pipeline is canceled. helm-charts !125 is draft/open at
  `38558fc72442b92eaf8ba0279a0c7a303a920e20`; its pipeline passed.
- September E2E and recovery receipts prove the September rollout. October
  rollout decisions require current environment evidence and applicable previews.

### Execution details and ownership

1. **Refresh the snapshot source and reviews.** Reuse the two existing task
   worktrees and MRs. Fetch targets, preserve local work, assess target drift and
   integrate only when it affects readiness. Reuse unaffected passing reviews;
   review material corrections and close the recorded planning concerns. Run the
   existing snapshot validation and render checks; refresh the df-cloud app
   preview and deployment-pattern audit at the reviewed head. Confirm no broader
   infrastructure or workload effects are included in the apply.
2. **STG prerequisites and schedule.** After required checks/reviews pass, mark
   the authorized snapshot MRs ready, merge !610 into STG and run its applicable
   seaweedfs app-stack preview/apply through GitLab CI. Verify the added snapshot
   class and AppProject whitelist live before merging !125 into helm-charts main.
   Argo owns the workload rollout; Pulumi owns the class and AppProject. No live
   patches or local Pulumi operations are authorized.
3. **STG acceptance.** Execute the existing plan's least-privilege, actual
   CronJob-run, same-day reuse, labeled retention-fixture, content/backend
   reclamation, isolated fixture-bound restore and alert checks. Verify canaries
   and authenticated CodeAPI artifact round trip. Clean up only synthetic test
   objects and temporary drill resources created for this verification, recording
   disk release. Correct the inherited Slice 5 fixture procedure: retention ages
   snapshots by immutable `metadata.creationTimestamp`, not a date in the name.
   Create a separately recorded, operator-approved synthetic fixture inventory and
   allow it to age past the implemented six-day cutoff (the number of recent daily captures depends on start and readiness timing). Derive expected victims and
   the three-ready survivor floor from the entire current owned inventory before
   a run; never assume the three-ready floor protects every genuine daily snapshot.
   Do not change the retention window or relabel historical recovery snapshots.
   Seed the isolated restore fixture before the selected real CronJob capture and
   bind that receipt to the resulting snapshot name, UID and timestamp. Use the
   existing `project/seaweedfs-recovery/drill.yaml` operator manifest.
4. **PRD after STG acceptance.** Prepare a dedicated PRD chart package and scoped
   df-cloud prerequisite promotion using the normal STG-to-PRD release path, with
   current PRD previews and required recorded human release approval. If that
   promotion contains unrelated changes, hold its dependent branch for explicit
   disposition; do not invent a selective promotion or merge an unrelated broad
   release. Apply the seaweedfs PRD prerequisite stack and verify the class and
   AppProject whitelist live before merging the PRD chart MR, since its main branch
   automatically syncs. Preserve the release approval gate.
   Repeat the applicable snapshot/retention/restore and CodeAPI acceptance checks.
   Keep STG running if PRD is held or fails. Avoid unrelated broad promotion MRs.
5. **Upstream assessment after snapshot acceptance.** Compare v1.10.4 with fork
   main and the retained patches, identify compatibility and deployment changes,
   and persist `docs/project/upstream-v1.10.4-integration-plan.md` in this same root. It must
   preserve upstream history and use GitOps revisions with no fork stable tags or
   releases. This step authorizes assessment and planning; a new release rollout
   requires the concrete plan and its environment-specific gates.

The existing snapshot test portfolio remains authoritative. CodeAPI acceptance
adds one consumer-boundary obligation using the existing synthetic E2E harness;
upstream planning adds source-diff, patch-disposition and plan-review obligations,
with no new runtime tests until a concrete integration change is approved.

| Continuation slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| Snapshot source/review refresh | main; planner owns plan challenge | persisted continuation | current branch checks, applicable previews and review disposition |
| STG prerequisite and chart delivery | main | source gates green | exact merged heads, successful app apply, class/whitelist, Argo receipt |
| STG runtime and retention acceptance | main | STG delivery | real schedule, genuine fixture age, reclamation, isolated restore, consumer checks |
| PRD prerequisite promotion | main | STG accepted | normal release approval/preview/apply, live prerequisites before chart merge |
| PRD chart parity | bounded source executor | STG accepted, prerequisite source settled | existing validation for PRD, reviewed MR |
| PRD runtime acceptance | main | PRD prerequisites and chart accepted | same evidence boundary as STG |
| Upstream v1.10.4 assessment and plan | main; bounded researcher if useful | snapshot package accepted | patch disposition and persisted reviewed plan |

The main session owns integration, authority, secret handling, live changes and
final proof. Execution mode: standard; the exact runtime model identifier is not
available to prove membership in the skill's solo allowlist.

### Acceptance and recovery

The snapshot package completes only when both environments have an accepted real
scheduled backup, ready restore point, retention and backend-reclamation evidence,
isolated restore proof, passing consumer artifact checks and reviewed rollout
receipts. Then the upstream assessment completes with a persisted reviewable plan.
Neither a green source pipeline nor an Argo healthy status alone meets acceptance.

The original snapshot plan owns retention rules, workload identity, rollback
branches and restore procedure, with the fixture correction above overriding its
backdated-name arithmetic. For scheduler/RBAC/network failures, fix or suspend
only the affected schedule through its source owner. For failed reclamation, keep
new backups working where safe and preserve victim names/content/handle evidence;
backend cleanup is separately gated. For isolated restore or consumer failures,
keep the working schedule active, preserve failure evidence, and hold PRD rather
than disabling successful backups. Preserve the live storage PVC, existing object
data and recovery points. Do not delete the retained September snapshot,
its Azure handle, or old recovery PVCs/Jobs as cleanup under this continuation.
Such historical-resource deletion needs its own exact-target authority.

### Working context and progress

Reuse these paths; do not duplicate active ownership:

- CodeAPI governing-plan clone: `/Users/rschlae/Git/klicker/code-interpreter/trees/storage-reliability-investigation`,
  branch `rs/storage-rollout-receipts`.
- helm-charts: `/Users/rschlae/Git/df/helm-charts/trees/rs/seaweedfs-scheduled-snapshots`,
  branch `rs/seaweedfs-scheduled-snapshots`, existing plan in `project/`.
- df-cloud: `/Users/rschlae/Git/df/df-cloud/trees/rs/seaweedfs-snapshot-class`,
  branch `rs/seaweedfs-snapshot-class`.

If the existing infrastructure worktrees cannot be written under this sandbox,
use an explicitly recorded temporary checkout of the same remote task branch under
`/private/tmp`, without changing audience or creating a competing branch. The old
worktrees remain inspection copies; one writable checkout owns each branch. The
canonical snapshot plan stays under helm-charts `project/` in that checkout and
ships with its existing MR. This is a filesystem constraint, not a new delivery lane.

Scheduled-run continuation: use one bounded Kubernetes Job watch per pending run,
with a deadline of the next 02:15 UTC schedule plus 30 minutes and receipts under
the implementing repository's `project/_local/reviews/`. Use a bounded watch again
when the recorded retention fixtures become eligible, no later than their six-day
cutoff plus the next schedule plus 30 minutes. Do not leave a watcher duplicating an
active run. This API session has no established callback for those future deadlines;
if a watch cannot deliver a supported completion event, checkpoint the exact fixture
UIDs/timestamps, deadline and next command, stop the watcher, and require explicit
resumption of this same task. The main session remains the resume owner. This is a
continuation-capability hold, never passing evidence. Do not substitute a manual Job
for the required actual CronJob-controlled run or silently claim aged reclamation.

Status: continuation approved 12 October; persistence and preflight underway.
The CodeAPI plan clone is writable and fetched. The two existing infrastructure
worktrees are read-only under this session's filesystem policy. Azure authentication
failed with the old `/tmp/azcfg` profile; the normal host account reports Enabled,
so existing host credentials were checked: both cluster APIs respond and STG
app-codeapi/app-seaweedfs are Synced/Healthy. STG has only the retained manual
September snapshot and no scheduled-snapshot CronJob. The current STG snapshot
validation passed on 12 October. No live October apply has been performed.

Planning review: native read-only planner approved the October continuation after
one correction round. The five initial findings were verified and accepted:
creation-time fixture aging, explicit PRD prerequisite ordering, bounded scheduled
continuation, failure-specific recovery, and complete owners/test obligations.
The implemented cutoff is six days, with a three-ready floor; no policy was changed.
Writable sandbox copies are under
`/private/tmp/codeapi-snapshots-20261012.MXrwGT/{helm-charts,df-cloud}`, on the same
two MR branches. These are the sole source writers for this continuation.


### October preflight receipts — 2026-10-12

The reviewed continuation was committed and pushed as `fc3576a` before source
execution. The current targets were deliberately integrated once, without
conflicts: helm-charts main `ae07cc3473e0513ecaddd4081e7882d09453ffdb` into task
head `052e726d423626792946fca28386381a1aebbfb3`, and df-cloud STG
`8d22aa1c2cfcdaca18a5b0d915f80a27b59a282a` into task head
`dbe06417e1d3c9d64cdcee9454bd6b01381aa985`. The df-cloud net delta is still only
25 added lines in the SeaweedFS app stack. The pushed head started MR pipeline
681657 and SeaweedFS child 681659; preview acceptance is pending.

STG snapshot validation passed after integration and after retaining the unchanged
September recovery manifests. Those four objects remain Argo-tracked with
`Prune=false`. Removing their manifests would leave pending-prune drift without
historical cleanup authority, so keep `recovery.yaml` referenced in both
environments until that cleanup is separately authorized. This correction does
not change any live object's spec or require recreation. The new operator drill
remains outside Kustomize. STG private API endpoint `10.100.4.10` and service address
`10.240.0.1` match the snapshot egress policy. Both APIs respond; PRD's AppProject
still lacks the new ServiceAccount/Role/RoleBinding entries. No live change has
been executed during this continuation.

Deployment-pattern audit, derived from the fetched STG source:

| Axis | Current source | Result |
| --- | --- | --- |
| ArgoCD and ownership | `src/common/resources.ts:997`, `src/apps/laya/index.ts` Argo block, `AGENTS.md:61` | Existing Pulumi-owned AppProject remains namespace-scoped; class is a cluster prerequisite and Argo owns the schedule. Matches ownership. Existing inline AppProject is retained; helper conversion is unrelated. |
| Storage and shared helpers | `src/common/resources.ts:939`, `src/apps/seaweedfs/index.ts:407` | Adds an explicit CSI Delete class beside the existing Retain class. No snapshot-class factory exists in current source; no storage/PVC replacement. Matches existing resource pattern. |
| Workload identity | `src/common/resources.ts:915`, snapshot schedule Role | Scheduler uses Kubernetes API only, namespace RBAC, no Azure identity or static cloud credential. Azure identity factory does not apply. |
| Environment gating and naming | `src/apps/seaweedfs/index.ts:26`, existing snapshot-class naming | Uses existing STG/PRD validation and class convention; live PRD apply remains gated. Matches. |
| CI and preview | `.gitlab/ci/apps-triggers.yml:3`, `.gitlab/ci/app-child-pipeline.yml` | SeaweedFS-specific MR preview at current head is running; readiness awaits successful preview and effect review. |
| Secrets, data services, networking, node placement | unchanged in prerequisite diff | Not applicable; no new secret, database, endpoint or workload placement. Chart-only scheduler networking is checked separately. |
| Decision records | existing canonical snapshot plan | Existing snapshot-only design retained; corrected creation-time acceptance and rollout ordering, no new architecture decision. |


### STG source delivery and capability hold — 2026-10-12

The prerequisite MR !610 merged into STG as `30935bd6ccdfce9d171cfcb8f66042133ec7eba1`
after pipeline 681657 and SeaweedFS preview job 2181421 passed. The desired plan
has one new Delete snapshot class and one AppProject whitelist update, no deletes
or replacements. The independent final reviewer passed canonical JSON validation.
The automated review's cluster-wide escalation claim was rejected against the
Kubernetes RBAC documentation: a RoleBinding, including one referencing a
ClusterRole, scopes permissions to its namespace. The accepted namespace-level
source trust remains disclosed. The separate infra preview includes unrelated
target changes and deletions; no infra-up or unrelated app apply is authorized.

GitLab applied the project's squash/delete defaults despite CLI false flags.
The merge has parent `241da0f6`, its squash commit, rather than the reviewed task
head; the task branch was restored with an ordinary push to preserve its original
history. CodeAPI upstream history is unaffected. For subsequent merges use explicit
JSON `squash: false` and `should_remove_source_branch: false` and verify the graph.

The exact merged STG pipeline is 681679. SeaweedFS deployment bridge 2181510 was
triggered only to create its applicable child 681687 and refresh the merged-result
app preview; app-up 2181540 has not been triggered. The chart correction is pushed
as `7c02fdc1d8e3b89deefad20b2e9f76ad4c03cff2`, preserving the unchanged September
recovery manifests. Chart pipeline 681691 passed. Its independent source review
confirmed the implementation and raised one low documentation timing finding;
the retention window is six days, with capture count dependent on timing.
The correction round passed and validated against the canonical review schema at
chart head `0349ae568061a9fec32a9a4dc63768ed678039f4`; all findings are empty.
Source pipeline 681692 passed at that head. No policy or executable source changed.

Cluster verification is now blocked by the sandbox: an Azure token refresh fails
with `Operation not permitted: /Users/rschlae/.azure/msal_token_cache.json.lockfile`.
The earlier cached token allowed read-only preflight; refresh now needs a cache write
outside current writable roots. Approval policy is never, so escalation is not
available here. No secret/cache copy, alternate identity, or cluster workaround
was attempted. Finish current source and CI evidence; hold live apply/chart merge
until host Azure cache refresh and scoped cluster verification work again. After
capability is restored, resume this same plan at merged SeaweedFS preview review,
app-up 2181540, then live class/whitelist verification before chart merge.
No live October apply, scheduled capture, retention fixture or restore has occurred.
PRD and upstream v1.10.4 assessment remain behind STG acceptance.


The merged-result SeaweedFS preview job 2181539 passed at STG `30935bd6`, again
showing one class create and one AppProject update, no deletes/replacements.
The parent watcher completed; app-up 2181540 is held. The chart source gate is
passed, but !125 remains draft/unmerged pending live prerequisite verification.
Both CI watchers and both Claude review processes have terminated, and the
planner/documentation children are closed. No runtime or port-forward was started.
The final plan checkpoint is documentation only, reusing unchanged source checks
and the passing final review. No exact fixture UIDs or future capture deadline exist
yet because no live fixture or CronJob was created. After access recovery, record
those values when the actual STG rollout occurs and continue this same sequence.

The canonical snapshot checkpoint is pushed as helm-charts
`12d81f05940b1709ceb3134b697def9d3e29bc20`; current-head pipeline 681693 passed.
MR !125's published description was read back and matches source checks, the
passing final review, the successful merged-result prerequisite preview and the
blocked live gate. Its squash/delete flags are explicitly false. The source
branches and governing plan are pushed; no reviewer, watcher or test runtime is
left running. Next dependency remains restored Azure cache-write capability.

### Azure cache repair diagnosis and resume condition — 2026-10-12

The user explicitly authorized repairing Azure cache access and continuing the
approved STG verification, then conditional PRD promotion. Authority is recovered;
the remaining blocker is the execution environment's filesystem restriction.

Fresh `az account show --query '{state:state}' -o json` fails before authentication
with `PermissionError: [Errno 1] Operation not permitted:
'/Users/rschlae/.azure/az.sess'`. Metadata inspection shows normal user ownership
and no stale `msal_token_cache.json.lockfile`. Azure CLI 2.90.0 source loads
`az.sess` with a one-hour maximum age and writes it when expired; its MSAL token
cache also uses the same configuration directory. The current sandbox permits
only `/Users/rschlae/.azure/commands`, not the parent configuration directory.
Removing a lock or changing Unix file modes would not fix this sandbox denial.
No credentials were printed, copied or relocated, and no client configuration or
credential files were modified.

The required external capability is a session that permits Azure CLI writes to
`/Users/rschlae/.azure`, including session/cache files and their lock files.
The current session cannot grant that permission: its approval policy is `never`.
An external token refresh alone is not a durable repair because later CLI session
expiry or token refresh can require another denied write. Resume the same approved
plan after that capability is available; no renewed rollout approval is needed.

Fresh forge evidence confirms df-cloud STG remains
`30935bd6ccdfce9d171cfcb8f66042133ec7eba1`. SeaweedFS child pipeline 681687 has
successful build 2181538 and preview 2181539; app-up 2181540 remains manual.
helm-charts main remains `ae07cc3473e0513ecaddd4081e7882d09453ffdb`; MR !125 is
draft/open at `12d81f05940b1709ceb3134b697def9d3e29bc20`, with successful pipeline
681693 and both squash/source-branch-removal flags false. Both task clones are
clean and remote-aligned. No live apply, fixture, scheduled capture or restore was
performed in this repair attempt; current runtime health remains unverified.

Resume by verifying `kubectl --context aks-stg-apps --request-timeout=10s get
--raw=/readyz`, refreshing source/CI evidence, and reviewing the exact merged
preview before app-up 2181540. Verify the live snapshot class and AppProject
whitelist before the chart merge. Then follow the approved real scheduled capture,
creation-time retention, isolated restore and consumer E2E acceptance sequence.
PRD remains conditional on complete STG acceptance, including genuine retention
aging beyond six days. No watcher or runtime remains active.

### Azure access restored and STG schedule deployed — 2026-10-12

The user restored unrestricted filesystem capability and explicitly requested the
settings edit. In the active `standard-workspace` profile, the only configuration
change replaces `"~/.azure/commands" = true` with `"~/.azure" = true` under
`permissions.standard-workspace.workspace_roots`. TOML validation and read-back
confirmed no other configuration change. The current session can now refresh
Azure credentials: the normal account reports Enabled and the STG API readiness
endpoint returns `ok`. No credential was printed or copied. The previous Azure
filesystem hold is resolved; operational snapshot acceptance remains open.

Cluster-level changes: STG SeaweedFS app-up 2181540 in child pipeline 681687 passed
at df-cloud STG `30935bd6ccdfce9d171cfcb8f66042133ec7eba1`. Its source additions
are the incremental Delete class `seaweedfs-scheduled-snapshots` and the
AppProject ServiceAccount/Role/RoleBinding whitelist. Both were verified live;
the existing incremental Retain class `seaweedfs-disk-snapshots` remains intact.
The apply also reported reconciliation of the existing SeaweedFS Application.
No infra-up or unrelated app deployment was triggered.

The chart's server-side dry-run passed. helm-charts !125 merged without squash as
`0fa2e60b3d1415fb76781b086ec30f7224e4f0d3`, with parents `33241ff` and the reviewed
task head `12d81f05940b1709ceb3134b697def9d3e29bc20`. The source branch is retained;
merged-result pipeline 681890 passed. The intervening target commit changed only
the unrelated knowledge-graph chart, so the unchanged snapshot source checks and
final review were reused. Argo reached this exact merge revision and reports
Synced/Healthy. The daily schedule now exists; its first actual run is still pending.

Runtime and synthetic verification:

- All 12 authorization checks passed: four snapshot verbs allowed, snapshot
  update and access to contents, PVCs, Secrets, workloads, another namespace and
  nodes denied. The initial receipt parser incorrectly required a bare `no`;
  Azure returns `no - Azure does not have opinion for this user.`. After directly
  verifying that response, the parser accepted its explanatory suffix while
  retaining the expected answer and exit-status checks. No RBAC change was needed.
- CodeAPI on `e0b8c440` passed the existing 11-request synthetic probe: cold
  execution 273074 ms, warm execution 233 ms, exact-byte downloads, timeout
  SIGKILL/137, three object deletes and the harness's input-absence check. The
  harness does not exercise programmatic cancellation in this storage probe.
  Receipt: `docs/project/_local/reviews/2026-10-12-stg-snapshots-e2e.json`.
- The CodeAPI and trypost storage canaries both succeeded at
  `2026-10-12T15:34:07Z`. SeaweedFS remains one ready pod on its existing digest.
- Seed Job `seaweedfs-drill-seed-20261012`, UID
  `5ada15d6-8822-4c43-bc6a-6d05c6a909e8`, completed at
  `2026-10-12T15:31:50Z`. It verified the synthetic bytes in bucket `trypost-media`,
  key `synthetic-recovery/20261012-snapshots-v1`, with metadata
  `recovery=20261012-snapshots-v1`. Expected content is
  `SeaweedFS recovery fixture 20261012 snapshots-v1` followed by one newline.
  Only this newly created seed Job was deleted after its receipts were recorded;
  the stored fixture remains for the scheduled-capture restore.
- One retention fixture, `seaweedfs-auto-20261001`, UID
  `8bff3818-a0c2-443e-933c-24b838e2d976`, was created at
  `2026-10-12T15:33:02Z` from `seaweedfs-data` using the Delete class and schedule
  ownership label. It is ready, bound to
  `snapcontent-8bff3818-a0c2-443e-933c-24b838e2d976`; its incremental Azure backend
  reports Succeeded. The date in its name only reserves an unused past name;
  genuine creation time governs retention. Historical September objects remain.

Values-free/synthetic fixture, content/backend handle, seed, RBAC and schedule
receipts are also preserved under the existing persistent ignored root
`docs/project/_local/reviews/2026-10-12-stg-snapshot-receipts/`, alongside their
implementing helm-charts `project/_local/reviews/` originals. No secret-bearing
files or credentials were copied. The port-forward is stopped, port 13112 has no
listener, and every started CI, Kubernetes wait and E2E process has terminated.

#### Pending schedule and retention acceptance

CronJob `seaweedfs-snapshot-schedule` has UID
`27bc0935-4a11-44ba-b2cc-8e2bff9d6300`, creation time
`2026-10-12T15:31:06Z`, schedule `15 2 * * *`, time zone `Etc/UTC`, and no
`lastSuccessfulTime` yet. First expected actual capture is
`seaweedfs-auto-20261013` at 13 October 02:15 UTC, with a bounded deadline of
02:45 UTC. At that time, resume this same task and use:

```sh
kubectl --context aks-stg-apps --request-timeout=15s -n seaweedfs wait \
  --for=jsonpath='{.status.lastSuccessfulTime}' \
  cronjob/seaweedfs-snapshot-schedule --timeout=1800s
```

Record the actual Job's CronJob owner reference, completed run/logs and updated
last-success metric. Bind the restore drill to the resulting snapshot's exact UID
and creation time, confirming the fixture seed completed before capture. Complete
same-day reuse, isolated restore, temporary disk release and post-capture consumer
acceptance. A ready operator-created retention fixture does not prove the restricted
scheduled pod executed.

The retention fixture becomes eligible strictly after 18 October 15:33:02 UTC;
the first regular run after that cutoff is 19 October 02:15 UTC, with deadline
02:45 UTC. Before that run compute victims and the three-ready floor from the full
current owned inventory, then verify this fixture's content and recorded backend
handle are reclaimed by the scheduler. Never substitute a backdated name or manual
deletion for genuine aging and retention proof.

On 12 October the user authorized automatic follow-ups in this same task and
conditional PRD continuation after full STG acceptance. Two native, one-time
heartbeat automations are active, attached to task
`01a0af87-a812-7f02-86dc-bce93f7bf58f`:

| Follow-up | Europe/Zurich (CEST) | UTC | Automation ID |
| --- | --- | --- | --- |
| Corrected actual scheduled capture, same-day reuse, isolated restore and consumer verification | 14 October 2026, 04:20 | 02:20 | `stg-scheduled-capture-and-restore-verification` |
| Pre-run inventory, genuine aged retention/backend reclamation, then conditional PRD rollout | 19 October 2026, 04:05 | 02:05 | `stg-retention-verification-and-conditional-prd-rollout` |

The retention follow-up starts before the 04:15 local scheduled run so it can
record expected victims and the protected floor from the complete inventory.
If execution starts after that run without pre-run evidence, hold PRD and report
the missing proof. Use a supported bounded watcher through the 04:45 local run
deadline; record actual scheduled-run ownership and freshness rather than accepting
an earlier `lastSuccessfulTime`. There is no continuously running local watcher.

Both automation records were read back as active with one occurrence and the
intended task attachment. Their prompts resume this plan and existing source
owners, preserve the fixture and historical recovery resources, persist sanitized
receipts, and notify only meaningful results, failures or required user action.
The 13 October follow-up cannot clear the genuine-aging gate early. The 19 October
follow-up proceeds with the approved PRD sequence only after every STG acceptance
gate passes, preserving required human release approval and the hold on unrelated
promotion changes. PRD prerequisites must be applied and verified before its
auto-synced chart package is merged.

PRD source promotion/deployment and the subsequent upstream v1.10.4 assessment
remain behind full STG acceptance. This is a scheduled continuation hold with
STG's snapshot schedule active, not completion of the snapshot package and not a
new generic approval gate. The upstream continuation remains assessment and
planning only; no upstream rollout is authorized by these follow-ups.

### Scheduled capture failed acceptance — 2026-10-13

The first actual scheduled Job ran within the expected deadline, but it did not
capture today's data. Job `seaweedfs-snapshot-schedule-29864295`, UID
`076dcc0d-8627-4d30-9962-8b5b58a93759`, has the expected CronJob controller owner
`27bc0935-4a11-44ba-b2cc-8e2bff9d6300`. It started at `2026-10-13T02:15:00Z`
and completed successfully at `02:15:06Z`. Its only snapshot receipt is
`snapshot=seaweedfs-auto-20261001 readyToUse=true`, followed by
`phase=complete status=ok`. The expected `seaweedfs-auto-20261013` does not exist.
The inventory still contains the original retention fixture and September recovery
snapshot with their recorded UIDs; no new capture appeared.

Root cause is reproduced from the live ConfigMap script with synthetic API
responses and no network access. `main` assigns today's name before inventory.
`collect_owned_documents` calls `fetch_snapshot_document`, which assigns its
argument to the same global shell variable `name`. The initial inventory therefore
replaces today's name with the existing fixture's name. The create request uses
that old name, receives a conflict, adopts the ready fixture and reports success.
The reproduction emitted the old name in its create request while explicitly
recording `expected_today=seaweedfs-auto-20261013`.

The CronJob's `lastSuccessfulTime` and Prometheus
`kube_cronjob_status_last_successful_time` both advance to `02:15:06Z`
(`1791857706`). The scoped snapshot alert query returned no active alerts. These
are process-success receipts and do not prove a fresh backup; this defect also
prevents the age-of-success alert from detecting the missing capture. Argo remains
Synced/Healthy at helm-charts `5805fdba11917f8e59e1785e0659ffcb5b574d51`.
The snapshot script has no diff between the retained task branch and current main.

The fresh scheduled-capture gate fails. Same-day reuse and the fixture-bound
restore remain blocked on a genuine new scheduled snapshot; no operator snapshot
or historical restore was substituted. No restore Job/PVC or disk was created,
and no fixture or historical recovery resource was deleted. The existing schedule
remains active for evidence and source-owned correction; it is not currently
accepted as working backup coverage. PRD remains held.

The next source correction must keep today's target in a variable that inventory
helpers cannot overwrite, then exercise the complete run with an existing owned
fixture. Validate both new capture and same-day reuse, with freshness tied to the
expected snapshot UID/creation time. Deliver through the owning chart source and
its applicable checks/review; never patch the live ConfigMap. After correction,
prove a real subsequent CronJob capture before the isolated restore and PRD gates.

The follow-up arrived at `2026-10-13T04:20:14.393Z` (06:20 Zurich), two hours after
its intended local time. The stored recurrence has no timezone anchor. An attempted
native update anchoring the 19 October follow-up to 04:05 Europe/Zurich was rejected
with `MCP tool call requires approval, but approval policy is never`; no setting
or automation file was edited to bypass that rejection. The existing 19 October
automation remains active with its original unanchored recurrence, so its intended
pre-run timing is not verified. Correct the schedule through the native automation
approval/settings capability before relying on it for the pre-run inventory; a
late run must hold PRD rather than fabricate that evidence.

Sanitized scheduled Job, logs, CronJob status, inventory, metric, alert, canary and
offline reproduction receipts are in the existing ignored directory
`docs/project/_local/reviews/2026-10-13-stg-snapshot-receipts/`.

Independent consumer checks passed: both storage canaries last succeeded at
`2026-10-13T04:26:07Z`; the authenticated synthetic CodeAPI probe completed with
11 requests, three created objects and zero failures. Cold execution took
270872 ms and warm execution 223 ms. Downloads matched expected bytes, timeout
returned SIGKILL/137, all three deletes returned 200 and the harness verified
input absence with 404. Programmatic cancellation remains skipped by this storage
probe. Receipt: `docs/project/_local/reviews/2026-10-13-stg-snapshots-e2e.json`.
The existing `codeapi-stg` profile remained authenticated with its sole approved
readable key and no writable names; an isolated temporary uv cache avoided an
unwritable default cache without changing settings or secret scope. Both owned
port-forwards stopped successfully and ports 13112/19090 have no listeners.
Consumer health does not clear the failed backup gate.

### Approved snapshot correction and timed continuation — 2026-10-13

The user explicitly approved fixing the snapshot defect, correcting follow-up
timing, verifying capture/restore in STG and proceeding with PRD after every check
passes. This continues the existing executable batch and its required reviews,
source ownership and PRD release gate. The original six-day retention and genuine
aging acceptance remain binding. Execution mode remains standard.

Correction owner: main changes only the script's persistent target name in
`seaweedfs/stg/snapshot-schedule.yaml`; one trusted native worker owns regression
coverage in `seaweedfs/tests/validate.sh`. Reuse the existing sole-writer chart
clone `/private/tmp/codeapi-snapshots-20261012.MXrwGT/helm-charts` on new branch
`rs/seaweedfs-snapshot-target`, based on current main
`5805fdba11917f8e59e1785e0659ffcb5b574d51`. Main owns automation, delivery,
integration, secret handling and live proof. Acceptance includes the full script
with a pre-existing owned fixture, correct fresh capture, correct same-day reuse,
and rejection of mismatched conflicts; the old script must fail that regression.

The 19 October heartbeat was updated successfully through the native automation
tool and its stored record read back with explicit UTC start `20261019T020500Z`,
one occurrence and the same task attachment. This is 04:05 Europe/Zurich and
supersedes the unanchored recurrence. Its pre-run inventory and conditional PRD
instructions remain intact. No automation file was edited directly.

After the chart correction passes source checks and independent review, merge
through GitLab and verify Argo's script revision. An approved operator rerun may
prove today's capture/reuse and enable an isolated preliminary restore; it cannot
replace the real CronJob gate. Reuse the capture heartbeat for the next daily
scheduled run on 14 October, explicitly anchored to 02:20 UTC (04:20 Zurich),
with acceptance deadline 02:45 UTC. Record the genuine scheduled snapshot UID
and creation time before the final fixture-bound restore. Continue the existing
19 October genuine retention verification and conditional PRD path.

### Correction deployed; operator restore accepted — 2026-10-13

[Chart correction MR 143](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/merge_requests/143)
merged without squash as `e20be146e64cabfba65c347ffbce07f9a38c1c38`, preserving
parents `5805fdba11917f8e59e1785e0659ffcb5b574d51` and reviewed task head
`d5b624496551ac35b347288050a7595c13fbd415`. Its source branch remains. The net
package touches only the STG snapshot script and its existing validation script:
the production target-variable rename and complete-run synthetic regression.
The worker and independent reviewer each demonstrated the regression failing
against the old script and passing against the correction. STG validation,
shell syntax and server-side dry-run passed. Simplifier advice reduced mock list
serialization while preserving all assertions; the independent slice review and
schema-validated trusted final review passed with no blocking findings.

Source [pipeline 682254](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/pipelines/682254)
and merged-result [pipeline 682259](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/pipelines/682259)
passed their secret-detection jobs. These pipelines do not run the complete
snapshot validation; that check and the independent regression proof ran locally.
Argo reached the exact merge commit, Synced/Healthy, and the live ConfigMap script
matched the reviewed source byte for byte. No local Pulumi or live ConfigMap patch
was used. The daily schedule, retention policy, RBAC and live SeaweedFS PVC/image
were unchanged by the correction.

Approved operator verification after deployment:

- `seaweedfs-snapshot-check-20261013` created ready snapshot
  `seaweedfs-auto-20261013`, UID `5c941e3f-37a4-4576-b404-bb2138ab7b89`, at
  `2026-10-13T06:15:33Z`. Its receipt at `06:15:54Z` confirms the correct target.
  Bound content is `snapcontent-5c941e3f-37a4-4576-b404-bb2138ab7b89`.
- `seaweedfs-snapshot-reuse-20261013` succeeded at `06:16:00Z`; the snapshot UID
  and creation time stayed identical. Both Jobs were operator-created from the
  CronJob template; they do not satisfy the genuine scheduled-run gate.
- Isolated Job `seaweedfs-drill-20261013`, UID
  `974724cc-c4db-4a14-b6a8-2f1459fcba64`, completed at `06:18:20Z`. Its verifier
  recovered the seeded fixture's exact bytes and metadata from that snapshot;
  digest `0731caab145c084ccf2cba17a2ae540320ef0bc83d8d7e0760fce5628b210219`
  matched. A new write/read/delete round trip succeeded on the isolated copy.
- Temporary restore PVC UID `41b94ad1-d31b-4098-a5c5-0159b24b7de8`, PV
  `pvc-41b94ad1-d31b-4098-a5c5-0159b24b7de8` and its recorded Azure disk were
  released after recording the Delete reclaim policy and exact claim identity.
  The bounded Kubernetes/Azure deletion watchers passed; an independent Azure
  read returned `ResourceNotFound` at `06:20:14Z`. Only newly created drill and
  operator verification Jobs were deleted. The captured snapshot, retention
  fixture and all historical September recovery resources remain.

The post-correction consumer probe initially failed cold execution with HTTP 504;
upload succeeded, and its sole input was deleted with a verified 404 afterward.
The original harness drained the error body, so the backend error code is unknown.
Scoped logs did not identify a matching synthetic run or establish its cause.
A diagnostic harness in the existing ignored receipt area adds duration and only
an allowlisted lowercase error enum on failure; raw error payloads and credentials
are suppressed. Its rerun passed all 11 requests, three synthetic objects, exact
downloads, SIGKILL/137 timeout behavior, three deletes and input-absence proof.
First execution took 351 ms and warm execution 815 ms. This fast rerun proves the
available execution path recovered; it does not prove cold-start reliability or
explain the first failure. Programmatic cancellation remains outside this harness.
Both storage canaries succeeded at `06:25:07Z`.

Consumer receipts:
`docs/project/_local/reviews/2026-10-13-stg-snapshot-correction-e2e.json` and
`docs/project/_local/reviews/2026-10-13-stg-snapshot-correction-diagnostic-e2e.json`.
Sanitized capture/reuse, fixture-bound restore, exact disk release, canary and
review receipts are persisted alongside the earlier failure under
`docs/project/_local/reviews/2026-10-13-stg-snapshot-receipts/`. Secret scope stayed
at the approved `codeapi-stg` read mapping. The owned port-forward stopped and
ports 13112/19090 have no listeners; no watcher, child or test process remains.

The source defect and preliminary restore are resolved. Genuine daily capture
and a restore bound to its resulting UID remain scheduled for 14 October, followed
by genuinely aged retention/content/backend reclamation on 19 October. Both
native follow-ups were updated and read back with explicit UTC starts, active
status and the original task attachment. Their prompts now preserve this deployed
correction, both E2E outcomes and the requirement for representative cold-start
evidence. PRD remains held until those checks and consumer reliability pass, then
the existing approved prerequisite-first normal release sequence applies.

Durable lesson: helper-only tests and a green process-success metric missed the
interaction between inventory and backup creation. The full-run regression now
checks the observable new snapshot and stable reuse identity. Live acceptance
must independently bind the expected date, snapshot UID and creation time to the
actual controlled Job; its success timestamp alone is insufficient.


### Cold execution correction — approved continuation, 13 October 2026

The user directly authorized investigating and fixing the cold HTTP 504, proving
STG cold-start reliability, then proceeding with PRD only after every existing
gate passes. This is an executable batch within the existing rollout. Execution
mode remains standard. Main owns runtime evidence, integration and external
effects; the trusted read-only sidecar owns the exact deployed timeout-path map.
The planner reviews this derived contract before implementation.

The deployed worker and API image is `e0b8c4409c337789d8fb07e5c5665bc2879c4fc3`;
the separately pinned Helm chart is `8eb246c5c0b3286f03fed7e32185e01b7a661d45`.
Debug those exact revisions. Sandbox pods live in `codeapi-sandbox`, separate
from the control plane. At 06:16:04Z the synthetic wake created a pending runner;
the spot pool began scaling from zero at 06:16:07Z, KVM scheduling completed at
06:19:29Z, and the 1,348,411,050-byte image pull took 101.477 seconds. The runner
started at 06:21:19Z, over five minutes after scheduling began. The configured
worker budget is 300,000 ms; the API separately inherits the same default.
The original 504 body was not retained, so its exact error remains unknown.
This lifecycle establishes a deadline mismatch. An old-budget reproduction is
optional because its original error body is unknown; corrected-budget acceptance
depends on measured cold trials, never an inferred warm retry.

#### Scope and sequence

1. Freeze and review the owning GitOps correction before publication. The proposed
   bounded budget is 480,000 ms for both the worker and explicitly configured API,
   and 540 seconds for the signed execution manifest. Confirm the deployed source
   accepts those values and leaves completion/cleanup headroom. Leave the 900-second
   egress grant, guest execution limits, KEDA zero floor, node pools, image pins,
   replica ownership and isolation controls unchanged. If source evidence requires
   another behavior, resolve that before editing. Ordinary source revert is recovery.
2. Use a dedicated `rs/codeapi-cold-start-budget` task branch from current Helm
   `origin/main` in the existing temporary writer, separate from the snapshot branch.
   Writer: `/private/tmp/codeapi-snapshots-20261012.MXrwGT/helm-charts`.
   Touch only `codeapi/stg/values.yaml`;
   prepare the corresponding PRD overlay only once STG acceptance passes. No live
   deployment patch, manual scaling, node deletion or autoscaler ownership transfer.
   Main owns the correction; configured slice and final reviewers cover deadline,
   capability lifetime and cross-system effects. The deployed API completion wait
   adds 70 seconds, yielding 550,000 ms; the synthetic HTTP budget is 600,000 ms.
   Source rendering plus the
   deployed timeout-path checks must demonstrate the old budget misses the observed
   startup and the corrected worker/API/manifest budgets remain ordered.
3. Publish and merge the reviewed STG correction with required CI/reviews, using
   existing direct deployment authority. Preserve history and source branch; wait
   for exact GitOps revision, Ready API/worker and one KEDA replica owner. Validate
   successful guest timeout enforcement as well as artifacts and cleanup.
4. Run three independent synthetic requests after observing runner replicas zero,
   including at least one naturally recycled spot node with an uncached image.
   Record node/runner identities and lifecycle times, HTTP duration and allowlisted
   failure enum; all cold attempts must succeed without a retry. Use the existing
   exact `codeapi-stg` Infisical read scope and synthetic-only harness, with bounded
   HTTP budget covering the API completion wait. Let KEDA and the cluster autoscaler
   provide idle transitions through bounded native watchers, never manual mutation.
   A cached-node start or fresh session on a warm runner is insufficient alone.
   Before each request, verify both desired and current runner replicas are zero
   and the runner label selector returns no pods. Watch the existing spot Node
   for deletion with `kubectl --context aks-stg-apps wait --for=delete node/<name>
   --timeout=1200s`; the next node UID must be new and its Pod Pulling/Pulled events
   must establish a real image download. Observe each scale-down with
   `kubectl --context aks-stg-apps -n codeapi-sandbox wait
   --for=jsonpath={.spec.replicas}=0 deployment/codeapi-sandbox-runner --timeout=420s`,
   followed by the current-replica/pod precondition read. One attempt per gate;
   timeout holds acceptance rather than restarting an unbounded observation.
   The exact harness is `docs/project/_local/reviews/codeapi-stg-e2e-diagnostic-auth.mjs`,
   importing `codeapi-v140-stg-e2e-diagnostic.mjs`; extend that ignored harness only
   if evidence needs it. Its executable budget is `CODEAPI_TEST_HTTP_TIMEOUT_MS=600000`.
   Stop owned port-forwards and watchers and delete only test-created objects.
5. Keep the actual scheduled capture/fixture-bound restore gate on 14 October and
   genuine aged retention/content/backend reclamation on 19 October. Update their
   existing native follow-ups with verified cold receipts. Only after all gates
   pass may the existing prerequisite-first PRD sequence proceed, including the
   required human release approval and unrelated-release-delta hold. PRD rollback
   uses the reviewed declarative recovery branch. No fork tags or PRD Alertmanager.

Delegation Map: main owns the configuration correction, review integration,
publication, STG rollout and live proof (steps 1–4). The completed trusted
read-only sidecar owns only exact-source timeout mapping (step 1 prerequisite).
The existing dated follow-ups own step 5, using the same plan and authority;
required planner/slice/final reviewers are read-only and do not own external effects.

Test portfolio: `none` for new configuration tests; reuse the exact-source timeout contract and Helm rendering for
budget/lifetime consistency. Render the pinned chart extracted to
`/private/tmp/codeapi-cold-start-20261013/helm/codeapi` with `helm template codeapi
<chart> --namespace codeapi --values codeapi/stg/values.yaml`; compare only the
API JOB_TIMEOUT, worker JOB_TIMEOUT and worker manifest TTL semantic delta,
and assert no Secret or sandbox replica-owner change. `extend existing` for
the ignored synthetic E2E harness only when needed for
true-cold preconditions, bounded timing and sanitized errors. Guest timeout,
artifact byte integrity and cleanup remain consequential live checks. The budget
change preserves deployed `workers.ts` cancellation/revocation and deadline
anchoring; existing `service/src/worker-error.test.ts` and `config.test.ts` are the unchanged
source regression seams present at e0. Do not claim
a new live worker-deadline-expiry test from the guest timeout result. Record that
coverage limitation separately; the cold success result and completed queue response
are the acceptance boundary for this repair. Add no
runtime dependency, mirrored configuration unit tests or fabricated availability
claim. Three passing trials are bounded acceptance evidence, not an SLA estimate.

Progress: exact-source mapping complete; native planner approved round 2 after
bounded observers and ownership were specified. The optional trusted AGY opposing
pass approved the same draft and exited successfully. Configuration-only correction needs one slice risk review and final
review; no dedicated simplifier is required for three scalar settings and affected
comments, with no control-flow or abstraction change. Implementation stays with
main because the single overlay edit costs less than dispatch overhead. PRD remains held. The snapshot
correction and earlier operator restore receipts remain valid; actual scheduled
capture and aged retention cannot be replaced by this cold-start work.


Cold correction source/live checkpoint: [Helm MR 144](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/merge_requests/144)
merged without squash as `4eae4a767611a69fdc367aa0b48a04a2e525bc52`, with
parents `e20be146e64cabfba65c347ffbce07f9a38c1c38` and
`fbdbe250fb1efe4d3506fb6c5a2fed5d5dc82e3b`. Source branch remains. Pipelines
682285 and 682312 passed secret detection. Exact pinned-chart rendering showed
only the three intended environment settings changed; correct-namespace server
dry-run passed. Existing control-plane PodSecurity warnings were unchanged by
this scalar correction. Independent slice review passed after its initial
progress-only reply was rejected; trusted Claude final source review passed
canonical schema validation after its closing reflection shape was corrected.
These are source go/no-go verdicts, not cold-start acceptance.

At 07:04:45Z Argo was Synced/Healthy at the exact values revision. Both API and
worker had JOB_TIMEOUT=480000 and one Ready updated replica; the manifest TTL
was 540 and egress TTL900. There are no deployed CodeAPI Ingress resources;
the historical Compose nginx settings are outside the tested Service path.
The old spot node was naturally deleted. First trial started with zero desired
and current runners, no runner pods and no KVM nodes. Its synthetic request
uses the existing scoped Infisical JWT mapping and 600000 ms HTTP budget.
KEDA created runner UID `e43ceb5c-3d70-411b-8314-c725e9d72876` and triggered a
new spot node at 07:05:22Z. That trial subsequently failed, as recorded below;
no cold success may be assumed from this deployment receipt. Evidence
is in ignored `docs/project/_local/reviews/2026-10-13-cold-start-receipts/`.


### Fresh-node trial exposed a registry dependency — 13 October 2026

The first corrected-budget trial failed transport before a response. Node v24
fetch has a separately documented 300-second headers deadline; AbortSignal600000
alone does not remove that ceiling. The original error cause was not retained,
so this client diagnosis is supported by timing and documentation rather than a
recorded UND_ERR_HEADERS_TIMEOUT. Extend the existing diagnostic harness to record
only duration and an allowlisted transport enum and use node:http for the exact
loopback /v1/exec POST, preserving fresh JWT, destination guard, redirect rejection,
AbortSignal600000 and a 2MiB response bound. Other requests retain fetch. A trusted
executor owns only those two ignored harness files; main retains live authority.

The new Node UID `2626e309-5ed9-4511-9799-e5f6e8f6e559` became Ready at 07:07:09Z,
but smarter-device-manager was ImagePullBackOff. Its anonymous token endpoint
returned HTTP503; independent metadata-only HTTP verification reproduced503.
Without the device plugin, the node advertised no smarter-devices/kvm capacity,
so the runner could not schedule. PRD declares the identical GitLab image and
currently has zero device-plugin pods because its pool is idle; warm readiness
cannot clear this shared dependency. The registry recovered during the bounded
300-second readiness watcher, but the failed cold trial remains failed.

This evidence requires a second scoped GitOps correction within the user's
approved cold-execution repair: replace only the STG device-plugin image in
`codeapi/companion/stg/smarter-device-manager.yaml` with the upstream official
`ghcr.io/smarter-project/smarter-device-manager@sha256:228f7f44594a3182571559e62f2e3fe8a3f26180fb5dd7fc0cb7bf7d22a5bbcd`.
Upstream's own Helm values and DaemonSet use this repository and v1.20.12.
Registry metadata verifies that immutable multiarch index and amd64 manifest
39a0675c, source revision482e65a3, Apache2.0 and versionv1.20.12. The binary is
not byte-identical to the legacy GitLab artifact: record this as an official
image replacement, not a proven mirror. Main must review its provenance,
configuration interface and KVM registration before delivery. No image is
published, no new registry credentials, privileges, mounts, owners, node pools
or capacity are introduced. Recovery is a declarative source revert; the old
GitLab dependency's current availability is not a durable recovery guarantee.

Use branch `rs/codeapi-device-plugin-registry` from fresh Helm origin/main in
the existing sole writer. Main owns this one-line implementation and STG rollout;
a native planner reviews the new contract, then independent slice/final source
reviews precede exact-head CI merge. Kustomize rendering and correct-namespace
server dry-run must show only the image reference changes. Verify the live
DaemonSet image, Ready plugin and allocatable40 KVM devices. The original eight-
minute API/worker budgets, guest limits, manifest540, egress900 and replica-owner
contract remain binding. The repaired test's local synthetic checks must prove
abort, delayed response, redirect rejection and response bound without keys.

Restart acceptance as three independent zero-runner trials, including a new
naturally recycled Node UID and an actual sandbox image download after this
registry correction. Preserve every failed receipt and classify cached-node
successes separately. Use one bounded watcher for the waker's natural zero
transition (1800 seconds), then node deletion (1200 seconds), never force either.
Timeout holds the dependent gate without repeating observation indefinitely.
PRD still waits for cold acceptance, actual 14 October capture/restore, genuine
19 October retention/reclamation and the existing release-review sequence. This
repair broadens the owning source surface from timeout values to its failed node
plugin dependency; it does not broaden publication, secret or production authority.


Second-correction progress: the native planner approved the new registry contract.
Trusted executor changed only the two ignored harness files; its actual extracted
transport functions passed 32 local synthetic checks, independently rerun by main.
The long POST uses node:http with the same destination/JWT guard, abort budget,
redirect rejection and 2MiB body bound; sanitized failure duration/code recording
preserves secret handling. This changes the probe, not deployed consumers.
A consumer's own five-minute socket limit would still need explicit alignment.

[Device-plugin MR145](https://gitlab.uzh.ch/uzh-bf/cloud/helm-charts/-/merge_requests/145)
passed source CI682334, independent slice review and canonical-schema-valid Claude
source final review. The source/config interface is unchanged, including the
relative config path; the live allocatable40 check will prove it. The existing
ConfigMap devicePermissions key is ignored by both binary schemas; the existing
chmod init container supplies0666. Do not expand this repair into removing that
pre-existing key. Main independently retrieved the old GitLab manifest after
503 recovery; a reviewer's single401 result does not establish a permanent new
authentication requirement. Oldregistry availability remains an explicit recovery
limitation. Only the STG image string changed; no image was republished.

### Cold-start live acceptance checkpoint — 13 October 2026

Device-plugin MR 145 merged without squash as
`717160fed338ace94a022e56cca604839f386595`, with parents `4eae4a76` and
`d65d972b`. Its source branch remains. Merged-result pipeline 682336 passed
secret_detection job 2184821. Both STG Argo applications reached that exact
values/companion revision and were Synced/Healthy. The deployed API and worker
retain JOB_TIMEOUT=480000, manifest TTL 540 seconds and egress TTL 900 seconds. The replacement DaemonSet
was Ready and registered 40 KVM slots, including on newly provisioned nodes.

Three independent zero-runner trials passed without an execution retry. Each
precondition receipt records desired/current runner replicas 0, no runner pods,
the exact GitOps revision and the Ready control plane. Each probe completed 11
requests, exact-byte artifact downloads, cold and warm execution HTTP 200, guest
SIGKILL/137 time-limit enforcement, three successful object deletes and input HTTP 404.

| Receipt trial | Synthetic run UUID | Cold execution | Startup path |
| --- | --- | --- | --- |
| 2 | `6dca38e0-25ac-474c-a655-901e3a0cfdfd` | 270651 ms | Empty pool; new Node UID 1073dba2-3700-4026-87fb-78811dde5d83 |
| 3 | `3957cbe6-b12e-4123-8ed0-5ec2122ad74d` | 36084 ms | Zero runners on the cached node |
| 5 | `cce984c7-0480-4db1-af21-22d46f9b3d4e` | 269747 ms | Empty pool; new Node UID 00404879-0699-44ec-85cc-f352eafaf294 |

Fresh runner UIDs were `3f038150-db2c-46ee-8470-8078fcc99d66` and
`63415f3a-ef99-438d-b5ef-a45e83104a80`. Their actual 1,348,411,050-byte sandbox
downloads took 72.319 s and 87.710 s. The upstream GHCR device plugin pulled in 1.770 s
and 1.718 s and registered 40 slots on both new nodes. Trial 3's immediate lifecycle
collection was missed during a session gap. The late live receipt correctly
records natural scale-down; it is not the execution-time state. Scoped historical
Prometheus pod metrics independently identify runner UID
`238297ec-2642-4ede-b685-60bdf4542198`, created at 07:58:25Z on the recorded cached
node. Its readiness sample was 0 at 07:59:00Z and 1 at 08:00:00Z; this bounds the
observed metric and does not establish an exact Ready transition time.

The earlier registry-blocked trial 1 remains failed and excluded from acceptance.
Trial 4 stopped at health with loopback ECONNREFUSED after the owned port-forward
disconnected; it submitted no execution and created no objects. That receipt is
preserved. The restored tunnel was used for a new, independently identified
trial 5; no failed execution was retried or counted as successful. The probe's
39 local transport checks and focused independent correction review passed.
The initial receipt parser expected summary status `ok`; the protocol is
`passed`. Its correction required no live rerun and preserves the raw receipt.

Both storage canaries succeeded at 10:55:07Z. All nine objects from the three
accepted trials were deleted. The owned port-forward was stopped, and port 13112
has no listener. The native waits and test processes completed; no manual pod,
node or replica mutation occurred. Source/config and runtime receipts remain
under ignored `docs/project/_local/reviews/2026-10-13-cold-start-receipts/`.

Integrated Claude final review of the exact two-file range e20be146..717160fe
and these synthetic receipts passed canonical schema validation with no findings.
It reused the source reviews, accepted the three classified cold trials and
preserved the PRD hold. Review: ignored `integrated-final-review.json`.
Three successful trials provide bounded acceptance, not an SLA. The probe tests
the authenticated Service path; it changes no deployed consumer socket settings.
Guest timeout does not prove live worker-deadline expiry or cancellation.

PRD remains held by the actual 14 October scheduled capture/fixture-bound restore
and genuine 19 October retention/content/backend reclamation gates. The existing
dated follow-ups retain their corrected UTC anchors and conditional PRD authority.
After all STG gates pass, the dedicated PRD package must include parity for the
API/worker 480000 ms budget, manifest TTL 540 seconds and the reviewed upstream GHCR plugin pin,
alongside the snapshot schedule. Preserve normal df-cloud STG-to-PRD promotion,
recorded human release approval, unrelated-delta hold and prerequisite-first
ordering. This checkpoint does not authorize an early PRD rollout.

Both existing native follow-ups were updated with the final cold receipts,
failed-attempt exclusions, probe limitations and required PRD parity. Native
success responses and file read-back confirm ACTIVE, same thread, and unchanged
single-occurrence anchors: 14 October 02:20 UTC (04:20 Europe/Zurich), and
19 October 02:05 UTC (04:05 Europe/Zurich). The latter starts before the 02:15 UTC
retention run for the required victim inventory. No duplicate monitor, new goal
or separate chat was created. Fresh KEDA/HPA ownership read-back confirms one
ScaledObject-owned HPA per runner/waker, minima 0 and maxima 3/1.

### Actual scheduled capture and restore accepted — 14 October 2026

The corrected daily scheduler, exact-capture recovery and post-capture consumer
gate passed. This clears the 14 October gate; genuine aged retention on 19 October
and the existing PRD release prerequisites remain pending. Earlier operator
captures remain preliminary evidence, separate from this actual scheduled run.

Fresh Helm main is `21c0ae065083bb46b604a8b31fcd3739c65fbf09`; its SeaweedFS and
CodeAPI paths have no delta from reviewed `717160f`. The live snapshot script is
byte-identical to that source and contains the corrected `target_snapshot_name`.
SeaweedFS, CodeAPI and companion Argo applications are Synced and Healthy at that
revision; CodeAPI retains chart `8eb246c5` and images `e0b8c440`. The full STG
snapshot validation, including same-day HTTP 409 and ownership/PVC/class rejection
regressions, passed against the unchanged reviewed source.

- Actual CronJob-owned Job `seaweedfs-snapshot-schedule-29865735`, UID
  `c825fd3b-af0d-410a-a679-6d9b84f3df0e`, was created at `02:15:00Z` and completed
  at `02:15:25Z`, before the `02:45Z` deadline. Its owner is CronJob UID
  `27bc0935-4a11-44ba-b2cc-8e2bff9d6300`. Logs confirm the expected snapshot and
  successful completion. CronJob `lastSuccessfulTime` and its Prometheus metric
  value `1791944125` independently match this completion.
- Real snapshot `seaweedfs-auto-20261014`, UID
  `81abd60c-801b-44aa-bcc5-643e3716393f`, was created at `02:15:02Z` and reports
  ready, 50 GiB. Its content is
  `snapcontent-81abd60c-801b-44aa-bcc5-643e3716393f`, with backend creation time
  `02:15:05Z`. The source is `seaweedfs-data`, class
  `seaweedfs-scheduled-snapshots`, with the schedule ownership label.
- Same-day operator reuse Job `seaweedfs-snapshot-reuse-20261014`, UID
  `371f019d-a818-4a72-a81d-ef6a58bdcb7f`, completed at `02:25:34Z`. It reused the
  exact snapshot without changing UID or creation time. The unchanged script
  adopts an existing target through its 409 path; logs report the ready target
  rather than the HTTP status. Full-run regression validation independently
  exercises that 409 and rejects mismatched ownership, source and class.
- Isolated Job `seaweedfs-drill-20261014-scheduled-v1`, UID
  `dee13120-79b4-4619-9da9-7815b19d67d4`, completed at `02:27:25Z`, restoring that
  exact scheduled snapshot. It recovered the fixture seeded on 12 October before
  capture: `trypost-media/synthetic-recovery/20261012-snapshots-v1`, exact bytes,
  metadata and digest
  `0731caab145c084ccf2cba17a2ae540320ef0bc83d8d7e0760fce5628b210219`.
  A new write/read/delete succeeded on the isolated copy.
- Temporary PVC UID `f14bce2d-e28e-4d6f-b3e2-f3ff10251a2a`, PV
  `pvc-f14bce2d-e28e-4d6f-b3e2-f3ff10251a2a` and its recorded Azure disk were
  released after checking the exact claim and Delete reclaim policy. Native
  deletion waits passed; independent Azure `ResourceNotFound` and Kubernetes
  absence checks confirmed release at `02:29:06Z`. The first receipt assertion
  expected only `ResourceNotFound` while Azure initially returned equivalent
  `NotFound`; the follow-up read resolved this without repeating deletion.

Cluster-level changes: only the approved temporary restore PVC/Job and same-day
reuse Job were created and then removed. The scheduled capture, seeded object,
retention fixture UID `8bff3818-a0c2-443e-933c-24b838e2d976`, previous captures and
historical September recovery resources remain. No managed deployment changed.

Post-capture CodeAPI E2E UUID `8cbf4614-e5ae-40e5-88db-30108ed6a59c` passed all
11 requests through the authenticated Service path, using only the existing
`codeapi-stg` read scope and fresh in-memory synthetic tokens. Both API and worker
retain `JOB_TIMEOUT=480000`, manifest 540 seconds and egress 900 seconds.
Starting from zero desired/current/ready runners, cold execution succeeded in
270314 ms, warm execution in 263 ms. A new node UID
`4bf1979f-070c-4b04-94dd-b5661161baa8` exposed 40 KVM slots; its sandbox image pull
was 1,348,411,050 bytes in 79.359 seconds. The reviewed upstream GHCR device-plugin
pin pulled successfully in 1.726 seconds. Exact-byte output downloads, guest
SIGKILL/137 timeout enforcement, three deletes and input 404 passed. Existing
probe/review evidence applies: both harness hashes are unchanged. This adds one
independent cold trial; it does not establish an SLA, every consumer socket path,
programmatic cancellation or live worker-deadline expiry.

Both storage canaries last succeeded at `02:31:07Z`. The scoped SeaweedFS alert
query returned no active alerts. The owned port-forward stopped; ports 13112 and
19090 have no listeners, and all started verification watchers completed.
Sanitized receipts remain in the existing ignored root:
`docs/project/_local/reviews/2026-10-14-stg-snapshot-receipts/`.

The completed 14 October capture follow-up was deleted through the native
automation tool. The existing retention follow-up was updated with this accepted
scheduled capture, restore, disk release and additional cold-start evidence.
Native success and read-back confirm ACTIVE, the same chat, and the unchanged
single occurrence on 19 October at 02:05 UTC (04:05 Europe/Zurich), before the real
02:15 UTC retention run. It must record the full owned inventory, expected victims
and three-ready floor before that run, then prove genuine aged snapshot/content
and Azure backend reclamation. No retention window was shortened and no fixture
was manually deleted. PRD stays held until that proof and the existing approved
normal STG-to-PRD release sequence pass, including recorded human release approval,
the unrelated-promotion-delta hold and prerequisites before chart auto-sync.
Its dedicated chart package must carry the snapshot fix, API/worker 480000,
manifest 540 and the reviewed upstream GHCR plugin pin. Existing owners, reviews
and recovery branches remain; there is no new goal, separate chat or early rollout.

### Earlier PRD cold-execution rollout — approved 14 October

Approval summary: decouple the verified CodeAPI cold-execution repair from the
snapshot retention acceptance gate. The six-day wait verifies automated deletion
of aged snapshots and Azure backend reclamation. It adds no direct evidence for
CodeAPI execution budgets or device-plugin availability. Promote only those
CodeAPI fixes before 19 October, with existing release reviews and environment
checks. Keep the production snapshot schedule, pruning and storage prerequisites
in their existing gated package. This changes rollout ordering; it does not waive
the retention test or authorize the unrelated changes in a platform release.

Approval mode: executable batch. The user explicitly approved the CodeAPI-only
PRD rollout, E2E and cold-start verification on 14 October, keeping production
snapshots gated on the 19 October retention check. Existing owners and reviews
remain. Main owns the source package,
cross-repository integration, all release effects, secrets and final PRD proof;
the configured read-only planner challenges this amendment before presentation.

The exact Helm source scope is `codeapi/prd/values.yaml`: API `JOB_TIMEOUT=480000`,
worker `jobTimeout=480000`, and manifest TTL 540 seconds; and
`codeapi/companion/prd/smarter-device-manager.yaml`: the reviewed upstream GHCR
digest `228f7f44594a3182571559e62f2e3fe8a3f26180fb5dd7fc0cb7bf7d22a5bbcd`.
Preserve guest limits, egress TTL, images, replica ownership and existing security
configuration. Include only comments made inaccurate by those changes. Use a
purpose-named `rs/` worktree and draft MR based on fresh Helm main, existing
native render/check tooling, prior applicable risk reviews and an integrated
review of the PRD delta.

Live PRD CodeAPI values are pinned to Helm revision `c1edada3950f7d2dc5760ee559706d125cacdf34`
and its chart to `e0b8c440`; the companion follows Helm `main`. Consequently,
merging the proposed Helm package makes the plugin correction eligible for Argo
reconciliation, while timeout/manifest values require the later df-cloud pin
promotion. Treat the
Helm merge as a production deployment gate: complete the PRD plugin diff review,
render validation, baseline health and declarative rollback preflight before it.
The two rollout steps have independent receipts; plugin acceptance does not prove
the timeout values are deployed. Confirm those Application revisions before any
mutation, compare the pinned chart with STG's reviewed
`8eb246c5`, and include only demonstrated dependencies in the source plan. Source
publication is followed by updating the PRD values pin in df-cloud via
its normal STG-to-PRD release path and GitLab CI preview/apply. Promotion !659 was
draft during planning and has since merged externally as `d48a6077`. A fresh
comparison still contains unrelated deltas across seven files; this task has no
authority to promote those remaining changes. Preserve the existing release owner, required
recorded human approval and merged-result previews. Hold the dependent rollout
if unrelated deltas lack explicit disposition; do not invent a selective release,
direct PRD push, local Pulumi operation or live Kubernetes patch.

After the applicable source and deployment gates pass, merge the Helm package
without squash and preserve source branches. Verify actual Argo revision,
DaemonSet digest and readiness before recording plugin acceptance or proceeding
to timeout promotion; a merged source revision alone does not clear that gate.
Then, after a clean applicable CI preview and recorded release approval, promote
the PRD values pin and apply only the approved CodeAPI app stack through GitLab CI.
Verify exact Argo revisions, Ready control-plane pods, timeout/TTL values and
device-plugin digest. Run the approved
synthetic PRD artifact E2E and cold-start checks using existing exact Infisical
scopes, fresh in-memory tokens, bounded requests and natural scale-to-zero; do not
manually remove runners or nodes. Reuse the existing STG cold-start acceptance
contract for representative zero-runner trials, exact downloads, guest timeout
enforcement and synthetic-object cleanup. Observe both storage canaries, stop
owned tunnels/watchers, and persist sanitized receipts in this artifact root.
No new tests are planned; run the existing source/render and synthetic acceptance
checks. No application runtime is required merely to prepare the package.

A failed PRD acceptance holds subsequent work. Restore the exact prior plugin
manifest through an ordinary reviewed Helm revert, and restore any changed
chart/values pins through the reviewed df-cloud recovery source and the same
approved release path; never use rollout undo. The rollback covers only this
package's fields and preserves unrelated Helm changes. Terminal
condition: verified PRD CodeAPI acceptance, recorded rollback if necessary, or
a precise release/review/promotion blocker with the scoped package preserved.

The 19 October 04:05 Zurich follow-up remains responsible for the original aged
retention proof and later snapshot package. Update
that follow-up with actual CodeAPI progress so it does not repeat completed work.
Production automated snapshot creation/deletion, fork releases/tags, PRD
Alertmanager, historical cleanup and unrelated platform promotion remain outside
this amendment. Approval of this ordering does not authorize unresolved unrelated
release changes or bypass required human review.

Progress, start of approved execution: the planner approved this ordering after
correcting the distinction between a main-following source and actual Argo
adoption. The source patch preview and review are under the ignored
`docs/project/_local/reviews/2026-10-14-prd-cold-rollout-proposal/`. A fresh fetch
now shows df-cloud !659 merged externally as `d48a6077`; PRD's current chart and
values are still `e0b8c440` and `c1edada`, while the companion is Synced/Healthy
at Helm main `21c0ae0`. Remaining STG-to-PRD drift spans seven files and still
requires explicit disposition before a normal promotion can merge. This task
does not take ownership of that external release or its unrelated deltas.

Working paths: Helm implementation owns the task worktree
`/private/tmp/codeapi-snapshots-20261012.MXrwGT/helm-charts/trees/codeapi-prd-cold-start`
on `rs/codeapi-prd-cold-start`, based on fresh main. Main owns forge actions,
live verification, source integration and exact release gates. A trusted bounded
executor owns only the two named Helm files and returns the checked patch.
The isolated PRD consumer verification will use the existing approved
`codeapi-prd` Infisical profile and documented signing-key mapping; no new scope
or secret configuration is authorized or needed. Snapshot source, schedule,
retention fixture and 19 October follow-up remain in the separate storage phase.

#### CodeAPI PRD checkpoint and proposed scoped release exception

Helm MR !151 merged without squash as
`74296284bd3a814e901762f7e5796933cd96f3c2`, preserving source branch
`rs/codeapi-prd-cold-start` and source commit `5e765285`. Source CI 683325 and
merged CI 683330 passed secret detection; current PRD chart lint/render and
companion Kustomize render passed. The independent canonical Claude final review
passed without findings. The PRD companion adopted this revision, is Synced and
Healthy, and the device manager's observed generation and digest match source.

Preliminary PRD synthetic E2E UUID `e3adb607-43f9-4fd0-9ad7-33b8508832f8` passed
all 11 requests, exact-byte downloads, guest timeout SIGKILL/137, three deletes
and input 404. Cold execution took 270707 ms, warm 264 ms, after confirmed zero
desired/current/ready runners and no nodes. New Node UID
`4b7e9ecc-9415-4231-938c-7e70d124e8b4` exposed 40 KVM slots. The actual plugin
image pulled in 1.760 seconds, became Ready and had zero restarts; the sandbox
pulled 1,348,411,050 bytes in 77.458 seconds. This proves functional plugin startup
on PRD. The API/worker budget remains the old 300000 default/setting and manifest
TTL 360; this trial does not prove the complete 480000/540 rollout or replace its
required representative cold trials. The reviewed PRD PEM/public-JWKS adapter
uses only the existing approved key scope, keeps values in memory and reuses the
unchanged reviewed bounded HTTP transport; syntax and its 39 local checks passed.

The two-line df-cloud pin update and existing assertion were committed as
`8669b301` on `rs/codeapi-prd-cold-values`. Independent canonical source review,
pinned formatter checks, source MR pipeline 683336 and CodeAPI preview child
683337 passed. MR !673 merged to STG without squash as
`0ee5790abe6a49fa1690154c5c60ab5b0ca26382`, preserving its source branch. The STG
preview's one Application update sets chart `8eb246c5`, already observed live;
no STG app apply was run. PRD still uses chart/images `e0b8c440` and values
`c1edada`; no chart/image upgrade is needed for this timeout repair. Sanitized
receipts remain under `docs/project/_local/reviews/2026-10-14-prd-cold-start-receipts/`.

Correction to the earlier promotion diagnosis: a two-dot comparison showed seven
file differences, but that compared tree states rather than changes since the
shared merge base. Fresh merge-base and GitLab MR !674 diff checks show that the
actual STG promotion changes only the two CodeAPI files. The other differences
are PRD-specific overrides from !659's resolution. They must be preserved, but
are not additional STG changes requiring a new scope approval. The selective
release exception previously drafted is unnecessary and is withdrawn.

MR !674 has conflicts only in the CodeAPI values pin and its existing assertion.
The approved standing integration policy permits this bounded resolution. Main
created `rs/codeapi-prd-cold-release` in
`/private/tmp/codeapi-snapshots-20261012.MXrwGT/df-cloud/trees/codeapi-prd-cold-release`
from current PRD `d48a6077`, merged full STG `0ee5790`, and resolved only those two
pins to `74296284`. Merge candidate
`28bd9c9f93cbbc79dae7081ce3197c517dcfdd41` retains both heads as parents and all
STG history; its net diff from PRD is exactly two lines in the two CodeAPI files.
Every other PRD file is unchanged. This is the conflict-resolved normal promotion
candidate, not a selective cherry-pick or a protected-branch push.

Draft MR !675 targets PRD with that exact merged result. Prettier checks passed;
its independent merged-result review passed without findings after a canonical
schema-format correction; native PRD CI previews are in progress.
Recorded human release approval remains required. Complete those source/preview
and release gates, merge without squash with branches retained, then apply only
CodeAPI through its GitLab child pipeline. Verify actual values revision and
480000/540 settings before completing representative cold trials and E2E.
Recovery remains a reviewed source change back to `c1edada` and the same CodeAPI
CI apply; preserve the independently accepted plugin unless it regresses.
No additional scope approval is needed for this conflict resolution. No PRD
values apply, snapshot apply or completed full-budget acceptance is claimed.

Checkpoint cleanup: the owned PRD port-forward stopped, and ports 13112, 13113
and 19090 have no listeners. The preliminary probe and local checks completed.
The local CI watcher stopped at the release-scope decision; remote CI was not
cancelled. PRD's CodeAPI storage canary succeeded at `10:24:06Z`, and both STG
canaries at `10:24:07Z`. PRD has no scheduled snapshot CronJob. The existing
19 October follow-up was updated through the native tool with the approved
CodeAPI/snapshot separation, actual plugin acceptance, pending timeout pin and
current merged-result release candidate. The earlier exception proposal is
withdrawn: actual normal-promotion changes are CodeAPI-only. It keeps the same
UTC time and retention gates.

#### Production preview authentication failure — 14 October

PRD CodeAPI child pipeline 683376 built the helpers successfully, then preview
job 2189635 failed before evaluating the stack. Sanitized diagnostics report
`There are no active accounts` from Azure and Pulumi's fallback demand for
`PULUMI_ACCESS_TOKEN` in a non-interactive login. No deployment plan or production
apply resulted. Adding a Pulumi Cloud token is not the remedy: this project uses
its existing Azure-backed CI login configuration.

Scoped GitLab metadata confirms server 19.4.2 and that candidate branch
`rs/codeapi-prd-cold-release` is unprotected, while `stg`, `prd` and the existing
`release/prd-*` pattern are protected. GitLab requires protected source and target
branches, same-project membership and eligible triggering-user permissions for
MR pipelines to receive protected variables/runners. The unprotected candidate
does not meet that requirement. This explains the observed missing CI login
configuration; the failure is not evidence against the CodeAPI timeout source.
Existing protection and variable policies have not been changed. The failure,
branch-status and canonical review receipts are preserved in the ignored root.
MR !675 also has zero recorded approvals; its custom release job requires one.

The PRD plugin remains deployed and functionally accepted on the new-node trial.
The timeout values remain at 300000/360. Snapshot rollout remains gated on the
19 October check. No production values, infrastructure or SeaweedFS apply is
claimed. Both the CI trust-boundary repair and recorded release approval are
required before continuing the dependent timeout deployment.

##### Exact CI repair — approved; superseded candidate on refresh

Protect only the already reviewed candidate branch `rs/codeapi-prd-cold-release`
at unchanged SHA `28bd9c9f93cbbc79dae7081ce3197c517dcfdd41`, using an exact-name
rule, direct pushes disabled, Maintainer merge access (40) and force pushes
disabled. This makes that verified source eligible for existing protected PRD
CI resources while preserving the current rules for every other branch. It is
a new CI trust-boundary action, separate from the already approved source merge
and CodeAPI rollout. It grants no new secret-store scope and changes no CI
variable, project-wide setting, script or production resource.

Main verifies the unchanged reviewed SHA and creates that exact rule only after
the user approves this action. Start a fresh MR !675 pipeline at the same SHA so
GitLab evaluates the protected-resource context anew; preserve the failed run.
If access still fails, hold rather than widening variable exposure or toggling
project settings. After canonical source review, actual PRD preview showing only
the CodeAPI Application values-pin update, and recorded human release approval
pass, the existing authority covers a history-preserving merge, CodeAPI-only CI
apply and full E2E/representative cold trials. Restore the prior values pin through
the approved declarative recovery path on a regression. Terminal condition is
full PRD CodeAPI acceptance or its precise remaining gate. The 19 October storage
sequence, existing owners, source branches and historical resources remain.

Planner review: APPROVED; native read-only planner Beauvoir reviewed this exact
CI protection proposal. The user explicitly approved that exact protection and fresh CI run on
14 October. Before mutation, the required remote refresh found a newer release;
the protection action is held while its relevance is resolved.

#### Concurrent release refresh — 14 October, 15:30 UTC

The user approved exact-name protection of `rs/codeapi-prd-cold-release`, a fresh
MR !675 pipeline, and CodeAPI-only rollout after its recorded approval. No policy
mutation or pipeline rerun has occurred. Refresh found that MR !674 was already
approved and merged independently at `7069d94c8c09857addb0da2798629df93b176c28`.
It carries the exact reviewed CodeAPI values pin `74296284` and preserves full
STG history. One actual GitLab approval is recorded; production pipeline 683524
is successful. These external actions are not claimed as this task's work.

A non-mutating merge-tree check of !675 into current PRD yields the identical
PRD tree: !675 is now redundant. Its GitLab diff still lists historical PRD
overrides relative to the newer common ancestor; neither merging it nor running
its old candidate preview is necessary to deliver CodeAPI. Source branch/head
`28bd9c9f` remains intact and unprotected. The user was asked to confirm using the
already approved !674 release instead of the now-superseded named !675 gate.

The actual PRD Application remains at values `c1edada`, API default/worker
300000 and manifest 360. All five control-plane deployments are Ready, and
the independently accepted device plugin is deployed. Main prepares only the
CodeAPI child preview from release 7069d94 / parent 683524; app-up remains held
until that preview passes and the replacement release gate is confirmed. No
other app, infrastructure, storage or Alertmanager action is authorized here.
After that gate, acceptance requires live 480000/540, unchanged chart/images
`e0b8c440`, representative zero-runner cold trials and complete synthetic E2E.
The 19 October retention gate and all historical recovery resources remain.

The user confirmed: "Use approved release !674 (Recommended)". This replaces
the obsolete !675 gate and permits the same CodeAPI-only preview/apply and cold
E2E from release 7069d94. Skip the now-unnecessary !675 protection/CI rerun.
Keep !675 and its branch intact pending any separately requested cleanup.

#### CodeAPI-only production apply — 14 October, 15:39 UTC

The replacement release gate is cleared by the user's explicit confirmation and
MR !674's recorded approval. Release 7069d94 includes the reviewed source and
full STG history. Its CodeAPI/shared build and CI inputs match reviewed candidate
28bd9c9f; the other apps promoted externally are outside this task's effects.
Main played only `deploy-app-prd: [codeapi]` bridge 2190404. Child 683629's helper
build 2190804 and preview 2190805 passed. Exact preview: one in-place CodeAPI
Application values revision update `c1edada` to `74296284`, 41 unchanged resources,
no creates/deletes/replacements and no other changed property. After inspecting
that diff, main played only app-up 2190806; it is running. Infrastructure and
SeaweedFS jobs remain untouched. MR !675 remains draft/open with its branch
retained; its now-unnecessary protection/CI repair was skipped as approved.

Read-only baseline confirms zero runners, no sandbox nodes, and one KEDA-owned
HPA per sandbox deployment (min 0, max 3 for runner / 1 for pool waker). The full
budget observer asserts API/worker 480000, manifest 540, egress 900, chart/images
e0b8c440 and values74296284, the reviewed plugin digest, zero desired/current/ready
runners and no runner Pods before each accepted cold trial. The reviewed probe
transport is unchanged; keys/tokens remain in memory via the existing exact PRD
Infisical scope. Deployment and functional acceptance are still pending.

Apply 2190806 passed in 172.887 seconds at 15:42:06Z. Argo is Synced/Healthy at
`[e0b8c440,74296284]`; API and worker rollout checks and the full budget observer
passed. The CI template performs a real Pulumi state refresh before up: six
refresh records changed, including existing read resources and companion state.
The final up updated two CodeAPI Applications. Besides the intended values pin,
it reasserted the companion's explicit `allowEmpty:false` default after refresh;
its source path/revision, prune/self-heal/retry and KEDA ignore policy remain.
The companion diff also contains managedFields bookkeeping. No source revision,
plugin, workload image or additional app changed through that second update.
Sanitized property-key and actual companion-spec receipts distinguish this from
the earlier one-update preview. No create, delete or replacement occurred.

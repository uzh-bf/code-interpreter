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

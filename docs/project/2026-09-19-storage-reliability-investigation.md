# SeaweedFS and CodeAPI reliability investigation

Historical investigation snapshot. The subsequent approved [v1.4.0 execution plan](2026-09-19-storage-recovery-upstream-v1.4.0-plan.md) supersedes release target, authorization and review status below.

Date: 2026-09-19. Status: investigation complete; remediation and deployment not performed.
Related history: [v1.2.0 integration](2026-09-18-upstream-v1.2.0-integration-plan.md).

## Decision summary

STG cannot allocate storage for CodeAPI artifacts. PRD has a working CodeAPI
volume but no spare allocation slots. The failure is independent of the upstream
upgrade. Correct allocation, detect failed writes, prove recovery, and then
promote a fixed CodeAPI revision through STG to PRD as separate changes.

The latest upstream stable release is now v1.3.1, published 2026-09-19 at
15:20:05 UTC. The previously integrated v1.2.0 is no longer latest.

The two proposed flags are directionally correct, but do not alone establish
reliable operation. Add a one-volume growth policy, early capacity monitoring,
synthetic storage acceptance, and a verified recovery procedure. No finite
storage configuration or test battery can guarantee zero future failures.

## Verified source and deployment state

| Layer               | Current evidence                                                                                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fork source         | main ccc225985ff2f6aec6a3fe1472515d8e9bf188bf; no open PRs                                                                                                                                                                                                  |
| Upstream release    | v1.3.1 commit dc48249741e9d9bd010d19a3d5fcf56e2c159b79; two commits beyond v1.2.0                                                                                                                                                                           |
| Fork CI             | CI 35395067065 and image build 35395067053 succeeded at ccc2259                                                                                                                                                                                             |
| Fork release policy | Zero remote tags and releases; Release run 35397206167 skipped                                                                                                                                                                                              |
| STG CodeAPI         | Chart and six application deployments, including sandbox runner, pinned to 929ec4d8220f969a3f049e3a134259befeed15d7                                                                                                                                         |
| PRD CodeAPI         | Chart and six application deployments pinned to d2382d66491b05f1e9000ad6756868a66ea47e1d                                                                                                                                                                    |
| GitOps              | helm-charts main 1bd3caf1c429527f38bd12db788799e2f20fc42b; CodeAPI and SeaweedFS Argo Applications Synced/Healthy in both environments                                                                                                                      |
| SeaweedFS           | Both environments run 4.37, source c06a2dca879cdbe742246d812431fbe2de01357b, image digest f898c91e42d7da5f4bb13f1efd424ff03ba85b420312eb929708a384e8a8b03d                                                                                                  |
| Runtime acceptance  | Historical STG core execution passed; historical artifact delivery failed. This investigation refreshed read-only state, not client execution acceptance. PRD has no observed storage failure in the inspected log window; this is not a fresh write proof. |

The separate STG `codeapi-api-klicker-test` deployment uses a different ACR
digest and must not be mistaken for acceptance of the shared CodeAPI service.
Both sandbox runners and pool wakers were at zero replicas during inspection.

The primary checkouts are stale, and the primary fork's .git is sandbox read-only.
Fresh isolated clones were used for authoritative source reads. This report is
in a durable task checkout at `trees/storage-reliability-investigation`, branch
`rs/storage-reliability-investigation`. No changes were pushed or merged.

## Storage failure and corrections to earlier feedback

| Observation                            | STG                       | PRD                           |
| -------------------------------------- | ------------------------- | ----------------------------- |
| Registered volumes / maximum           | 8 / 8                     | 8 / 8                         |
| Free allocation slots                  | 0                         | 0                             |
| Default collection writables           | 7                         | 7                             |
| codeapi-files writables                | 0                         | 1                             |
| trypost-media writables                | 1                         | Absent from inspected layouts |
| Actual /data allocation from du        | 960 KiB                   | 35,756 KiB                    |
| PVC                                    | 50Gi, StandardSSD_ZRS     | 50Gi, StandardSSD_ZRS         |
| file-server retryable S3 500 log lines | 27                        | 0                             |
| file-server /ready                     | HTTP 200, redis and s3 ok | HTTP 200, redis and s3 ok     |

Counts cover at most 12,000 current-pod log lines over the last 24 hours. STG
SeaweedFS includes 81 no-writable/no-free messages and 27 seven-volume growth
attempts. These are log-line counts, not counts of independent user requests.

The live layout and exact-version source establish the allocation problem.
The historical claim that a particular tenant "won first" is a plausible
explanation of that layout; retained logs do not establish the original order
of all writes. Repeated `create 7 volume` errors show failed growth attempts,
not seven successful allocations per error.

SeaweedFS volumes are logical data files inside one Kubernetes PVC. There are
not eight Azure disks. Sparse volumes consume space as data arrives. Each
collection/layout needs a writable volume. A new tenant that shares an existing
writable bucket does not necessarily need another collection; a new bucket or
layout does.

PRD is exposed when its collection needs replacement capacity. Proactive growth
starts near the default 90% crowded threshold, so waiting for an exact 30 GB
fill point is not a reliable operational trigger. Other causes of an unwritable
volume can trigger failure earlier.

Replication `000` means one SeaweedFS copy. It does not mean no durability:
the backing Azure ZRS disk provides storage redundancy. Both environments still
have one serving process and one local filer metadata store, so restart or
node movement interrupts service. ZRS does not provide application failover or
protect against logical deletion and corruption.

The master directory defaults to /data and the filer store to /data/filerldb2.
The filer directory exists on the mounted PVC in both environments. This
investigation did not find evidence of metadata being stored only in an
ephemeral container directory.

## Recommended allocation settings

Keep the deployed SeaweedFS image for the initial repair. For each environment,
change its own `seaweedfs/<env>/deployment.yaml`:

```text
-master.volumeSizeLimitMB=2048
-volume.max=0
-volume.minFreeSpace=5GiB
WEED_MASTER_VOLUME_GROWTH_COPY_1=1
```

The last setting is an environment variable. The exact deployed source reads
it through the WEED prefix and dot-to-underscore config mapping. Replication
000 has one copy, so copy_1 is the relevant growth setting. This changes the
allocation batch to one, without removing any existing volume.

Version 4.37 does more than divide free bytes by a size. It reserves the unused
capacity of existing writable volumes, adds existing volume slots, and
recalculates on volume heartbeats and size-limit changes. At current filesystem
capacity, 2048 MiB volumes imply approximately **24 total slots**, not a promise
of 25. Existing eight volumes remain and count toward that total.

Auto sizing alone with 30000 MiB volumes would reserve more capacity for the
existing eight volumes than the filesystem has. It would provide no useful
new slots. The paired size change matters. All currently reported volume sizes
are below 2 GiB; refresh this condition immediately before rollout.

The 5 GiB reserve is a proposed operational policy, not a source default or
proof of sufficient compaction capacity. The auto-max calculation does not
subtract this reserve. It is a separate low-space write protection, and can
make all volumes read-only. Alert before reaching it. Do not describe auto-max
as automatic PVC expansion, a per-tenant quota, or unlimited bucket capacity.

An explicit maximum of 64 would postpone slot starvation but still permit
logical capacity far above the physical disk. It is not the preferred lasting
fix. Do not delete or repurpose the default collection's near-empty volumes:
they contain internal data and some have nonzero file counts.

## Detection, retention, and recovery gaps

SeaweedFS probes test only the S3 TCP port. Its bucket bootstrap jobs only
list/check/create buckets. CodeAPI `/health` returns ok without storage access;
`/ready` pings Redis and calls bucketExists. These checks can pass throughout
this failure. The bucketExists boolean is also not checked in the current
handler, so a missing bucket can be misreported as healthy after initialization.

Use a separate bounded synthetic write/read/checksum/delete check for each
required bucket, with a dedicated synthetic prefix and restricted credentials.
Do not make dependency failure restart the storage pod or perform writes on
every liveness probe. Separate deployment acceptance from recurring detection.

SeaweedFS metricsPort is unset. No SeaweedFS/CodeAPI-specific ServiceMonitor,
PodMonitor, or PrometheusRule was found in either cluster. Existing external
monitoring was not exhaustively inspected. Add scraping through the existing
monitoring owner, and prove the alert delivery path. Version 4.37 exports
writable-layout, max-volumes, volume-count, disk-space, allocation-failure,
and disk-error metrics. Alert on missing expected series as well as zero.

Candidate thresholds for validation: free slots below 4; expected collection
writables below 1; any sustained allocation failure; disk free below 10 GiB
warning and 7 GiB critical; failed storage canary; failed artifact delivery.
Aggregate slot counts correctly across volume types and instances. Validate
rules against actual scraped series, including missing-metric behavior.

The Redis session cache TTL does not remove S3 objects. No object expiration
policy is defined in these manifests. Bucket-specific runtime lifecycle rules
and application deletion behavior need verification before claiming bounded
growth. Do not introduce blanket retention: generated CodeAPI artifacts and
Trypost media may have different retention contracts.

There are no SeaweedFS namespace VolumeSnapshots or backup CronJobs in the
inspected clusters, and no backup/restore definition in the SeaweedFS manifests.
An external Azure backup may exist; it was not verified. Both live PVs and
StorageClasses use reclaimPolicy Delete. Both Argo Applications enable automatic
pruning and self-healing; neither PVC carries a prune/delete protection annotation.
Establish a consistent backup of object volumes and filer metadata, plus an
isolated restore proof, before treating storage rollback as safe. Any backup
activation, retention change, or storage ownership change needs explicit scope.

## Upstream integration assessment

v1.3.1 adds two commits over v1.2.0: repository-specific GitHub App credential
routing and authenticated bot-identity lookup. Ten changed files are confined
to packages/code and its documentation/tests. The hosted API, service,
file-server, SeaweedFS configuration, and Helm chart have no upstream changes
in that release range. Therefore this release does not fix storage starvation.

`git merge-tree --write-tree origin/main v1.3.1` succeeded without conflicts,
producing tree 4f57a969e2e7c4ef438b50483158cdceac2315ee. This is structural merge
evidence only; no merge commit, integrated tests, or deployment occurred.

The fork is 50 commits ahead and two behind v1.3.1. Preserve upstream history
with a merge commit, keep justified fork patches, keep the Release workflow
disabled, and deploy the resulting fork SHA through GitOps. Do not create fork
stable tags. STG also predates the already-merged public-contract follow-up on
fork main, so source completion must not be called deployment completion.

## Proposed recovery and acceptance sequence

This sequence is a remediation proposal, not authorization to mutate clusters
or merge repositories. Shared storage changes are cluster-level changes.

1. Prepare a STG-only allocation change and focused readiness regression fix.
   Establish backup/restore evidence and rollback constraints. Validate the
   rendered manifests and the exact SeaweedFS image locally, including multiple
   collections, preserved objects, process restart, and exhaustion/recovery.
2. Merge and reconcile only the STG storage path after named authorization.
   Capture live topology and effective settings. Prove S3 upload/read/checksum
   and existing-data continuity, then the authenticated CodeAPI path: input
   upload, execution, nonempty artifacts with successful artifact_delivery,
   download integrity, and reuse as input. Validate Trypost's storage path too.
3. Add and verify early capacity and semantic-failure detection. Establish
   documented retention/capacity ownership and backup recovery. A green TCP
   probe, HTTP 200 execution, or Argo health alone cannot pass this gate.
4. Integrate pinned upstream v1.3.1 into the fork using a merge commit. Run
   repository-native CI and fork-contract checks; verify all deployment image
   artifacts. Promote the resulting chart and image SHA together to STG.
   Test through each intended consumer, not only direct API calls. Exercise a
   cold start from zero and a warm call; verify client timeout, 300-second job
   timeout, 360-second manifest TTL, cancellation, and retry semantics. A warm
   retry after a failed cold request is not transparent cold-start acceptance.
5. Promote storage protection to PRD as a separate change after STG acceptance,
   with a verified recovery point and bounded synthetic PRD smoke. Only then
   promote the tested CodeAPI SHA and repeat the synthetic consumer acceptance.
   Record source, CI, GitOps desired state, actual pod digests, storage health,
   and application acceptance separately.

Both SeaweedFS environments track helm-charts main. A single merge changing
both paths could auto-deploy both environments. Use separate STG and PRD
commits/MRs with the PRD merge conditional on STG acceptance. CodeAPI chart
revision and image tags span df-cloud and helm-charts, so coordinate those pins.

Rollback must preserve all newly written objects and metadata. Once more than
eight volumes exist, reverting to max=8 recreates starvation. Reverting the
volume size to 30000 with auto-max can also remove growth headroom. Keep proven
storage-capacity settings while rolling back a CodeAPI image. Never delete
newly allocated volumes to make the old configuration fit. A data restore is
a separate, potentially destructive operation, not an ordinary source revert.

Terminal acceptance requires successful storage and consumer checks in both
environments, tested detection, and a verified recovery procedure. High
availability is a separate architecture decision: the present single-process
design necessarily interrupts requests on restart. Do not simply raise its
replica count against one RWO PVC and embedded LevelDB store.

## Evidence sources and limitations

-   Live Kubernetes reads: deployments, pod readiness, PVCs, StorageClasses,
    Argo sources/status, storage topology and volume statistics, bounded log
    counts, and file-server `/ready`. No secret values or stored user objects read.
-   Fresh fork, helm-charts, and df-cloud remote clones; host gh release/PR/CI
    queries. No broad security audit was performed.
-   [Exact deployed auto-size implementation](https://github.com/seaweedfs/seaweedfs/blob/c06a2dca879cdbe742246d812431fbe2de01357b/weed/storage/store.go#L879)
    and [growth defaults](https://github.com/seaweedfs/seaweedfs/blob/c06a2dca879cdbe742246d812431fbe2de01357b/weed/topology/volume_growth.go#L42).
-   [SeaweedFS production guidance](https://github.com/seaweedfs/seaweedfs/wiki/Production-Setup)
    supports smaller volumes with auto sizing on small disks.
-   [Azure disk redundancy](https://learn.microsoft.com/en-us/azure/virtual-machines/disks-redundancy)
    distinguishes ZRS durability from application availability.
-   [Upstream v1.3.1](https://github.com/LibreChat-AI/code-interpreter/releases/tag/v1.3.1).

External Context7 lookup was not used because its skill requires execution
outside the sandbox and this session prohibits escalation. Exact deployed
source and official web documentation supplied the version-specific evidence.
The configured Claude advisor failed with an expired OAuth token; this is not
an independent review pass. A generic-continuity planner invocation using
gpt-5.6-sol at xhigh also failed before review: the CLI could not initialize its
in-process app-server client (Operation not permitted). No native subagent
surface was available. Formal execution-plan review remains pending; the
proposal above is not a reviewed deployment plan.

## Local exact-image experiment receipt

The Docker experiment used the deployed image digest, synthetic objects only,
loopback-published ports, a dedicated local data directory, and no cluster
credentials. Both configurations used the same data directory. All experiment
containers are stopped; their synthetic data and logs remain for inspection.

| Check                 | Result                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------- |
| Default allocation    | Seven default-collection volumes plus one trypost-media volume; max 8, free 0           |
| Starved bucket        | codeapi-files object PUT returned HTTP 500, zero writable volumes                       |
| Proposed settings     | Same image and data, auto max plus 2048 MiB size, copy_1=1, 5 GiB low-space guard       |
| Recovery              | codeapi-files PUT and exact-content GET passed; precisely one writable volume allocated |
| Existing object       | Pre-change trypost-media object content survived configuration change                   |
| Process stop/start    | Both earlier synthetic objects remained readable with matching content                  |
| Writes after restart  | New object PUT and GET passed                                                           |
| Additional collection | New bucket PUT/GET passed, one writable volume allocated                                |

Initial harness attempts exposed asynchronous startup and first-growth 503s.
The restart harness initially reused a dynamically published Docker port that
had changed; resolving the current port fixed that harness error. These failed
attempts are not storage regressions or passing receipts. The final restart
check read both old objects, wrote a new one, and allocated another collection.

The local bind-mounted filesystem reports much larger capacity than AKS and
therefore produced a much larger automatic maximum. This experiment proves
allocation behavior, existing-data continuity, and process restart recovery;
it does not empirically establish a 24-slot maximum on a 50Gi disk. The estimate
of 24 uses live AKS byte counts and the exact deployed calculation. It does not
prove low-disk cutoff, compaction, PVC expansion, disk detach/attach, ZRS
recovery, production performance, abrupt-crash recovery, or the CodeAPI client
contract. Those remain explicit staged acceptance obligations.

Local reproducer/evidence at investigation completion:
`/tmp/seaweed-allocation-check.py`,
`/tmp/seaweed-allocation-check-results.json`,
`/tmp/seaweed-restart-check.py`, and
`/tmp/seaweed-restart-check-results.json`.

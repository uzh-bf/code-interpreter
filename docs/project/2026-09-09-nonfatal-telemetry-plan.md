# Keep Code Interpreter telemetry outside domain failures

## Approval and outcome

Continue W2 of the already approved optional-telemetry roadmap. Contain optional SDK setup,
propagation, span callbacks and request instrumentation failures without changing domain results,
error identity, invocation count, healthy trace propagation, privacy or shutdown behavior.
Source fixes, synthetic tests, reviews, ordinary fork-branch push and draft PR are authorized.
No merge, release, deployment, dependency, shutdown expansion, inference or gitlink change.

Repository: maintained `uzh-bf/code-interpreter` fork, remote `uzh`, target `main` at
`d2382d66491b05f1e9000ad6756868a66ea47e1d`. Branch `rs/nonfatal-telemetry`, worktree
`upstream/trees/rs/nonfatal-telemetry`. The `origin` remote is not the delivery target.
PR 21 owns disjoint OpenAPI/replay/worker paths. Parent retains integration and external effects.
Full-path package; terminal is reviewed source with passing checks and a draft PR.

## One implementation slice

Route: main. Execution-tier skip reason: unhealthy route. `ocx ready --json` reports
`ready:false,status:failed`; liveness is healthy. Native planner completed successfully, which
proves only that planner operation. No service mutation or executor dispatch is assumed.

Write only `shared/telemetry-core.ts`, `shared/telemetry-test-suite.ts`,
`api/src/telemetry.test.ts`, `service/src/telemetry.test.ts` plus this plan. Guard SDK preparation
before invoking domain callbacks. Never retry domain work. Failed extraction uses ROOT_CONTEXT;
failed injection discards partially written carrier fields but preserves caller headers.
Initialize once, preserve available propagation after exporter failure, and enable spans only
after complete setup. Span facade operations are individually nonthrowing; error status wins
and end is attempted at most once. Middleware calls next once, preserving its thrown value.
Protect only instrumentation around emitter binding and completion hooks, never application
listener execution. Preserve existing shutdown rejection, timeout and shared-promise semantics.
Do not add a reset API or telemetry factory for tests. A partial-resource ownership issue that
requires shutdown changes returns to the parent before that expansion.

## Acceptance and review

Use synthetic configured SDK dependencies in isolated Bun processes for initialization state.
Prove setup and propagation failure isolation, result and error identity, partial injection
removal, middleware next exactly once and callback/end failures. Retain healthy privacy and
stream-context tests in both package entrypoints. No real exporter or application needed.
Run pinned Bun 1.3.14 tests for api/src/telemetry.test.ts and service/src/telemetry.test.ts,
then applicable package builds/tests and CI. Preserve lockfiles. Required simplifier, risk review
and integrated final review precede completed source delivery. No browser-only contract changes.

## Planning disposition

Native planner Tesla returned DONE_WITH_CONCERNS on the complete finite scope. Main accepts
ROOT_CONTEXT fallback, one-shot degradation, per-operation facade guards and isolated synthetic
fault tests. Shutdown contract remains unchanged; broad new shutdown testing is deferred unless
changed code crosses it. Existing healthy tests remain. This is a correction to existing internal
instrumentation, with no new product primitive, trust boundary or forward-looking ADR decision.

## Progress

Ownership and target confirmed; source unchanged. Dependencies absent in this new worktree.

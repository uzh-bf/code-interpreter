# Klicker chatbot CodeAPI prototype findings

## Decision

A small native Python tool fits the current chat tool composition. Keep it disabled by default and limited to explicitly selected Tutor chatbots. Preserve the existing calculator for arithmetic; use Python for procedures, statistics and small simulations. Start with text results only.

Claude advised reusing `withCalculatorTool` in `apps/chat/src/lib/server/calculatorTool.ts` and the existing chat route composition. The older text-tracer plan predates that calculator. Its assumption that no native tool precedent exists is stale. The current repository target is `v3`; the older tracer's `v3-ai` target does not select the base for a new implementation.

## Existing work

- [PR #5142](https://github.com/uzh-bf/klicker-uzh/pull/5142) plans CODE questions and asynchronous grading. It is distinct from the chatbot tool and supplies no completed chat integration.
- [PR #5676](https://github.com/uzh-bf/klicker-uzh/pull/5676) addresses authoritative conversation history. Preserve its route/history ownership; it is not a CodeAPI tool implementation.
- Existing local roadmap: `trees/chat-codeapi-roadmap/project/2026-08-23-klicker-chat-codeapi-roadmap.md`.
- Existing local client proposal: `trees/codeapi-client-foundation/project/2026-08-30-codeapi-client-foundation-plan.md`.
- Existing local text tracer: `trees/rs/chat-codeapi-text-tracer/project/2026-09-05-chat-codeapi-text-tracer-plan.md`.

The scoped current source and PR inventory found no implemented chatbot CodeAPI adapter or matching open PR. Reconcile the existing plans rather than creating a competing feature roadmap. Do not import the CODE grading architecture into chat.

## Experiment

Question: can an AI SDK tool composed beside the calculator reserve one call, sign server-owned claims and consume bounded CodeAPI results?

Runnable artifact: `/private/tmp/klicker-codeapi-prototype/README.md`. Its command uses a disposable Node 24.22.1 container, pnpm 11.5.0 and current Klicker AI SDK 7.0.52, jose 5.9.4 and Zod 3.25.76. Dependencies are existing read-only mounts and the test container has no network. The five prototype files remain outside both application repositories.

Observation: all thirty-six synthetic checks passed, with no failures or skips. They invoke the actual SDK `tool.execute` callback against a loopback HTTP fake. Coverage includes default-off/non-Tutor/unallowlisted denial without transport, synchronous one-call reservation under concurrent callbacks, generated in-memory Ed25519 signing, issuer/audience/key/source/expiry checks, result validation, HTTP errors, malformed/oversized responses, bounded UTF-8 output, timeout and caller abort.

An independent rerun exposed a flaky signature negative control: changing unused base64url padding bits can preserve the decoded bytes. The correction flips a decoded signature byte. The corrected full suite passes; a focused check across sixteen generated keys rejected all 2048 byte mutations. The verifier behavior is unchanged.

A complete AI SDK `generateText` turn is also verified with the installed `MockLanguageModelV4`: the first step requests the Python tool, the next consumes its actual typed result and derives the final answer. It makes one fake HTTP request and completes in two steps under the existing five-step cap, with retries disabled. This adds no dependency or real model call.

The fake uses the fork's flat public `/v1/exec` response; the old nested sandbox `run` shape is rejected. It binds the proposed `external:klicker` source to a synthetic issuer trust entry rather than impersonating LibreChat. The model supplies code only. The server owns identity, endpoint, key and execution policy.

Conclusion: the local callback/transport seam is feasible. The experiment returns canned output and executes no Python. It does not prove real model choice, the complete chat route, history persistence, browser behavior, deployed trust/network reachability, guest timeout or guest reaping. An aborted fake HTTP response proves transport cancellation only. No production activation or deployment trust entry was created.

## Smallest next implementation

Extend the existing tracer plan against current `v3`. Add one app-local `codeapiTool.ts` and one focused adapter test, then compose it beside the calculator after existing chat access/conversation admission. Keep one invocation per admitted turn, the current five-step budget, existing generic tool rendering and conversation/usage ownership. No new shared package, Prisma capability field, GraphQL surface or dedicated UI is required for an initial pilot.

The production adapter must add an explicit short guest timeout and `X-CodeAPI-Expected-Profile: default`, retain request AbortSignal and a separate bounded transport deadline, distinguish Python errors from service failure, and safely bound/redact persisted output. Model-provided identity, endpoint, files, runtime and credentials remain forbidden. A caller timeout alone does not prove guest termination.

Before a real staging pilot, separately qualify the dedicated Klicker issuer/JWK trust entry, exact secret injection and network policy through their existing owners. Then test the actual route with a deterministic model, provider tool selection, browser Stop/reload and real CodeAPI execution. Preserve disabled defaults until those checks and the release gates pass. Package installation, arbitrary egress, persistent notebooks, uploaded files, plots and lecturer management remain later decisions.

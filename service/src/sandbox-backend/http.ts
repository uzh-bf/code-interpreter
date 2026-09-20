import axios, { type AxiosError, type CanceledError } from 'axios';
import type { SandboxBackend, SandboxExecuteContext, SandboxRawResponse, SandboxTransportRequest } from './types';
import { injectTraceHeaders, withSpan } from '../telemetry';
import { Jobs } from '../enum';
import { env } from '../config';

const REFUSAL_RETRY_BACKOFF_MS = 500;

/** Axios cancellation; the worker maps ERR_CANCELED onto its abort path. */
const cancellation = (): CanceledError<unknown> => new axios.CanceledError('Sandbox execute cancelled');

/** A refused connection means the sandbox never received the request, so it is
 *  the only failure that may be retried. Failures after a response, resets,
 *  timeouts, cancellations and ambiguous failures stay untouched. */
function refusedBeforeConnection(error: unknown): error is AxiosError {
  return axios.isAxiosError(error) && error.code === 'ECONNREFUSED' && error.response === undefined;
}

/** Fixed backoff, capped by the remaining deadline. */
function pauseBeforeRetry(signal: AbortSignal, deadlineAtMs: number): Promise<void> {
  if (signal.aborted) return Promise.reject(cancellation());
  const remainingMs = Math.min(REFUSAL_RETRY_BACKOFF_MS, deadlineAtMs - Date.now());
  if (remainingMs <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, remainingMs);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(cancellation());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** POST the signed request to SANDBOX_ENDPOINT and rethrow Axios errors
 *  untouched so the worker's existing abort/timeout/sandbox-error mapping
 *  stays byte-identical.
 *
 *  A POST the sandbox refused before receiving it is retried until one
 *  attempt succeeds or the call's absolute deadline ends it, resending the
 *  same signed bytes. Redirects stay disabled, otherwise a 3xx could replay
 *  the accepted POST against a redirect target. */
export class HttpSandboxBackend implements SandboxBackend {
  readonly name = 'http' as const;

  async execute(req: SandboxTransportRequest, ctx: SandboxExecuteContext): Promise<SandboxRawResponse> {
    const deadlineAtMs = this.resolveDeadlineAtMs(ctx.deadlineAtMs);
    /* One request-local controller bounds every attempt: it follows the
     * caller's signal and the absolute deadline. */
    const cancel = new AbortController();
    const onCallerAbort = (): void => cancel.abort();
    ctx.signal.addEventListener('abort', onCallerAbort, { once: true });
    const deadlineTimer = setTimeout(
      () => cancel.abort(cancellation()),
      Math.max(0, deadlineAtMs - Date.now()),
    );

    try {
      const response = await withSpan('codeapi.sandbox.execute', {
        'http.request.method': 'POST',
        'url.path': `/${Jobs.execute}`,
        'codeapi.language': ctx.language,
        'codeapi.sandbox.backend': this.name,
      }, async () => {
        for (;;) {
          if (ctx.signal.aborted || cancel.signal.aborted || Date.now() >= deadlineAtMs) {
            throw cancellation();
          }
          try {
            return await axios.post<SandboxRawResponse>(
              `${env.SANDBOX_ENDPOINT}/${Jobs.execute}`,
              req.body,
              {
                headers: injectTraceHeaders(req.headers),
                signal: cancel.signal,
                /* A redirected accepted POST must not be replayed. */
                maxRedirects: 0,
              }
            );
          } catch (error) {
            if (!refusedBeforeConnection(error)) throw error;
            await pauseBeforeRetry(cancel.signal, deadlineAtMs);
          }
        }
      }, 'CLIENT');

      if (response.status !== 200) {
        throw new Error('Error from sandbox');
      }

      return response.data;
    } finally {
      clearTimeout(deadlineTimer);
      ctx.signal.removeEventListener('abort', onCallerAbort);
    }
  }

  /** The one absolute deadline for this call: the worker-supplied deadline
   *  when present, otherwise entry time plus JOB_TIMEOUT. An unusable deadline
   *  rejects before anything is dispatched instead of becoming a longer
   *  budget. */
  private resolveDeadlineAtMs(suppliedDeadlineAtMs?: number): number {
    if (suppliedDeadlineAtMs !== undefined) {
      if (!Number.isFinite(suppliedDeadlineAtMs) || suppliedDeadlineAtMs <= 0) {
        throw new Error('Sandbox execute deadline is invalid');
      }
      return suppliedDeadlineAtMs;
    }
    if (!Number.isFinite(env.JOB_TIMEOUT) || env.JOB_TIMEOUT <= 0) {
      throw new Error('Sandbox execute deadline is invalid');
    }
    return Date.now() + env.JOB_TIMEOUT;
  }
}

export function operationalErrorClass(error: unknown): string {
  const value = error as { name?: unknown; code?: unknown; message?: unknown } | null;
  const name = typeof value?.name === 'string' ? value.name : '';
  switch (name) {
    case 'AbortError':
      return 'aborted';
    case 'ExecutionManifestError':
      return 'manifest';
    case 'SessionCheckpointError':
      return 'checkpoint';
    case 'SessionWorkspaceBindingError':
    case 'SessionWorkspaceDirtyError':
      return 'session_workspace';
    case 'SyntaxError':
    case 'TypeError':
    case 'ValidationError':
      return 'invalid_state';
  }

  switch (value?.code) {
    case 'ABORT_ERR':
      return 'aborted';
    case 'EACCES':
    case 'EPERM':
      return 'permission';
    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'ENETUNREACH':
    case 'ENOTFOUND':
    case 'EPIPE':
      return 'dependency';
    case 'ENOSPC':
      return 'capacity';
    case 'ETIMEDOUT':
      return 'timeout';
  }

  const message = typeof value?.message === 'string' ? value.message.toLowerCase() : '';
  if (message.includes('timed out') || message.includes('timeout')) return 'timeout';
  if (message.includes('abort')) return 'aborted';
  return 'unexpected';
}

export function operationalErrorMeta(error: unknown): { errorClass: string } {
  return { errorClass: operationalErrorClass(error) };
}

const GENERIC_MESSAGES = new Set(['internal', 'INTERNAL', 'unavailable', 'not-found', 'deadline-exceeded', '']);

const CODE_HELP = {
  internal: {
    title: 'Store setup could not finish',
    message: 'The setup service did not respond correctly. This usually means the ensureStore Cloud Function is not deployed in asia-south1, or it crashed before reporting a reason. Your existing records have not been changed.',
  },
  'not-found': {
    title: 'Setup service not found',
    message: 'The ensureStore Cloud Function is not deployed to the asia-south1 region. Deploy Firebase Functions, then press Retry setup.',
  },
  unavailable: {
    title: 'Setup service is busy',
    message: 'The server or your connection was temporarily unavailable. Your data is safe. Press Retry setup to continue.',
  },
  'deadline-exceeded': {
    title: 'Setup took too long',
    message: 'Copying your records took longer than expected. Progress is saved, so press Retry setup to resume where it stopped.',
  },
  'permission-denied': {
    title: 'Store access denied',
    message: 'Your account is not allowed to open this store. Ask the store owner to check your role.',
  },
  unauthenticated: {
    title: 'Please sign in again',
    message: 'Your session expired. Sign out and sign back in to continue.',
  },
  'failed-precondition': {
    title: 'Store is not ready yet',
    message: 'Store setup is not complete yet. Press Retry setup.',
  },
  'invalid-argument': {
    title: 'Invitation could not be used',
    message: 'The invitation code is not valid. Ask the owner for a new one.',
  },
};

const RETRYABLE = new Set(['internal', 'not-found', 'unavailable', 'deadline-exceeded', 'failed-precondition', 'aborted', 'unknown']);

export function describeSetupError(error) {
  const code = String(error?.code || 'internal').replace(/^functions\//, '');
  const details = error?.details && typeof error.details === 'object' ? error.details : {};
  const help = CODE_HELP[code] || CODE_HELP.internal;
  const serverMessage = String(error?.message || '').trim();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const technical = [
    `code: ${code}`,
    details.stage && `stage: ${details.stage}`,
    details.collection && `collection: ${details.collection}`,
    details.reason && `reason: ${details.reason}`,
  ].filter(Boolean).join(' · ');

  const reason = String(details.reason || '').trim();
  const readableReason = reason && reason !== serverMessage ? `${serverMessage && !GENERIC_MESSAGES.has(serverMessage) ? `${serverMessage} ` : ''}Reason: ${reason}` : '';

  return {
    code,
    title: offline ? 'You are offline' : help.title,
    message: offline
      ? 'Reconnect to the internet, then press Retry setup. Nothing was changed.'
      : readableReason || (GENERIC_MESSAGES.has(serverMessage) || !serverMessage ? help.message : serverMessage),
    technical,
    retryable: offline || (typeof details.retryable === 'boolean' ? details.retryable : RETRYABLE.has(code)),
    autoRetry: code === 'unavailable' || code === 'deadline-exceeded' || code === 'aborted',
  };
}

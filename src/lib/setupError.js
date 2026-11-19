const HELP_BY_CODE = {
  'permission-denied': {
    title: 'Store access unavailable',
    message: 'Your account does not have permission to open this store. Ask the store owner to check your membership.',
  },
  unauthenticated: {
    title: 'Please sign in again',
    message: 'Your session could not be verified. Sign out and sign back in to continue.',
  },
  'invalid-argument': {
    title: 'Invitation could not be used',
    message: 'The invitation code is not valid. Ask the owner for a new one.',
  },
  'failed-precondition': {
    title: 'Store is not ready yet',
    message: 'Your store data is still being prepared. Retry to continue.',
  },
};

const RETRYABLE = new Set(['internal', 'not-found', 'unavailable', 'deadline-exceeded', 'failed-precondition', 'aborted', 'unknown']);

export function describeSetupError(error) {
  const code = String(error?.code || 'unknown').replace(/^functions\//, '');
  const help = HELP_BY_CODE[code] || {
    title: 'Store data is temporarily unavailable',
    message: 'The app could not finish connecting to your store data. Check your connection and Firestore access, then retry. Your existing records were not changed.',
  };
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  return {
    code,
    title: offline ? 'You are offline' : help.title,
    message: offline
      ? 'Reconnect to the internet, then retry. Your existing records were not changed.'
      : help.message,
    technical: '',
    retryable: offline || RETRYABLE.has(code),
    autoRetry: code === 'unavailable' || code === 'deadline-exceeded' || code === 'aborted',
  };
}

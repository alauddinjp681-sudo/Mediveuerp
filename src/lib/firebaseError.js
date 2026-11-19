const FRIENDLY_MESSAGES = {
  'permission-denied': 'You do not have permission to complete this action. Ask the store owner to review your access.',
  unavailable: 'The service is temporarily unavailable. Check your connection and try again.',
  'deadline-exceeded': 'The request took too long. Check your connection and retry.',
  'not-found': 'The requested record could not be found. Refresh and try again.',
  'network-request-failed': 'No internet connection. Reconnect and try again.',
  'failed-precondition': 'This action is not available for the account or record yet. Refresh and try again.',
  unauthenticated: 'Your session has expired. Sign in again to continue.',
  internal: 'The service could not complete this request. Try again, and contact support if it continues.',
};

export function readableFirebaseError(error, fallback = 'The action could not be completed. Please try again.') {
  const code = String(error?.code || '').replace(/^(firestore|functions|auth)\//, '');
  const message = String(error?.message || '').replace(/^Firebase:\s*/i, '').trim();
  const genericPermission = /missing or insufficient permissions|error \((?:firestore\/|functions\/)?permission-denied\)/i.test(message);
  const genericFirebaseFailure = /^error \((?:firestore\/|functions\/|auth\/)[^)]+\)\.?$/i.test(message);

  if (genericPermission) return FRIENDLY_MESSAGES['permission-denied'];
  if (genericFirebaseFailure) return FRIENDLY_MESSAGES[code] || fallback;
  if (message) return message;
  return FRIENDLY_MESSAGES[code] || fallback;
}

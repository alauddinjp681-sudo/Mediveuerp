import { Capacitor } from '@capacitor/core';

const nativeApiOrigin = (import.meta.env?.VITE_API_BASE_URL || 'https://v0-mediveuerp.vercel.app').replace(/\/+$/, '');

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return Capacitor.isNativePlatform() ? `${nativeApiOrigin}${normalizedPath}` : normalizedPath;
}

export async function parseApiResponse(response, invalidResponseMessage) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(invalidResponseMessage);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(invalidResponseMessage);
  }
}

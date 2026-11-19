const fallbackValues = new Map();
const persistentFallbackValues = new Map();

export const persistentStore = {
  getItem(key) {
    try {
      const value = window.localStorage.getItem(key);
      if (value !== null) persistentFallbackValues.set(key, value);
      return value ?? persistentFallbackValues.get(key) ?? null;
    } catch {
      return persistentFallbackValues.get(key) ?? null;
    }
  },
  setItem(key, value) {
    const normalizedValue = String(value);
    persistentFallbackValues.set(key, normalizedValue);
    try {
      window.localStorage.setItem(key, normalizedValue);
    } catch {
      return undefined;
    }
    return undefined;
  },
  removeItem(key) {
    persistentFallbackValues.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      return undefined;
    }
    return undefined;
  },
};

export const sessionStore = {
  getItem(key) {
    try {
      const value = window.sessionStorage.getItem(key);
      if (value !== null) fallbackValues.set(key, value);
      return value ?? fallbackValues.get(key) ?? null;
    } catch {
      return fallbackValues.get(key) ?? null;
    }
  },
  setItem(key, value) {
    const normalizedValue = String(value);
    fallbackValues.set(key, normalizedValue);
    try {
      window.sessionStorage.setItem(key, normalizedValue);
    } catch {
      return undefined;
    }
    return undefined;
  },
  removeItem(key) {
    fallbackValues.delete(key);
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      return undefined;
    }
    return undefined;
  },
};

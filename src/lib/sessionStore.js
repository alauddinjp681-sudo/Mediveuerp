const fallbackValues = new Map();

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

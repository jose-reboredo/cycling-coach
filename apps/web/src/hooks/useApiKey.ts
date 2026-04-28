import { useState, useCallback } from 'react';
import { storage, KEYS } from '../lib/storage';

export function useApiKey() {
  const [key, setKey] = useState<string | null>(() => storage.get<string>(KEYS.apiKey));

  const save = useCallback((value: string) => {
    const v = value.trim();
    if (!v) return;
    storage.set(KEYS.apiKey, v);
    setKey(v);
  }, []);

  const clear = useCallback(() => {
    storage.del(KEYS.apiKey);
    setKey(null);
  }, []);

  return { key, save, clear };
}

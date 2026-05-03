// apps/web/src/hooks/usePassphrase.ts
//
// Sprint 13 / v11.1.0 — React hook for passphrase-derived master key.
//
// Holds the master key in module-scoped state (so any component that
// uses this hook in the same tree shares the same unlock state).
// The master key is *not* persisted — page reload = re-enter passphrase.
import { useCallback, useEffect, useState } from 'react';
import {
  deriveMasterKey,
  encryptKey,
  decryptKey,
  buildAAD,
} from '../lib/credentials';

let _masterKey: CryptoKey | null = null;
const _listeners = new Set<() => void>();

function notify() {
  for (const fn of _listeners) fn();
}

export function usePassphrase() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  }, []);

  const unlock = useCallback(
    async (passphrase: string, salt: Uint8Array, iterations: number) => {
      _masterKey = await deriveMasterKey(passphrase, salt, iterations);
      notify();
    },
    [],
  );

  const lock = useCallback(() => {
    _masterKey = null;
    notify();
  }, []);

  const encrypt = useCallback(
    async (plaintext: string, athleteId: number, provider: string) => {
      if (!_masterKey) throw new Error('locked');
      const aad = buildAAD(athleteId, provider);
      return encryptKey(_masterKey, plaintext, aad);
    },
    [],
  );

  const decrypt = useCallback(
    async (
      ciphertext: ArrayBuffer,
      iv: Uint8Array,
      athleteId: number,
      provider: string,
    ) => {
      if (!_masterKey) throw new Error('locked');
      const aad = buildAAD(athleteId, provider);
      return decryptKey(_masterKey, ciphertext, iv, aad);
    },
    [],
  );

  return {
    unlocked: _masterKey !== null,
    unlock,
    lock,
    encrypt,
    decrypt,
  };
}

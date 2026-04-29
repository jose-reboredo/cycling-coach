// AppContext — global "what scope is the user looking at" state. Persisted in
// localStorage under cc_activeContext so a refresh keeps the user in the
// context they were last in. Default = individual mode.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type AppMode = 'individual' | 'club';

export interface AppScope {
  mode: AppMode;
  clubId: number | null;
  clubName: string | null;
  role: string | null;
}

interface AppContextValue {
  scope: AppScope;
  setIndividual: () => void;
  setClub: (club: { id: number; name: string; role: string }) => void;
}

const STORAGE_KEY = 'cc_activeContext';
const DEFAULT_SCOPE: AppScope = { mode: 'individual', clubId: null, clubName: null, role: null };

function readPersisted(): AppScope {
  if (typeof window === 'undefined') return DEFAULT_SCOPE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCOPE;
    const parsed = JSON.parse(raw);
    if (parsed?.mode !== 'individual' && parsed?.mode !== 'club') return DEFAULT_SCOPE;
    if (parsed.mode === 'club' && (typeof parsed.clubId !== 'number' || !parsed.clubName)) {
      return DEFAULT_SCOPE;
    }
    return {
      mode: parsed.mode,
      clubId: parsed.clubId ?? null,
      clubName: parsed.clubName ?? null,
      role: parsed.role ?? null,
    };
  } catch {
    return DEFAULT_SCOPE;
  }
}

function persist(scope: AppScope) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scope));
  } catch {
    /* swallow — quota / private mode */
  }
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<AppScope>(readPersisted);

  const setIndividual = useCallback(() => {
    setScope(DEFAULT_SCOPE);
    persist(DEFAULT_SCOPE);
  }, []);

  const setClub = useCallback((club: { id: number; name: string; role: string }) => {
    const next: AppScope = {
      mode: 'club',
      clubId: club.id,
      clubName: club.name,
      role: club.role,
    };
    setScope(next);
    persist(next);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({ scope, setIndividual, setClub }),
    [scope, setIndividual, setClub],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppContextProvider');
  return ctx;
}

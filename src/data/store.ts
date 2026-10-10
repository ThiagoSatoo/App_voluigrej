import { useSyncExternalStore } from "react";
import { createSeed, seedBirthDate } from "./mock-data";
import { migrateScheduleTimes } from "./migrate";
import type { AppState } from "./types";

/**
 * Local mock persistence (localStorage). Only the repository writes here.
 * When a real database is connected, replace repository.ts internals —
 * screens keep using the same hooks and actions.
 */
const KEY = "escala-voluntarios-v1";

let state: AppState = createSeed();
let hydrated = false;
let snapshot = { state, hydrated };
const serverSnapshot = { state: createSeed(), hydrated: false };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { state, hydrated };
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function setState(fn: (s: AppState) => AppState) {
  state = fn(state);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota (e.g. large photos) — keep in memory */
    }
  }
  emit();
}

export function hydrateStore() {
  if (hydrated) return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = migrateScheduleTimes({ ...createSeed(), ...JSON.parse(raw) });
      // Older local data: add birth dates, notification type/recipient and staff session ids.
      state = {
        ...saved,
        volunteers: saved.volunteers.map((v) => (v.birthDate ? v : { ...v, birthDate: seedBirthDate(v.id) })),
        notifications: saved.notifications.map((n) => ({ ...n, type: n.type ?? "candidatura_cancelada", recipientId: n.recipientId ?? "s1" })),
        session: saved.session?.role === "supervisor" && saved.session.userId === "supervisor" ? { ...saved.session, userId: "s1" } : saved.session,
      };
      localStorage.setItem(KEY, JSON.stringify(state));
    }
  } catch {
    /* ignore */
  }
  hydrated = true;
  emit();
}

export function resetStore() {
  const session = state.session;
  state = { ...createSeed(), session };
  localStorage.removeItem(KEY);
  setState((s) => s);
}

export function useStore() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => serverSnapshot,
  );
}

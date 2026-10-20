import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { loadState } from "./loader";
import type { AppState } from "./types";

/**
 * Cache em memória dos dados que o usuário logado pode ver.
 * Nada de dado pessoal fica salvo no aparelho: a fonte da verdade é o Supabase
 * (com RLS), e o cache é recarregado após cada alteração.
 */
export const emptyState = (): AppState => ({
  volunteers: [],
  periods: [],
  availabilities: [],
  draws: [],
  attendance: [],
  substitutions: [],
  session: null,
  settings: { churchName: "", visibilityPolicy: "privado" },
  opportunities: [],
  dayAvailability: [],
  applications: [],
  notifications: [],
  supervisors: [],
  notifPrefs: {},
  oppCounts: {},
  navConfig: {},
  fixedSchedules: [],
  fixedMembers: [],
  fixedExceptions: [],
});

let state: AppState = emptyState();
let hydrated = false;
let snapshot = { state, hydrated };
const serverSnapshot = { state: emptyState(), hydrated: false };
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
  emit();
}

let inflight: Promise<void> | null = null;
let queued = false;

/** Recarrega tudo do servidor (pedidos simultâneos são agrupados). */
export async function refresh(): Promise<void> {
  if (inflight) {
    queued = true;
    return inflight;
  }
  inflight = (async () => {
    try {
      do {
        queued = false;
        state = await loadState();
      } while (queued);
    } catch (e) {
      console.error("Falha ao carregar dados", e);
    } finally {
      hydrated = true;
      inflight = null;
      emit();
    }
  })();
  return inflight;
}

let started = false;

/** Liga o app à sessão do Supabase. Chamado uma vez na raiz. */
export function hydrateStore() {
  if (started) return;
  started = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      state = emptyState();
      hydrated = true;
      emit();
    } else if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
      // Evita chamar o Supabase dentro do callback (recomendação da biblioteca).
      setTimeout(() => void refresh(), 0);
    }
  });
  // Atualiza ao voltar para o app e periodicamente (notificações novas).
  if (typeof window !== "undefined") {
    const onVisible = () => {
      if (document.visibilityState === "visible" && state.session) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    setInterval(() => {
      if (document.visibilityState === "visible" && state.session) void refresh();
    }, 120_000);
  }
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

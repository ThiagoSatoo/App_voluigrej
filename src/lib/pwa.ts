import { useEffect, useState } from "react";
import { toast } from "sonner";

/** Até quantos ms depois de abrir (ou voltar para) o app a nova versão entra sem perguntar. */
const AUTO_RELOAD_WINDOW = 15_000;
/** Com o app aberto, procura versão nova a cada 30 minutos. */
const CHECK_EVERY = 30 * 60_000;

/** Recarrega a página, no máximo uma vez a cada 10 s (evita ficar recarregando em loop). */
function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem("escala-reload") ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem("escala-reload", String(Date.now()));
  } catch {
    /* sem sessionStorage: recarrega mesmo assim */
  }
  window.location.reload();
}

/** A tela aberta é de uma versão antiga? Compara o arquivo principal com o do servidor. */
async function isStale(): Promise<boolean> {
  const mine = document.querySelector<HTMLScriptElement>(
    'script[type="module"][src*="/assets/index-"]',
  )?.src;
  if (!mine) return false;
  try {
    const html = await (await fetch("/_shell.html", { cache: "no-store" })).text();
    const latest = /\/assets\/index-[\w-]+\.js/.exec(html)?.[0];
    return !!latest && new URL(mine).pathname !== latest;
  } catch {
    return false; // sem internet: fica como está
  }
}

/**
 * Registra o service worker (só em produção) e mantém o app sempre na versão mais nova:
 * - ao abrir o app e ao voltar para ele, pergunta ao servidor se há versão nova;
 * - se houver, recarrega sozinho quando o app acabou de ser aberto; com o app em uso,
 *   mostra um aviso com "Atualizar" e atualiza sozinho na próxima vez que a pessoa voltar ao app;
 * - se uma tela tentar baixar um arquivo de uma versão que já saiu do ar, recarrega na versão nova.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !import.meta.env.PROD) return;

  // Arquivo de tela antigo que não existe mais depois de uma publicação: recarrega na versão nova.
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    reloadOnce();
  });

  if (!("serviceWorker" in navigator)) return;
  const sw = navigator.serviceWorker;
  // Na primeira instalação não há versão antiga para trocar.
  const hadController = !!sw.controller;
  let shownAt = Date.now();
  let pending = false;

  sw.addEventListener("controllerchange", async () => {
    if (!hadController || !(await isStale())) return;
    if (Date.now() - shownAt < AUTO_RELOAD_WINDOW) return reloadOnce();
    pending = true;
    toast("Nova versão do app disponível", {
      duration: Infinity,
      action: { label: "Atualizar", onClick: reloadOnce },
    });
  });

  const register = async () => {
    try {
      const reg = await sw.register("/sw.js", { scope: "/" });
      const check = () => void reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        if (pending) return reloadOnce();
        // Voltou ao app: confere também se a tela está numa versão antiga (o service worker pode já ter trocado).
        void isStale().then((old) => old && reloadOnce());
        shownAt = Date.now();
        check();
      });
      setInterval(() => document.visibilityState === "visible" && check(), CHECK_EVERY);
    } catch (e) {
      console.warn("Service worker não registrado", e);
    }
  };
  // O app só roda este código depois de montar a tela; nessa hora o evento "load" quase sempre já passou.
  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => void register(), { once: true });
}

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/** Estado do botão "Instalar app": Android/desktop usam o aviso do navegador; iPhone precisa de instruções. */
export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null);
  };

  return { canInstall: !!event && !installed, showIosHint: isIos && !installed, install };
}

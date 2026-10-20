import { useEffect, useState } from "react";

/** Registra o service worker só em produção (evita cache confuso durante o desenvolvimento). */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  const register = () =>
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("Service worker não registrado", e));
  // O app só roda este código depois de montar a tela; nessa hora o evento "load" quase sempre já passou.
  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => void register(), { once: true });
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Estado do botão "Instalar app": Android/desktop usam o aviso do navegador; iPhone precisa de instruções. */
export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
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

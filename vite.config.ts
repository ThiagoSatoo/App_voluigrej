import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// O app roda inteiro no navegador (SPA) e conversa direto com o Supabase.
// O build gera arquivos estáticos em dist/client, servidos pela Vercel.
export default defineConfig({
  server: { port: 8080 },
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      spa: { enabled: true },
    }),
    viteReact(),
    tailwindcss(),
  ],
  build: {
    sourcemap: false,
  },
});

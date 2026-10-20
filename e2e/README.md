# Teste de telas (responsividade, CSP e PWA)

Abre o app num Chromium real em 360px, 390px (celular) e 1280px (computador), com o Supabase simulado por dados de teste. Verifica:

- se alguma tela fica mais larga que o aparelho (rolagem lateral);
- erros no console e bloqueios da política de segurança (CSP);
- requisitos do PWA: manifesto, ícones, service worker ativo, abertura sem internet e nenhum dado do Supabase no cache.

```bash
bun run build
node e2e/server.mjs "$PWD/dist/client" &   # serve em http://localhost:4173
node e2e/run.mjs                           # capturas em e2e/shots/
```

Precisa do pacote `playwright` e de um Chromium instalado.

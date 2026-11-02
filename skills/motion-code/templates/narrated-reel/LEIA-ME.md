# Template — Reel narrado (9:16, 60 s)

Formato aprovado no Reel "Círculo cromático" (nov/2026). Guia completo: `~/.claude/skills/motion-code/references/narrated-reel.md`.

1. Crie `.env` (nunca versionar/imprimir): `FISH_API_KEY=…`, `FISH_VOICE_ID=…`.
2. Edite `script.json` (`output`, falas e janelas), `src/plan.js` (palavras-gatilho), `assets/art/points.json` (obras e pontos) e a cena em `src/scene.js`.
3. Obras: `node tools/commons-dl.mjs search "…"` → `get '{"chave":"File:…"}'` → `npm run art:grid` → editar pontos → `npm run art:pick` → `npm run art:check`.
4. `npm run build` (voz → tempos por palavra → mix → render → `npm run check`).

Sem chave: `npm run voice:draft && npm run render` gera um rascunho com a voz do sistema.

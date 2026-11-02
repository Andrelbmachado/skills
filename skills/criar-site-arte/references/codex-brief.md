# Brief para o Codex — pesquisa de imagens

Salve em `~/Developer/Design-Master-style-kits/.superpowers/briefs/<AAAA-MM-DD>-codex-<estilo>.md`. Modelo validado: `2026-11-01-codex-mesopotamia.md` (leia-o se existir).

## Invocação

```bash
cd ~/Developer/Design-Master-style-kits
codex exec -s workspace-write -c sandbox_workspace_write.network_access=true \
  -C ~/Developer/Design-Master-style-kits - < .superpowers/briefs/<arquivo>.md \
  > .superpowers/briefs/codex-<estilo>.log 2>&1
```
Rode com `run_in_background: true`. Não faça polling; espere a notificação.

## Template

```
Research and download the best reference images of <MOVIMENTO> (<região>, <datas>) for a design style kit. Save ONLY into Styles/<Pasta>/research/ with subfolders: <architecture, reliefs, sculpture, objects, writing, seals|paintings|…, textures, patterns>. Do not modify anything outside that folder. Do not use git.

LICENCES: only public domain, CC0, CC BY or CC BY-SA. Verify the licence on each file page (Wikimedia Commons API `LicenseShortName`). Sources: Wikimedia Commons, The Met Open Access (CC0 — fallback when Commons returns 429), Art Institute of Chicago (CC0), Cleveland Museum of Art (CC0), Rijksmuseum, Smithsonian Open Access, British Museum / Louvre photos on Commons. Never use images whose licence you cannot confirm.

COVERAGE (aim 3–5 good images per item, high resolution, frontal, even light):
- <categoria>: <obras nomeadas, com museu/número de inventário quando souber; peça vistas inteiras + close-ups do detalhe que vira UI>
- Writing: <suportes com a escrita do período, nítidos, legíveis; inclua uma sign list/tabela de signos>
- Textures (also save 1600×1600 square crops of BARE surface — no figures, no text, no labels, even light, not thin strips): <materiais: pedra X, tijolo Y, argila, metal, pigmento…>
- Patterns: <motivos, bordas, frisos, padrões geométricos>
- Architecture forms: <silhuetas: pirâmide, zigurate, arco… frontais e de perfil>

FOR EACH IMAGE record: what item it is (exact name + inventory number), where it is (museum/site), what is visible in the image (focus), and whether it is a photo of a 3D object (photographer copyright applies) or a 2D reproduction.

FILES: cap ~8 MB each (resize larger, keep long side ≥ 2400 px when the source allows). Descriptive snake_case names (e.g. architecture/ishtar_gate_full.jpg). Write in Styles/<Pasta>/research/:
- credits.json — {schema, collection, license_filter, records[]}; per record: file, title, item_name, inventory, holder, date, culture, source_url (full Commons "File:" page or museum object page), author, licence, licence_url, focus, is_3d_photo, sha256, bytes, width, height
- CREDITS.md — readable attribution list
- contact-sheet.png — every image with file name + licence
- research.md — hero candidates per category with reasoning, and a "Design vocabulary" section: textures, colours, shapes, patterns, symbols, writing signs, iconic objects and period words/names visible in the photos that a UI designer could use (be specific: which file, which detail, where in the image)

NETWORK: download with curl/python directly into the target folder. User-Agent "DesignMasterResearch/1.0 (andre)", throttle ≥ 1.5 s between requests, back off on HTTP 429. No duplicates (sha256 and near-identical views).

SELF-CHECK before finishing: open each image and confirm it shows the named item (not a book cover, poster, modern drawing, different site, or museum label). Remove anything that fails and list removals in research.md.
```

## Follow-up de correção (`-codex-fix.md`)

Depois da sua inspeção (fase 3), mande uma lista exata, não genérica:
```
Fix these problems in Styles/<Pasta>/research/ (same rules as before):
1. <arquivo> is <o que realmente é>, not <o que diz>. Replace with <item> from <fonte sugerida>.
2. textures/<x>.jpg is a thin strip / has figures — redo as 1600×1600 bare-surface crop.
3. credits.json source_url for <arquivo> lacks the "File:" prefix.
Regenerate contact-sheet.png and update research.md.
```

## Armadilhas já vistas (verifique sempre)
- Capa de livro/pôster no lugar da obra (Meso: 4 texturas + "Hammurabi").
- Sítio errado ("Giza" era Saqqara); obra de outra cultura/período (grifo aquemênida de Susa como "Porta de Ishtar").
- Museu errado no registro ("Ishtar Gate Berlin" era Louvre AO 21118).
- Resolução inútil (Nefertiti ~500 px); texturas em tira fina; duplicatas.
- SVG/desenho moderno como se fosse artefato (`gods/horus.jpg`).
- `source_url` sem o prefixo `File:`.

## Imagens geradas (botões-assinatura e o que não existe em foto licenciada)
Receita aprovada (Mesopotâmia, botões da sidebar): `tools/style-kits/briefs/2026-11-01-codex-meso-nav-buttons.md`.
1. Gere a **folha de referência** você mesmo (PIL): 1536×1024, fundo quase preto liso, placas 700×152 em grade 2×2 (x 48/788, y 250/622), cada uma com a palavra já na **fonte do kit**. Uma folha por 4 rótulos.
2. Recorte **material de referência** de fotos licenciadas (ex.: tijolo de Ur, esmalte de Ishtar).
3. Rode na pasta de raws (fora do repo):
   `codex exec --skip-git-repo-check -s workspace-write -C ~/Developer/design-master-assets/<kit>-raws/nav -i ref-A.png -i ref-B.png -i mat-1.png -i mat-2.png - < brief.md`
   Brief: usar o `image_gen` embutido (não CLI/API key), uma chamada por imagem, copiar de `~/.codex/generated_images/` com nome exato; manter placas/posições/letras da referência; material de borda a borda, sem arredondar cantos; estados (repouso/ativo) em folhas separadas.
4. ~4 imagens ≈ 5–8 min. O Codex pode dizer "letras diferem" — confira você: na Meso as 8 palavras saíram certas.
5. Recorte por script (`meso_nav_buttons.py`): placas achadas por **distância da cor do fundo** (limiar de luminância falha em esmalte escuro), 2× do tamanho CSS, WebP.
6. Crédito: "Generated with OpenAI image_gen via Codex CLI (<versão>), <data>", licença CC0, `derivative` citando as referências de material; brief versionado em `tools/style-kits/briefs/` (`.superpowers/` é gitignored).

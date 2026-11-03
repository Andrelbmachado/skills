# Instruções para qualquer IA
1. Clone/atualize: `gh repo clone Andrelbmachado/skills ~/skills-repo || git -C ~/skills-repo pull`
2. Rode `~/skills-repo/sync.sh` para importar todas as skills (Claude: ~/.claude/skills, Codex: ~/.codex/skills, Gemini: ~/.gemini/skills).
3. Outras IAs: leia `skills/<slug>/SKILL.md` e importe cada uma no seu formato de skills.
4. Criou/melhorou uma skill? Adicione em `skills/<slug>/`, atualize README.md, commit e push.

## Skills sync rule
- After installing/creating/editing any skill, run `~/skills-repo/scripts/publish-skill.sh <skill-dir>` (copies to repo `skills/<slug>/`, commits, pushes, syncs all CLIs).
- Once per day: `git -C ~/skills-repo pull && ~/skills-repo/sync.sh`. See skill `skills-synchronizer`.
- Never push secrets; on push conflict `git pull --rebase` then push.

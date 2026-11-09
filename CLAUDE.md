# Instruções para qualquer IA
Use a skill `local-agent-hierarchy` quando o usuário pedir coordenação hierárquica de múltiplos CLIs/agentes ou memória temporária compartilhada por projeto.
1. Clone/atualize: `gh repo clone Andrelbmachado/skills ~/skills-repo || git -C ~/skills-repo pull`
2. Rode `~/skills-repo/sync.sh` para importar todas as skills (Claude: ~/.claude/skills, Codex: ~/.codex/skills, Gemini: ~/.gemini/skills).
3. Outras IAs: leia `skills/<slug>/SKILL.md` e importe cada uma no seu formato de skills.
4. Criou/melhorou uma skill? Adicione em `skills/<slug>/`, atualize README.md, commit e push.

## Skills sync rule
- After installing/creating/editing any skill, run `~/skills-repo/scripts/publish-skill.sh <skill-dir>` (copies to repo `skills/<slug>/`, commits, pushes, syncs all CLIs).
- Once per day: `git -C ~/skills-repo pull && ~/skills-repo/sync.sh`. See skill `skills-synchronizer`.
- Never push secrets; on push conflict `git pull --rebase` then push.

## Métricas obrigatórias (regra do André, 2026-11-02)
Meça tokens e tempo de TODA etapa de todo projeto/vídeo. Rode `claude -p --output-format json` (usage + duration + total_cost_usd) e `codex exec --json` (eventos token_count). Ao fim de cada execução, registre uma linha em `~/metrics/metrics.csv` com:
`~/skills-repo/scripts/log-metrics.sh <projeto> <etapa> <agente> <modelo> <input_tokens> <output_tokens> <cost_usd|""> <start_iso> <end_iso>`
Colunas: date,project,task/step,agent,model,input_tokens,output_tokens,total_tokens,cost_usd_if_reported,start,end,duration_s. Retroativo de sessão Claude: `scripts/metrics-from-claude-session.py <session.jsonl> <projeto> <etapa>`. Resumo: `scripts/metrics-summary.sh [projeto]`. Inclua a tabela por etapa e o total no relatório final.

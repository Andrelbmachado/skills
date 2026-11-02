---
name: harness2-workflow
description: >-
  Use when designing, refining, or executing complex tasks, skills, or
  multi-step agent workflows using the Google Research Harness² 8-component
  architecture and Propose-Probe-Compose recursion.
---
# Fluxo Harness² (Recursive Agent Harnessing)

Use este fluxo para estruturar, executar e refinar agentes, skills e tarefas complexas seguindo os **8 componentes (`c1..c8`)** e os **2 níveis de recursão** do `google-research/harness2`.

## 1. Hierarquia de custo dos 8 componentes (`c1..c8`)
Texto sempre ativo (`c1..c4`) compete diretamente com o orçamento de saída em todos os turnos. Prefira componentes sob demanda nesta ordem:
1. **Skill (`c6`)** — procedimento reutilizável com gatilho claro (`description:` obrigatório no frontmatter + linha de gatilho explícita no prompt/instruções).
2. **Script (`c7` — `scripts/<nome>.py`)** — helper determinístico para cálculos, validações, builds ou transformações repetitivas que o modelo erraria ou faria devagar manualmente.
3. **Subagente (`c5`)** — investigação ou subtarefa isolada cuja **entrada é grande** e a **resposta é curta** (ex.: `executor`, `computerUse`, `knowledgeWork`).
4. **Plugin / Hook / Orquestração (`c8`)** — verificação mecânica dentro do loop de ferramentas (cortar saída ruidosa, validar escrita logo após editar, bloquear erro recorrente).
5. **Sempre ativos (`c1` Prompt, `c2` Guardrails, `c3` Memória, `c4` Guia de Ferramentas)** — apenas regras curtas que valem para **toda** execução. Se adicionar algo aqui, enxugue outra parte.

## 2. Três regras de ouro de validação
1. **Toda skill precisa de linha de gatilho** (`Quando <situação>, carregue a skill <nome>`).
2. **Todo script citado precisa existir** e ser executável deterministicamente.
3. **O formato do entregável pertence ao pedido:** mude *como* o agente trabalha, nunca altere colunas, seções ou formato que o usuário pediu, e entregue valores calculados (nunca placeholders).

## 3. Ciclo em 2 níveis de recursão
- **Nível 1 — Recursão na tarefa (Propose → Probe → Compose):**
  1. *Propose:* identifique onde a execução falha ou perde tempo e proponha ajustes pontuais nos componentes (`c1..c8`).
  2. *Probe:* teste a mudança na tarefa real (build, teste E2E, verificação visual/DOM).
  3. *Compose:* combine apenas as mudanças que comprovaram melhora real no comportamento.
- **Nível 2 — Recursão no harness (Experience Reflector):**
  - Ao concluir uma tarefa não trivial, registre a lição aprendida apoiada em evidência na memória durável (`c3`), em um script determinístico (`c7`) ou na própria skill (`c6`) para guiar tarefas futuras.

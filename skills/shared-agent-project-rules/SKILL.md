---
name: shared-agent-project-rules
description: Use quando um projeto tiver AGENTS.md e CLAUDE.md e for preciso eliminar regras duplicadas ou contraditórias entre agentes.
---

# Fonte única de regras entre agentes

## Fluxo
1. Ler as regras existentes em AGENTS.md e CLAUDE.md no escopo do projeto. Considerar regras de subpastas quando existirem, sem presumir que apenas a raiz governa todos os arquivos.
2. Comparar instruções repetidas e contraditórias. Separar regras comuns do projeto das notas exclusivas do Claude. Não escolher silenciosamente uma regra vencedora quando houver conflito de intenção.
3. Consolidar as regras comuns no AGENTS.md. Preservar as restrições do projeto; eliminar duplicação, não conteúdo obrigatório.
4. Fazer o CLAUDE.md importar o arquivo comum com a linha `@AGENTS.md`. Manter abaixo apenas notas exclusivas do Claude, sob uma seção como `# Claude only`.
5. Rever os dois arquivos: cada regra comum deve ter uma fonte única; as notas específicas não podem contradizê-la. Entregar o resumo das duplicações removidas e dos conflitos que ainda exigem decisão.

## Limites
- Não reescrever regras globais nem sincronizar todos os agentes como efeito colateral.
- Aplicar o import apenas ao leitor que o suporta; não afirmar que toda ferramenta interpreta a sintaxe do Claude.
- Esse arquivo governa instruções do projeto; não é substituto de handoff ou memória de execução.

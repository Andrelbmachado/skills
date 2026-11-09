---
name: mcp-batched-code-mode
description: Use quando projetar um agente com muitas ferramentas MCP e precisar reduzir schemas e resultados intermediários no contexto usando uma API tipada em execução isolada.
---

# Composição de ferramentas por Code Mode

## Fluxo
1. Identificar o custo do desenho atual: muitas definições de ferramentas no contexto e resultados intermediários voltando ao modelo a cada chamada.
2. Representar as operações permitidas como uma API TypeScript tipada, em vez de expor todas como schemas individuais sempre presentes na conversa.
3. Projetar uma entrada de execução, como `run_code`, pela qual o agente componha as operações necessárias em um pequeno programa.
4. Executar esse programa em ambiente isolado. Processar os resultados intermediários dentro dessa execução, sem devolvê-los automaticamente ao modelo a cada etapa.
5. Retornar ao modelo somente o resultado final necessário para a tarefa. Comparar o volume de contexto do fluxo antigo e do novo, sem prometer os percentuais de demos.

## Limites de segurança
- Preservar permissões e aprovações de cada operação: agrupá-las em código não concede novos poderes nem elimina confirmação de ações externas.
- Usar somente operações documentadas e autorizadas. Não trocar um conector indisponível por API interna, leitura de credenciais ou sessão de navegador.
- Sem isolamento e política de execução definidos, entregar apenas o desenho; não chamar de sandbox uma execução arbitrária no host.
- Complementar com llm-ops para limites de passos/custo e tratamento de resultados como dados não confiáveis.

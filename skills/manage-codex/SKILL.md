---
name: manage-codex
description: >-
  Escolha e ajuste modelo, esforço de raciocínio, ferramentas, conectores e orçamento
  do Codex para tarefas de gerenciamento de projetos e execução de trabalho. Use
  esta skill quando GrokBot ou outro agente precisar decidir como gastar créditos
  do Codex ou da API, dividir trabalho entre agentes, configurar ferramentas, reduzir
  tokens, medir custo/qualidade ou selecionar modelo e esforço para uma tarefa.
compatibility: "Codex; verifique as ferramentas, modelos e permissões efetivamente disponíveis na sessão."
metadata:
  display_name: "Manage Codex"
  version: "1.0.0"
---

# Manage Codex

## Gatilho

Quando GrokBot receber um projeto, tarefa ou plano e precisar selecionar modelo, esforço, ferramentas, conectores, agentes ou estratégia de orçamento do Codex, carregue esta skill antes de planejar a execução.

## Objetivo

Entregar o resultado requerido com o menor custo total razoável, mantendo a qualidade e a segurança necessárias. Otimize o custo completo: chamadas, raciocínio, contexto repetido, saídas de ferramentas, retries, tempo de revisão humana e retrabalho. Não trate o maior modelo ou esforço como padrão.

## Regra de escolha rápida

1. **Comece pela tarefa e pelo critério de sucesso**, não pelo modelo. Extraia escopo, risco, prazo, formato, evidência necessária e o que conta como concluído.
2. **Use o modelo mais econômico que cumpra o critério com confiança.** Verifique o seletor da sessão; nomes, disponibilidade e opções mudam por plano, workspace, produto e data.
3. **Comece com esforço baixo para trabalho simples e médio para trabalho com julgamento ou várias etapas.** Eleve um nível somente quando houver uma lacuna concreta que mais raciocínio possa resolver.
4. **Separe contexto ausente de raciocínio insuficiente.** Se faltam arquivos, permissões, dados atuais ou acesso a um conector, obtenha-os; esforço maior não supre informação nem acesso.
5. **Faça uma verificação proporcional ao risco** e encerre quando os critérios estiverem satisfeitos. Não repita a tarefa completa por uma correção pequena.

## Matriz prática de modelo e esforço

Use os nomes abaixo como orientação para famílias mostradas nas páginas oficiais consultadas; se a sessão exibir outros nomes, aplique as mesmas funções e confirme suporte e disponibilidade no seletor/documentação atual.

| Trabalho | Ponto de partida | Aumente quando |
|---|---|---|
| Classificação, extração, resumo curto, edição localizada, triagem repetitiva | Modelo rápido/econômico disponível, esforço baixo | A tarefa exigir contexto conflituoso, precisão crítica ou falhar nos critérios |
| Planejamento de sprint, status, dependências, decomposição de backlog, síntese de documentos | Modelo equilibrado, esforço médio | Houver dependências ambíguas, evidência conflitante ou impacto alto |
| Implementação de feature delimitada, revisão de plano, análise de impacto | Modelo equilibrado, esforço médio | A mudança atravessar muitos módulos ou exigir tradeoffs técnicos difíceis |
| Bug reproduzível e localizado | Modelo econômico/equilibrado, esforço baixo ou médio | Hipóteses simples forem refutadas ou a causa exigir análise sistêmica |
| Arquitetura, incidente difícil, análise de segurança, migração, revisão de alto risco | Modelo mais capaz que esteja acessível, esforço alto | Só use extra alto/máximo se a avaliação demonstrar ganho material que compense o custo e a latência |
| Trabalho visual/UI com inspeção do resultado | Modelo com visão/computer-use adequado, esforço baixo/médio | Interações ou defeitos visuais forem difíceis de diagnosticar; valide captura, DOM ou navegador |

Na família publicada na documentação em 2026, GPT-6.1 Sol é apresentado como equilíbrio de capacidade e custo; GPT-6 Astra como opção mais capaz; GPT-6 Luna como opção econômica para volume; GPT-6.1 Terra como opção eficiente para raciocínio visual e uso preciso do computador. Isso não garante que esses nomes apareçam em todas as sessões Codex. Consulte [modelos](https://developers.openai.com/api/docs/models) e [seleção de modelo](https://developers.openai.com/api/docs/guides/model-selection) no momento da decisão.

### Esforço

- **Low:** extração, roteamento, pequenas edições, tarefas delimitadas e execução direta.
- **Medium:** equilíbrio padrão para planejamento, código com julgamento, pesquisa e coordenação moderada.
- **High:** depuração difícil, análise de risco, planejamento profundo e trabalhos de alto impacto.
- **Xhigh / Max:** use apenas em tarefas excepcionais e longas quando critérios de qualidade ou avaliações comparativas comprovem benefício. Não os selecione por prestígio.
- **None / Minimal:** selecione somente quando o modelo oferecer esse nível e a tarefa for simples e sensível à latência. Os valores aceitos variam por modelo; nunca presuma que todas as opções existem.

Esforço maior pode elevar tokens de raciocínio, uso e latência, sem garantir resposta melhor. Ao comparar, mantenha tarefa, contexto, ferramentas e modelo constantes e mude uma variável de cada vez. Registre sucesso, retrabalho, tempo e uso real.

## Orçamento, créditos e cobrança

Antes de um trabalho grande ou de longa duração:

1. Identifique a modalidade ativa: login Codex via ChatGPT, cobrança/créditos do workspace, ou chave da API. Não assuma que são uma única franquia.
2. Confira o indicador de uso e o horário de reset no Codex/ChatGPT; na CLI, consulte `/status` quando disponível. Para cobrança de API, confira o projeto, limites e painel de uso da Platform.
3. Defina um teto prático de tentativas, paralelismo e duração. Faça um primeiro corte pequeno ou piloto antes de lançar uma tarefa extensa.
4. Depois do piloto, veja qualidade e consumo observado. Continue, reduza escopo ou mude configuração conforme o custo total.

**Não confunda créditos de uso do Codex/ChatGPT com créditos ou cobrança da API.** Uma chave própria segue os preços e limites da API; o login ChatGPT usa as regras de uso do plano/workspace aplicáveis. Confira os termos atuais da conta em [uso do Codex](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan), [limites](https://help.openai.com/en/articles/20001625-understanding-chatgpt-and-codex-usage-limits) e [créditos](https://help.openai.com/en/articles/12642688). Não estime preço a partir de uma tabela antiga nem prometa que trocar de modelo restaura um limite.

Quando uma solução própria via API for realmente necessária, aplique orçamento por projeto, limites de gasto/taxa disponíveis, alertas, chaves com escopo mínimo e rotação. Não coloque chaves em prompts, logs, repositórios ou arquivos de skill. Evite criar chave/API para tarefas que a sessão Codex já atende sem uma necessidade concreta.

## Reduzir tokens sem perder contexto útil

- Leia primeiro o índice e as instruções locais (`AGENTS.md`, README, plano e estado atual); depois abra somente arquivos relevantes. Prefira busca direcionada a despejar repositórios inteiros.
- Use respostas curtas de status: decisão, progresso verificável, bloqueio e próximo passo. Não reimprima planos e contexto que já estão registrados.
- Dê ao agente objetivo, restrições, caminhos relevantes, critérios de aceitação e formato final em uma só solicitação clara. Evite ciclos de instrução incremental causados por requisitos omitidos.
- Reutilize contexto estável quando o produto oferecer cache; mantenha prefixos compartilhados no começo dos prompts e dados variáveis no fim. Meça cache hits e custo real antes de concluir que houve economia. Consulte [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).
- Prefira scripts determinísticos para operações repetidas, cálculos, transformações e validações; ferramentas podem ser mais baratas e confiáveis que pedir ao modelo para recalcular tudo a cada passo.
- Compacte/sumarize conversas longas quando o cliente permitir, preservando decisões, estado, caminhos, evidências e próximos passos. Remova histórico irrelevante sem perder critérios ou dados necessários.
- Limite tamanho e volume das saídas de ferramentas. Filtre por linhas, campos, arquivos e erros relevantes. Não peça análises duplicadas de conteúdo idêntico.
- Faça retries apenas após identificar o motivo da falha; corrija a causa, reduza o escopo e não repita em loop chamadas com o mesmo input.
- Use modo de velocidade mais caro somente quando a redução de latência tiver valor mensurável para o projeto.

## Delegação e concorrência

Delegue subtarefas independentes, com pergunta delimitada, contexto mínimo suficiente e resposta esperada curta. Exemplos: revisar documentos separados, pesquisar riscos diferentes ou investigar hipóteses distintas. Mantenha dependências sequenciais no agente principal.

- Inclua custo de cada subagente no orçamento; cada um pode consumir contexto e chamadas próprios.
- Não delegue tarefas pequenas, fortemente dependentes, nem partes que editam simultaneamente os mesmos arquivos.
- Peça achados concisos com evidência e caminhos, e faça a síntese uma vez no agente coordenador.
- Limite número de agentes à quantidade de trabalho realmente paralelizável; aumente concorrência só quando tempo ganho superar custo e coordenação.
- Use scripts/CLI para trabalho repetitivo e determinístico; agentes são melhores para investigação e julgamento independente.

Consulte a documentação de [multiagentes](https://developers.openai.com/api/docs/guides/agents-api/multi-agent) se estiver configurando um harness próprio.

## Ferramentas, skills e conectores

Escolha o meio mais direto e restrito que resolve a tarefa:

1. **Skill:** procedimento especializado e reutilizável; carregue apenas quando o gatilho corresponder. Skills ensinam o fluxo e podem orientar ferramentas; não fornecem por si só credenciais ou acesso.
2. **Script/CLI:** cálculo, validação, extração, build e transformação repetíveis.
3. **Conector/MCP:** dados vivos ou ação numa fonte específica; use o conector adequado e permissões mínimas. Consulte-o apenas quando a tarefa exigir dados daquela fonte.
4. **Navegador/computer use:** interface visual, interação que não esteja disponível em API/conector, ou verificação do resultado renderizado. Para informação pública sem interação, prefira busca web.
5. **Subagente:** investigação paralela independente que precisa de julgamento.

Não habilite todos os conectores “por garantia”: eles ampliam contexto, superfície de acesso e possíveis chamadas. Verifique conexão, escopo e autorização antes de usar. Para operações externas, confirme o destino e as permissões; siga as regras de autorização do produto e do usuário.

Para dúvidas sobre Codex, API, modelos ou plugins, consulte documentação oficial atual; se disponível, use OpenAI Docs MCP (`https://developers.openai.com/mcp`) e/ou a skill de documentação OpenAI. Não invente capacidades nem valores de preço.

## Ciclo de gerenciamento do projeto

Para cada projeto, use este ciclo curto:

1. **Enquadrar:** meta, entregáveis, dependências, riscos, prazo e critério de aceite.
2. **Fatiar:** tarefas independentes versus sequenciais; delegue apenas independentes.
3. **Configurar:** modelo, esforço, ferramentas e orçamento inicial adequados a cada fatia; nem todo o projeto precisa usar a mesma configuração.
4. **Executar:** produzir incrementos revisáveis com evidências e registrar bloqueios reais.
5. **Verificar:** validar os critérios que realmente importam; não execute verificações custosas que não se aplicam.
6. **Ajustar:** se falhar, identifique a causa. Corrija instruções, contexto, acesso ou implementação; suba modelo/esforço somente se a causa exigir mais capacidade de raciocínio.
7. **Fechar:** resumir entregues, evidência, riscos remanescentes, consumo conhecido e próxima ação.

## Registro mínimo para tarefas recorrentes

Para comparar configurações ao longo do tempo, registre somente o necessário: tipo de trabalho, modelo e esforço realmente usados, versão/data, critério de qualidade, conclusão, tempo, tokens/créditos observáveis e retrabalho. Não armazene segredos nem conteúdo sensível desnecessário. Use amostras representativas e compare resultado equivalente; escolha a opção de menor custo que atinja a qualidade exigida.

## Referências oficiais

As páginas abaixo são dinâmicas; confira-as novamente quando decidir por preço, acesso ou comportamento específico.

- [Modelos da API](https://developers.openai.com/api/docs/models)
- [Seleção de modelo](https://developers.openai.com/api/docs/guides/model-selection)
- [Raciocínio e esforço](https://developers.openai.com/api/docs/guides/reasoning)
- [Uso do Codex com plano ChatGPT](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)
- [Limites de uso](https://help.openai.com/en/articles/20001625-understanding-chatgpt-and-codex-usage-limits)
- [Créditos de uso do ChatGPT](https://help.openai.com/en/articles/12642688)
- [Skills e MCP](https://developers.openai.com/plugins/concepts/skills)
- [OpenAI Docs MCP](https://developers.openai.com/learn/docs-mcp)
- [Agentes multiagente](https://developers.openai.com/api/docs/guides/agents-api/multi-agent)
- [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)

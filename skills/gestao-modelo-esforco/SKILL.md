---
name: gestao-modelo-esforco
description: Define qual modelo (Haiku, Sonnet, Opus, Fable) e qual nível de esforço do Claude Code usar em cada tarefa, quando delegar a subagentes, e como economizar tokens e créditos (assinatura, API, usage credits). Use antes de despachar, planejar ou delegar qualquer trabalho, ao iniciar sessões longas, quando o custo estiver subindo, ou ao decidir entre /model, /effort, opusplan, subagentes, plan mode, workflows e agent teams.
---

# Gestão de modelo, esforço e custo no Claude Code

Skill para o GrokBot (gerente de projetos). Objetivo: entregar o resultado com o **modelo mais barato e o esforço mais baixo que ainda resolvem a tarefa com margem**, e gastar contexto apenas onde ele rende.

Custo ≈ tamanho do contexto × preço do modelo × esforço (tokens de raciocínio) × número de turnos. Cada turno reenvia o contexto inteiro (com desconto de cache). Por isso as maiores alavancas, em ordem, são: **contexto pequeno > modelo certo > esforço certo > menos turnos**.

> Base: documentação oficial do Claude Code (model-config, costs, sub-agents), consultada em 02/11/2026. Aliases e versões mudam. Em dúvida, rode `/model` e `/effort` para ver o que está disponível e consulte https://code.claude.com/docs/en/model-config.md.

## 1. Modelos

| Alias | Modelo atual (API Anthropic) | Use para | Observações |
|---|---|---|---|
| `haiku` | Haiku 5.5 | Busca, leitura, resumo, testes/builds, tarefas mecânicas | Esforço padrão `medium`. Contexto 1M, mas prompts acima de 100K tokens custam mais por token. Não dá para desligar o raciocínio. |
| `sonnet` | Sonnet 5.5 | Trabalho diário de código com escopo claro, revisão, bugs comuns | Esforço padrão `medium`. Contexto 1M nativo. |
| `opus` | Opus 5.5 | Planejamento, arquitetura, bugs difíceis, código crítico | É o `default` em Pro/Max/Team/Enterprise/API. Esforço padrão `medium`. |
| `fable` | Fable 5.1 | Tarefas maiores que uma sessão, causa raiz de incidentes, problemas ambíguos e longos | Mais capaz e mais caro. **Não é padrão**: precisa ser escolhido. Pode cobrar de usage credits (ver seção 8). |
| `opusplan` | Opus no plan mode, Sonnet na execução | Features novas: pensar caro, executar barato | Melhor roteamento automático nativo. |

Regras:
- `best` = Fable onde disponível, senão Opus. Não use `best` por hábito.
- Para fixar versão (reprodutibilidade), use o ID completo (`claude-sonnet-5-5`, `claude-opus-5-5`, `claude-haiku-5-5`, `claude-fable-5-1`) ou `ANTHROPIC_DEFAULT_*_MODEL`.
- Sonnet 5.5, Opus 5.5 e Haiku 5.5 exigem Claude Code recente (`claude update`).
- Em provedores como Bedrock/Foundry os aliases podem apontar para versões mais antigas.

## 2. Esforço (`/effort`, `--effort`, frontmatter `effort`)

Níveis nos modelos 5.x e Fable: `low`, `medium`, `high`, `xhigh`, `max`. O esforço controla quanto o modelo pensa por passo; é a segunda maior alavanca de custo.

| Nível | Quando |
|---|---|
| `low` | Respostas rápidas que você revisa, renomear, formatar, buscar, listar, resumir |
| `medium` | Padrão de Opus/Sonnet/Haiku 5.5. Implementar com escopo claro |
| `high` | Corrigir bug em base existente, edge cases prováveis, revisão que precisa verificar |
| `xhigh` | Raciocínio mais profundo com custo maior. Só quando `high` falhou ou o erro custa caro |
| `max` | Problemas difíceis para o modelo resolver sozinho (ex.: caça a vulnerabilidades). Rendimento decrescente e tendência a pensar demais. **Teste antes de adotar** |

Regras:
- A escala é calibrada por modelo. Ao trocar de modelo, **recomece em `medium`**, não carregue o nível antigo.
- `max` vale só para a sessão atual, a menos que fixado via `CLAUDE_CODE_EFFORT_LEVEL`. Não persista `max`.
- Para uma única virada de raciocínio profundo sem mudar a sessão, escreva `ultrathink` no prompt. É mais barato que subir o esforço da sessão inteira.
- Ordem de resolução: variável `CLAUDE_CODE_EFFORT_LEVEL` / `--effort` / `/effort` > configurações salvas > padrão do modelo. Frontmatter de skill/subagente sobrepõe a sessão, mas não a variável de ambiente.
- Para Opus 5.5, a chave `effortLevel` de nível superior no `settings.json` do usuário não vale; use `/effort` ou `modelSettings`.
- `ultracode` não é nível: é uma configuração que faz o Claude orquestrar workflows dinâmicos. Gasta muito. Só com orçamento aprovado.
- Pensamento não pode ser desligado em Opus 5.5, Sonnet 5.5, Haiku 5.5 e Fable. Controle custo pelo esforço.

## 3. Matriz tarefa → modelo + esforço

| Tarefa | Modelo | Esforço |
|---|---|---|
| Achar arquivos/símbolos, mapear repositório, ler logs, resumir | `haiku` (subagente Explore) | `low` |
| Rodar testes/build (`swift test`, `xcodebuild`, `pytest`, `npm test`) e reportar só falhas | `haiku` | `low` |
| Renomear, formatar, mudanças mecânicas em muitos arquivos, commit messages, README | `haiku` ou `sonnet` | `low` |
| SQL e shell simples; HTML/CSS pontual | `sonnet` | `low`–`medium` |
| Implementar tela/feature com spec clara (ex.: SwiftUI a partir do Figma) | `sonnet` | `medium` |
| Ler spec do Figma (`get_design_context`, screenshots) para extrair o que implementar | subagente `sonnet`/`haiku`, resultado resumido | `low`–`medium` |
| Bug em código existente, refatoração média, code review | `sonnet` | `high` |
| Planejar feature nova, arquitetura, modelo de dados, requisitos ambíguos | `opusplan` (plan mode) | `medium`→`high` |
| Concorrência, Assembly/C de baixo nível, criptografia, migração de esquema com dados reais | `opus` | `high` (`xhigh` se falhar) |
| Bug intermitente que já resistiu a 2 tentativas | `opus` | `high`→`xhigh` |
| Investigação longa e autônoma, causa raiz de incidente, trabalho maior que uma sessão | `fable` | padrão do modelo, só com orçamento aprovado |
| Auditoria de segurança profunda | `opus` ou `fable` | `high`; `max` só após teste |

Atalho mental: **leitura e mecânica = Haiku low · construção = Sonnet medium · julgamento e risco = Opus high · ambiguidade enorme e longa = Fable**.

## 4. Escalonamento (começar barato, subir só com evidência)

1. Comece no nível baixo plausível da matriz.
2. Se falhar de forma que raciocínio extra resolveria (erro de lógica, esqueceu caso de borda): suba **um** degrau de esforço, não de modelo.
3. Se falhar de novo no mesmo degrau: suba para o próximo modelo, voltando a `medium`.
4. Se falhar por falta de contexto (não achou o arquivo, spec incompleta): **não suba modelo**. Corrija o contexto, o prompt ou a spec.
5. Depois de resolver a parte difícil, **desça** para Sonnet/Haiku para o restante (ex.: Opus planeja, Sonnet implementa, Haiku roda os testes).
6. Nunca pule direto para `max` ou Fable por "garantia". Registre por que subiu.

Trocar `/model` ou `/effort` no meio da sessão pode invalidar o cache de prompt e forçar reprocessar o contexto. Prefira trocar em fronteiras de tarefa (depois de `/clear` ou `/compact`) e não alternar a cada turno.

## 5. Delegar a subagentes

Delegue quando a tarefa gera muita saída que você não vai reutilizar (busca, logs, testes, docs), é autocontida e retorna um resumo, ou precisa de um modelo/esforço diferente do da sessão. **Não delegue** quando exige ida e volta frequente, compartilha muito contexto com as fases vizinhas, é mudança pequena ou a latência importa.

Como o modelo do subagente é decidido (primeiro que se aplica):
1. Parâmetro `model` da chamada (alias: `haiku`/`sonnet`/`opus`/`fable`)
2. Campo `model` do frontmatter do subagente (`inherit` = modelo da sessão)
3. Variável `CLAUDE_CODE_SUBAGENT_MODEL`
4. Modelo da conversa principal

Pontos que custam dinheiro se ignorados:
- **Subagentes herdam o modelo da sessão**. Sessão em Opus high significa exploração em Opus high. Fixe `model` e `effort` em cada subagente.
- O `Explore` embutido usa o modelo da conversa (e, se a sessão estiver em Fable, roda em Opus). Defina um subagente de usuário chamado `Explore` com `model: haiku` e `effort: low` para sobrescrevê-lo.
- Cada subagente tem contexto próprio e envia suas próprias requisições, que contam no mesmo limite de uso.
- `effort` por invocação existe (parâmetro `effort` na chamada, Claude Code v2.1.292+), além do campo `effort` no frontmatter.
- `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` obriga todos os subagentes ao mesmo modelo e ignora o frontmatter. **Não use** numa frota mista; só para um teto de custo temporário.
- Limite de concorrência padrão: 20 subagentes. Reduza com `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (ex.: 4–5). Profundidade de aninhamento padrão: 3; `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` desliga aninhamento.
- Use `maxTurns` no frontmatter para evitar subagente em loop.
- Descrições de subagentes entram no contexto: mantenha curtas (limite de 15.000 tokens somando todas).
- Para o resultado do subagente voltar enxuto, peça no prompt: "retorne só X, em até N linhas".

Modelos prontos de subagentes: veja `subagentes-templates.md` (mesma pasta).

### Agent teams e sessões paralelas
- Agent teams usam ~7× mais tokens que uma sessão comum quando teammates rodam em plan mode. Ficam desligados por padrão (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` para ligar).
- Se usar: times pequenos, teammates em Sonnet, prompts de spawn enxutos, encerrar teammate quando acabar.
- Prefira subagentes comuns a agent teams, e agent teams só quando os trabalhadores precisam conversar entre si.

## 6. Economia de contexto e tokens (checklist de todo despacho)

Contexto
- `/clear` ao trocar de assunto (use `/rename` antes e `/resume` para voltar).
- `/compact <foco>` antes de pausas longas. Compactar um contexto grande já é uma requisição grande: faça cedo, não tarde. Se for recomeçar do zero, `/clear` não custa nada.
- Seção "Compact instructions" no CLAUDE.md dizendo o que preservar.
- CLAUDE.md abaixo de ~200 linhas. Instruções de fluxos específicos vão para **skills** (carregam sob demanda).
- Prompts específicos ("adicione validação ao `login()` em `Auth.swift`") em vez de "melhore o projeto". Peça arquivos e funções pelo nome.
- Dê alvo de verificação (teste, saída esperada, screenshot) para o modelo se auto-corrigir sem rodadas extras.
- Corte cedo: `Esc` ao ver desvio; `/rewind` (ou `Esc` duas vezes) para voltar ao checkpoint.

Ferramentas e MCP
- Definições de ferramentas MCP são adiadas por padrão (só nomes entram no contexto), mas servidores ainda pesam. Rode `/context` para ver o que ocupa espaço e `/mcp` para desligar o que não está em uso.
- Prefira CLIs (`gh`, `aws`, `gcloud`, `xcodebuild`, `git`) a servidores MCP quando houver equivalente: não adicionam listagem de ferramentas.
- Para MCPs necessários só a uma tarefa, declare-os **inline no frontmatter do subagente** (`mcpServers`): a conversa principal não paga o custo das descrições.
- Plugins de code intelligence (linguagem com servidor de linguagem) trocam "grep + ler 5 arquivos" por uma chamada de "ir à definição" e reportam erros de tipo após edição sem compilar.
- Skills: instale só as que usa. Muitas skills e plugins aumentam o contexto base.

Pré-processamento com hooks (barato e poderoso)
- Hook `PreToolUse` em Bash que filtra a saída de testes/builds para só falhas (exemplo em `subagentes-templates.md`). Reduz dezenas de milhares de tokens a centenas.
- Hooks também podem bloquear comandos caros ou perigosos antes de executar.

Pensamento
- Esforço baixo para tarefas simples. Em modelos antigos com orçamento fixo (Opus/Sonnet 4.6) existe `MAX_THINKING_TOKENS`; nos modelos 5.x use esforço.

Sessões ociosas (custo invisível)
- Sessão aberta o dia todo reenvia o histórico inteiro a cada pergunta, mesmo curta.
- Cache de prompt expira. Depois de uma pausa maior que o tempo de vida do cache, a primeira mensagem reprocessa tudo.
- Tarefas agendadas de sessão (`/loop`), check-ins de `/goal` e mensagens entre sessões disparam turnos com o contexto completo mesmo com a sessão parada. Limite ou desligue o que não precisa (`CLAUDE_CODE_GOAL_CHECKIN_MINUTES=0`, `crossSessionInbound: hold`).
- Desligue sugestões de prompt se não usa (elas fazem uma chamada a cada resposta, majoritariamente cache).

## 7. Outros recursos do Claude Code que melhoram o GrokBot como gerente

| Recurso | Para que serve | Custo/atenção |
|---|---|---|
| **Plan mode** (`Shift+Tab`) | Explora e propõe plano antes de editar. Evita retrabalho caro | Barato; use em qualquer mudança multi-arquivo |
| **`opusplan`** | Opus no plano, Sonnet na execução | Bom padrão para features |
| **Advisor tool** (`advisorModel`, `--advisor`) | Modelo executor consulta um segundo modelo no meio da tarefa, em vez de trocar na fronteira do plano | Útil quando a dificuldade aparece no meio |
| **`/goal`** | Mantém o modelo trabalhando até um resultado definido (bom com Fable, "descreva o resultado, não os passos") | Check-ins ociosos consomem; limite |
| **Workflows dinâmicos / ultracode** | Orquestração de múltiplos agentes para tarefas substanciais | Gasto alto; só com orçamento |
| **Skills** | Conhecimento de domínio sob demanda. Uma skill "visão geral do codebase" evita o modelo ler vários arquivos para entender a estrutura | Frontmatter `effort`/`model` por skill |
| **Subagentes com `memory`** (`project`) | Revisor/investigador que aprende padrões do projeto entre sessões | Memória entra no prompt do subagente |
| **Hooks** | Filtrar saída, bloquear ações, validar antes de executar | Scripts precisam de `chmod +x` |
| **Fallback de modelo** (`--fallback-model sonnet,haiku` / `fallbackModel`) | Troca de modelo no turno se o principal estiver sobrecarregado/indisponível | A troca vale só para o turno; até 3 modelos |
| **Fallback por classificadores** (cyber/bio) | Fable/Opus 5.5 reencaminham pedidos sinalizados para outro modelo | Repositórios de segurança/biologia disparam logo no 1º pedido; `switchModelsOnFlag: false` para ser consultado |
| **`claude -p` (headless)** | Automação e agendamento | Nunca pergunta consentimento de Fable; cobra direto. Use `--max-budget-usd` |
| **Worktrees / `isolation: worktree`** | Subagente em cópia isolada do repositório | Para trabalho paralelo que escreve arquivos |
| **Conectores/MCP** | Figma (design→código), Things, Calendar, Drive, navegador | Cada servidor pesa no contexto; habilite só os da tarefa |
| **`/btw`** | Pergunta lateral com o contexto atual, sem ferramentas e sem entrar no histórico | Mais barato que subagente para dúvida simples |
| **`claude --safe-mode`** | Diagnosticar fallback disparado por CLAUDE.md/skills/MCP | Só diagnóstico |

## 8. Créditos: assinatura, API e usage credits

- **Assinatura (Pro/Max/Team/Enterprise)**: o uso sai de limites por janela de 5 horas e semanal, **compartilhados entre todos os modelos** e com o chat. Trocar de modelo não restaura acesso após "session limit" ou "weekly limit". Depois dos avisos específicos "Opus limit"/"Sonnet limit", trocar para outra família funciona.
- **Usage credits**: permitem continuar além do limite e podem cobrar o **Fable** (a linha "Requires usage credits" aparece no `/model`). Em sessões interativas há um prompt de consentimento. Em sessão em segundo plano, remota ou de teammate, o prompt expira (padrão 5 minutos, `dialogExpiry`) e o turno termina sem enviar. Em `-p`/SDK sem prompt, **cobra sem perguntar**.
- **API/Console**: cobrança por token; controle por limites de gasto do workspace, painel de uso do Console e API de analytics. Sessões Claude Code ficam num workspace "Claude Code" próprio.
- **Bedrock/Vertex/Foundry**: cobrança na nuvem; use OpenTelemetry ou gateway para custo por usuário.
- O valor em dólares do `/usage` é estimativa a preço de lista; para fatura use o Console.

Regras para o GrokBot:
1. Nunca selecionar Fable em execução não assistida (agendada, `-p`, background) sem orçamento explícito aprovado na ordem de serviço.
2. Quando o limite de assinatura apertar, preferir Sonnet/Haiku para o que sobrar da semana, em vez de queimar usage credits em Opus/Fable.
3. Com limite de sessão atingido, no Claude Code v2.1.234+ é possível esperar o reset e continuar automaticamente (`/rate-limit-options`), em vez de gastar créditos.
4. Reservar Opus/Fable para os passos em que o erro custa mais que o modelo.
5. Em API, definir `--max-budget-usd` em execuções automatizadas e limites de gasto no workspace.

## 9. Monitoramento (meça antes de otimizar)

- `/usage`: tokens e custo da sessão, linha de cache de prompt (% de entrada vinda do cache, misses, quente/frio) e, em planos pagos, atribuição por skill/subagente/plugin/MCP com recomendações. Tecla `f` aplica as recomendações que consegue.
- `/context`: o que ocupa a janela (CLAUDE.md, MCPs, skills).
- `/insights`: relatório do seu padrão de trabalho (fricções, sugestões) a partir das sessões recentes.
- `/tasks`: mostra o modelo e o esforço de cada subagente em execução. Use para confirmar que o roteamento funcionou.
- Status line com contexto/custo contínuo. OpenTelemetry para métricas por usuário.

Cadência do GrokBot: no início de cada projeto, ver `/context`; ao fim de cada marco, `/usage`; semanalmente, `/insights`. Se um subagente ou MCP aparecer com fatia grande na atribuição, revisar seu modelo, esforço ou necessidade.

## 10. Roteiro de decisão do GrokBot (antes de cada despacho)

1. **Classifique** a tarefa na matriz (seção 3): leitura/mecânica, construção, julgamento/risco, ou ambiguidade longa.
2. **Isole o contexto**: precisa estar na sessão principal? Se gera saída volumosa e voltaria como resumo, delegue a subagente com `model` e `effort` explícitos.
3. **Mude de modo**: mudança multi-arquivo ou ambígua → plan mode / `opusplan` antes de executar.
4. **Prepare a ordem** (modelo abaixo) com alvo de verificação e limite de turnos.
5. **Acompanhe**: sinais de excesso (muitos turnos sem avanço, contexto crescendo, mesmo erro repetido). Aplique a seção 4.
6. **Feche**: `/rename` + `/clear` ao concluir; registre o que foi decidido para a próxima sessão em vez de arrastar a conversa.

Formato curto de ordem de serviço:

```
Tarefa: <resultado esperado, em uma frase>
Arquivos/escopo: <caminhos ou módulos>
Modelo/esforço: <alias> / <nível>   (motivo: <1 linha>)
Verificação: <teste, build ou saída esperada>
Retorno: <o que devolver e em quantas linhas>
Limite: <maxTurns ou orçamento>   Escalar se: <condição>
```

## 11. Anti-padrões

- Rodar tudo em Opus/Fable "por segurança". Exploração em Opus high é desperdício.
- Subir para `max` ou `xhigh` por reflexo, ou carregar `max` entre sessões.
- Subir modelo quando o problema é contexto faltando.
- Subagentes sem `model`/`effort` (herdam o caro).
- Uma sessão eterna: histórico enorme reenviado a cada turno.
- Alternar `/model` e `/effort` a cada mensagem (invalida cache).
- Deixar servidores MCP e skills desnecessários ligados.
- CLAUDE.md gigante com procedimentos que só servem a um fluxo.
- Agent teams ou workflows para tarefa que um subagente resolve.
- Execução não assistida com Fable e sem teto de orçamento.
- Pedir "ultrathink" em tudo (vira esforço alto disfarçado).
- Confiar que os nomes de modelos e níveis desta skill estão atuais sem conferir `/model`.

## 12. Manutenção desta skill

Atualize quando saírem novos modelos, quando mudar o padrão de esforço ou quando a documentação (model-config, costs, sub-agents) mudar. Confirme sempre com `/model`, `/effort` e a documentação antes de fixar versões em automações.

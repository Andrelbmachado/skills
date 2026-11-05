# Agent Skills System — v1

Conjunto implementável de instruções de oito skills priorizadas e suas versões júnior, com Project Architect supervisor e seu júnior (18 agentes possíveis no catálogo). Cada skill é uma unidade de procedimento, não um processo autônomo. Para execução real, integrar a um runtime de agentes, ferramentas e controle de acesso no servidor.

## Pastas
- `skills/<nome>/SKILL.md`: skill da especialidade.
- `skills/<nome>/JUNIOR.md`: perfil do júnior subordinado.
- `policy.yaml`: matriz mínima de autorização.
- `schemas.json`: contratos de mensagens, aprovação e ciclo da tarefa.
- `tests/simulate.py`: teste sintético reproduzível de 8.000.000 de eventos.
- `tests/scenarios.md`: roteiro de testes conversacionais interagentes e casos de ataque.
- `tests/results.json` e `tests/report.md`: resultados medidos.

## Controle e escopo
- Project Manager existente: prazos, escopo, alocação e condução do projeto.
- Project Architect: arquitetura e governança técnica, com limites de autorização.
- Workflow Orchestrator: diagramas, estados, handoffs, filas, gatilhos e fluxos de execução.
- Supervisor da especialidade: revisa o júnior e pode aprovar apenas ações de baixo risco.
- Júnior: conhecimento especializado, capacidade de propor e testar, sem poderes de publicação ou produção.
- Autoridade humana: operações destrutivas, produção, segredos, publicações externas e orçamentos superiores aos limites.

## Como adaptar a agentes reais
Definir ferramentas por papel (IAM/RBAC), persistência de estado e bus com autenticação, versionamento e retenção de mensagens, orquestração de transições, integração com CI, credenciais isoladas, logs imutáveis e observabilidade. Prompts por si só NÃO garantem permissões; validação deve ocorrer no backend. Não rodar alterações reais sem aprovação humana.

## Testes
`python3 tests/simulate.py --events 8000000 --seed 42`

Este é um teste sintético do protocolo, estados, troca de eventos e política, NÃO oito milhões de mensagens geradas por modelos de linguagem nem uma rede social autônoma real. Para avaliar a qualidade cognitiva e interações sociais de agentes reais, executar o roteiro em `tests/scenarios.md` com modelos e ferramentas conectados e auditar transcrições.

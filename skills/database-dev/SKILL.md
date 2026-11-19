---
name: database-dev
description: Use when designing schemas, writing SQL/migrations, choosing a database (Postgres, SQLite, MySQL, Mongo, Redis, vector DBs), tuning queries or indexes, or storing embeddings for AI features.
---

> **REGRA DO ANDRÉ: responda apenas o que foi perguntado.** Sim/não → só "Sim."/"Não.". Hora → só a hora. Nada extra.
# database-dev
- **Choose**: SQLite for local/single-user; Postgres default for apps (JSONB, pgvector for embeddings); Redis only for cache/queues; Mongo only for truly document-shaped data.
- **Schema**: normalise to 3NF first, denormalise with a measured reason; every table has PK, `created_at`; FKs + NOT NULL + CHECK constraints; money as integer cents/`numeric`.
- **Migrations**: versioned, forward-only, reversible when cheap; never edit an applied migration; test on a copy of prod-shaped data.
- **Performance**: `EXPLAIN ANALYZE` before indexing; index FK and filter/sort columns, composite index order = equality columns then range; avoid `SELECT *`, N+1, unbounded `OFFSET` (use keyset pagination).
- **Safety**: parameterised queries only; least-privilege DB user; backups + restore test; destructive statements need a transaction and a `WHERE` verified with `SELECT` first.
- **Embeddings/vector**: store model name + dim with each vector; cosine index (pgvector HNSW); see `ml-cache`, `llm-ops`.

## Banco distribuído: chave de partição e partição quente
Use quando uma tabela grande num banco particionado tem latência imprevisível ou um nó vive sobrecarregado.
1. Anote a consulta dominante e escolha a chave de partição para ler uma partição só (entidade + balde de tempo fixo), limitando o tamanho da partição.
2. Liste chaves com leitura concentrada ao mesmo tempo (anúncio para todos, item viral, evento ao vivo) e meça por partição, não só por nó.
3. Nó novo não divide partição existente: mais hardware não resolve partição quente.
4. Antes de trocar de banco, ponha uma camada fina na frente que junta pedidos idênticos em voo numa consulta só (request coalescing) e roteia por hash consistente da chave.
5. Se a latência de cauda vem de pausas de GC ou compactação, considere um banco compatível sem essas pausas e com a mesma linguagem de consulta.
6. Migre com escrita dupla + leituras amostradas comparadas nos dois bancos; meça p99 e número de nós antes e depois.
Limites: só compensa em escala; em app pequeno, índice + cache resolvem primeiro.
Fonte: @brenonascimento.dev (caso Discord Cassandra→ScyllaDB).

## Agente que responde perguntas de negócio com SQL
1. Montar um glossário a partir dos schemas, de amostras e do histórico de queries: termo, sinônimos, SQL aprovado da métrica com as regras de exclusão (ex.: status cancelado) e joins válidos.
2. Uma pessoa certifica cada definição antes do uso.
3. Ao responder, buscar os termos, montar o SQL a partir dos blocos certificados, executar/validar e corrigir se der erro, e devolver a consulta junto do número.
4. Se o glossário ou os dados não cobrem a pergunta, dizer que os dados não respondem isso em vez de chutar.

## Lessons learned
(none yet)

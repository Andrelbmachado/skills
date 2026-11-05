---
name: database-dev
description: Use when designing schemas, writing SQL/migrations, choosing a database (Postgres, SQLite, MySQL, Mongo, Redis, vector DBs), tuning queries or indexes, or storing embeddings for AI features.
---
# database-dev
- **Choose**: SQLite for local/single-user; Postgres default for apps (JSONB, pgvector for embeddings); Redis only for cache/queues; Mongo only for truly document-shaped data.
- **Schema**: normalise to 3NF first, denormalise with a measured reason; every table has PK, `created_at`; FKs + NOT NULL + CHECK constraints; money as integer cents/`numeric`.
- **Migrations**: versioned, forward-only, reversible when cheap; never edit an applied migration; test on a copy of prod-shaped data.
- **Performance**: `EXPLAIN ANALYZE` before indexing; index FK and filter/sort columns, composite index order = equality columns then range; avoid `SELECT *`, N+1, unbounded `OFFSET` (use keyset pagination).
- **Safety**: parameterised queries only; least-privilege DB user; backups + restore test; destructive statements need a transaction and a `WHERE` verified with `SELECT` first.
- **Embeddings/vector**: store model name + dim with each vector; cosine index (pgvector HNSW); see `ml-cache`, `llm-ops`.

## Lessons learned
(none yet)

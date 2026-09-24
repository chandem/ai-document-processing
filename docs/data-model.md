# Data Model

Schema source of truth: [`supabase/schema.sql`](../supabase/schema.sql)  
Incremental changes: [`supabase/migrations/`](../supabase/migrations/)

## Tables

### `documents`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid | FK → `auth.users`, cascade delete |
| `filename` | text | Sanitized upload name |
| `storage_path` | text | Path in Storage bucket `documents` |
| `content_type` | text | MIME type |
| `file_size` | bigint | Bytes |
| `status` | text | `uploaded` \| `processing` \| `completed` \| `failed` |
| `extracted_text` | text | Full OCR / digital text |
| `category` | text | invoice, receipt, contract, … |
| `classification_confidence` | numeric(4,3) | 0–1 |
| `summary` | text | LLM or extractive summary |
| `structured_data` | jsonb | Optional LLM field extraction |
| `error_message` | text | Set when `status = failed` |
| `retry_count` | integer | Default 0 |
| `processed_at` | timestamptz | When analysis finished |
| `created_at` / `updated_at` | timestamptz | `updated_at` via trigger |

**RLS:** users can only CRUD their own rows (`auth.uid() = user_id`).

### `processing_jobs`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `document_id` | uuid FK | Cascade on document delete |
| `user_id` | uuid FK | |
| `stage` | text | e.g. `analysis`, `analyzing`, `completed`, `failed` |
| `status` | text | `queued` \| `processing` \| `running` \| `completed` \| `failed` |
| `attempt` | integer | Default 1 |
| `error_message` | text | Safe user-facing error |
| `started_at` / `completed_at` | timestamptz | |
| `created_at` / `updated_at` | timestamptz | |

## Storage

- Bucket name: **`documents`** (private)
- Object key pattern: `{user_id}/{document_id}/{filename}`

## Apply schema

1. Run `schema.sql` on a fresh project, **or**
2. On an existing project, apply migrations in order under `supabase/migrations/`.

## Planned extensions

- `conversations` / `messages` — multi-turn Q&A history with citations
- Usage / quota tables for SaaS limits

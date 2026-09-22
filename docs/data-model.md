# Data Model

Schema source of truth: [`supabase/schema.sql`](../supabase/schema.sql)

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
| `created_at` / `updated_at` | timestamptz | Defaults `now()` |

**RLS:** users can only CRUD their own rows (`auth.uid() = user_id`).

### `processing_jobs`

Optional job tracking for async pipelines.

| Column | Type |
|--------|------|
| `id` | uuid PK |
| `document_id` | uuid FK → documents |
| `user_id` | uuid FK → auth.users |
| `stage` | text |
| `status` | queued \| running \| completed \| failed |
| `error_message` | text |
| `started_at` / `completed_at` / `created_at` | timestamptz |

## Storage

- Bucket name: **`documents`** (private)
- Object key pattern: `{user_id}/{document_id}/{filename}`

## Planned extensions

- `extracted_fields` — structured JSON fields per document
- `conversations` / `messages` — multi-turn Q&A history with citations

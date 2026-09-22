# Data Model

The planned persistence model is separated from the processing code.

## Core tables

### documents
- id UUID primary key
- user_id UUID referencing auth.users
- filename
- storage_path
- content_type
- file_size
- status
- extracted_text
- category
- classification_confidence
- summary
- timestamps

### processing_jobs
Tracks asynchronous processing stages and errors.

### extracted_fields
Stores structured fields generated from a document.

### conversations
Stores document Q&A sessions.

### messages
Stores user questions and assistant answers.

All user-owned tables should use Row Level Security and ownership policies before production access is enabled.

# AI Document Processing

**Intelligent document understanding pipeline** powered by modern LLMs and computer vision.

Extract text, classify documents, pull structured data, summarize content, and turn messy PDFs/images into clean, actionable information.

## Features

- **OCR & Text Extraction** – High-quality text from scanned PDFs and images (Tesseract + optional cloud OCR)
- **Document Classification** – Automatically categorize invoices, contracts, receipts, forms, reports, etc.
- **Structured Data Extraction** – Pull key-value pairs, tables, entities using LLMs with JSON schema enforcement
- **Summarization** – Concise or detailed summaries with controllable length and focus
- **Multi-format Support** – PDF, PNG, JPG, TIFF, DOCX
- **Pipeline Orchestration** – Chain processing steps with configurable workflows
- **REST API** – FastAPI endpoints for easy integration
- **CLI** – Command-line interface for batch processing

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/chandem/ai-document-processing.git
cd ai-document-processing
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment Variables

Create a `.env` file:

```env
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
# Optional: for higher quality OCR
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 3. Run the CLI

```bash
# Process a single document
python -m src.ai_document_processing.cli process path/to/invoice.pdf --output results.json

# Classify only
python -m src.ai_document_processing.cli classify path/to/document.pdf

# Extract structured data with a schema
python -m src.ai_document_processing.cli extract path/to/invoice.pdf --schema invoice_schema.json
```

### 4. Start the API

```bash
uvicorn src.ai_document_processing.api:app --reload --host 0.0.0.0 --port 8000
```

Docs available at `http://localhost:8000/docs`

## Project Structure

```
ai-document-processing/
├── src/
│   └── ai_document_processing/
│       ├── __init__.py
│       ├── ocr.py              # OCR engines
│       ├── classifier.py       # Document type classification
│       ├── extractor.py        # Structured data extraction
│       ├── summarizer.py       # Summarization
│       ├── pipeline.py         # End-to-end orchestration
│       ├── schemas.py          # Pydantic models & example schemas
│       ├── utils.py            # Helpers (file loading, chunking, etc.)
│       ├── cli.py              # Command-line interface
│       └── api.py              # FastAPI application
├── examples/
│   ├── sample_invoice.pdf
│   ├── invoice_schema.json
│   └── run_pipeline.py
├── tests/
├── Dockerfile
├── requirements.txt
├── pyproject.toml
└── README.md
```

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Input File │────▶│  Preprocess  │────▶│  OCR / Text Ext │
│ (PDF/Image) │     │  (convert,   │     │                 │
└─────────────┘     │   clean)     │     └────────┬────────┘
                    └──────────────┘              │
                                                  ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Structured │◀────│  LLM Extract │◀────│  Classifier     │
│  JSON / CSV │     │  + Schema    │     │  (doc type)     │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │  Summarizer     │
                                         └─────────────────┘
```

## Supported Providers

| Component       | Options                          |
|-----------------|----------------------------------|
| LLM             | OpenAI (GPT-4o, o1), Anthropic (Claude 3.5/4), local (Ollama) |
| OCR             | Tesseract, Google Vision, Azure Document Intelligence |
| Embeddings      | OpenAI, HuggingFace              |

## Example: Extract Invoice Data

```python
from ai_document_processing.pipeline import DocumentPipeline
from ai_document_processing.schemas import InvoiceSchema

pipeline = DocumentPipeline(llm_provider="openai")
result = pipeline.process(
    "invoice.pdf",
    steps=["ocr", "classify", "extract"],
    schema=InvoiceSchema
)
print(result.extracted_data)
```

## Roadmap

- [ ] Multi-page table extraction with layout awareness
- [ ] Human-in-the-loop review UI
- [ ] Vector store integration for RAG over document collections
- [ ] Batch processing with progress tracking
- [ ] Support for more document types (medical, legal, financial statements)
- [ ] Evaluation suite with ground-truth datasets

## Contributing

Pull requests are welcome! Please open an issue first to discuss major changes.

## License

MIT License – see [LICENSE](LICENSE)

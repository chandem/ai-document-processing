"""Example script demonstrating the DocumentPipeline."""

from pathlib import Path

from ai_document_processing import DocumentPipeline, InvoiceSchema

# Replace with a real PDF path on your machine
DOCUMENT = Path("sample_invoice.pdf")

def main():
    if not DOCUMENT.exists():
        print(f"Please place a sample PDF at {DOCUMENT} and re-run.")
        return

    pipeline = DocumentPipeline(
        classify_model="gpt-4o-mini",
        extract_model="gpt-4o",
    )

    result = pipeline.process(
        DOCUMENT,
        steps=["ocr", "classify", "extract", "summarize"],
        schema=InvoiceSchema,  # force invoice schema
    )

    print("=== Document Type ===")
    print(result.document_type, f"(confidence={result.confidence})")
    print("\n=== Summary ===")
    print(result.summary)
    print("\n=== Extracted Data ===")
    print(result.extracted_data)
    print(f"\nProcessed in {result.processing_time_seconds}s")


if __name__ == "__main__":
    main()

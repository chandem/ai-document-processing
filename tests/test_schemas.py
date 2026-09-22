"""Basic tests for Pydantic schemas."""

from ai_document_processing.schemas import DocumentType, InvoiceSchema, LineItem, DocumentResult


def test_invoice_schema_defaults():
    inv = InvoiceSchema()
    assert inv.invoice_number is None
    assert inv.line_items == []


def test_invoice_with_data():
    inv = InvoiceSchema(
        invoice_number="INV-001",
        vendor_name="Acme Corp",
        total_amount=1500.0,
        currency="USD",
        line_items=[
            LineItem(description="Consulting", quantity=10, unit_price=150, amount=1500)
        ],
    )
    assert inv.invoice_number == "INV-001"
    assert len(inv.line_items) == 1
    assert inv.line_items[0].amount == 1500


def test_document_result():
    result = DocumentResult(
        file_path="test.pdf",
        document_type=DocumentType.INVOICE,
        raw_text="Sample text",
        confidence=0.95,
    )
    assert result.document_type == DocumentType.INVOICE
    assert result.confidence == 0.95

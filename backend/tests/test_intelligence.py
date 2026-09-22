import pytest

from app.services.intelligence import analyze_document, classify_document


@pytest.mark.asyncio
async def test_invoice_classification_heuristic():
    result = await classify_document(
        "Invoice number 100. Subtotal 500. Tax 50. Total due 550. Bill to Acme."
    )
    assert result["category"] == "invoice"
    assert result["confidence"] >= 0.55
    assert result["source"] in {"heuristic", "llm"}


@pytest.mark.asyncio
async def test_summary_uses_first_sentences_when_no_llm():
    result = await analyze_document("First sentence. Second sentence. Third sentence.")
    assert "First sentence" in result["summary"]
    assert result["category"] is not None


@pytest.mark.asyncio
async def test_other_category_for_unrelated_text():
    result = await classify_document("The quick brown fox jumps over the lazy dog.")
    assert result["category"] == "other"

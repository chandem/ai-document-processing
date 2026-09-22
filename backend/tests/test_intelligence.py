from app.services.intelligence import analyze_document


def test_invoice_classification():
    result = analyze_document(
        "Invoice number 100. Subtotal 500. Tax 50. Total due 550."
    )
    assert result["category"] == "invoice"
    assert result["confidence"] >= 0.55


def test_summary_uses_first_sentences():
    result = analyze_document("First sentence. Second sentence. Third sentence.")
    assert result["summary"] == "First sentence. Second sentence. Third sentence."

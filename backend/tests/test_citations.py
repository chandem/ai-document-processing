from app.services.citations import extract_citations


def test_extract_citations_prefers_matching_sentences():
    text = (
        "Acme Corp issued invoice INV-42. "
        "The total amount due is 1250 USD. "
        "Payment is due within 30 days. "
        "Thank you for your business."
    )
    citations = extract_citations(text, "What is the total amount due?")
    assert citations
    joined = " ".join(c["snippet"].lower() for c in citations)
    assert "1250" in joined or "amount" in joined


def test_extract_citations_empty_text():
    assert extract_citations("", "anything") == []

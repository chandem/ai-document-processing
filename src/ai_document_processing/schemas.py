"""Pydantic models and example extraction schemas."""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class DocumentType(str, Enum):
    INVOICE = "invoice"
    RECEIPT = "receipt"
    CONTRACT = "contract"
    FORM = "form"
    REPORT = "report"
    ID_DOCUMENT = "id_document"
    OTHER = "other"


class LineItem(BaseModel):
    description: str = Field(..., description="Item or service description")
    quantity: Optional[float] = Field(None, description="Quantity")
    unit_price: Optional[float] = Field(None, description="Price per unit")
    amount: Optional[float] = Field(None, description="Line total")


class InvoiceSchema(BaseModel):
    """Schema for structured invoice extraction."""

    invoice_number: Optional[str] = Field(None, description="Invoice / bill number")
    invoice_date: Optional[date] = Field(None, description="Issue date")
    due_date: Optional[date] = Field(None, description="Payment due date")
    vendor_name: Optional[str] = Field(None, description="Seller / vendor name")
    vendor_address: Optional[str] = Field(None, description="Vendor address")
    vendor_tax_id: Optional[str] = Field(None, description="VAT / tax ID of vendor")
    customer_name: Optional[str] = Field(None, description="Buyer / customer name")
    customer_address: Optional[str] = Field(None, description="Customer address")
    subtotal: Optional[float] = Field(None, description="Subtotal before tax")
    tax_amount: Optional[float] = Field(None, description="Total tax")
    total_amount: Optional[float] = Field(None, description="Grand total")
    currency: Optional[str] = Field(None, description="Currency code, e.g. USD, EUR, ETB")
    line_items: list[LineItem] = Field(default_factory=list, description="Line items")
    payment_terms: Optional[str] = Field(None, description="Payment terms or notes")


class ReceiptSchema(BaseModel):
    """Schema for structured receipt extraction."""

    merchant_name: Optional[str] = None
    merchant_address: Optional[str] = None
    transaction_date: Optional[datetime] = None
    total_amount: Optional[float] = None
    tax_amount: Optional[float] = None
    currency: Optional[str] = None
    payment_method: Optional[str] = None
    items: list[LineItem] = Field(default_factory=list)


class DocumentResult(BaseModel):
    """Full result of a document processing run."""

    file_path: str
    document_type: DocumentType = DocumentType.OTHER
    raw_text: str = ""
    summary: Optional[str] = None
    extracted_data: Optional[dict[str, Any]] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    metadata: dict[str, Any] = Field(default_factory=dict)
    processing_time_seconds: Optional[float] = None

    class Config:
        use_enum_values = True

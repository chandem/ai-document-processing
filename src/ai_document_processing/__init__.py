"""AI Document Processing – intelligent document understanding pipeline."""

__version__ = "0.1.0"

from .pipeline import DocumentPipeline
from .schemas import DocumentResult, InvoiceSchema, ReceiptSchema

__all__ = [
    "DocumentPipeline",
    "DocumentResult",
    "InvoiceSchema",
    "ReceiptSchema",
    "__version__",
]

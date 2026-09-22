"""Command-line interface for AI Document Processing."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.json import JSON
from rich.panel import Panel

from .pipeline import DocumentPipeline
from .schemas import InvoiceSchema, ReceiptSchema

app = typer.Typer(help="AI-powered document processing CLI")
console = Console()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


@app.command()
def process(
    path: Path = typer.Argument(..., help="Path to the document (PDF or image)"),
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="Save result as JSON"),
    steps: Optional[str] = typer.Option(
        None,
        "--steps",
        help="Comma-separated steps: ocr,classify,extract,summarize",
    ),
    schema: Optional[str] = typer.Option(
        None,
        "--schema",
        help="Schema name: invoice | receipt",
    ),
):
    """Run the full (or selected) processing pipeline on a document."""
    if not path.exists():
        console.print(f"[red]File not found:[/red] {path}")
        raise typer.Exit(1)

    step_list = [s.strip() for s in steps.split(",")] if steps else None

    schema_map = {"invoice": InvoiceSchema, "receipt": ReceiptSchema}
    chosen_schema = schema_map.get(schema.lower()) if schema else None

    pipeline = DocumentPipeline()
    with console.status("[bold green]Processing document..."):
        result = pipeline.process(path, steps=step_list, schema=chosen_schema)

    console.print(Panel.fit(f"[bold]Document:[/bold] {result.file_path}"))
    console.print(f"[bold]Type:[/bold] {result.document_type}  (confidence: {result.confidence})")
    console.print(f"[bold]Processing time:[/bold] {result.processing_time_seconds}s")

    if result.summary:
        console.print("\n[bold]Summary:[/bold]")
        console.print(result.summary)

    if result.extracted_data:
        console.print("\n[bold]Extracted data:[/bold]")
        console.print(JSON(json.dumps(result.extracted_data, indent=2, default=str)))

    if output:
        output.write_text(result.model_dump_json(indent=2))
        console.print(f"\n[green]Saved result to {output}[/green]")


@app.command()
def classify(path: Path = typer.Argument(...)):
    """Classify a document type only."""
    process(path=path, steps="ocr,classify")


@app.command()
def extract(
    path: Path = typer.Argument(...),
    schema: str = typer.Option("invoice", "--schema", "-s"),
):
    """Extract structured data using a schema."""
    process(path=path, steps="ocr,extract", schema=schema)


if __name__ == "__main__":
    app()

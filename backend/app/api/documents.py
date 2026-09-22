from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

@router.get("")
def list_documents():
    return {"documents": []}

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "status": "received",
        "message": "Document upload endpoint initialized.",
    }

from fastapi import APIRouter

from .documents import router as documents_router
from .documents_write import router as documents_write_router
from .documents_extra import router as documents_extra_router
from .integration import router as integration_router

api_router = APIRouter()
api_router.include_router(documents_router)
api_router.include_router(documents_write_router)
api_router.include_router(documents_extra_router)
api_router.include_router(integration_router)

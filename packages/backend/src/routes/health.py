from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from src.core.dependencies import get_db
from src.core.settings import get_settings

router = APIRouter()


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"


@router.get("/health", response_model=HealthResponse)
def health():
    """Basic liveness probe."""
    return HealthResponse()


@router.get("/readiness")
async def readiness(db: AsyncSession = Depends(get_db)):
    """Readiness probe: checks database connectivity."""
    await db.execute(text("SELECT 1"))
    return {"status": "ready"}
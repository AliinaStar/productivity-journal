"""Report endpoints — manual generation trigger and retrieval.

Endpoints:
  POST /reports/generate  – run the RAG pipeline for a given period
  GET  /reports           – fetch an already-stored report from the DB

Both endpoints identify the user via the ``get_current_user`` dependency
(reads ``X-User-ID`` header set by the mobile client after login).

Frontend contract (api-client/reports.ts):
  POST body:  { period, period_start, period_end }
  GET params: ?period=week&period_start=2025-04-07
  Response:   RemoteReport shape (id, period, period_start, period_end,
              avg_productivity, active_days, created_at, final_report)
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from src.core.dependencies import get_current_user
from src.db.models import User

router = APIRouter(prefix="/reports", tags=["reports"])


# ---------------------------------------------------------------------------
# Shared response schema  (matches RemoteReport on the frontend)
# ---------------------------------------------------------------------------

class ReportResponse(BaseModel):
    """Matches the ``RemoteReport`` interface in ``api-client/reports.ts``."""

    id: int
    period: str
    period_start: str   # ISO date, e.g. "2025-04-07"
    period_end: str
    avg_productivity: float | None
    active_days: int
    created_at: str
    final_report: dict | None


# ---------------------------------------------------------------------------
# POST /reports/generate
# ---------------------------------------------------------------------------

class GenerateReportRequest(BaseModel):
    """Matches the body sent by ``requestReport()`` on the frontend."""

    period: Literal["week", "month", "year"]
    period_start: str   # ISO date string, e.g. "2025-04-07"
    period_end: str     # ISO date string, e.g. "2025-04-13"


@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    body: GenerateReportRequest,
    current_user: User = Depends(get_current_user),
) -> ReportResponse:
    """Run the RAG pipeline and persist the result for the current user.

    Converts ``period_start`` / ``period_end`` strings to a ``DateDict``
    before invoking the pipeline, then saves the result via ``db.save_report``.

    Raises:
        404: User not found (should not happen if auth works correctly).
        422: No entries exist for the requested period.
        500: LLM generation or structured-output parsing failed.
    """
    raise NotImplementedError


# ---------------------------------------------------------------------------
# GET /reports
# ---------------------------------------------------------------------------

@router.get("", response_model=ReportResponse | None)
async def get_report(
    period: Literal["week", "month", "year"] = Query(...),
    period_start: str = Query(..., description="ISO date, e.g. 2025-04-07"),
    current_user: User = Depends(get_current_user),
) -> ReportResponse | None:
    """Return a stored report for the current user, or ``null`` if not found.

    Matches the ``fetchReport()`` call in ``api-client/reports.ts``.
    Returns HTTP 200 with ``null`` body (not 404) when the report does not
    exist yet — the frontend uses this to decide whether to show a
    'Generate' button.
    """
    raise NotImplementedError

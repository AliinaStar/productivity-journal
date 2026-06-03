"""Report retrieval endpoints.

Reports are generated automatically by the scheduler (see ``src/rag/scheduler.py``);
there is no manual generation endpoint. These endpoints only read stored reports.

Endpoints:
  GET /reports/list  – list stored reports of a given period type (paginated)
  GET /reports       – fetch a single stored report by period + start date
"""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select

from src.core.dependencies import Pagination, get_current_user, get_pagination
from src.db.models import Report, User
from src.db.session import get_async_sessionmaker

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportResponse(BaseModel):
    """Matches the ``RemoteReport`` interface in ``api-client/reports.ts``."""

    id: int
    period: str
    period_start: str
    period_end: str
    avg_productivity: float | None
    active_days: int
    created_at: str
    final_report: dict | None


def _to_response(report: Report) -> ReportResponse:
    return ReportResponse(
        id=report.id,
        period=report.period,
        period_start=report.period_start.isoformat(),
        period_end=report.period_end.isoformat(),
        avg_productivity=report.avg_productivity,
        active_days=report.active_days,
        created_at=report.created_at.isoformat(),
        final_report=report.final_report,
    )


@router.get("/list", response_model=list[ReportResponse])
async def list_reports(
    period: Literal["week", "month", "year"] = Query(...),
    page: Pagination = Depends(get_pagination),
    current_user: User = Depends(get_current_user),
) -> list[ReportResponse]:
    """Return stored reports for the current user for a given period type."""
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        result = await session.execute(
            select(Report)
            .where(Report.user_id == current_user.id)
            .where(Report.period == period)
            .order_by(Report.period_start.desc())
            .limit(page.limit)
            .offset(page.offset)
        )
        reports = result.scalars().all()
    return [_to_response(r) for r in reports]


@router.get("", response_model=ReportResponse | None)
async def get_report(
    period: Literal["week", "month", "year"] = Query(...),
    period_start: str = Query(..., description="ISO date, e.g. 2025-04-07"),
    current_user: User = Depends(get_current_user),
) -> ReportResponse | None:
    """Return a stored report for the current user, or ``null`` if not found.

    Returns HTTP 200 with ``null`` body when the report does not exist yet.
    """
    start = date.fromisoformat(period_start)
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        result = await session.execute(
            select(Report)
            .where(Report.user_id == current_user.id)
            .where(Report.period == period)
            .where(Report.period_start == start)
        )
        report = result.scalars().first()

    return _to_response(report) if report else None

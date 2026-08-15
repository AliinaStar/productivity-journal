"""Report retrieval endpoints.

Reports are generated automatically by the scheduler (see ``src/rag/scheduler.py``);
there is no manual generation endpoint. These endpoints only read stored reports.

Endpoints:
  GET /reports/list  – list stored reports of a given period type (paginated)
  GET /reports       – fetch a single stored report by period + start date
"""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import Pagination, get_current_user, get_db, get_pagination
from src.db.models import Report, User

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
    session: AsyncSession = Depends(get_db),
) -> list[ReportResponse]:
    """Return stored reports for the current user for a given period type."""
    result = await session.execute(
        select(Report)
        .where(Report.user_id == current_user.id)
        .where(Report.period == period)
        # 'ready' only. The table also carries a bookkeeping row for every
        # period the scheduler has resolved without writing a report — empty
        # ones, failed ones, ones in flight. Unfiltered they would not just
        # show as blank cards, they would take up slots in this page and push
        # real reports off it.
        .where(Report.status == "ready")
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
    session: AsyncSession = Depends(get_db),
) -> ReportResponse | None:
    """Return a stored report for the current user, or ``null`` if not found.

    Returns HTTP 200 with ``null`` body when the report does not exist yet.
    """
    try:
        start = date.fromisoformat(period_start)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="period_start must be an ISO date (YYYY-MM-DD).",
        )
    result = await session.execute(
        select(Report)
        .where(Report.user_id == current_user.id)
        .where(Report.period == period)
        .where(Report.period_start == start)
        # A bookkeeping row is not a report; "not generated" and "generated but
        # empty" are both null to the client, as before this table tracked why.
        .where(Report.status == "ready")
    )
    report = result.scalars().first()

    return _to_response(report) if report else None

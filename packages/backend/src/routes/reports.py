"""Report endpoints — manual generation trigger and retrieval.

Endpoints:
  POST /reports/generate  – run the RAG pipeline for a given period
  GET  /reports           – fetch an already-stored report from the DB
"""

import json
from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from src.core.dependencies import get_current_user
from src.db.models import Report, User
from src.db.session import get_async_sessionmaker
from src.rag import db as rag_db
from src.rag.pipeline import app as pipeline
from src.rag.state import DateDict

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


class GenerateReportRequest(BaseModel):
    """Matches the body sent by ``requestReport()`` on the frontend."""

    period: Literal["week", "month", "year"]
    period_start: str   # ISO date string, e.g. "2025-04-07"
    period_end: str     # ISO date string, e.g. "2025-04-13"


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


def _date_to_dict(period: str, period_start: date) -> DateDict:
    """Convert an ISO period_start date to a ``DateDict`` for the pipeline."""
    if period == "week":
        iso = period_start.isocalendar()
        return {"year": iso.year, "week": iso.week}
    elif period == "month":
        return {"year": period_start.year, "month": period_start.month}
    else:
        return {"year": period_start.year}


@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    body: GenerateReportRequest,
    current_user: User = Depends(get_current_user),
) -> ReportResponse:
    """Run the RAG pipeline and persist the result for the current user.

    Raises:
        422: No entries exist for the requested period.
        500: LLM generation or structured-output parsing failed.
    """
    period_start = date.fromisoformat(body.period_start)
    period_end = date.fromisoformat(body.period_end)
    date_dict = _date_to_dict(body.period, period_start)

    try:
        state = await pipeline.ainvoke({
            "period": body.period,
            "date": date_dict,
            "user_id": current_user.id,
        })
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    if not state or not state.get("final_report"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No entries found for the requested period.",
        )

    report = await rag_db.save_report(
        user_id=current_user.id,
        period=body.period,
        period_start=period_start,
        period_end=period_end,
        avg_productivity=state.get("avg_productivity"),
        active_days=state.get("active_days", 0),
        final_report=json.loads(state["final_report"]),
    )
    return _to_response(report)


@router.get("/list", response_model=list[ReportResponse])
async def list_reports(
    period: Literal["week", "month", "year"] = Query(...),
    current_user: User = Depends(get_current_user),
) -> list[ReportResponse]:
    """Return all stored reports for the current user for a given period type."""
    session_factory = get_async_sessionmaker()
    async with session_factory() as session:
        result = await session.execute(
            select(Report)
            .where(Report.user_id == current_user.id)
            .where(Report.period == period)
            .order_by(Report.period_start.desc())
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

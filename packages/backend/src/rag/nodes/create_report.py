"""Node: create_report — final LLM generation step (all paths).

Selects the correct prompt template based on period and whether sub-period
summaries exist, calls the LLM with structured output, and writes the
typed Pydantic report + metadata back into the state.
"""

import time
from calendar import month_name as calendar_month_name
from datetime import datetime, timedelta

from langchain_core.messages import HumanMessage, SystemMessage

from src.rag.db import format_entries
from src.rag.llm import get_llm
from src.rag.prompts.month_report import (
    MONTH_SYSTEM_TEMPLATE,
    MONTH_USER_BASELINE,
    MONTH_USER_TEMPLATE,
)
from src.rag.prompts.week_report import WEEK_SYSTEM_TEMPLATE, WEEK_USER_TEMPLATE
from src.rag.prompts.year_report import (
    YEAR_SYSTEM_TEMPLATE,
    YEAR_USER_BASELINE,
    YEAR_USER_TEMPLATE,
)
from src.rag.schemas import MonthReport, WeekReport, YearReport
from src.rag.state import ReportState


async def create_report(state: ReportState) -> dict:
    """Generate the final structured report via LLM with structured output."""
    period = state["period"]
    date = state["date"]
    language = state["language"]
    gender = state.get("gender") or "not specified"
    active_days = state["active_days"]
    goal_metrics_block = state.get("goal_metrics_block", "")
    sub_period_reports = state.get("sub_period_reports")
    prev_text = format_entries(state["prev_entries"])

    if period == "week":
        week_dt = datetime.fromisocalendar(date["year"], date["week"], 1)
        goals_block = "\n".join(f"- {e['name']}" for e in state["current_entries"])
        user_prompt = WEEK_USER_TEMPLATE.format(
            month_name=calendar_month_name[week_dt.month],
            year=date["year"],
            language=language,
            gender=gender,
            goals_block=goals_block,
            goal_metrics_block=goal_metrics_block,
            active_days=active_days,
            period_start=week_dt.strftime("%d.%m.%Y"),
            period_end=(week_dt + timedelta(days=6)).strftime("%d.%m.%Y"),
            current_entries=format_entries(state["current_entries"]),
        )
        system_prompt = WEEK_SYSTEM_TEMPLATE
        schema = WeekReport
        state_key = "week_report"

    elif period == "month":
        goals_block = "\n".join(
            f"- {e['goal_id']}: {e['name']}" for e in state["current_entries"]
        )
        template = MONTH_USER_TEMPLATE if sub_period_reports else MONTH_USER_BASELINE
        user_prompt = template.format(
            month_name=calendar_month_name[date["month"]],
            year=date["year"],
            language=language,
            gender=gender,
            goals_block=goals_block,
            goal_metrics_block=goal_metrics_block,
            active_days=active_days,
            current_entries=sub_period_reports or format_entries(state["current_entries"]),
            rag_context=prev_text,
        )
        system_prompt = MONTH_SYSTEM_TEMPLATE
        schema = MonthReport
        state_key = "month_report"

    else:  # year
        goals_block = "\n".join(
            f"- {e['goal_id']}: {e['name']}" for e in state["current_entries"]
        )
        if sub_period_reports:
            user_prompt = YEAR_USER_TEMPLATE.format(
                year=date["year"],
                language=language,
                gender=gender,
                goals_block=goals_block,
                goal_metrics_block=goal_metrics_block,
                active_days=active_days,
                current_entries=sub_period_reports,
                rag_context=prev_text,
            )
        else:
            user_prompt = YEAR_USER_BASELINE.format(
                year=date["year"],
                language=language,
                gender=gender,
                goals_block=goals_block,
                goal_metrics_block=goal_metrics_block,
                active_days=active_days,
                total_entries=sum(len(e["notes"]) for e in state["current_entries"]),
                current_entries=format_entries(state["current_entries"]),
                rag_context=prev_text,
            )
        system_prompt = YEAR_SYSTEM_TEMPLATE
        schema = YearReport
        state_key = "year_report"

    llm = get_llm()
    t_start = time.time()
    result = await llm.with_structured_output(schema, include_raw=True).ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])
    generation_time = time.time() - t_start

    if result.get("parsing_error") or result["parsed"] is None:
        raise ValueError(f"Structured output parse failed: {result.get('parsing_error')}")

    report = result["parsed"]
    raw_msg = result["raw"]
    report_tokens = (
        raw_msg.usage_metadata.get("total_tokens", 0)
        if raw_msg.usage_metadata
        else 0
    )
    tokens_used = report_tokens + state.get("summary_tokens_used", 0)

    return {
        state_key: report,
        "final_report": report.model_dump_json(),
        "tokens_used": tokens_used,
        "generation_time": generation_time,
    }

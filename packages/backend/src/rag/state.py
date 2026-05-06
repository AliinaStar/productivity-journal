from typing import Literal
from typing_extensions import TypedDict

from langgraph.graph import MessagesState

from src.rag.schemas import WeekReport, MonthReport, YearReport


class DateDict(TypedDict, total=False):
    """Period identifier passed into the pipeline."""

    month: int | None
    year: int
    week: int | None


class ReportState(MessagesState, total=False):
    """Shared LangGraph state for the report-generation pipeline.

    Fields are populated progressively by each node:
      - retrieve_entries / collect_reports  → current_entries, avg_productivity, …
      - generate_summary                    → sub_period_reports, summary_tokens_used
      - retrieve_similar                    → prev_entries
      - create_report                       → week/month/year_report, final_report, tokens_used
    """

    period: Literal["week", "month", "year"]
    date: DateDict
    user_id: int

    # Entries for the current period (list of {goal_id, name, notes})
    current_entries: list[dict]
    # Historical entries retrieved via MMR (same shape as current_entries)
    prev_entries: list[dict]
    # Formatted LLM-generated sub-period summaries (None for week)
    sub_period_reports: str | None

    avg_productivity: float
    active_days: int
    goal_metrics_block: str

    language: str
    gender: str | None

    week_report: WeekReport
    month_report: MonthReport
    year_report: YearReport
    # JSON string produced by report.model_dump_json()
    final_report: str

    tokens_used: int
    summary_tokens_used: int
    generation_time: float

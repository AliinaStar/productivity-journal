from dataclasses import asdict, dataclass
from datetime import date
from typing import TYPE_CHECKING, Literal

import pandas as pd

if TYPE_CHECKING:
    from langfuse import Langfuse

@dataclass
class RetrievedChunk:
    entry_id: int
    text: str
    embedding: list[float]
    date: date
    goal_id: int
    relevance_score: float

@dataclass
class Report:
    report_id: int
    text: str
    period: Literal["month", "week"]

@dataclass
class RetrievedContext:
    moment_chunks: list[RetrievedChunk] | None   # retrieved минулі записи (RAG)
    pattern_reports: list[Report] | None         # попередні звіти / sub-period summaries
    source_chunks: list[RetrievedChunk] | None = None  # поточні записи (для faithfulness без summaries)
    total_available_months: int | None = None    # всього унікальних місяців в historical pool (для temporal_breadth)
    pool_avg_similarity: float | None = None     # середня попарна схожість всього пулу (для normalized_diversity)
    goal_metrics_block: str | None = None        # статистика по цілях (active days, avg score) — передається в LLM і суддю

@dataclass
class ReportResult:
    context: RetrievedContext | None
    generated_text: str
    tokens_used: int
    final_generation_time: float
    method: str             # "baseline_rag" | "mmr_rag" | "raw_generation"
    user_id: int
    period: Literal["month", "week", "year"]
    period_start: date

@dataclass
class EvaluationResult:
    # ідентифікація
    sample_id: str
    method: str
    user_id: int
    period_start: date
    period_type: Literal["month", "week", "year"]

    # retrieval метрики (None для тижня і raw_generation week)
    diversity: float | None
    normalized_diversity: float | None
    temporal_coverage: float | None
    temporal_breadth: float | None
    context_precision: float | None

    # generation метрики
    faithfulness_report: float | None
    answer_relevancy_report: int | None

    # технічні
    report_tokens_used: int
    report_generation_time: float

    # згенерований текст звіту
    generated_text: str

    def to_dict(self) -> dict:
        return asdict(self)

_FLOAT_METRIC_FIELDS = [
    "diversity",
    "normalized_diversity",
    "temporal_coverage",
    "temporal_breadth",
    "context_precision",
    "faithfulness_report",
    "answer_relevancy_report",
    "report_tokens_used",
    "report_generation_time",
]


class EvaluationLogger:
    def __init__(self, output_path: str, langfuse: "Langfuse") -> None:
        self.results: list[EvaluationResult] = []
        self.output_path = output_path
        self._langfuse = langfuse
        import os
        if os.path.exists(output_path):
            os.remove(output_path)

    def _append_to_csv(self, result: EvaluationResult) -> None:
        import os
        row = pd.DataFrame([result.to_dict()])
        write_header = not os.path.exists(self.output_path)
        row.to_csv(self.output_path, mode='a', header=write_header, index=False)

    def log(self, result: EvaluationResult) -> None:
        self.results.append(result)
        self._append_to_csv(result)
        session_id = f"{result.method}_{result.period_type}"

        with self._langfuse.start_as_current_span(
            name=f"{result.method}_{result.period_type}",
            metadata={
                "period": result.period_type,
                "period_start": result.period_start.isoformat(),
                "method": result.method,
                "tokens_used": result.report_tokens_used,
                "generation_time": result.report_generation_time,
            },
        ) as span:
            span.update_trace(
                user_id=str(result.user_id),
                session_id=session_id,
                tags=[result.method, result.period_type],
                output=result.generated_text,
            )
            for field in _FLOAT_METRIC_FIELDS:
                value: float | int | None = getattr(result, field)
                if value is not None:
                    span.score(name=field, value=float(value))

    def save(self) -> None:
        df = pd.DataFrame([r.to_dict() for r in self.results])
        df.to_csv(self.output_path, index=False)

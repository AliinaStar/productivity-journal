"""LangGraph report-generation pipeline.

Graph topology (5 nodes):

    START
      │  route_by_period()
      ├─── week  ──────────────────────────────────────────► retrieve_entries
      │                                                             │
      └─── month / year ──► collect_reports                  create_report ──► END
                                   │                               ▲
                            generate_summary                       │
                                   │                               │
                            retrieve_similar ──────────────────────┘
"""

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from src.rag.nodes import (
    collect_reports,
    create_report,
    generate_summary,
    retrieve_entries,
    retrieve_similar,
)
from src.rag.state import ReportState


def route_by_period(state: ReportState) -> str:
    """Route START → retrieve_entries (week) or collect_reports (month/year)."""
    return "retrieve_entries" if state["period"] == "week" else "collect_reports"


def build_pipeline() -> CompiledStateGraph:
    """Assemble and compile the 5-node LangGraph pipeline.

    Returns a compiled graph ready for ``await app.ainvoke({...})``.
    """
    graph = StateGraph(ReportState)

    graph.add_node("retrieve_entries", retrieve_entries)
    graph.add_node("collect_reports", collect_reports)
    graph.add_node("generate_summary", generate_summary)
    graph.add_node("retrieve_similar", retrieve_similar)
    graph.add_node("create_report", create_report)

    graph.add_conditional_edges(
        START,
        route_by_period,
        {
            "retrieve_entries": "retrieve_entries",
            "collect_reports": "collect_reports",
        },
    )
    graph.add_edge("retrieve_entries", "create_report")
    graph.add_edge("collect_reports", "generate_summary")
    graph.add_edge("generate_summary", "retrieve_similar")
    graph.add_edge("retrieve_similar", "create_report")
    graph.add_edge("create_report", END)

    return graph.compile()


# Module-level compiled app — import and invoke directly.
app: CompiledStateGraph = build_pipeline()

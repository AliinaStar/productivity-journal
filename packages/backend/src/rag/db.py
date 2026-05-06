"""Database query helpers for the report-generation pipeline.

All functions are async and use the shared ``get_async_sessionmaker`` singleton.
No business logic lives here — only data access.
"""

from datetime import date as date_type

from src.db.models import Entry, Goal, Report, User
from src.rag.state import DateDict


def format_entries(entries: list[dict]) -> str:
    """Format a list of ``{goal_id, name, notes}`` dicts into a prompt-ready string.

    Example output::

        **Goal A**
        - note 1
        - note 2

        **Goal B**
        - note 3
    """
    raise NotImplementedError


def build_where_clause(period: str, date: DateDict, user_id: int):
    """Return a SQLAlchemy WHERE expression that filters entries by period and user.

    Supports ``'week'``, ``'month'``, and ``'year'`` periods.
    Uses ``extract()`` on ``Entry.date_note``.
    """
    raise NotImplementedError


async def query_entries(period: str, date: DateDict, user_id: int) -> dict:
    """Load current-period entries together with aggregate metrics.

    Returns a dict with keys:
      - ``entries``          – list of ``{goal_id, name, notes}``
      - ``raw_entries``      – list of ORM ``Entry`` objects (for embeddings)
      - ``avg_productivity`` – float, rounded to 2 decimals
      - ``active_days``      – int
      - ``goal_metrics_block`` – pre-formatted string for the LLM prompt
    """
    raise NotImplementedError


async def query_sub_period_reports(
    period: str,
    date: DateDict,
    user_id: int,
) -> list[Report]:
    """Load sub-period ``Report`` rows from the DB for use in ``generate_summary``.

    - For ``period='month'``: fetches weekly reports that fall inside that month.
    - For ``period='year'``:  fetches monthly reports that fall inside that year.

    Returns rows ordered by ``period_start`` ascending.
    """
    raise NotImplementedError


async def get_user(user_id: int) -> User:
    """Fetch a single ``User`` row by primary key."""
    raise NotImplementedError


async def count_available_months(user_id: int, before_date: date_type) -> int:
    """Count distinct calendar months in the user's history before *before_date*.

    Used by ``retrieve_similar`` to populate ``total_available_months`` in context.
    """
    raise NotImplementedError


async def compute_pool_avg_similarity(
    user_id: int,
    before_date: date_type,
) -> float | None:
    """Compute average pairwise cosine similarity of all historical embeddings.

    Returns ``None`` when fewer than two embedded entries exist.
    Used as a diversity baseline for evaluation metrics.
    """
    raise NotImplementedError


async def get_all_users() -> list[User]:
    """Fetch all ``User`` rows from the DB.

    Used by the scheduler to iterate over users when running a batch
    report generation job.
    """
    raise NotImplementedError


async def save_report(
    user_id: int,
    period: str,
    period_start: date_type,
    period_end: date_type,
    avg_productivity: float | None,
    active_days: int,
    final_report: dict,
) -> Report:
    """Persist a generated report to the ``report`` table and return the new row.

    Args:
        user_id:          Owner of the report.
        period:           ``'week'``, ``'month'``, or ``'year'``.
        period_start:     First day of the covered period.
        period_end:       Last day of the covered period.
        avg_productivity: Average productivity score across all entries
                          in the period (may be ``None`` if no entries).
        active_days:      Number of distinct days with at least one entry.
        final_report:     Parsed report dict (``model.model_dump()``),
                          stored as JSONB.

    Returns:
        The newly created ``Report`` ORM object with its ``id`` populated.
    """
    raise NotImplementedError

from datetime import date, datetime

from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    Enum,
    Date,
    DateTime,
    CheckConstraint,
    Text,
    Float,
    Boolean,
    Index,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from src.db.base import Base

class Entry(Base):
    __tablename__ = "entry"
    __table_args__ = (
        Index(
            "ix_entry_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    goal_id: Mapped[int] = mapped_column(ForeignKey("goal.id"))
    date_note: Mapped[date] = mapped_column(Date)
    note: Mapped[str] = mapped_column(Text)
    productivity_score: Mapped[int] = mapped_column(
        Integer,
        CheckConstraint("productivity_score BETWEEN 1 AND 5", name="check_productivity_score")
    )
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(768),  # Alibaba-NLP/gte-multilingual-base
        nullable=True
    )
    # When the row was written, as opposed to date_note (which day the entry
    # is *about*). The gap between the two is the interesting part: it shows
    # whether someone journals day by day or backfills a whole week at once.
    #
    # Nullable on purpose. Entries that predate this column have no knowable
    # creation time, and backfilling them with the migration timestamp would
    # invent a spike of ~1500 entries "written" at deploy time — corrupting
    # exactly the analysis the column exists for. NULL means "unknown".
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        server_default=func.now(), onupdate=func.now(),
    )

    goal: Mapped["Goal"] = relationship(back_populates="entries")


class Goal(Base):
    __tablename__ = "goal"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    title: Mapped[str] = mapped_column(String(250))
    description: Mapped[str | None] = mapped_column(String(500))
    deadline: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Enum("active", "postpone", "finished", name="goal_status"))

    user: Mapped["User"] = relationship(back_populates="goals")
    entries: Mapped[list["Entry"]] = relationship(back_populates="goal")


class Report(Base):
    __tablename__ = "report"
    __table_args__ = (
        # One report per user per period — protects against duplicate rows when
        # a scheduler run is retried or the startup catch-up overlaps a cron job.
        UniqueConstraint(
            "user_id", "period", "period_start",
            name="uq_report_user_period_start",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    period: Mapped[str] = mapped_column(Enum("week", "month", "year", name="period_time"))
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    avg_productivity: Mapped[float | None] = mapped_column(Float, nullable=True)
    active_days: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[date] = mapped_column(Date)
    final_report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Cost and latency of the LLM run that produced this report. Both are
    # already measured by the create_report node; before this they were
    # computed and thrown away. Nullable: rows written earlier have no
    # measurement, and a failed-then-retried run may not have one either.
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    generation_time: Mapped[float | None] = mapped_column(Float, nullable=True)

    user: Mapped["User"] = relationship(back_populates="reports")


class AuthCode(Base):
    """One-time login code sent to the user's email.

    A new row is created on every ``POST /auth/send-code`` request.
    ``used`` is flipped to ``True`` after successful verification so the
    code cannot be reused. Expired or used rows can be cleaned up by a
    periodic job (not implemented yet).
    """

    __tablename__ = "auth_code"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(250), nullable=False, index=True)
    # SHA-256 hex digest of the OTP — the plaintext code is never stored.
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)


class RefreshToken(Base):
    """Server-side allowlist of issued refresh tokens.

    JWTs are stateless, so to support real logout / revocation we track each
    issued refresh token by its ``jti`` claim. ``/auth/refresh`` only succeeds
    if a matching, non-revoked, non-expired row exists. Logout flips
    ``revoked`` to ``True``. Expired/revoked rows are purged by a periodic job.
    """

    __tablename__ = "refresh_token"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    jti: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)


class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(250), unique=True)
    language: Mapped[str] = mapped_column(String(50), server_default="English")
    gender: Mapped[str | None] = mapped_column(
        Enum("male", "female", "unspecified", name="gender"),
        nullable=True
    )
    # Coarse age range instead of an exact birth year. The
    # lowest bucket starts at 13:  (see privacy policy §7).
    age_group: Mapped[str | None] = mapped_column(
        Enum("13-17", "18-24", "25-34", "35-44", "45-54", "55+", name="age_group"),
        nullable=True,
    )
    # Timestamp at which the user accepted the privacy policy (GDPR consent).
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Expo push token of the user's most recent device (ExponentPushToken[...]).
    # NULL when the user never granted notification permissions.
    expo_push_token: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # IANA zone name reported by the device ("Europe/Kyiv"). Decides when a
    # week ends for this user, which in turn decides both how long an entry
    # stays editable and when their reports are generated (see
    # ``src/core/periods.py``). NULL — for accounts that predate the column or
    # clients that have not synced yet — is read as UTC, the previous behaviour.
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)

    reports: Mapped[list["Report"]] = relationship(back_populates="user")
    goals: Mapped[list['Goal']] = relationship(back_populates="user")

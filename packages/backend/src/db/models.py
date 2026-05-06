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
    note: Mapped[str] = mapped_column(Text) # didn't create migration
    productivity_score: Mapped[int] = mapped_column(
        Integer,
        CheckConstraint("productivity_score BETWEEN 1 AND 5", name="check_productivity_score")
    )
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(768),  # Alibaba-NLP/gte-multilingual-base
        nullable=True
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

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    period: Mapped[str] = mapped_column(Enum("week", "month", "year", name="period_time"))
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    avg_productivity: Mapped[float | None] = mapped_column(Float, nullable=True)
    active_days: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[date] = mapped_column(Date)
    final_report: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

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
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


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

    reports: Mapped[list["Report"]] = relationship(back_populates="user")
    goals: Mapped[list['Goal']] = relationship(back_populates="user")

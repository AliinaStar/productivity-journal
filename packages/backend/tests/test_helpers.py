"""Unit tests for small pure route helpers."""

from datetime import date

from src.routes.auth import _generate_code
from src.routes.reports import _date_to_dict


def test_generate_code_is_six_digits():
    for _ in range(50):
        code = _generate_code()
        assert len(code) == 6
        assert code.isdigit()


def test_date_to_dict_week():
    # 2025-04-07 is ISO week 15 of 2025.
    assert _date_to_dict("week", date(2025, 4, 7)) == {"year": 2025, "week": 15}


def test_date_to_dict_month():
    assert _date_to_dict("month", date(2025, 4, 7)) == {"year": 2025, "month": 4}


def test_date_to_dict_year():
    assert _date_to_dict("year", date(2025, 4, 7)) == {"year": 2025}

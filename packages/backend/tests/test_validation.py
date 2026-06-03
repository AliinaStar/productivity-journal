"""Tests for request input validation (422 instead of a DB 500)."""

_GOAL = {"title": "G", "status": "active", "created_at": "2026-01-01"}


def _make_goal(client, headers) -> int:
    return client.post("/goals", json=_GOAL, headers=headers).json()["id"]


def _entry(goal_id, **over):
    return {"goal_id": goal_id, "date_note": "2026-01-02", "note": "ok",
            "productivity_score": 3, **over}


def test_score_out_of_range_rejected(client, make_user):
    user = make_user()
    gid = _make_goal(client, user["headers"])
    assert client.post("/entries", json=_entry(gid, productivity_score=6), headers=user["headers"]).status_code == 422
    assert client.post("/entries", json=_entry(gid, productivity_score=0), headers=user["headers"]).status_code == 422


def test_empty_and_oversized_note_rejected(client, make_user):
    user = make_user()
    gid = _make_goal(client, user["headers"])
    assert client.post("/entries", json=_entry(gid, note=""), headers=user["headers"]).status_code == 422
    assert client.post("/entries", json=_entry(gid, note="x" * 5001), headers=user["headers"]).status_code == 422


def test_bad_date_rejected(client, make_user):
    user = make_user()
    gid = _make_goal(client, user["headers"])
    assert client.post("/entries", json=_entry(gid, date_note="not-a-date"), headers=user["headers"]).status_code == 422


def test_valid_entry_accepted(client, make_user):
    user = make_user()
    gid = _make_goal(client, user["headers"])
    assert client.post("/entries", json=_entry(gid), headers=user["headers"]).status_code == 200


def test_invalid_goal_status_rejected(client, make_user):
    user = make_user()
    res = client.post("/goals", json={**_GOAL, "status": "bogus"}, headers=user["headers"])
    assert res.status_code == 422


def test_oversized_goal_title_rejected(client, make_user):
    user = make_user()
    res = client.post("/goals", json={**_GOAL, "title": "x" * 251}, headers=user["headers"])
    assert res.status_code == 422


def test_bad_goal_date_rejected(client, make_user):
    user = make_user()
    res = client.post("/goals", json={**_GOAL, "created_at": "31-01-2026"}, headers=user["headers"])
    assert res.status_code == 422

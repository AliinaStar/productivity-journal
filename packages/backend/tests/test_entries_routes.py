"""Integration tests for entry routes — auth, ownership, isolation, and the
week-long window during which an entry can still be changed.

Embeddings are stubbed (see conftest._stub_external) so no model is loaded.
"""

from datetime import datetime, timedelta, timezone

_GOAL = {"title": "Read more", "status": "active", "created_at": "2026-01-01"}

# Far enough in the past that its week is definitively closed. A fixed date is
# safe here precisely because it can only get older.
_CLOSED_WEEK_DAY = "2026-01-02"


def _today() -> str:
    """Today in UTC — the zone a user with no stored timezone is read as."""
    return datetime.now(timezone.utc).date().isoformat()


def _make_goal(client, headers) -> int:
    return client.post("/goals", json=_GOAL, headers=headers).json()["id"]


def _entry_body(goal_id: int, date_note: str | None = None) -> dict:
    return {
        "goal_id": goal_id,
        "date_note": date_note or _today(),
        "note": "read 20 pages",
        "productivity_score": 4,
    }


def _create_entry(client, headers, goal_id: int, date_note: str | None = None) -> dict:
    res = client.post("/entries", json=_entry_body(goal_id, date_note), headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def test_entries_require_authentication(client):
    assert client.get("/entries").status_code in (401, 403)


def test_create_and_list_entry(client, make_user):
    user = make_user()
    goal_id = _make_goal(client, user["headers"])

    created = client.post("/entries", json=_entry_body(goal_id), headers=user["headers"])
    assert created.status_code == 200
    assert created.json()["note"] == "read 20 pages"
    # A freshly created entry carries a server-set creation timestamp; only
    # rows predating the column are allowed to be null.
    assert created.json()["created_at"] is not None

    listed = client.get("/entries", headers=user["headers"]).json()
    assert len(listed) == 1
    assert listed[0]["goal_id"] == goal_id


def test_create_entry_honours_client_created_at(client, make_user):
    """An offline entry syncs with the device's real write time, not sync time."""
    user = make_user()
    goal_id = _make_goal(client, user["headers"])

    body = _entry_body(goal_id, _CLOSED_WEEK_DAY) | {"created_at": "2026-01-02T09:30:00+00:00"}
    created = client.post("/entries", json=body, headers=user["headers"])
    assert created.status_code == 200
    assert created.json()["created_at"].startswith("2026-01-02T09:30:00")


def test_new_entry_does_not_look_edited(client, make_user):
    """updated_at == created_at is how the UI decides an entry is untouched.
    A backfilled entry carries a created_at days behind its sync time, so
    letting updated_at default to now() would mark it edited on arrival."""
    user = make_user()
    goal_id = _make_goal(client, user["headers"])

    body = _entry_body(goal_id, _CLOSED_WEEK_DAY) | {"created_at": "2026-01-02T09:30:00+00:00"}
    created = client.post("/entries", json=body, headers=user["headers"]).json()
    assert created["updated_at"] == created["created_at"]


def test_create_entry_ignores_unparseable_created_at(client, make_user):
    """A bad client clock must never block a sync — the server default applies."""
    user = make_user()
    goal_id = _make_goal(client, user["headers"])

    body = _entry_body(goal_id) | {"created_at": "not-a-date"}
    created = client.post("/entries", json=body, headers=user["headers"])
    assert created.status_code == 200
    assert created.json()["created_at"] is not None


def test_update_entry(client, make_user):
    user = make_user()
    goal_id = _make_goal(client, user["headers"])
    entry_id = _create_entry(client, user["headers"], goal_id)["id"]

    res = client.patch(f"/entries/{entry_id}", json={"productivity_score": 1}, headers=user["headers"])
    assert res.status_code == 200
    assert res.json()["productivity_score"] == 1


def test_entry_reports_its_own_edit_deadline(client, make_user):
    """The client shows the deadline the server enforces rather than deriving
    it from a device clock that may sit in a different zone."""
    user = make_user()
    goal_id = _make_goal(client, user["headers"])
    created = _create_entry(client, user["headers"], goal_id)

    from src.core.periods import bounds_containing
    from datetime import date

    _, week_end = bounds_containing("week", date.fromisoformat(created["date_note"]))
    assert created["editable_until"] == week_end.isoformat()
    assert created["updated_at"] is not None


def test_editing_bumps_updated_at(client, make_user):
    user = make_user()
    goal_id = _make_goal(client, user["headers"])
    created = _create_entry(client, user["headers"], goal_id)

    edited = client.patch(
        f"/entries/{created['id']}", json={"note": "read 40 pages"}, headers=user["headers"]
    ).json()
    assert edited["note"] == "read 40 pages"
    assert edited["updated_at"] >= created["updated_at"]
    # created_at must survive an edit — it is what says when the note was written.
    assert edited["created_at"] == created["created_at"]


def test_cannot_update_entry_from_a_closed_week(client, make_user):
    """Once the week is over its report quotes the entry, so it freezes."""
    user = make_user()
    goal_id = _make_goal(client, user["headers"])
    entry_id = _create_entry(client, user["headers"], goal_id, _CLOSED_WEEK_DAY)["id"]

    res = client.patch(f"/entries/{entry_id}", json={"note": "rewritten"}, headers=user["headers"])
    assert res.status_code == 403


def test_cannot_move_entry_into_a_different_week(client, make_user):
    """Otherwise an open entry could be dropped into an already-reported week."""
    user = make_user()
    goal_id = _make_goal(client, user["headers"])
    created = _create_entry(client, user["headers"], goal_id)

    other_week = (
        datetime.fromisoformat(created["date_note"]) - timedelta(days=14)
    ).date().isoformat()
    res = client.patch(
        f"/entries/{created['id']}", json={"date_note": other_week}, headers=user["headers"]
    )
    assert res.status_code == 422


def test_can_move_entry_within_its_own_week(client, make_user):
    user = make_user()
    goal_id = _make_goal(client, user["headers"])
    created = _create_entry(client, user["headers"], goal_id)

    from src.core.periods import bounds_containing
    from datetime import date

    week_start, _ = bounds_containing("week", date.fromisoformat(created["date_note"]))
    res = client.patch(
        f"/entries/{created['id']}",
        json={"date_note": week_start.isoformat()},
        headers=user["headers"],
    )
    assert res.status_code == 200
    assert res.json()["date_note"] == week_start.isoformat()


def test_delete_entry_inside_its_week(client, make_user):
    user = make_user()
    goal_id = _make_goal(client, user["headers"])
    entry_id = _create_entry(client, user["headers"], goal_id)["id"]

    assert client.delete(f"/entries/{entry_id}", headers=user["headers"]).status_code == 204
    assert client.get("/entries", headers=user["headers"]).json() == []


def test_cannot_delete_entry_from_a_closed_week(client, make_user):
    user = make_user()
    goal_id = _make_goal(client, user["headers"])
    entry_id = _create_entry(client, user["headers"], goal_id, _CLOSED_WEEK_DAY)["id"]

    assert client.delete(f"/entries/{entry_id}", headers=user["headers"]).status_code == 403
    assert len(client.get("/entries", headers=user["headers"]).json()) == 1


def test_cannot_delete_another_users_entry(client, make_user):
    alice = make_user("alice@example.com")
    bob = make_user("bob@example.com")
    alice_goal = _make_goal(client, alice["headers"])
    entry_id = _create_entry(client, alice["headers"], alice_goal)["id"]

    assert client.delete(f"/entries/{entry_id}", headers=bob["headers"]).status_code == 404
    assert len(client.get("/entries", headers=alice["headers"]).json()) == 1


def test_edit_window_follows_the_users_timezone(client, make_user, monkeypatch):
    """Same entry, same instant: still open for a user west of UTC, closed for
    one in Kyiv. This is the case a fixed UTC deadline got wrong."""
    from datetime import date

    from src.core import periods

    user = make_user()
    goal_id = _make_goal(client, user["headers"])
    entry = _create_entry(client, user["headers"], goal_id)
    _, week_end = periods.bounds_containing("week", date.fromisoformat(entry["date_note"]))

    # 04:00 UTC on the Monday after: already Monday in Kyiv (UTC+2/+3), still
    # Sunday evening in Vancouver (UTC-7/-8) in either DST season. Freeze the
    # one clock every period helper reads.
    instant = datetime.combine(
        week_end + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
    ).replace(hour=4)
    monkeypatch.setattr(periods, "local_now", lambda tz: instant.astimezone(tz))

    client.patch("/users/me", json={"timezone": "America/Vancouver"}, headers=user["headers"])
    assert client.patch(
        f"/entries/{entry['id']}", json={"note": "still open"}, headers=user["headers"]
    ).status_code == 200

    client.patch("/users/me", json={"timezone": "Europe/Kyiv"}, headers=user["headers"])
    assert client.patch(
        f"/entries/{entry['id']}", json={"note": "too late"}, headers=user["headers"]
    ).status_code == 403


def test_cannot_create_entry_on_another_users_goal(client, make_user):
    alice = make_user("alice@example.com")
    bob = make_user("bob@example.com")
    alice_goal = _make_goal(client, alice["headers"])

    res = client.post("/entries", json=_entry_body(alice_goal), headers=bob["headers"])
    assert res.status_code == 404


def test_entries_isolated_between_users(client, make_user):
    alice = make_user("alice@example.com")
    bob = make_user("bob@example.com")
    alice_goal = _make_goal(client, alice["headers"])
    client.post("/entries", json=_entry_body(alice_goal), headers=alice["headers"])

    assert client.get("/entries", headers=bob["headers"]).json() == []


def test_cannot_update_another_users_entry(client, make_user):
    alice = make_user("alice@example.com")
    bob = make_user("bob@example.com")
    alice_goal = _make_goal(client, alice["headers"])
    entry_id = client.post("/entries", json=_entry_body(alice_goal), headers=alice["headers"]).json()["id"]

    res = client.patch(f"/entries/{entry_id}", json={"note": "hijacked"}, headers=bob["headers"])
    assert res.status_code == 404

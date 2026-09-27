import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.auth import get_current_active_user
from app.models import (
    User, Like, Match, Chat, Notification, UserBlock,
    MatchingProfile, MatchingProfileImage,
)

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db
client = TestClient(app)
Base.metadata.create_all(
    bind=engine,
    tables=[
        m.__table__
        for m in (User, Like, Match, Chat, Notification, UserBlock, MatchingProfile, MatchingProfileImage)
    ],
)


@pytest.fixture(autouse=True)
def db():
    session = TestingSession()
    try:
        yield session
    finally:
        for model in (Notification, Chat, Match, Like, UserBlock, User):
            session.query(model).delete()
        session.commit()
        session.close()
        app.dependency_overrides.pop(get_current_active_user, None)


def _make_user(db, email: str) -> User:
    user = User(
        email=email,
        password_hash="x",
        display_name=email.split("@")[0],
        membership_type="premium",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _as(user: User):
    def _current_user():
        return user

    app.dependency_overrides[get_current_active_user] = _current_user


def _like(user: User, to_user_id: int):
    _as(user)
    return client.post(f"/api/matching/likes/{to_user_id}")


def test_one_sided_like_does_not_match(db):
    a = _make_user(db, "a@example.com")
    b = _make_user(db, "b@example.com")

    res = _like(a, b.id)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "liked"
    assert body["matched"] is False

    assert db.query(Like).count() == 1
    assert db.query(Match).count() == 0
    assert db.query(Chat).count() == 0


def test_mutual_like_creates_match_chat_and_notifications(db):
    a = _make_user(db, "a@example.com")
    b = _make_user(db, "b@example.com")

    _like(a, b.id)
    res = _like(b, a.id)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "matched"
    assert body["matched"] is True

    match = db.query(Match).one()
    chat = db.query(Chat).one()
    assert body["match_id"] == match.id
    assert body["chat_id"] == chat.id
    assert (match.user_a_id, match.user_b_id) == tuple(sorted([a.id, b.id]))
    assert match.active_flag is True
    assert chat.match_id == match.id

    notifs = db.query(Notification).filter(Notification.type == "match").all()
    assert sorted(n.user_id for n in notifs) == sorted([a.id, b.id])
    for n in notifs:
        assert n.payload["match_id"] == match.id
        assert n.payload["chat_id"] == chat.id


def test_repeated_like_is_idempotent(db):
    a = _make_user(db, "a@example.com")
    b = _make_user(db, "b@example.com")

    _like(a, b.id)
    first = _like(b, a.id).json()
    second = _like(b, a.id).json()
    third = _like(a, b.id).json()

    assert first["match_id"] == second["match_id"] == third["match_id"]
    assert db.query(Like).count() == 2
    assert db.query(Match).count() == 1
    assert db.query(Chat).count() == 1
    assert db.query(Notification).filter(Notification.type == "match").count() == 2


def test_withdrawn_like_is_reactivated_and_matches(db):
    a = _make_user(db, "a@example.com")
    b = _make_user(db, "b@example.com")

    _like(a, b.id)
    _as(a)
    assert client.delete(f"/api/matching/likes/{b.id}").status_code == 200
    db.expire_all()
    assert db.query(Like).one().status == "withdrawn"

    res = _like(b, a.id).json()
    assert res["matched"] is False
    assert db.query(Match).count() == 0

    res = _like(a, b.id).json()
    assert res["matched"] is True
    assert db.query(Match).count() == 1


def test_self_like_rejected(db):
    a = _make_user(db, "a@example.com")
    res = _like(a, a.id)
    assert res.status_code == 400


def test_like_blocked_user_rejected(db):
    a = _make_user(db, "a@example.com")
    b = _make_user(db, "b@example.com")
    db.add(UserBlock(blocker_id=b.id, blocked_id=a.id))
    db.commit()

    res = _like(a, b.id)
    assert res.status_code == 403
    assert db.query(Like).count() == 0


def test_list_matches_and_unmatch(db):
    a = _make_user(db, "a@example.com")
    b = _make_user(db, "b@example.com")
    _like(a, b.id)
    match_id = _like(b, a.id).json()["match_id"]

    _as(a)
    items = client.get("/api/matching/matches").json()["items"]
    assert len(items) == 1
    assert items[0]["match_id"] == match_id
    assert items[0]["user_id"] == b.id
    assert items[0]["chat_id"] is not None

    res = client.delete(f"/api/matching/matches/{match_id}")
    assert res.status_code == 200
    db.expire_all()
    assert db.query(Match).one().active_flag is False
    assert all(l.status == "withdrawn" for l in db.query(Like).all())
    assert client.get("/api/matching/matches").json()["items"] == []

    # 再度相互いいねで同じ Match を再有効化（重複作成しない）
    _like(a, b.id)
    res = _like(b, a.id).json()
    assert res["matched"] is True
    assert res["match_id"] == match_id
    assert db.query(Match).count() == 1
    assert db.query(Chat).count() == 1

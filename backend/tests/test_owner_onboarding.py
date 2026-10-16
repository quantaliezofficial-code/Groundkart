"""
05_App_Flow.md §3/§4: customer submits a verification doc, an admin
approves or rejects it. The interesting assertions here aren't just status
codes — they're "did the role actually flip," "did the rejection leave the
role alone," and "is there an audit_logs row for this," since those are
the parts a shallow test could miss entirely while still getting the HTTP
status code right.
"""
import uuid

import httpx
import pytest
from sqlalchemy import select

from app.db import get_db, get_idem_db
from app.main import app
from app.models.core import AuditLog, User
from app.modules.auth.security import create_access_token


@pytest.fixture
async def client(test_session_factory):
    async def _override_get_db():
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_idem_db] = _override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def _fake_pdf_bytes() -> bytes:
    return b"%PDF-1.4 fake but non-empty content for a unit test\n"


async def test_customer_can_submit_verification(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof.pdf", _fake_pdf_bytes(), "application/pdf")},
        data={"business_name": "Sharma Sports Co."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"
    assert body["business_name"] == "Sharma Sports Co."


async def test_second_pending_submission_is_rejected_with_409(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    first = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof.pdf", _fake_pdf_bytes(), "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    second = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof_2.pdf", _fake_pdf_bytes(), "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert first.status_code == 201
    assert second.status_code == 409


async def test_unsupported_file_type_rejected_with_422(client, seeded_customer):
    token = create_access_token(seeded_customer, "customer")
    resp = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("script.exe", b"not a real document", "application/x-msdownload")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


async def test_approval_flips_role_and_is_verified_and_writes_audit_log(
    client, test_session_factory, seeded_customer, seeded_admin
):
    customer_token = create_access_token(seeded_customer, "customer")
    submit_resp = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof.pdf", _fake_pdf_bytes(), "application/pdf")},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    verification_id = submit_resp.json()["id"]

    admin_token = create_access_token(seeded_admin, "admin")
    approve_resp = await client.post(
        f"/api/v1/admin/owner-verifications/{verification_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "approved"

    # The actual point: did the user row really change.
    async with test_session_factory() as session:
        user = (
            await session.execute(select(User).where(User.id == seeded_customer))
        ).scalar_one()
        assert user.role == "owner"
        assert user.is_verified is True

        logs = (
            await session.execute(
                select(AuditLog).where(AuditLog.entity_id == uuid.UUID(verification_id))
            )
        ).scalars().all()
        assert len(logs) == 1
        assert logs[0].action == "owner_verification.approved"
        assert logs[0].actor_id == seeded_admin


async def test_get_me_reflects_role_change_after_approval(
    client, test_session_factory, seeded_customer, seeded_admin
):
    customer_token = create_access_token(seeded_customer, "customer")

    before = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {customer_token}"})
    assert before.json()["role"] == "customer"
    assert before.json()["is_verified"] is False

    submit_resp = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof.pdf", _fake_pdf_bytes(), "application/pdf")},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    admin_token = create_access_token(seeded_admin, "admin")
    await client.post(
        f"/api/v1/admin/owner-verifications/{submit_resp.json()['id']}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    after = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {customer_token}"})
    assert after.json()["role"] == "owner"
    assert after.json()["is_verified"] is True


async def test_rejection_leaves_role_unchanged_and_records_reason(
    client, test_session_factory, seeded_customer, seeded_admin
):
    customer_token = create_access_token(seeded_customer, "customer")
    submit_resp = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof.pdf", _fake_pdf_bytes(), "application/pdf")},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    verification_id = submit_resp.json()["id"]

    admin_token = create_access_token(seeded_admin, "admin")
    reject_resp = await client.post(
        f"/api/v1/admin/owner-verifications/{verification_id}/reject",
        json={"reason": "Document is illegible — please resubmit a clearer scan."},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reject_resp.status_code == 200
    assert reject_resp.json()["status"] == "rejected"
    assert "illegible" in reject_resp.json()["rejection_reason"]

    async with test_session_factory() as session:
        user = (
            await session.execute(select(User).where(User.id == seeded_customer))
        ).scalar_one()
        assert user.role == "customer"  # unchanged
        assert user.is_verified is False  # unchanged


async def test_rejection_allows_resubmission(client, seeded_customer, seeded_admin):
    """The whole point of distinguishing rejected-from-pending: a rejected
    user can submit again, exactly because the previous row's status is no
    longer 'pending'."""
    customer_token = create_access_token(seeded_customer, "customer")
    first = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof.pdf", _fake_pdf_bytes(), "application/pdf")},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    admin_token = create_access_token(seeded_admin, "admin")
    await client.post(
        f"/api/v1/admin/owner-verifications/{first.json()['id']}/reject",
        json={"reason": "Blurry scan"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    second = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof_v2.pdf", _fake_pdf_bytes(), "application/pdf")},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert second.status_code == 201


async def test_non_admin_cannot_approve(client, seeded_customer, seeded_owner_with_unit):
    owner_id, _, _ = seeded_owner_with_unit
    customer_token = create_access_token(seeded_customer, "customer")
    submit_resp = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof.pdf", _fake_pdf_bytes(), "application/pdf")},
        headers={"Authorization": f"Bearer {customer_token}"},
    )

    owner_token = create_access_token(owner_id, "owner")  # owner, not admin
    resp = await client.post(
        f"/api/v1/admin/owner-verifications/{submit_resp.json()['id']}/approve",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 403


async def test_approving_an_already_decided_request_returns_409(
    client, seeded_customer, seeded_admin
):
    customer_token = create_access_token(seeded_customer, "customer")
    submit_resp = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof.pdf", _fake_pdf_bytes(), "application/pdf")},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    admin_token = create_access_token(seeded_admin, "admin")
    verification_id = submit_resp.json()["id"]

    first_approve = await client.post(
        f"/api/v1/admin/owner-verifications/{verification_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    second_approve = await client.post(
        f"/api/v1/admin/owner-verifications/{verification_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert first_approve.status_code == 200
    assert second_approve.status_code == 409


async def test_admin_can_view_verification_document(
    client, seeded_customer, seeded_admin
):
    customer_token = create_access_token(seeded_customer, "customer")
    submit_resp = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof.pdf", _fake_pdf_bytes(), "application/pdf")},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    verification_id = submit_resp.json()["id"]

    admin_token = create_access_token(seeded_admin, "admin")
    resp = await client.get(
        f"/api/v1/admin/owner-verifications/{verification_id}/document",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.content == _fake_pdf_bytes()


async def test_owner_cannot_view_verification_document(
    client, seeded_customer, seeded_owner_with_unit
):
    owner_id, _, _ = seeded_owner_with_unit
    customer_token = create_access_token(seeded_customer, "customer")
    submit_resp = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof.pdf", _fake_pdf_bytes(), "application/pdf")},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    verification_id = submit_resp.json()["id"]

    owner_token = create_access_token(owner_id, "owner")
    resp = await client.get(
        f"/api/v1/admin/owner-verifications/{verification_id}/document",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 403


async def test_customer_cannot_view_verification_document(
    client, seeded_customer
):
    customer_token = create_access_token(seeded_customer, "customer")
    submit_resp = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof.pdf", _fake_pdf_bytes(), "application/pdf")},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    verification_id = submit_resp.json()["id"]

    resp = await client.get(
        f"/api/v1/admin/owner-verifications/{verification_id}/document",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert resp.status_code == 403


async def test_anonymous_cannot_view_verification_document(
    client, seeded_customer
):
    customer_token = create_access_token(seeded_customer, "customer")
    submit_resp = await client.post(
        "/api/v1/owner/verification",
        files={"document": ("id_proof.pdf", _fake_pdf_bytes(), "application/pdf")},
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    verification_id = submit_resp.json()["id"]

    resp = await client.get(
        f"/api/v1/admin/owner-verifications/{verification_id}/document"
    )
    assert resp.status_code == 401


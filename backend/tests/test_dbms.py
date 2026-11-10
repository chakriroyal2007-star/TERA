"""
Unit and integration tests for TERA DBMS Studio.
Verifies schema discovery, Chen ER diagram generation, functional dependency algorithms,
normalization assessment, and safe SQL execution.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.dbms.algorithms import (
    compute_attribute_closure,
    find_candidate_keys,
    compute_minimal_cover,
    assess_normal_form,
)

client = TestClient(app)


@pytest.fixture
def auth_admin(client, staff):
    """Authenticates admin user and retains session on client."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "test-passphrase-123"},
    )
    assert resp.status_code == 200
    return client


def test_fd_algorithms():
    """Verifies functional dependency mathematical operations: closure, candidate keys, minimal cover."""
    # Relation R(A, B, C, D) with FDs: A -> B, B -> C, AC -> D
    fds = [
        ({"A"}, {"B"}),
        ({"B"}, {"C"}),
        ({"A", "C"}, {"D"}),
    ]

    # 1. Attribute closure of {A} should be {A, B, C, D}
    closure_a = compute_attribute_closure({"A"}, fds)
    assert closure_a == {"A", "B", "C", "D"}

    # 2. Attribute closure of {B} should be {B, C}
    closure_b = compute_attribute_closure({"B"}, fds)
    assert closure_b == {"B", "C"}

    # 3. Candidate key should be {"A"}
    candidate_keys = find_candidate_keys({"A", "B", "C", "D"}, fds)
    assert [{"A"}] == candidate_keys

    # 4. Minimal cover
    minimal = compute_minimal_cover(fds)
    assert len(minimal) > 0

    # 5. Normal form assessment: A is candidate key, A -> B, B -> C has non-superkey determinant
    # B -> C violates BCNF and 3NF because B is not a superkey and C is not prime!
    nf = assess_normal_form({"A", "B", "C", "D"}, candidate_keys, fds)
    assert nf["is_1nf"] is True
    assert nf["is_2nf"] is True
    assert nf["is_3nf"] is False  # Transitive dependency B -> C
    assert nf["is_bcnf"] is False


def test_dbms_overview(auth_admin):
    """Verifies DBMS overview endpoint returns actual database metadata."""
    resp = auth_admin.get("/api/v1/dbms/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_tables"] > 0
    assert data["total_attributes"] > 0
    assert data["total_primary_keys"] > 0
    assert "dialect" in data


def test_dbms_tables(auth_admin):
    """Verifies tables metadata endpoint returns columns, PKs, FKs, and constraints."""
    resp = auth_admin.get("/api/v1/dbms/tables")
    assert resp.status_code == 200
    tables = resp.json()
    assert isinstance(tables, list)
    assert len(tables) > 0

    table_names = [t["name"] for t in tables]
    assert "incidents" in table_names
    assert "users" in table_names

    incident_table = next(t for t in tables if t["name"] == "incidents")
    col_names = [c["name"] for c in incident_table["columns"]]
    assert "id" in col_names
    assert "case_id" in col_names
    assert "status" in col_names


def test_dbms_chen_er_model(auth_admin):
    """Verifies Chen ER model endpoint generates valid entities, weak entities, and relationships."""
    resp = auth_admin.get("/api/v1/dbms/er-model")
    assert resp.status_code == 200
    model = resp.json()
    assert "entities" in model
    assert "relationships" in model

    entities = {e["table_name"]: e for e in model["entities"]}
    assert "incidents" in entities
    assert "users" in entities

    # Incidents entity attributes check
    inc_attrs = [a["name"] for a in entities["incidents"]["attributes"]]
    assert "id" in inc_attrs


def test_dbms_sql_execution_safe(auth_admin):
    """Verifies safe read-only SQL queries execute and return rows and duration."""
    csrf_token = auth_admin.cookies.get("tera_csrf", "")
    resp = auth_admin.post(
        "/api/v1/dbms/sql/execute",
        json={"query": "SELECT id, category, status FROM incidents", "limit": 10},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "columns" in data
    assert "rows" in data
    assert "duration_ms" in data


def test_dbms_sql_execution_destructive_blocked(auth_admin):
    """Verifies that destructive queries (DROP, DELETE, ALTER, etc.) are strictly rejected."""
    csrf_token = auth_admin.cookies.get("tera_csrf", "")
    bad_queries = [
        "DROP TABLE users",
        "DELETE FROM incidents",
        "ALTER TABLE users DROP COLUMN email",
        "TRUNCATE incidents",
        "INSERT INTO roles VALUES ('hacker')",
    ]
    for q in bad_queries:
        resp = auth_admin.post(
            "/api/v1/dbms/sql/execute",
            json={"query": q, "limit": 10},
            headers={"X-CSRF-Token": csrf_token},
        )
        assert resp.status_code == 400
        assert "Security violation" in resp.json()["detail"] or "Only read-only queries" in resp.json()["detail"]


def test_dbms_documentation(auth_admin):
    """Verifies documentation generator produces complete technical specification."""
    resp = auth_admin.get("/api/v1/dbms/documentation")
    assert resp.status_code == 200
    data = resp.json()
    assert "markdown" in data
    assert "# TERA Database Management System" in data["markdown"]
    assert "incidents" in data["markdown"]

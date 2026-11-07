"""
Database Introspection Service for TERA DBMS Studio.
Discovers real-time PostgreSQL / SQLite metadata via SQLAlchemy Inspector and system catalogs.
"""

from typing import Dict, Any, List, Set, Optional
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from app.db import engine, Base
import app.models as models


def get_dbms_overview(eng: Engine) -> Dict[str, Any]:
    """Retrieves high-level metadata statistics across the entire database."""
    insp = inspect(eng)
    table_names = sorted(insp.get_table_names())
    view_names = sorted(insp.get_view_names())

    dialect_name = eng.dialect.name
    total_attributes = 0
    total_pks = 0
    total_fks = 0
    total_indexes = 0
    total_constraints = 0

    fk_relationships_set: Set[Tuple] = set()

    for table in table_names:
        cols = insp.get_columns(table)
        total_attributes += len(cols)
        
        pk_constraint = insp.get_pk_constraint(table)
        if pk_constraint and pk_constraint.get("constrained_columns"):
            total_pks += len(pk_constraint["constrained_columns"])

        fks = insp.get_foreign_keys(table)
        total_fks += len(fks)
        for fk in fks:
            fk_relationships_set.add((table, fk.get("referred_table"), tuple(fk.get("constrained_columns", []))))

        indexes = insp.get_indexes(table)
        total_indexes += len(indexes)

        unique_constraints = insp.get_unique_constraints(table)
        check_constraints = insp.get_check_constraints(table)
        total_constraints += len(unique_constraints) + len(check_constraints)

    # Triggers and Functions count
    triggers_count = 0
    functions_count = 0
    db_version = "Unknown"
    db_size = "N/A"

    with eng.connect() as conn:
        if dialect_name == "postgresql":
            try:
                res = conn.execute(text("SELECT count(*) FROM information_schema.triggers WHERE trigger_schema NOT IN ('pg_catalog', 'information_schema')")).scalar()
                triggers_count = res or 0
            except Exception:
                pass
            try:
                res = conn.execute(text("SELECT count(*) FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'public'")).scalar()
                functions_count = res or 0
            except Exception:
                pass
            try:
                res = conn.execute(text("SELECT pg_size_pretty(pg_database_size(current_database()))")).scalar()
                db_size = str(res)
            except Exception:
                pass
            try:
                res = conn.execute(text("SHOW server_version")).scalar()
                db_version = f"PostgreSQL {res}"
            except Exception:
                pass
        else:
            try:
                res = conn.execute(text("SELECT count(*) FROM sqlite_master WHERE type='trigger'")).scalar()
                triggers_count = res or 0
            except Exception:
                pass
            db_version = "SQLite 3.x (Serverless Runtime Storage)"
            db_size = "Local DB"

    return {
        "dialect": dialect_name,
        "database_version": db_version,
        "database_size": db_size,
        "total_tables": len(table_names),
        "total_entities": len(table_names),
        "total_relationships": len(fk_relationships_set),
        "total_attributes": total_attributes,
        "total_primary_keys": total_pks,
        "total_foreign_keys": total_fks,
        "total_indexes": total_indexes,
        "total_constraints": total_constraints,
        "total_views": len(view_names),
        "total_triggers": triggers_count,
        "total_functions": functions_count,
        "schema_name": "public" if dialect_name == "postgresql" else "main",
    }


def get_all_tables_metadata(eng: Engine) -> List[Dict[str, Any]]:
    """Discovers every table and provides comprehensive structural metadata."""
    insp = inspect(eng)
    table_names = sorted(insp.get_table_names())
    tables_result: List[Dict[str, Any]] = []

    # Map tables that have models to get their docstring descriptions
    model_descriptions: Dict[str, str] = {}
    for attr in dir(models):
        item = getattr(models, attr)
        if isinstance(item, type) and issubclass(item, Base) and hasattr(item, "__tablename__"):
            tname = getattr(item, "__tablename__")
            doc = (item.__doc__ or "").strip()
            if doc:
                model_descriptions[tname] = doc

    # Collect all foreign keys to determine referencing tables
    referencing_map: Dict[str, List[Dict[str, Any]]] = {t: [] for t in table_names}
    for t in table_names:
        for fk in insp.get_foreign_keys(t):
            target = fk.get("referred_table")
            if target in referencing_map:
                referencing_map[target].append({
                    "from_table": t,
                    "from_columns": fk.get("constrained_columns", []),
                    "to_columns": fk.get("referred_columns", []),
                    "constraint_name": fk.get("name"),
                })

    for table in table_names:
        cols = insp.get_columns(table)
        pk = insp.get_pk_constraint(table)
        pk_cols = set(pk.get("constrained_columns", []) if pk else [])
        fks = insp.get_foreign_keys(table)
        fks_by_col: Dict[str, Dict[str, Any]] = {}
        for fk in fks:
            for c in fk.get("constrained_columns", []):
                fks_by_col[c] = {
                    "referred_table": fk.get("referred_table"),
                    "referred_columns": fk.get("referred_columns"),
                    "name": fk.get("name"),
                    "ondelete": fk.get("options", {}).get("ondelete", "NO ACTION"),
                    "onupdate": fk.get("options", {}).get("onupdate", "NO ACTION"),
                }

        unique_constraints = insp.get_unique_constraints(table)
        check_constraints = insp.get_check_constraints(table)
        indexes = insp.get_indexes(table)

        columns_data = []
        for c in cols:
            c_name = c["name"]
            c_type = str(c["type"])
            columns_data.append({
                "name": c_name,
                "data_type": c_type,
                "nullable": c.get("nullable", True),
                "default": str(c.get("default")) if c.get("default") is not None else None,
                "autoincrement": c.get("autoincrement", False),
                "is_primary_key": c_name in pk_cols,
                "is_foreign_key": c_name in fks_by_col,
                "foreign_key_info": fks_by_col.get(c_name),
            })

        # Row count estimate
        row_count = 0
        try:
            with eng.connect() as conn:
                row_count = conn.execute(text(f'SELECT count(*) FROM "{table}"')).scalar() or 0
        except Exception:
            row_count = 0

        tables_result.append({
            "name": table,
            "description": model_descriptions.get(table, f"Stores operational data for {table.replace('_', ' ')}."),
            "row_count": row_count,
            "columns": columns_data,
            "primary_key": {
                "name": pk.get("name") if pk else None,
                "columns": list(pk_cols),
            },
            "foreign_keys": fks,
            "unique_constraints": unique_constraints,
            "check_constraints": check_constraints,
            "indexes": indexes,
            "referencing_tables": referencing_map.get(table, []),
        })

    return tables_result


def get_table_details(eng: Engine, table_name: str) -> Optional[Dict[str, Any]]:
    """Fetches in-depth schema, constraint and sample records for a single table."""
    all_tables = get_all_tables_metadata(eng)
    for t in all_tables:
        if t["name"] == table_name:
            # Fetch up to 10 sample rows
            samples = []
            try:
                with eng.connect() as conn:
                    res = conn.execute(text(f'SELECT * FROM "{table_name}" LIMIT 10'))
                    keys = list(res.keys())
                    for row in res.fetchall():
                        samples.append({k: (str(v) if v is not None else None) for k, v in zip(keys, row)})
            except Exception:
                samples = []
            
            t["sample_rows"] = samples
            return t
    return None


def get_chen_er_model(eng: Engine) -> Dict[str, Any]:
    """
    Constructs a complete Chen notation ER Diagram model dynamically based on real PostgreSQL metadata.
    Chen Notation components:
    - Entity (Rectangle)
    - Weak Entity (Double Rectangle)
    - Relationship (Diamond)
    - Identifying Relationship (Double Diamond)
    - Attribute (Oval)
    - Primary Key (Underline attribute name)
    - Derived Attribute (Dashed oval)
    - Multivalued Attribute (Double oval)
    - Cardinality (1:1, 1:N, M:N)
    - Participation (Total / Partial)
    """
    insp = inspect(eng)
    table_names = sorted(insp.get_table_names())

    entities = []
    relationships = []
    rel_counter = 1

    # Domain categorization
    def categorize_table(name: str) -> str:
        if name in ("users", "roles", "memberships", "permissions", "role_permissions", "sessions", "challenges", "invitations"):
            return "Identity & Access"
        if name in ("incidents", "incident_status_histories", "reports", "evidence"):
            return "Incident Operations"
        if name in ("voice_recordings", "transcription_jobs", "transcripts", "incident_extractions"):
            return "Multilingual Voice & AI"
        if name in ("hospitals", "departments", "capacities", "ambulances", "missions", "referrals", "reservations"):
            return "Healthcare & Response Fleet"
        if name in ("emergency_protocols", "emergency_protocol_versions", "emergency_protocol_steps", "emergency_protocol_translations", "emergency_assistance_sessions", "emergency_conversation_messages"):
            return "AI First-Aid Protocols"
        return "Audit & Security"

    table_pks: Dict[str, Set[str]] = {}
    table_fks: Dict[str, List[Dict[str, Any]]] = {}

    for t in table_names:
        pk_info = insp.get_pk_constraint(t)
        pk_cols = set(pk_info.get("constrained_columns", []) if pk_info else [])
        table_pks[t] = pk_cols
        table_fks[t] = insp.get_foreign_keys(t)

    for t in table_names:
        cols = insp.get_columns(t)
        pk_cols = table_pks.get(t, set())
        fks = table_fks.get(t, [])
        fk_col_names = set()
        for fk in fks:
            fk_col_names.update(fk.get("constrained_columns", []))

        # Check if weak entity: table PK includes a foreign key or table cannot exist without parent
        is_weak = False
        if pk_cols and pk_cols.issubset(fk_col_names):
            is_weak = True
        elif t in ("capacities", "reservations", "transcripts", "incident_extractions", "emergency_protocol_steps", "emergency_conversation_messages"):
            is_weak = True

        attributes = []
        for c in cols:
            c_name = c["name"]
            is_pk = c_name in pk_cols
            is_fk = c_name in fk_col_names
            is_derived = "age" in c_name.lower() or "count" in c_name.lower() or "available" in c_name.lower()
            is_multivalued = "facilities" in c_name.lower() or "tags" in c_name.lower() or "languages" in c_name.lower()

            attributes.append({
                "id": f"attr_{t}_{c_name}",
                "name": c_name,
                "data_type": str(c["type"]),
                "is_primary_key": is_pk,
                "is_foreign_key": is_fk,
                "is_derived": is_derived,
                "is_multivalued": is_multivalued,
                "nullable": c.get("nullable", True),
            })

        entities.append({
            "id": t,
            "name": t.replace("_", " ").title(),
            "table_name": t,
            "is_weak": is_weak,
            "category": categorize_table(t),
            "attributes": attributes,
        })

        # Process relationships for each foreign key
        for fk in fks:
            target_table = fk.get("referred_table")
            if not target_table or target_table not in table_names:
                continue

            c_cols = fk.get("constrained_columns", [])
            r_cols = fk.get("referred_columns", [])

            # Cardinality determination
            # If constrained column has a UNIQUE constraint or is PK, it's 1:1, else N:1
            unique_cons = insp.get_unique_constraints(t)
            is_unique_fk = False
            for uc in unique_cons:
                if set(c_cols) == set(uc.get("column_names", [])):
                    is_unique_fk = True
                    break
            if set(c_cols) == pk_cols:
                is_unique_fk = True

            cardinality = "1:1" if is_unique_fk else "1:N"

            # Identifying relationship if entity is weak and depends on this FK
            is_identifying = is_weak and bool(set(c_cols).intersection(pk_cols))

            # Participation: Total if foreign key is NOT NULL
            total_participation = False
            for c in cols:
                if c["name"] in c_cols and not c.get("nullable", True):
                    total_participation = True
                    break

            rel_name = f"links_{t}_to_{target_table}"
            if t == "incidents" and target_table == "users":
                rel_name = "Reports"
            elif t == "missions" and target_table == "incidents":
                rel_name = "Dispatched For"
            elif t == "missions" and target_table == "ambulances":
                rel_name = "Operates"
            elif t == "transcripts" and target_table == "voice_recordings":
                rel_name = "Transcribes"
            elif t == "incident_extractions" and target_table == "voice_recordings":
                rel_name = "Extracts Facts"
            elif t == "departments" and target_table == "hospitals":
                rel_name = "Belongs To"
            elif t == "capacities" and target_table == "departments":
                rel_name = "Measures"
            elif t == "referrals" and target_table == "capacities":
                rel_name = "Targets"
            elif t == "reservations" and target_table == "referrals":
                rel_name = "Reserves"
            elif t == "memberships" and target_table == "users":
                rel_name = "Holds"
            elif t == "memberships" and target_table == "roles":
                rel_name = "Assigns"
            elif t == "role_permissions" and target_table == "roles":
                rel_name = "Grants"
            else:
                rel_name = f"{t.split('_')[-1].title()} of {target_table.split('_')[-1].title()}"

            relationships.append({
                "id": f"rel_{t}_{target_table}_{'_'.join(c_cols)}",
                "name": rel_name,
                "source_entity": t,
                "target_entity": target_table,
                "cardinality": cardinality,
                "is_identifying": is_identifying,
                "source_participation": "total" if total_participation else "partial",
                "target_participation": "partial",
                "foreign_key_columns": c_cols,
                "referred_columns": r_cols,
                "constraint_name": fk.get("name"),
            })
            rel_counter += 1

    return {
        "entities": entities,
        "relationships": relationships,
        "legend": {
            "entity": "Rectangle (Strong Entity)",
            "weak_entity": "Double Rectangle (Weak Entity)",
            "relationship": "Diamond (Relationship)",
            "identifying_relationship": "Double Diamond (Identifying Relationship)",
            "primary_key_attribute": "Oval with Underlined Label",
            "derived_attribute": "Dashed Oval",
            "multivalued_attribute": "Double Oval",
            "total_participation": "Double Line",
            "partial_participation": "Single Line",
        }
    }


def get_relational_schema(eng: Engine) -> List[Dict[str, Any]]:
    """
    Transforms database metadata into formal relational schema expressions.
    Example: INCIDENTS(id [PK], case_id [UNIQUE], organization_id [FK → organizations.id], ...)
    """
    insp = inspect(eng)
    table_names = sorted(insp.get_table_names())
    result = []

    for t in table_names:
        cols = insp.get_columns(t)
        pk_info = insp.get_pk_constraint(t)
        pk_cols = set(pk_info.get("constrained_columns", []) if pk_info else [])
        fks = insp.get_foreign_keys(t)
        fk_map = {}
        for fk in fks:
            for src_col, tgt_col in zip(fk.get("constrained_columns", []), fk.get("referred_columns", [])):
                fk_map[src_col] = f"{fk.get('referred_table')}.{tgt_col}"

        unique_cons = insp.get_unique_constraints(t)
        unique_cols = set()
        for uc in unique_cons:
            unique_cols.update(uc.get("column_names", []))

        attributes = []
        for c in cols:
            c_name = c["name"]
            markers = []
            if c_name in pk_cols:
                markers.append("PK")
            if c_name in fk_map:
                markers.append(f"FK → {fk_map[c_name]}")
            if c_name in unique_cols and c_name not in pk_cols:
                markers.append("UNIQUE")

            attributes.append({
                "name": c_name,
                "type": str(c["type"]),
                "markers": markers,
                "nullable": c.get("nullable", True),
                "is_pk": c_name in pk_cols,
                "is_fk": c_name in fk_map,
                "references": fk_map.get(c_name),
            })

        # Generate formal schema notation string
        attrs_str = ", ".join([
            f"{a['name']}" + (f" [{' '.join(a['markers'])}]" if a['markers'] else "")
            for a in attributes
        ])
        notation = f"{t.upper()}({attrs_str})"

        result.append({
            "table_name": t,
            "formal_notation": notation,
            "attributes": attributes,
            "primary_key": list(pk_cols),
            "foreign_keys": [
                {
                    "column": fk.get("constrained_columns", []),
                    "target_table": fk.get("referred_table"),
                    "target_column": fk.get("referred_columns", []),
                    "sql_join_condition": f"{t}.{fk.get('constrained_columns', [''])[0]} = {fk.get('referred_table')}.{fk.get('referred_columns', [''])[0]}",
                }
                for fk in fks
            ],
        })

    return result


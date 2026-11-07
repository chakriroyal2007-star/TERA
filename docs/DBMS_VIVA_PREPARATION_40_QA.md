# TERA — Master DBMS Viva Voce Preparation Guide
**40 Comprehensive Technical Questions & Expert Answers**  
**Academic Course:** Database Management Systems (CS / IT / AI / DS)  
**System:** TERA (Temporal Emergency Resource Allocation & Coordination Platform)  

---

## SECTION 1: DBMS FUNDAMENTALS (Q1 – Q7)

### Q1: What is a Database Management System (DBMS), and how does it differ from a traditional File Processing System?
**Answer:**  
A DBMS is a collection of interrelated data and a set of software programs to access, manipulate, and manage that data while ensuring data integrity, security, and concurrency.  
Key advantages over traditional File Processing Systems:
1. **Redundancy & Inconsistency Control**: Centralized relational schema prevents duplicate and conflicting copies of data.
2. **Data Isolation & Atomicity**: File systems cannot guarantee that all changes in a multi-step operation succeed or none do; a DBMS guarantees ACID transactions.
3. **Concurrent Access Anomalies**: DBMS uses concurrency control (locks, timestamps) to prevent race conditions (e.g., two operators booking the same ambulance).
4. **Data Independence**: Logical and physical data independence separates conceptual schema changes from application code.

### Q2: What is the Three-Schema Architecture (ANSI/SPARC)?
**Answer:**  
The Three-Schema Architecture separates the database into three levels to achieve data independence:
1. **Internal (Physical) Level**: Describes physical storage structures, data paths, file formats, and B-tree indexes on disk.
2. **Conceptual (Logical) Level**: Describes the entire database structure, entities, data types, relationships, constraints, and normalization rules (e.g., the 41 tables in TERA).
3. **External (View) Level**: Tailored user views providing specific abstractions (e.g., the Citizen view sees only their incident status, whereas the Operator view sees dispatch queues and bed capacities).

### Q3: What is the difference between a Database Schema and a Database Instance?
**Answer:**  
- **Schema**: The overall design and structural blueprint of the database, including table names, columns, data types, constraints, and relationships. It is relatively static and defined via DDL (`CREATE TABLE`).
- **Instance**: The collection of actual operational data stored in the database at a specific moment in time. It is dynamic and changes continuously via DML (`INSERT`, `UPDATE`, `DELETE`).

### Q4: What is the difference between DDL, DML, DQL, and DCL?
**Answer:**  
- **DDL (Data Definition Language)**: Defines schema structure (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`). In TERA, SQLAlchemy and Alembic manage DDL.
- **DML (Data Manipulation Language)**: Modifies stored data instances (`INSERT`, `UPDATE`, `DELETE`).
- **DQL (Data Query Language)**: Retrieves records (`SELECT`, `JOIN`, `GROUP BY`).
- **DCL (Data Control Language)**: Manages permissions and rights (`GRANT`, `REVOKE`).

### Q5: What is a Relation, Tuple, and Attribute in relational database terminology?
**Answer:**  
- **Relation**: A mathematical set of tuples conforming to a schema (represented practically as a two-dimensional table, e.g., `incidents`).
- **Tuple**: An ordered list of attribute values representing a single entity occurrence (a table row).
- **Attribute**: A named column representing a domain property (e.g., `status`, `latitude`).

### Q6: What is a Domain, and how does TERA enforce domain integrity?
**Answer:**  
A domain is the set of all allowable atomic values for an attribute. TERA enforces domain constraints at the database level using:
1. **Data Types**: `VARCHAR(32)`, `INTEGER`, `FLOAT`, `BOOLEAN`, `TIMESTAMP WITH TIME ZONE`.
2. **Check Constraints**: `CHECK (status IN ('reported', 'verified', 'dispatched', 'active', 'closed'))`.
3. **NOT NULL Constraints**: Mandating required attributes (e.g., `address`, `category`).

### Q7: Why did you choose PostgreSQL over a NoSQL document database (like MongoDB) for TERA?
**Answer:**  
Emergency dispatch requires strict **ACID transactional guarantees** and **referential integrity**:
1. An ambulance assignment involves simultaneous updates across `missions`, `ambulances`, and `incidents`. NoSQL eventual consistency risks double-allocating resources.
2. Foreign key constraints in PostgreSQL guarantee that orphaned records (e.g., a mission referencing a non-existent incident) cannot exist.
3. PostgreSQL provides robust concurrency mechanisms (`SELECT ... FOR UPDATE` row-level locks) and partial unique indexes (`WHERE status != 'completed'`) that natively eliminate race conditions.

---

## SECTION 2: ENTITY-RELATIONSHIP (ER) MODELING (Q8 – Q14)

### Q8: What is an Entity-Relationship (ER) Model?
**Answer:**  
An ER model is a high-level conceptual data model that views the real world as a collection of basic objects called **entities** and relationships among these objects. It forms the foundational design blueprint before mapping to a logical relational schema.

### Q9: Explain Peter Chen Notation. What symbols are used?
**Answer:**  
Peter Chen notation is the classical academic standard for ER diagrams:
- **Rectangle**: Strong Entity set (e.g., `INCIDENTS`, `AMBULANCES`).
- **Double Rectangle**: Weak Entity set (depends on an identifying owner entity).
- **Diamond**: Relationship set connecting entities (e.g., `assigned`, `refers_to`).
- **Double Diamond**: Identifying relationship for a weak entity.
- **Oval**: Attribute (e.g., `category`, `status`).
- **Underlined Text in Oval**: Primary Key attribute (e.g., `__id__`, `__case_id__`).
- **Double Oval**: Multivalued attribute (e.g., `facilities`).
- **Dashed Oval**: Derived attribute (e.g., `available_beds = total - occupied - reserved`).
- **Double Line**: Total Participation (existence dependency).
- **Single Line**: Partial Participation.

### Q10: What is the difference between Strong and Weak Entities? Give an example from TERA.
**Answer:**  
- **Strong Entity**: Has a primary key formed entirely from its own attributes and can exist independently (e.g., `INCIDENTS` with primary key `id`).
- **Weak Entity**: Does not have sufficient attributes to form a primary key of its own; it depends on an identifying relationship with an owner entity and uses a discriminator (partial key) combined with the owner's primary key. In TERA, `INCIDENT_STATUS_HISTORY` functions as an existence-dependent entity whose lifecycle is bound to `INCIDENTS`.

### Q11: Explain Cardinality Ratio and Participation Constraints.
**Answer:**  
- **Cardinality Ratio**: Specifies the maximum number of relationship instances that an entity can participate in:
  - **1:1 (One-to-One)**: E.g., each `MEMBERSHIP` belongs to exactly one `USER`.
  - **1:N (One-to-Many)**: E.g., one `INCIDENT` can have multiple `REPORTS` or `MISSIONS`.
  - **M:N (Many-to-Many)**: Modeled via associative tables (e.g., `USERS` and `ROLES` through `MEMBERSHIPS`).
- **Participation Constraint**: Specifies whether an entity must exist in a relationship instance:
  - **Total Participation (Mandatory)**: Every incident status transition must be associated with an incident.
  - **Partial Participation (Optional)**: An ambulance may or may not be currently assigned to an active mission.

### Q12: How are M:N (Many-to-Many) relationships converted into relational tables?
**Answer:**  
An M:N relationship cannot be represented directly with a single foreign key column without introducing non-atomic multivalued attributes. It is decomposed into:
1. Two separate 1:N relationships.
2. A third **Associative (Junction) Table** whose composite primary key comprises foreign keys referencing the primary keys of both parent tables, plus any relationship attributes (e.g., `role_permissions` referencing `role_id` and `permission_id`).

### Q13: What is a Composite Attribute and a Multivalued Attribute?
**Answer:**  
- **Composite Attribute**: An attribute that can be divided into smaller sub-parts (e.g., `Address` composed of `Street`, `City`, `Pincode`). In 1NF normalization, composite attributes are decomposed into atomic columns.
- **Multivalued Attribute**: An attribute that can hold multiple values for a single entity (e.g., a hospital having multiple facilities `['Trauma ICU', 'Burn Unit', 'Blood Bank']`). In relational databases, this is normalized into a separate child table or stored using PostgreSQL array/JSONB types.

### Q14: How does TERA dynamically generate the Chen ER Diagram in the DBMS Studio?
**Answer:**  
The DBMS Studio queries SQLAlchemy's `inspect(engine)` to discover all tables, columns, primary keys, and foreign keys. It programmatically maps tables to Entity nodes (Rectangles), foreign key constraints to Relationship nodes (Diamonds), and columns to Attribute nodes (Ovals). It calculates cardinalities based on foreign key uniqueness and generates an interactive, draggable SVG diagram.

---

## SECTION 3: KEYS & INTEGRITY CONSTRAINTS (Q15 – Q20)

### Q15: Distinguish between Superkey, Candidate Key, Primary Key, and Alternate Key.
**Answer:**  
- **Superkey**: Any set of attributes within a relation that uniquely identifies each tuple (e.g., `{id}`, `{id, email}`, `{email, name}`).
- **Candidate Key**: A **minimal superkey** (a superkey from which no attribute can be removed without losing uniqueness, e.g., `{id}` and `{email}`).
- **Primary Key**: The specific candidate key chosen by the database architect to uniquely identify tuples across the table (e.g., `id`).
- **Alternate Key**: Any candidate key not chosen as the primary key (e.g., `email` and `case_id`).

### Q16: What is a Composite Key versus a Surrogate Key?
**Answer:**  
- **Composite Key**: A primary or candidate key consisting of two or more attributes (e.g., `{department_id, kind}` in bed capacity).
- **Surrogate Key**: An artificially generated unique identifier with no intrinsic business meaning (e.g., a UUID or auto-incrementing integer `id`). TERA uses UUID v4 surrogate keys for universal uniqueness across distributed nodes.

### Q17: What is Referential Integrity? What happens during `ON DELETE CASCADE` vs `RESTRICT`?
**Answer:**  
Referential integrity requires that if a foreign key in table $R_1$ references a primary key in table $R_2$, the referenced value must exist in $R_2$ or be `NULL`.
- **`ON DELETE CASCADE`**: When the parent row in $R_2$ is deleted, all matching child rows in $R_1$ are automatically deleted.
- **`ON DELETE RESTRICT` (or `NO ACTION`)**: The database engine rejects the deletion of the parent row if any child rows reference it, preventing accidental orphaned data.
- **`ON DELETE SET NULL`**: The foreign key columns in child rows are set to `NULL` upon deletion of the parent.

### Q18: What is the purpose of Check Constraints? Give an example from TERA.
**Answer:**  
Check constraints enforce arbitrary boolean predicate rules on column values before allowing an `INSERT` or `UPDATE`.  
In TERA:
```sql
ALTER TABLE capacities ADD CONSTRAINT check_valid_bed_counters 
CHECK (total >= 0 AND occupied >= 0 AND reserved >= 0 AND (occupied + reserved) <= total);
```
This guarantees that hospital bed occupancy can never physically exceed total capacity.

### Q19: What is a Partial Unique Index, and how does TERA use it?
**Answer:**  
A partial unique index is an index built over a subset of rows defined by a `WHERE` conditional clause.  
In TERA:
```sql
CREATE UNIQUE INDEX one_active_ambulance ON missions (ambulance_id) 
WHERE status != 'completed';
```
*Purpose*: An ambulance may have completed hundreds of historical missions, but it can only have **one** active mission where `status != 'completed'` at any given moment.

### Q20: Can a Primary Key contain NULL values? Why?
**Answer:**  
**No.** According to the **Entity Integrity Rule**, no primary key attribute may contain a `NULL` value. A `NULL` represents an unknown, missing, or inapplicable value; if a primary key were `NULL`, the DBMS could not uniquely distinguish or reference that entity occurrence.

---

## SECTION 4: NORMALIZATION & FUNCTIONAL DEPENDENCIES (Q21 – Q28)

### Q21: What is Normalization, and what are its primary objectives?
**Answer:**  
Normalization is a systematic, mathematical process of decomposing relational tables to minimize data redundancy and eliminate update, insertion, and deletion anomalies while ensuring **lossless joins** and **dependency preservation**.

### Q22: Define First Normal Form (1NF).
**Answer:**  
A relation is in 1NF if and only if:
1. Every attribute domain contains only **atomic (indivisible)** values.
2. There are no repeating groups or multivalued arrays.
3. Each record is uniquely identifiable by a designated primary key.

### Q23: Define Second Normal Form (2NF). What is a Partial Dependency?
**Answer:**  
A relation is in 2NF if:
1. It is in 1NF.
2. It contains **no partial dependencies** — meaning every non-prime attribute is fully functionally dependent on the primary key, and not on any proper subset of a composite candidate key.
- **Partial Dependency**: Occurs when $X \subset CK$ (a proper subset of a composite candidate key) and $X \rightarrow Y$ for some non-prime attribute $Y$.

### Q24: Define Third Normal Form (3NF). What is a Transitive Dependency?
**Answer:**  
A relation is in 3NF if:
1. It is in 2NF.
2. It contains **no transitive dependencies**.  
Formally, for every non-trivial functional dependency $X \rightarrow Y$:
- Either $X$ is a **superkey**, OR
- $Y$ is a **prime attribute** (a member of some candidate key).
- **Transitive Dependency**: An indirect functional dependency of the form $X \rightarrow Z \rightarrow Y$, where $X$ is a candidate key, $Z$ is not a candidate key, and $Z \rightarrow Y$.

### Q25: Define Boyce-Codd Normal Form (BCNF). How does it differ from 3NF?
**Answer:**  
A relation is in BCNF if and only if for every non-trivial functional dependency $X \rightarrow Y$, **$X$ is a superkey**.  
*Difference*: 3NF permits $X$ not to be a superkey if $Y$ is a prime attribute; BCNF removes this exception entirely. BCNF is strictly stronger than 3NF.

### Q26: What are Insertion, Update, and Deletion Anomalies? Give examples.
**Answer:**  
Consider an unnormalized relation `EMERGENCY_DISPATCH(IncidentID, AmbulanceReg, AmbulanceModel)`:
1. **Insertion Anomaly**: You cannot add a newly purchased ambulance into the database without first manufacturing a fake incident to assign it to.
2. **Update Anomaly**: If an ambulance model description is updated, all historical incident rows where that ambulance was dispatched must be modified, risking inconsistencies.
3. **Deletion Anomaly**: If the last incident associated with an ambulance is purged, the entire record of the ambulance's existence is lost.

### Q27: What is Attribute Closure ($X^+$), and why is it important?
**Answer:**  
The attribute closure $X^+$ with respect to a set of functional dependencies $F$ is the set of all attributes that are functionally determined by $X$ under $F$.  
*Importance*:
- To test if $X \rightarrow Y$ holds (check if $Y \subseteq X^+$).
- To determine if $X$ is a superkey (check if $X^+$ equals the entire relation schema $R$).
- To discover all minimal candidate keys algorithmically.

### Q28: What is Lossless Join Decomposition?
**Answer:**  
A decomposition of relation $R$ into relations $R_1$ and $R_2$ is **lossless** if and only if computing their natural join yields the exact original relation without producing spurious (ghost) tuples:
$$R_1 \bowtie R_2 = R$$
*Formal Condition*: $R_1 \cap R_2 \rightarrow R_1$ OR $R_1 \cap R_2 \rightarrow R_2$ (the common attributes must form a superkey of at least one of the decomposed relations).

---

## SECTION 5: SQL, QUERY PROCESSING & INDEXING (Q29 – Q34)

### Q29: What is the difference between `WHERE` and `HAVING` clauses in SQL?
**Answer:**  
- **`WHERE`**: Filters individual tuples *before* any grouping or aggregation takes place. It cannot evaluate aggregate functions (e.g., `WHERE COUNT(*) > 5` is illegal).
- **`HAVING`**: Filters grouped rows *after* the `GROUP BY` clause has aggregated tuples. It operates directly on aggregate values (e.g., `HAVING COUNT(*) > 5`).

### Q30: Explain the different types of SQL JOIN operations.
**Answer:**  
- **`INNER JOIN`**: Returns only tuples that have matching values in both tables.
- **`LEFT (OUTER) JOIN`**: Returns all tuples from the left table, and matched values from the right table (unmatched right attributes are filled with `NULL`).
- **`RIGHT (OUTER) JOIN`**: Returns all tuples from the right table, and matched values from the left table.
- **`FULL (OUTER) JOIN`**: Returns tuples when there is a match in either the left or right table.
- **`CROSS JOIN`**: Cartesian product of two relations ($|R_1| \times |R_2|$ rows).

### Q31: How does a B-Tree Index work, and why is it preferred for relational databases?
**Answer:**  
A B-Tree (Balanced Tree) is a self-balancing $m$-way search tree where all leaf nodes reside at the same depth and store pointers to physical table rows.  
*Advantages*:
- Guarantees $O(\log N)$ search, insertion, and deletion complexity.
- Supports both **exact equality lookups** (`WHERE id = '...'`) and **range queries** (`WHERE created_at BETWEEN '...' AND '...'`).
- Leaf nodes are linked sequentially, allowing efficient index range scans without random disk head movements.

### Q32: What is the difference between a Clustered and a Non-Clustered Index?
**Answer:**  
- **Clustered Index**: Dictates the actual physical storage order of rows on disk. A table can have only **one** clustered index because data can only be physically sorted in one order.
- **Non-Clustered (Secondary) Index**: A separate data structure containing sorted index keys and pointers (tuple identifiers / row IDs) referencing the actual physical storage page. A table can have multiple non-clustered indexes.

### Q33: Explain the SQL query used in TERA to aggregate incidents by category.
**Answer:**  
```sql
SELECT
    category,
    COUNT(*) AS total_incidents,
    SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) AS critical_count
FROM incidents
GROUP BY category
ORDER BY total_incidents DESC;
```
*Explanation*: The database groups tuples with identical `category` strings into buckets, computes the row count per bucket using `COUNT(*)`, and computes conditional sums to report critical incidents per emergency domain.

### Q34: What is an `EXPLAIN` query execution plan?
**Answer:**  
`EXPLAIN` shows the execution plan generated by the PostgreSQL query optimizer without running the query (`EXPLAIN ANALYZE` also executes it and records real timings). It details whether the engine used a **Sequential Scan**, an **Index Scan**, or a **Bitmap Index Scan**, as well as the join algorithms (Hash Join, Merge Join, Nested Loop).

---

## SECTION 6: TRANSACTIONS, CONCURRENCY & ACID (Q35 – Q40)

### Q35: What are the ACID properties of a Database Transaction?
**Answer:**  
- **Atomicity**: "All or nothing" — every operation in a transaction succeeds, or the entire transaction is rolled back with no partial effects.
- **Consistency**: A transaction transitions the database from one valid state to another, satisfying all integrity constraints.
- **Isolation**: Intermediate states of concurrent transactions are invisible to one another until committed.
- **Durability**: Once committed, changes are permanent and survive any power failure or system crash.

### Q36: What is Write-Ahead Logging (WAL), and how does it guarantee Durability?
**Answer:**  
WAL requires that any changes to data pages on disk must first be recorded sequentially in a durable log file on disk *before* the dirty pages are flushed to table storage. In the event of a sudden power loss or server crash, the PostgreSQL recovery manager reads the WAL during restart to **REDO** committed transactions and **UNDO** uncommitted transactions.

### Q37: What is Concurrency Control, and what anomalies occur without it?
**Answer:**  
Concurrency control manages simultaneous operations without conflict. Without it, three classical anomalies occur:
1. **Lost Update**: Two transactions read the same data and write updates based on the initial value; one overwrites the other.
2. **Dirty Read**: Transaction $T_2$ reads data updated by $T_1$ before $T_1$ has committed; if $T_1$ rolls back, $T_2$ read invalid phantom data.
3. **Unrepeatable (Fuzzy) Read**: Transaction $T_1$ reads a row, $T_2$ modifies that row, and $T_1$ re-reads the row obtaining a different value.

### Q38: What are Transaction Isolation Levels in SQL?
**Answer:**  
The SQL-92 standard defines 4 isolation levels based on permitted anomalies:
1. **Read Uncommitted**: Permits dirty reads, unrepeatable reads, phantom reads.
2. **Read Committed** (PostgreSQL Default): Prevents dirty reads; permits unrepeatable reads.
3. **Repeatable Read**: Prevents dirty reads and unrepeatable reads; permits serialization anomalies.
4. **Serializable**: Highest isolation; guarantees transactions execute as if strictly in serial sequence.

### Q39: How does TERA prevent double ambulance assignments during simultaneous dispatch requests?
**Answer:**  
TERA uses **Pessimistic Concurrency Control** via `SELECT ... FOR UPDATE`:
```python
a = db.scalar(select(Ambulance).where(Ambulance.id == data.ambulance_id).with_for_update())
```
When Operator 1 initiates dispatch, PostgreSQL places an exclusive row-level lock on that ambulance tuple. If Operator 2 simultaneously attempts to dispatch the same ambulance, Operator 2's transaction is blocked until Operator 1 commits. Upon unblocking, Operator 2 checks mission status, finds the ambulance already assigned, and is rejected with an HTTP 409 Conflict. Additionally, the database partial unique index (`one_active_ambulance`) acts as an immutable secondary barrier.

### Q40: What happens during a Rollback in TERA? Give an example.
**Answer:**  
During hospital handover, if bed capacity reservation fails due to an unexpected constraint violation, SQLAlchemy issues a `ROLLBACK` statement. PostgreSQL utilizes the transaction's undo log to revert all uncommitted changes:
- `capacities.reserved` count is restored.
- The `reservations` insert is discarded.
- `referrals.status` reverts to its previous state.
The database state remains completely clean without partial, corrupted records.

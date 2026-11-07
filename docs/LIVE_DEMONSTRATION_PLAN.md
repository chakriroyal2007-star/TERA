# TERA — Master Live Demonstration Plan
**8 to 10-Minute Academic Viva Presentation Script**  
**Course:** Database Management Systems (CS / IT / AI / DS)  
**System:** TERA (Temporal Emergency Resource Allocation & Coordination Platform)  
**Live URL:** `https://tera-project-dbms.vercel.app`  

---

## TIMED DEMONSTRATION TIMELINE (10 MINUTES TOTAL)

| Segment | Timing | Module & Actions | Key Academic Talking Points |
|---|:---:|---|---|
| **1. Introduction & Problem Statement** | 0:00 – 1:00 | Homepage (`/`) | Introduce TERA as a 3NF relational database for multi-role emergency dispatch. Highlight ACID consistency vs data silos. |
| **2. DBMS Studio Overview & ER Diagram** | 1:00 – 2:30 | DBMS Studio (`/app/dbms`) $\rightarrow$ Overview & Chen ER Diagram | Show real-time metadata (41 tables, relationships, constraints). Demonstrate Peter Chen notation (Rectangles, Diamonds, Ovals, underlined PKs). |
| **3. Normalization & Relational Algorithms** | 2:30 – 4:00 | DBMS Studio $\rightarrow$ Normalization & FD Analyzer | Walk through UNF $\rightarrow$ 1NF $\rightarrow$ 2NF $\rightarrow$ 3NF on emergency dispatch. Run live attribute closure ($X^+$) and candidate key discovery. |
| **4. Citizen Emergency Reporting Workflow** | 4:00 – 5:15 | Citizen Portal (`/report`) | Submit a live emergency report via multilingual voice / form. Show generated Case ID and tracking token. |
| **5. Database Persistence & SQL Inspection** | 5:15 – 6:15 | DBMS Studio $\rightarrow$ SQL Lab | Query the newly inserted record directly using SQL: `SELECT * FROM incidents ORDER BY created_at DESC LIMIT 1`. Prove genuine persistence. |
| **6. Operator Dispatch & Nontrivial Business Rule** | 6:15 – 7:30 | Operator Desk (`/app/operator`) | Verify the incident. Assign ambulance `AP-03-EM-108`. Attempt double assignment to show 409 Conflict rejection. |
| **7. Multi-Table SQL JOIN & Analytical Report** | 7:30 – 8:45 | DBMS Studio $\rightarrow$ SQL Lab | Execute 4-table JOIN (`incidents` $\bowtie$ `missions` $\bowtie$ `ambulances` $\bowtie$ `users`). Execute `GROUP BY` aggregate report. |
| **8. Hospital Referral & ACID Transaction Rollback** | 8:45 – 9:30 | Hospital Desk (`/app/hospital`) | Accept referral, show bed capacity reservation. Explain atomic commit and rollback protection. |
| **9. Q&A / Viva Wrap-up** | 9:30 – 10:00 | Assessment Checklist | Conclude with test suite evidence (33 automated pytest tests passing). |

---

## DETAILED STEP-BY-STEP SCRIPT FOR STUDENT

### Minute 0:00 – 1:00: Introduction & Problem Statement
1. **Action**: Open `https://tera-project-dbms.vercel.app` on browser.
2. **Student Script**:
   > *"Good morning, respected evaluators. Today I am presenting **TERA** — Temporal Emergency Resource Allocation & Coordination Platform.  
   > In critical trauma emergencies, data integrity and transactional consistency are life-or-death requirements. Legacy dispatch systems fail because disconnected records cause concurrent operators to allocate the same ambulance to multiple emergencies.  
   > TERA is a production-grade relational database management system built on PostgreSQL and SQLAlchemy. It strictly enforces 3NF normalization, referential integrity across 41 tables, pessimistic row-level locking (`SELECT ... FOR UPDATE`), and partial unique indexes to guarantee that no resource can ever be double-assigned.  
   > Today I will demonstrate the full database architecture, the Chen ER model, algorithmic functional dependency calculations, complete workflows, and real-time SQL execution."*

---

### Minute 1:00 – 2:30: DBMS Studio Overview & Peter Chen ER Model
1. **Action**: Click **Team sign in**, click **Lead Administrator** 1-click login button, and navigate to **DBMS Studio** (`/app/dbms`) in the sidebar.
2. **Student Script**:
   > *"Inside TERA, we built a dedicated **DBMS Studio** that directly introspects our live database catalogs.  
   > As you can see on the Overview dashboard:
   > - We have **41 live relational tables**.
   > - **331 distinct attributes**.
   > - **65 Foreign Key constraints** enforcing referential integrity.
   > - **53 B-tree and partial indexes**.  
   > Let us open the **Chen ER Diagram** section. Academic DBMS standards require Peter Chen notation rather than modern box notation:
   > - Strong entities are rendered as single **Rectangles** (`incidents`, `ambulances`, `users`).
   > - Relationships are rendered as **Diamonds** (`assigned`, `refers_to`).
   > - Attributes are **Ovals**, with Primary Keys **underlined**.
   > - Cardinalities are clearly labeled: One-to-Many (`1:N`) between incidents and missions, and Many-to-One (`N:1`) between missions and ambulances.
   > - This diagram is not static — it is dynamically generated from PostgreSQL system catalogs via SQLAlchemy inspector."*

---

### Minute 2:30 – 4:00: Normalization & Functional Dependency Analyzer
1. **Action**: Navigate to **Normalization Analyzer** (`/app/dbms/normalization`) and **Functional Dependency Analyzer** (`/app/dbms/fd`).
2. **Student Script**:
   > *"Now let us review our Normalization strategy. Our schema is normalized to **Third Normal Form (3NF)**:
   > - **1NF**: All attributes are strictly atomic (no repeating groups).
   > - **2NF**: Eliminates partial dependencies on composite keys. For example, in our dispatch relation, ambulance model details were separated from mission dispatch records.
   > - **3NF**: Eliminates transitive dependencies. For instance, in hospital referrals, hospital address depends on hospital ID, which depends on referral ID ($X \rightarrow Z \rightarrow Y$). We decomposed this into `referrals`, `departments`, and `hospitals` so that every determinant is a candidate key.  
   > Let us test our **Functional Dependency Analyzer**:
   > For relation $R(A, B, C, D)$ with dependencies $A \rightarrow B$, $B \rightarrow C$, $AC \rightarrow D$, we click **Compute Closure**.
   > Our Python algorithm computes the attribute closure: $\{A\}^+ = \{A, B, C, D\}$. Because the closure contains all attributes, $\{A\}$ is mathematically proven to be a candidate key."*

---

### Minute 4:00 – 5:15: Public Incident Reporting Workflow
1. **Action**: Navigate to the public report portal at `/report`.
2. **Student Script**:
   > *"Now let us execute Workflow 1: Public Citizen Emergency Reporting.  
   > A citizen does not need to register. We select English or regional languages, speak our emergency:  
   > *'Major two-car collision near Tirupati Highway Toll Gate with two people injured. Send ambulance immediately.'*  
   > The speech engine transcribes and extracts the emergency entities:
   > - Category: `road_collision`
   > - Casualties: `2`
   > - Severity: `high`
   > When we click **Confirm & Transmit Emergency**, the backend executes an atomic `INSERT` into `incidents`, computes a SHA-256 tracking hash, and generates a human-readable Case ID (`TERA-202611-XXXX`).  
   > The citizen can now track this report in real time using private token `TRK-XXXX`."*

---

### Minute 5:15 – 6:15: Verifying Persistence via SQL Laboratory
1. **Action**: Navigate to **DBMS Studio** $\rightarrow$ **SQL Laboratory** (`/app/dbms/sql`).
2. **Student Script**:
   > *"To prove that this report was genuinely persisted in PostgreSQL and not stored in temporary browser state, let us open the **SQL Laboratory**:  
   > We run:
   > ```sql
   > SELECT case_id, category, status, priority, created_at 
   > FROM incidents 
   > ORDER BY created_at DESC 
   > LIMIT 1;
   > ```
   > Clicking **Execute Safe Query** returns our exact incident from the database in less than 1 millisecond. The SQL laboratory safely executes read-only queries with explicit LIMIT guards and timing measurements."*

---

### Minute 6:15 – 7:30: Operator Dispatch & Nontrivial Business Rule
1. **Action**: Navigate to **Operator Incident Desk** (`/app/operator`).
2. **Student Script**:
   > *"Now let us switch to Workflow 2: Operator Verification and Dispatch.  
   > 1. The operator opens the newly reported incident.
   > 2. The operator verifies the case, which updates `status = 'verified'` and appends an entry into `incident_status_history`.
   > 3. The operator selects ambulance `AP-03-EM-108` and dispatches it.  
   > **Now, observe our Nontrivial Business Rule**:
   > What happens if an operator attempts to dispatch this same ambulance to another emergency while it is already on an active mission?  
   > Let us attempt to assign `AP-03-EM-108` to a second incident:
   > The backend immediately rejects it with **HTTP 409 Conflict: 'A selected resource is already assigned'**.  
   > This is guaranteed by two independent mechanisms:
   > - A pessimistic row lock (`SELECT ... WITH FOR UPDATE`) on the ambulance record.
   > - A PostgreSQL partial unique index: `CREATE UNIQUE INDEX one_active_ambulance ON missions(ambulance_id) WHERE status != 'completed'`."*

---

### Minute 7:30 – 8:45: Multi-Table SQL JOIN & Analytical Aggregation
1. **Action**: Back in DBMS Studio $\rightarrow$ **SQL Laboratory**.
2. **Student Script**:
   > *"The evaluation rubric requires multi-table JOIN and GROUP BY queries. Let us run our 4-table JOIN:
   > ```sql
   > SELECT
   >     i.case_id,
   >     i.category,
   >     i.status AS incident_status,
   >     m.status AS mission_status,
   >     a.registration AS ambulance_registration,
   >     u.name AS responder_name
   > FROM incidents i
   > INNER JOIN missions m ON m.incident_id = i.id
   > INNER JOIN ambulances a ON m.ambulance_id = a.id
   > INNER JOIN users u ON m.responder_id = u.id
   > LIMIT 5;
   > ```
   > This query joins `incidents` to `missions` (1:N), `missions` to `ambulances` (N:1), and `missions` to `users` (N:1).
   > Now let us run our **GROUP BY Aggregate query**:
   > ```sql
   > SELECT category, COUNT(*) AS total_incidents,
   >        SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) AS critical_count
   > FROM incidents
   > GROUP BY category
   > ORDER BY total_incidents DESC;
   > ```
   > This generates operational caseload metrics directly from database tuples."*

---

### Minute 8:45 – 10:00: Hospital Bed Reservation, ACID Rollback & Conclusion
1. **Action**: Open **ACID Transactions** section in DBMS Studio (`/app/dbms/acid`).
2. **Student Script**:
   > *"Finally, let us demonstrate Workflow 4 and **ACID Transaction Rollback**:
   > During ambulance transport, the operator requests an emergency trauma bed referral. The hospital coordinator accepts the referral, which atomically increments `capacities.reserved` and creates a `reservations` record.  
   > In our interactive ACID simulation stepper, we demonstrate what happens if an error occurs during dispatch:
   > If the responder ID is invalid or a constraint fails, SQLAlchemy triggers an automatic `ROLLBACK`. The database undo log discards the uncommitted mission row, and the ambulance availability is preserved. No orphaned records are ever created.  
   > To verify this reproducibility, our automated test suite has **33 passing tests** covering database design, access control, workflows, double assignment prevention, transactions, joins, and normalization algorithms.  
   > Thank you! I am now ready for your technical questions."*

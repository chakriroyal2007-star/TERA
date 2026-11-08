# SQL Queries Used in TERA — Official Reference Catalog
**Academic Mini-Project SQL Documentation**  
**Course:** Database Management Systems (CS / IT / AI / DS)  
**System:** TERA (Temporal Emergency Resource Allocation & Coordination Platform)  

---

## 1. DATA DEFINITION LANGUAGE (DDL)

### 1.1 Core Incidents Table
```sql
CREATE TABLE incidents (
    id VARCHAR(36) PRIMARY KEY,
    case_id VARCHAR(32) UNIQUE,
    idempotency_key VARCHAR(64) UNIQUE,
    tracking_hash VARCHAR(64) UNIQUE NOT NULL,
    organization_id VARCHAR(36) REFERENCES organizations(id) ON DELETE SET NULL,
    category VARCHAR(32) NOT NULL,
    description TEXT NOT NULL,
    address VARCHAR(500) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status VARCHAR(32) DEFAULT 'reported' NOT NULL,
    priority VARCHAR(16) DEFAULT 'unassessed' NOT NULL,
    casualties_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_incident_status CHECK (
        status IN (
            'submitted', 'pending_verification', 'reported', 'verified',
            'dispatched', 'en_route', 'on_scene', 'transporting',
            'hospital_handover', 'handover', 'active', 'resolved',
            'closed', 'rejected', 'duplicate'
        )
    ),
    CONSTRAINT check_incident_priority CHECK (
        priority IN ('unassessed', 'low', 'medium', 'high', 'critical')
    )
);

CREATE INDEX idx_incidents_status ON incidents (status);
CREATE INDEX idx_incidents_created_at ON incidents (created_at DESC);
```

### 1.2 Resource Dispatch Missions Table with Partial Unique Index
```sql
CREATE TABLE missions (
    id VARCHAR(36) PRIMARY KEY,
    incident_id VARCHAR(36) NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    ambulance_id VARCHAR(36) NOT NULL REFERENCES ambulances(id) ON DELETE RESTRICT,
    responder_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(24) DEFAULT 'assigned' NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_mission_status CHECK (
        status IN ('assigned', 'acknowledged', 'en_route', 'on_scene', 'transporting', 'handover', 'completed')
    )
);

-- Nontrivial Business Rule: An ambulance can only have ONE active mission at a time
CREATE UNIQUE INDEX one_active_ambulance ON missions (ambulance_id) 
WHERE status != 'completed';
```

### 1.3 Hospital Bed Capacity Table with Consistency Constraint
```sql
CREATE TABLE capacities (
    id VARCHAR(36) PRIMARY KEY,
    department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
    total INTEGER NOT NULL,
    occupied INTEGER DEFAULT 0 NOT NULL,
    reserved INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_capacity_bounds CHECK (
        total >= 0 AND occupied >= 0 AND reserved >= 0 AND (occupied + reserved) <= total
    )
);
```

---

## 2. DATA MANIPULATION LANGUAGE (DML) & TRANSACTIONS

### 2.1 Inserting a New Emergency Report (Citizen Workflow)
```sql
INSERT INTO incidents (
    id, case_id, tracking_hash, category, description,
    address, latitude, longitude, status, priority, casualties_count, created_at
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'TERA-202611-0042',
    '8f4b2a1c9e3d5f7a...',
    'road_collision',
    'Two-car head-on collision near Tirupati Highway Toll. Two people injured.',
    'Tirupati Highway Toll Plaza, NH 71',
    13.6288,
    79.4192,
    'reported',
    'high',
    2,
    CURRENT_TIMESTAMP
);
```

### 2.2 Atomic Ambulance Dispatch Transaction with Pessimistic Locking
```sql
BEGIN;

  -- 1. Pessimistically lock target incident and verify status
  SELECT id, status, organization_id 
  FROM incidents 
  WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' 
  FOR UPDATE;

  -- 2. Pessimistically lock ambulance and ensure not already busy
  SELECT id, registration, active 
  FROM ambulances 
  WHERE id = 'amb-108-ap03' 
  FOR UPDATE;

  -- 3. Check for any non-completed mission
  SELECT id FROM missions 
  WHERE ambulance_id = 'amb-108-ap03' AND status != 'completed';

  -- 4. Insert new dispatch mission
  INSERT INTO missions (id, incident_id, ambulance_id, responder_id, status, created_at)
  VALUES ('mis-999-uuid', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'amb-108-ap03', 'user-paramedic-01', 'assigned', CURRENT_TIMESTAMP);

  -- 5. Transition incident lifecycle status
  UPDATE incidents 
  SET status = 'dispatched' 
  WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  -- 6. Record immutable status history audit event
  INSERT INTO incident_status_history (id, incident_id, previous_status, new_status, actor_id, notes, created_at)
  VALUES ('hist-123-uuid', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'verified', 'dispatched', 'user-operator-01', 'Ambulance AP-03-EM-108 dispatched', CURRENT_TIMESTAMP);

COMMIT;
```

---

## 3. RELATIONAL JOIN QUERIES (ALL 10 JOIN TYPES IMPLEMENTED)

TERA DBMS Studio provides a dedicated **Relational Joins Laboratory** implementing, visualizing, and executing all 10 SQL join variants live against the relational database:

### 3.1 INNER JOIN (Equi-Join)
- **Relational Algebra:** $\text{incidents} \bowtie_{\text{incidents.id} = \text{missions.incident\_id}} \text{missions}$
- **Purpose:** Returns only matching records where keys exist in both relations; omits unassigned incidents.
```sql
SELECT 
  i.case_id, 
  i.category, 
  i.priority, 
  i.status AS incident_status, 
  m.id AS mission_id, 
  m.status AS mission_status, 
  m.created_at AS dispatched_at
FROM incidents i
INNER JOIN missions m ON m.incident_id = i.id
ORDER BY m.created_at DESC
LIMIT 10;
```

### 3.2 LEFT OUTER JOIN
- **Relational Algebra:** $\text{incidents} \mathbin{⟕}_{\text{incidents.id} = \text{voice\_recordings.incident\_id}} (\text{voice\_recordings} \mathbin{⟕} \text{transcripts})$
- **Purpose:** Preserves ALL reported incidents; voice recording columns contain NULL for manual/text reports.
```sql
SELECT 
  i.case_id, 
  i.category, 
  i.status, 
  v.original_filename, 
  v.mime_type, 
  t.detected_language, 
  t.original_transcript
FROM incidents i
LEFT JOIN voice_recordings v ON v.incident_id = i.id
LEFT JOIN transcripts t ON t.recording_id = v.id
ORDER BY i.created_at DESC
LIMIT 10;
```

### 3.3 RIGHT OUTER JOIN
- **Relational Algebra:** $\text{missions} \mathbin{⟖}_{\text{missions.ambulance\_id} = \text{ambulances.id}} \text{ambulances}$
- **Purpose:** Preserves ALL fleet units from `ambulances`, displaying active vehicles even when idle with no mission.
```sql
SELECT 
  a.registration, 
  a.active AS ambulance_active, 
  m.id AS mission_id, 
  m.status AS mission_status, 
  m.created_at AS mission_dispatched_at
FROM missions m
RIGHT OUTER JOIN ambulances a ON m.ambulance_id = a.id
ORDER BY a.registration
LIMIT 10;
```

### 3.4 FULL OUTER JOIN
- **Relational Algebra:** $\text{incidents} \mathbin{⟗}_{\text{incidents.organization\_id} = \text{ambulances.organization\_id}} \text{ambulances}$
- **Purpose:** Bi-directional audit matching all incidents with fleet units in agency jurisdictions, retaining unmatched rows with NULLs.
```sql
SELECT 
  i.case_id, 
  i.category, 
  i.status AS incident_status, 
  a.registration, 
  a.active AS ambulance_active
FROM incidents i
FULL OUTER JOIN ambulances a ON i.organization_id = a.organization_id
LIMIT 15;
```

### 3.5 CROSS JOIN (Cartesian Product)
- **Relational Algebra:** $\text{hospitals} \times (\pi_{\text{category}}(\text{incidents}))$
- **Purpose:** Generates the theoretical Cartesian space $|R| \times |S|$ pairing every facility with all emergency threat types.
```sql
SELECT 
  h.name AS hospital_name, 
  cat.category AS emergency_category
FROM hospitals h
CROSS JOIN (
  SELECT DISTINCT category FROM incidents LIMIT 5
) cat
ORDER BY h.name, cat.category
LIMIT 15;
```

### 3.6 SELF JOIN (Table Joined to Itself)
- **Relational Algebra:** $\text{incidents}_1 \bowtie_{i_1.\text{cat} = i_2.\text{cat} \wedge i_1.\text{id} \neq i_2.\text{id}} \text{incidents}_2$
- **Purpose:** Discovers duplicate or co-occurring emergency reports logged by multiple citizens in the same category.
```sql
SELECT 
  i1.case_id AS incident_alpha, 
  i2.case_id AS incident_beta, 
  i1.category, 
  i1.status AS status_alpha, 
  i2.status AS status_beta
FROM incidents i1
JOIN incidents i2 ON i1.category = i2.category AND i1.id <> i2.id
LIMIT 10;
```

### 3.7 ANTI-JOIN (Set Difference via NOT EXISTS)
- **Relational Algebra:** $\text{ambulances} \mathbin{▷}_{\text{ambulances.id} = \text{missions.ambulance\_id}} \text{missions}$
- **Purpose:** Identifies available fleet units that have NO active dispatch mission currently in progress.
```sql
SELECT 
  a.id AS ambulance_id, 
  a.registration, 
  a.active, 
  a.created_at
FROM ambulances a
WHERE NOT EXISTS (
  SELECT 1 FROM missions m 
  WHERE m.ambulance_id = a.id AND m.status != 'completed'
)
ORDER BY a.registration
LIMIT 10;
```

### 3.8 SEMI-JOIN (Correlated Membership via EXISTS)
- **Relational Algebra:** $\text{incidents} \mathbin{⋉}_{\text{incidents.id} = \text{voice\_recordings.incident\_id}} \text{voice\_recordings}$
- **Purpose:** Filters emergency cases that possess audio voice recordings without duplicating rows or pulling voice columns.
```sql
SELECT 
  i.case_id, 
  i.category, 
  i.priority, 
  i.address, 
  i.status
FROM incidents i
WHERE EXISTS (
  SELECT 1 FROM voice_recordings v 
  WHERE v.incident_id = i.id
)
ORDER BY i.created_at DESC
LIMIT 10;
```

### 3.9 Four-Table Multi-Table Inner Join (Dispatch Manifest)
- **Relational Algebra:** $\text{incidents} \bowtie \text{missions} \bowtie \text{ambulances} \bowtie \text{users}$
- **Purpose:** Assembles complete operational dispatch records linking citizen case, response vehicle, and paramedic.
```sql
SELECT
    i.case_id,
    i.category,
    i.status AS incident_status,
    i.address AS incident_location,
    m.status AS mission_status,
    m.created_at AS dispatched_at,
    a.registration AS ambulance_registration,
    u.name AS responder_name,
    u.email AS responder_email
FROM incidents i
INNER JOIN missions m ON m.incident_id = i.id
INNER JOIN ambulances a ON m.ambulance_id = a.id
INNER JOIN users u ON m.responder_id = u.id
WHERE i.status != 'closed'
ORDER BY m.created_at DESC
LIMIT 10;
```

### 3.10 Five-Table Join: Hospital Bed Allocation Manifest
```sql
SELECT
    i.case_id,
    i.priority,
    h.name AS hospital_name,
    d.name AS department_name,
    c.kind AS bed_type,
    r.status AS referral_status,
    res.status AS reservation_status
FROM referrals r
INNER JOIN incidents i ON r.incident_id = i.id
INNER JOIN capacities c ON r.capacity_id = c.id
INNER JOIN departments d ON c.department_id = d.id
INNER JOIN hospitals h ON d.hospital_id = h.id
LEFT JOIN reservations res ON res.referral_id = r.id
ORDER BY r.created_at DESC;
```

---

## 4. AGGREGATE & ANALYTICAL QUERIES (GROUP BY, HAVING)

### 4.1 Incident Caseload by Category with Conditional Severity Counts
```sql
SELECT
    category,
    COUNT(*) AS total_incidents,
    SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) AS critical_incidents,
    SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) AS high_priority_incidents,
    ROUND(AVG(COALESCE(casualties_count, 0)), 1) AS avg_reported_casualties
FROM incidents
GROUP BY category
ORDER BY total_incidents DESC;
```

### 4.2 Hospital Capacity Utilization Report with HAVING Clause
Identifies hospital trauma departments where remaining bed availability is dangerously low ($\le 2$ beds):

```sql
SELECT
    h.name AS hospital_name,
    d.name AS department_name,
    c.kind AS bed_type,
    c.total AS total_beds,
    c.occupied AS occupied_beds,
    c.reserved AS reserved_beds,
    (c.total - c.occupied - c.reserved) AS available_beds
FROM capacities c
INNER JOIN departments d ON c.department_id = d.id
INNER JOIN hospitals h ON d.hospital_id = h.id
GROUP BY h.name, d.name, c.kind, c.total, c.occupied, c.reserved
HAVING (c.total - c.occupied - c.reserved) <= 2
ORDER BY available_beds ASC;
```

### 4.3 Ambulance Fleet Mission Utilization
```sql
SELECT
    a.registration,
    COUNT(m.id) AS total_missions_served,
    SUM(CASE WHEN m.status = 'completed' THEN 1 ELSE 0 END) AS completed_missions,
    MAX(m.created_at) AS last_dispatched_at
FROM ambulances a
LEFT JOIN missions m ON m.ambulance_id = a.id
GROUP BY a.id, a.registration
ORDER BY total_missions_served DESC;
```


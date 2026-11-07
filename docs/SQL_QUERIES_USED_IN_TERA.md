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

## 3. COMPLEX JOIN QUERIES

### 3.1 Four-Table Multi-Table Inner Join (Incidents, Missions, Ambulances, Users)
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
*Academic Explanation*:
- Master table `incidents` contains core incident facts.
- Joined to `missions` via `m.incident_id = i.id` (1:N relationship).
- Joined to `ambulances` via `m.ambulance_id = a.id` (N:1 relationship).
- Joined to `users` via `m.responder_id = u.id` (N:1 relationship).
- Produces a denormalized dispatch manifest without requiring redundant columns in storage.

### 3.2 Five-Table Join: Hospital Bed Allocation Manifest
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

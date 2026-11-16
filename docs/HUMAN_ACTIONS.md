# TERA Emergency Response — Human Actions & Standard Operating Procedures (SOP)

**Document Code:** SOP-TERA-HUMAN-2026-v2  
**Target Roles:** Control Room Dispatchers, Ambulance Drivers & EMTs, Hospital Triage Officers, System Administrators

---

## 1. Control Room Dispatcher SOP

### 1.1 Inbound Emergency Call Triage
1. **Listen & Verify:** Review real-time speech transcript from caller. Verify incident category and location on interactive tactical map.
2. **Acknowledge:** Click "Acknowledge Report" to signal the caller that emergency services are actively handling the event.
3. **Smart Dispatch:**
   - Review Top-3 recommended ambulances scored by road routing ETA and vehicle capability (ALS required for cardiac/trauma/critical).
   - If overriding recommendation #1 (e.g. driver on rest break or local parade obstruction), enter audited override reason.
   - Click "Dispatch Team".
4. **Duplicate Reports:**
   - If duplicate alert banner appears ("Potential Nearby Duplicate Reports"), review distance.
   - If determined to be the same incident reported by another bystander, click "Merge into this Case" to consolidate caller notes and prevent multi-vehicle dispatch wastage.
5. **Prank / Hoax Filtering:**
   - If caller admits to false report or background audio confirms hoax, click "Flag as Prank / Hoax".
   - Enter reason. The system immediately revokes vehicle dispatch, rejects the case, and records a warning against the caller number.

---

## 2. Ambulance Driver & Responder EMT SOP

### 2.1 Mission Activation
1. **Acknowledge Order:** Tap "Confirm Acknowledged" on mobile tablet or phone.
2. **Enable GPS Streaming:** Tap "Stream Continuous GPS" and approve browser location prompt. Confirm green status pill: `📡 Live Streaming Active`.
3. **Turn-by-Turn GPS:** Tap "Turn-by-Turn GPS to Incident" to launch Google Maps / OSRM navigation directly to caller's verified coordinates.

### 2.2 On-Scene Arrival & Mass-Casualty Triage
1. **Confirm Arrival:** Once vehicle reaches scene, system auto-detects geofence (&lt;100m) or tap "Confirm On Scene".
2. **START Mass-Casualty Triage (Simple Triage And Rapid Treatment):**
   - For multiple casualties, tap "Add Casualty".
   - Assign standardized START color tag:
     - 🔴 **Immediate (Red):** Severe respiratory distress, uncontrolled arterial hemorrhage, tension pneumothorax.
     - 🟡 **Delayed (Yellow):** Serious fractures, stable deep lacerations, delayed care safe.
     - 🟢 **Minor (Green):** Walking wounded, superficial abrasions.
     - ⚫ **Deceased (Black):** Non-salvageable, no spontaneous respirations after airway opening.
3. **Vehicle Breakdown / Obstruction:**
   - If ambulance suffers tire puncture, engine breakdown, or traffic gridlock, immediately notify dispatch.
   - Dispatcher cancels mission with reason code `vehicle_breakdown` and triggers one-click reassign to nearest secondary unit.

---

## 3. Hospital Emergency & Triage Officer SOP

### 3.1 Bed Capacity & Diversion (Bypass) Mode
1. **Daily Capacity Verification:** Update available ICU, Emergency, and General trauma beds at the start of each shift.
2. **Emergency Diversion (Bypass) Activation:**
   - If Emergency Department is overwhelmed (mass casualty, power outage, oxygen manifold failure), immediately toggle **"ED Diversion (Bypass) Mode"** to `ACTIVE`.
   - The TERA dispatch intelligence engine immediately excludes your facility from incoming ambulance destination recommendations, protecting patient safety.
   - Once crisis is stabilized, toggle diversion mode to `INACTIVE`.

### 3.2 Incoming Pre-Arrival & Clinical Handover
1. **Monitor Incoming Units:** Watch the "Urgent Action Required: Incoming Emergency Referrals" queue.
2. **Review Triage Tag:** View incoming patient's START color, injury notes, and live road ETA countdown.
3. **Bed Reservation:** Confirm bed assignment in appropriate clinical department (ICU, Trauma OR, Burn Unit).
4. **Clinical Handover:** When ambulance arrives, verify patient identity and tap "Confirm Handover & Admit" to release ambulance back to field readiness.

---

## 4. System Administrator & Technical SOP

1. **Daily Backup Verification:** Verify automated snapshot created in `./backups/tera_db_YYYYMMDD_HHMMSS.sql.gz` with matching SHA-256 checksum.
2. **Health Monitoring:** Inspect `/health`, `/ready`, and `/metrics` probes.
3. **DPDP Compliance:** Ensure responder breadcrumb prune routine executes weekly. Address citizen right-to-correction requests within 72 hours.


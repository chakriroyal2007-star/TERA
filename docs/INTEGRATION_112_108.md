# TERA & National Emergency Services (112 / 108) Integration Guide

**Integration Protocol:** Emergency CAD & Telematics Bridge (HTTP/REST + WebSocket + Webhook)  
**Standard Reference:** MHA Emergency Response Support System (ERSS - 112) & National Health Mission (108 Ambulance Network)

---

## 1. System Overview

TERA is engineered to integrate seamlessly into existing State and National emergency command infrastructure:
1. **Inbound from 112 ERSS:** Ingestion of emergency calls, PSAP (Public Safety Answering Point) CAD cards, and citizen caller CLI/ANI details.
2. **Outbound to 108 Fleet:** Synchronization of ambulance dispatch orders, telematics streaming, and live road routing.
3. **Hospital Trauma Network:** Direct electronic referral and bed reservation bridge to Government & Private Empaneled Hospitals (PMJAY / Dr. YSR Aarogyasri).

---

## 2. Inbound 112 CAD Webhook Specification

### Endpoint: `POST /api/v1/integrations/112/inbound`
**Authentication:** Mutual TLS (mTLS) or HMAC-SHA256 signature in `X-112-Signature` header.

#### Inbound JSON Payload Example:
```json
{
  "erss_event_id": "ERSS-AP-2026-9817234",
  "call_time": "2026-11-16T08:14:22Z",
  "category": "road_traffic_accident",
  "caller_phone": "+919876543210",
  "location": {
    "latitude": 13.6288,
    "longitude": 79.4192,
    "address_text": "Renigunta Junction near Highway Toll Plaza, Tirupati",
    "district": "Tirupati",
    "state": "Andhra Pradesh"
  },
  "incident_brief": "Bus and SUV head-on collision, multiple injured, trapped passengers reported.",
  "estimated_casualties": 6,
  "required_services": ["ambulance", "fire", "police"]
}
```

#### Processing Pipeline in TERA:
1. **Idempotency Check:** Compares `erss_event_id` against database; prevents duplicate record generation.
2. **Incident Creation:** Inserts into `incidents` with `category="trauma"`, `priority="critical"`, and creates tracking token.
3. **Dispatch Recommendation:** Automatically triggers `rank_ambulances_for_incident()` and surfaces top 3 nearest ALS units to operators within 800ms.
4. **Acknowledgment Response:** Returns HTTP 201 with internal `case_id` and tracking URL:
   ```json
   {
     "status": "received",
     "case_id": "CASE-2026-TRP-0042",
     "tracking_url": "https://tera.emergency.gov.in/track/TRK-9817234abc",
     "assigned_sector": "Tirupati East Highway Command"
   }
   ```

---

## 3. Outbound 108 CAD Synchronization

When an operator confirms dispatch in TERA (`POST /incidents/{id}/dispatch`):
1. **CAD Push:** TERA fires an outbound webhook to 108 dispatch server with designated vehicle ID and turn-by-turn route polyline.
2. **Mobile Data Terminal (MDT) Sync:** The dispatched vehicle's Android tablet receives route coordinates, incident audio recording, and patient clinical summary.
3. **Telemetry Streaming:** Dispatched vehicle begins emitting continuous 5-second GPS updates back to TERA Redis cluster via `POST /missions/{id}/telemetry`.

---

## 4. Hospital Bed Reservation & Handover Protocol

When ambulance departs scene with patient:
1. TERA selects nearest appropriate trauma hospital based on active bed capacity (excluding diverted facilities).
2. Sends HL7 / FHIR-compatible pre-arrival notification to hospital emergency triage desk:
   - Patient START triage color (🔴 Immediate / 🟡 Delayed / 🟢 Minor).
   - Real-time road ETA countdown.
   - Clinical vitals and injury brief.
3. On arrival, hospital triage officer clicks "Confirm Handover", releasing ambulance back to "available" status.

---

## 5. Security & Network Architecture

- **Private VPN / Leased Line:** Dedicated IPsec tunnel between State Data Center (SDC) and TERA emergency nodes.
- **Circuit Breakers:** If 112 webhook endpoint fails to respond within 3 seconds, messages are buffered in durable Redis queue with exponential backoff (1s, 2s, 4s, 8s, up to 10 retries).
- **Audit Logging:** Every payload transmitted or received is hashed and stored in append-only `audit_logs` table.

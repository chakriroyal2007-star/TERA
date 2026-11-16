# TERA Emergency Coordination System — Privacy & DPDP Compliance

**Document Version:** 2.0.0  
**Effective Date:** November 2026  
**Regulatory Framework:** Digital Personal Data Protection Act, 2023 (DPDP Act, India) & CERT-In Cyber Security Guidelines

---

## 1. Executive Summary

TERA operates as an emergency dispatch, live ambulance telemetry, and clinical trauma coordination platform. This document defines the privacy architecture, data governance principles, and technical controls established to comply with India's **Digital Personal Data Protection Act, 2023 (DPDP Act)** while fulfilling critical life-safety emergency functions.

---

## 2. Roles & Classifications under DPDP Act 2023

- **Data Fiduciary:** The State Emergency Response Authority (e.g., 112/108 ERSS Directorate or Health Department operating the TERA cluster).
- **Data Processor:** TERA Emergency Platform Infrastructure (cloud/on-premise compute, automated speech recognition pipelines, and routing engines).
- **Data Principal:** Citizens reporting emergencies, injured patients receiving medical care, and ambulance responder personnel.

---

## 3. Lawful Basis for Processing (Section 7 DPDP Act)

Under **Section 7 of the DPDP Act 2023**, personal data may be processed without explicit prior consent under specific legitimate uses:
1. **Section 7(a) — Medical Emergency:** Processing data for responding to a medical emergency involving a threat to the life or immediate serious threat to the health of the Data Principal or any other individual.
2. **Section 7(b) — Disaster & Public Safety:** Taking measures to provide medical treatment, emergency rescue, or safety during disasters, vehicular pileups, industrial fires, or public safety emergencies.

---

## 4. Personal Data Categories & Retention Lifecycles

| Data Category | Data Elements Collected | Lawful Purpose | Retention Policy | Security Measures |
| :--- | :--- | :--- | :--- | :--- |
| **Citizen Reporter** | Phone number, location, audio recording, spoken text | Dispatch triage, callback confirmation | 90 days post-incident resolution | SHA-256 hashed tracking token, RBAC protected |
| **Patient Clinical Record** | START triage tag, injuries summary, age, gender | Hospital trauma bed reservation | 180 days for statutory clinical audit | Masked in transit, strict organization scope |
| **Ambulance Responder** | GPS coordinates, speed, heading, driver phone | Route navigation & citizen tracking | 7 days high-frequency breadcrumbs | Explicit in-app consent flag, auto-pruned |
| **System Audit Logs** | User ID, role, IP address, action performed | Non-repudiation & security audit | 180 days (CERT-In compliance) | PostgreSQL append-only triggers, immutable |

---

## 5. Explicit Consent & Responder Telemetry Controls

In compliance with DPDP principles:
- **Responder Geolocation Streaming:** Responders must explicitly grant in-app consent via the UI before continuous background GPS streaming is activated (`telemetry_consent = true`).
- **One-Time Location Fix:** Responders who decline continuous streaming can trigger one-time manual location updates.
- **Citizen Location:** Derived either from browser HTML5 geolocation API (requiring native permission prompt) or verbal location description.

---

## 6. Security Hardening & Technical Controls

1. **Tamper-Proof Audit History:** Database triggers enforce append-only guarantees on `audit_logs` and `events`. Mutation or deletion of logs raises database-level exceptions.
2. **Correlation ID Tracking:** Every API transaction carries an `X-Correlation-ID` header, enabling end-to-end tracing without logging raw PII in diagnostic logs.
3. **Session & Token Security:**
   - Stateless JWT access tokens (15-minute expiry).
   - Rotating refresh token families in HttpOnly, SameSite=Strict cookies.
   - Immediate session revocation upon role change or administrative freeze.
4. **Encryption in Transit & at Rest:**
   - TLS 1.3 enforced for all client and inter-service communications.
   - Audio recordings stored with SHA-256 integrity checksums.

---

## 7. Data Principal Rights & Redressal

In accordance with Sections 11–13 of the DPDP Act:
- **Right to Information:** Citizens can track real-time incident status using their anonymized case ID / tracking token without creating an account.
- **Right to Correction:** Operators and responders can correct triage details and casualty numbers upon physical on-scene verification.
- **Grievance Officer:**
  - **Email:** `privacy@tera.emergency.gov.in` / `chakriroyal2007@gmail.com`
  - **Resolution SLA:** Within 72 hours for emergency data inquiries.

# API guide

Base path: `/api/v1`. Interactive documentation: `/api/docs`. Generated schema: [`openapi.json`](openapi.json). Responses are JSON unless downloading evidence. Datetimes use timezone-aware ISO 8601.

## Credentials and CSRF

Successful password/email-code/Google authentication sets `tera_access` and `tera_refresh` as HttpOnly cookies. Read the `tera_csrf` cookie and send it as `X-CSRF-Token` for authenticated mutations, refresh and logout. Never put tokens into browser local storage. Clients should refresh once after an access-token 401 and retry the request; if refresh fails, sign in again.

The browser and API must use the same configured `PUBLIC_URL` origin. Cross-origin credentialed access is not enabled.

## Main routes

| Resource | Routes |
|---|---|
| Authentication | `POST /auth/register`, `/auth/login`, `/auth/otp/request`, `/auth/otp/verify`, `/auth/refresh`, `/auth/logout` |
| Google | `GET /auth/google`, `GET /auth/google/callback`; enabled only with provider configuration |
| Account | `GET /auth/me`, `/auth/sessions`, `/auth/history`; `DELETE /auth/sessions/{id}`; `POST /auth/mfa/setup`, `/auth/mfa/confirm` |
| Public reporting | `POST /public/incidents`; `GET /public/track/{code}`; `POST /public/track/{code}/notes`, `/evidence` |
| Incidents | `GET /incidents`, `/incidents/{id}`, `/incidents/{id}/suggestions` |
| Coordination | `POST /incidents/{id}/verify`, `/priority`, `/duplicate`, `/dispatch`, `/referrals`, `/close` |
| Missions | `GET /missions`; `POST /missions/{id}/progress`, `/location` |
| Hospitals | `GET/POST /hospitals`; `PATCH /hospitals/{id}`; `GET/POST /departments`; `POST /capacities`; `PATCH /capacities/{id}` |
| Referrals | `GET /referrals`; `POST /referrals/{id}/decision`, `/handover` |
| Fleet | `GET/POST /ambulances`; `PATCH /ambulances/{id}`; `GET /responders` |
| Administration | `GET/POST /organizations`; `GET /users`; `PATCH /users/{id}`, `/users/{id}/access`; `POST /invitations`; `GET/PUT /permissions`; `GET /audit`, `/system` |
| Analysis / synchronization | `GET /analytics`, `/notifications?after=0`; `WS /ws?after=0` |
| Evidence access | `GET /incidents/{id}/evidence`; authenticated attachment `GET /evidence/{id}` |

`GET /incidents`, `/users` and `/audit` support `offset` and `limit`, with response `{items, total}`. Registry, mission, referral, evidence and account-history endpoints accept `offset` and `limit` and return arrays capped at 100 per page. Continue until a page is shorter than the requested limit. UI resource selectors traverse all available pages. Permission restrictions return up to 500. Event synchronization uses an ordered cursor with batches of 100.

## Reporting example

```http
POST /api/v1/public/incidents
Content-Type: application/json

{
  "category": "medical",
  "description": "A description supplied by the actual reporter",
  "address": "The location or landmark supplied by the actual reporter",
  "latitude": null,
  "longitude": null
}
```

Success returns HTTP 201 with a generated `tracking_code` and `status`. Save the tracking code: its plaintext is not stored and administrators cannot retrieve it. Both coordinates must be present or both null.

## State-changing examples

```json
{"priority":"high","note":"Operator's verification findings"}
```

Send to `/incidents/{id}/verify` as an operator. Then dispatch with actual registered IDs:

```json
{"ambulance_id":"<registered ambulance UUID>","responder_id":"<approved responder UUID>"}
```

Responder progress uses `{ "status": "acknowledged", "note": "..." }`. Referral requests use `{ "capacity_id": "<registered capacity UUID>" }`; hospital decisions use `{ "accept": true, "reason": "Verified capacity" }`. These examples define request shapes, not seed records.

## Realtime

Connect with an authenticated cookie to `/api/v1/ws?after=<last_received_event_id>` using the configured browser Origin. Events contain `id`, `created_at`, `kind`, `incident_id`, `organization_id`, `actor_id` and `payload`. Heartbeats contain `kind: "heartbeat"` and a cursor. Reconnect with the most recent received ID; process event IDs idempotently. WebSocket authorization errors close with 4401/4403. Suspension, logout and access-token expiry are checked on every polling cycle.

## Errors

- 401: missing/expired/revoked credentials or authentication failure.
- 403: role, permission restriction, CSRF or Origin denial.
- 404: absent or out-of-scope record.
- 409: invalid transition, already allocated resource, duplicate unique value or inconsistent capacity.
- 413/415: oversized or unsupported evidence.
- 422: request validation.
- 429: rate limit, with `Retry-After`.
- 503: configured service unavailable where handled explicitly.

Responses do not expose SQL statements, password/OTP hashes or raw refresh credentials. PostgreSQL transaction failures roll back; a partial allocation or bed reservation is not committed.

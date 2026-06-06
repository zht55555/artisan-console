# Batch 1 - Anonymous Auth Baseline

## Delivered

- Middleware injects `visitor_id` cookie for anonymous users.
- `POST /api/auth/visitor` returns stable anonymous identity.
- `POST /api/auth/magic-link/send` validates request contract (email send to be integrated in Better Auth batch).
- `getCurrentUserOrThrow` utility added for protected server logic.

## Endpoints

### POST /api/auth/visitor

Response:

```json
{
  "userId": "v_xxx",
  "visitorId": "v_xxx",
  "mode": "anonymous"
}
```

### POST /api/auth/magic-link/send

Request:

```json
{
  "email": "user@example.com"
}
```

Response:

```json
{
  "ok": true,
  "message": "Magic link dispatch is pending Better Auth integration.",
  "email": "user@example.com"
}
```

## Validation Commands

```bash
pnpm dev
curl -X POST http://localhost:3000/api/auth/visitor
curl -X POST http://localhost:3000/api/auth/magic-link/send \
  -H 'content-type: application/json' \
  -d '{"email":"user@example.com"}'
```

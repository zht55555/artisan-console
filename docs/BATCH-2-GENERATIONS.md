# Batch 2 - Generations API

## Delivered

- `POST /api/v1/generations`: create generation task
- `GET /api/v1/generations/:id`: fetch task and assets
- `POST /api/v1/generations/:id/cancel`: cancel task with state transition guard
- zod request validation
- status transition helper (`queued -> running -> succeeded/failed/canceled`)

## Added Files

- `src/db/schema.ts`
- `src/db/index.ts`
- `src/lib/generation-status.ts`
- `src/app/api/v1/generations/route.ts`
- `src/app/api/v1/generations/[id]/route.ts`
- `src/app/api/v1/generations/[id]/cancel/route.ts`
- `drizzle.config.ts`

## Before Testing

1. Set `DATABASE_URL` in `.env.local`
2. Push schema:

```bash
pnpm db:push
```

## Validation Commands

```bash
# 1) create anonymous identity cookie
curl -i -c /tmp/artisan-cookie.txt -X POST http://localhost:3000/api/auth/visitor

# 2) create task
curl -s -b /tmp/artisan-cookie.txt -X POST http://localhost:3000/api/v1/generations \
  -H 'content-type: application/json' \
  -d '{"type":"text_to_image","prompt":"A cyberpunk cat in neon rain","size":"1024x1024"}'

# 3) query task (replace TASK_ID)
curl -s -b /tmp/artisan-cookie.txt http://localhost:3000/api/v1/generations/TASK_ID

# 4) cancel task (replace TASK_ID)
curl -s -b /tmp/artisan-cookie.txt -X POST http://localhost:3000/api/v1/generations/TASK_ID/cancel
```

## Notes

- If `DATABASE_URL` is missing, APIs return `503 database_not_configured`.
- Storage bucket is not required in this batch.

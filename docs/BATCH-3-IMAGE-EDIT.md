# Batch 3 - Image Edit API

## Delivered

- `POST /api/v1/edits`: submit image edit task
- `POST /api/v1/generations/[id]/mock-complete`: mock task completion and create edited image asset
- generation detail API now returns `sourceAsset` for edit tasks
- `sourceAssetId` is validated against current user ownership
- edited result stores `parent_asset_id` for lineage traceability

## Endpoints

### Create edit task

`POST /api/v1/edits`

Request body:

```json
{
  "sourceAssetId": "asset_xxx",
  "prompt": "Add cinematic lighting",
  "style": "cinematic",
  "size": "1024x1024"
}
```

### Mock complete edit task (development only)

`POST /api/v1/generations/:id/mock-complete`

Returns generated `assetId` and `parentAssetId`.

### Query generation detail

`GET /api/v1/generations/:id`

Returns:

- `task`
- `assets`
- `sourceAsset`

## Suggested Validation Flow

1. Create a base text-to-image task
2. Mock complete it to get source asset
3. Submit edit task with `sourceAssetId`
4. Mock complete edit task
5. Query edit task detail and verify `parentAssetId`

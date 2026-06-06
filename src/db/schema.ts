import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  integer,
} from "drizzle-orm/pg-core";

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_conversations_user_updated").on(t.userId, t.updatedAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    status: text("status").notNull().default("done"),
    tokenCount: integer("token_count"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_messages_conversation_created").on(
      t.conversationId,
      t.createdAt,
    ),
    index("idx_messages_user_created").on(t.userId, t.createdAt),
  ],
);

export const generationTasks = pgTable(
  "generation_tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull(),
    prompt: text("prompt").notNull(),
    negativePrompt: text("negative_prompt"),
    params: jsonb("params"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_generation_tasks_user_created_at").on(t.userId, t.createdAt),
    index("idx_generation_tasks_status_created_at").on(t.status, t.createdAt),
  ],
);

export const imageAssets = pgTable(
  "image_assets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    taskId: text("task_id").notNull(),
    parentAssetId: text("parent_asset_id"),
    url: text("url").notNull(),
    width: integer("width"),
    height: integer("height"),
    mimeType: text("mime_type"),
    promptSnapshot: text("prompt_snapshot"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_image_assets_user_created_at").on(t.userId, t.createdAt),
    index("idx_image_assets_task_id").on(t.taskId),
  ],
);

export const promptTemplates = pgTable(
  "prompt_templates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    template: text("template").notNull(),
    variables: jsonb("variables").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_prompt_templates_user_updated").on(t.userId, t.updatedAt),
    index("idx_prompt_templates_user_name").on(t.userId, t.name),
  ],
);

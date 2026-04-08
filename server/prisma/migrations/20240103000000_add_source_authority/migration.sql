CREATE TABLE IF NOT EXISTS "source_authority" (
    "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
    "channel_username" TEXT        NOT NULL,
    "authority"        DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "label"            TEXT,
    "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_authority_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "source_authority_channel_username_key"
    ON "source_authority"("channel_username");

-- Seed: default fallback record
INSERT INTO "source_authority" ("channel_username", "authority", "label")
VALUES ('__default__', 0.5, 'Default fallback')
ON CONFLICT ("channel_username") DO NOTHING;

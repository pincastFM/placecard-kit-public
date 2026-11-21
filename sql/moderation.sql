-- The shared moderation module (Track C, R/moderation/SPEC.md). Additive only.
CREATE TABLE IF NOT EXISTS moderation_items (
  id            bigserial    PRIMARY KEY,
  instance      varchar(32)  NOT NULL,     -- 'treehopper', 'studio'
  kind          varchar(32)  NOT NULL,     -- 'tree_photo', 'tree_note', 'studio_card'
  ref           varchar(64)  NOT NULL,     -- the content row's id, as text
  owner_sub     varchar(255) NOT NULL,     -- Logto id
  state         varchar(16)  NOT NULL,
  hidden_by     varchar(16),               -- admin | owner | replaced (state hidden only)
  reports_open  integer      NOT NULL DEFAULT 0,
  submitted_at  timestamptz  NOT NULL DEFAULT now(),
  decided_at    timestamptz,
  decided_by    varchar(255),              -- Logto id, or auto | own | system | backfill | import
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT moderation_items_state_chk CHECK (state IN ('pending','approved','declined','reported','hidden')),
  CONSTRAINT moderation_items_hidden_chk CHECK ((state = 'hidden') = (hidden_by IS NOT NULL)),
  CONSTRAINT moderation_items_ref_uq UNIQUE (instance, kind, ref)
);
CREATE INDEX IF NOT EXISTS moderation_items_queue ON moderation_items (instance, state, submitted_at);
CREATE INDEX IF NOT EXISTS moderation_items_owner ON moderation_items (instance, owner_sub, state);

CREATE TABLE IF NOT EXISTS moderation_reports (
  id            bigserial    PRIMARY KEY,
  item_id       bigint       NOT NULL REFERENCES moderation_items (id) ON DELETE CASCADE,
  reporter_sub  varchar(255) NOT NULL,
  reason        varchar(24)  NOT NULL,     -- not_this_tree | offensive | spam | private | wrong_place | other
  created_at    timestamptz  NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolution    varchar(8),                -- kept | hidden
  CONSTRAINT moderation_reports_once UNIQUE (item_id, reporter_sub)
);
CREATE INDEX IF NOT EXISTS moderation_reports_reporter ON moderation_reports (reporter_sub, created_at);

CREATE TABLE IF NOT EXISTS moderation_settings (
  instance      varchar(32)  PRIMARY KEY,
  queue         boolean      NOT NULL,
  alerts        boolean      NOT NULL DEFAULT true,
  updated_by    varchar(255),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation_events (
  id            bigserial    PRIMARY KEY,
  item_id       bigint       NOT NULL REFERENCES moderation_items (id) ON DELETE CASCADE,
  move          varchar(16)  NOT NULL,
  from_state    varchar(16),
  to_state      varchar(16)  NOT NULL,
  actor         varchar(255) NOT NULL,
  at            timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_events_item ON moderation_events (item_id, at);

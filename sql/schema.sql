-- Tunisian Hoods whitelist bot — schema (SQLite)
-- The bot creates these tables automatically on startup (see src/db.js).
-- This file is kept for reference / manual inspection only — you don't need
-- to run it yourself.

CREATE TABLE IF NOT EXISTS wl_applications (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id          TEXT NOT NULL UNIQUE,
  discord_tag         TEXT NOT NULL,

  -- form answers (11 questions, collected across 3 chained modals)
  name                TEXT NOT NULL, -- Your name
  age                 TEXT NOT NULL, -- Age
  rp_before           TEXT NOT NULL, -- Have you played RP before? If yes, where?
  playstyle           TEXT NOT NULL, -- What do you want to play, legal or illegal?
  about_you           TEXT NOT NULL, -- Tell us a little about yourself.
  backstory           TEXT NOT NULL, -- Your character's backstory
  first_action        TEXT NOT NULL, -- First thing you'll do when you join the server
  rp_meaning          TEXT NOT NULL, -- What does Roleplay mean?
  goals               TEXT NOT NULL, -- What are your goals as an RP player?
  referral            TEXT NOT NULL, -- How did you hear about the server?
  pc_specs            TEXT NOT NULL, -- What are your PC specs?

  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'denied', 'revoked')),
  applied_at          TEXT NOT NULL, -- ISO 8601, e.g. 2026-07-09T14:32:00.000Z
  reviewed_at         TEXT,
  reviewed_by         TEXT,
  deny_reason         TEXT,
  admin_message_id    TEXT -- the review embed's message id in ADMIN_CHANNEL_ID, so it can be re-edited later
);

CREATE INDEX IF NOT EXISTS idx_status ON wl_applications(status);

-- Singleton row tracking the public panel embed so it can be re-edited
-- instead of re-posted on every bot restart / slot-count change.
CREATE TABLE IF NOT EXISTS wl_panel (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL
);

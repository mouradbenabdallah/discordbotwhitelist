const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

fs.mkdirSync(path.dirname(config.db.path), { recursive: true });

const db = new DatabaseSync(config.db.path);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS wl_applications (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id          TEXT NOT NULL UNIQUE,
    discord_tag         TEXT NOT NULL,

    name                TEXT NOT NULL,
    age                 TEXT NOT NULL,
    rp_before           TEXT NOT NULL,
    playstyle           TEXT NOT NULL,
    about_you           TEXT NOT NULL,
    backstory           TEXT NOT NULL,
    first_action        TEXT NOT NULL,
    rp_meaning          TEXT NOT NULL,
    goals               TEXT NOT NULL,
    referral            TEXT NOT NULL,
    pc_specs            TEXT NOT NULL,

    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'denied', 'revoked')),
    applied_at          TEXT NOT NULL,
    reviewed_at         TEXT,
    reviewed_by         TEXT,
    deny_reason         TEXT,
    admin_message_id    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_status ON wl_applications(status);

  CREATE TABLE IF NOT EXISTS wl_panel (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL
  );
`);

function nowIso() {
  return new Date().toISOString();
}

async function testConnection() {
  db.prepare('SELECT 1').get();
  console.log(`[db] Connected to SQLite at ${config.db.path}`);
}

async function getAcceptedCount() {
  return db.prepare("SELECT COUNT(*) AS cnt FROM wl_applications WHERE status = 'accepted'").get().cnt;
}

async function getRemainingSlots() {
  const accepted = await getAcceptedCount();
  return Math.max(0, config.maxSlots - accepted);
}

async function getApplicationByDiscordId(discordId) {
  return db.prepare('SELECT * FROM wl_applications WHERE discord_id = ?').get(discordId) ?? null;
}

async function getApplicationById(id) {
  return db.prepare('SELECT * FROM wl_applications WHERE id = ?').get(id) ?? null;
}

async function setAdminMessageId(applicationId, messageId) {
  db.prepare('UPDATE wl_applications SET admin_message_id = ? WHERE id = ?').run(messageId, applicationId);
}

// Inserts a new application, or re-opens a previously denied/revoked row for
// the same discord_id as a fresh pending application (discord_id is UNIQUE).
async function submitApplication({
  discordId,
  discordTag,
  name,
  age,
  rpBefore,
  playstyle,
  aboutYou,
  backstory,
  firstAction,
  rpMeaning,
  goals,
  referral,
  pcSpecs,
}) {
  db.prepare(
    `INSERT INTO wl_applications
       (discord_id, discord_tag, name, age, rp_before, playstyle, about_you, backstory, first_action, rp_meaning, goals, referral, pc_specs, status, applied_at, reviewed_at, reviewed_by, deny_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, NULL)
     ON CONFLICT(discord_id) DO UPDATE SET
       discord_tag = excluded.discord_tag,
       name = excluded.name,
       age = excluded.age,
       rp_before = excluded.rp_before,
       playstyle = excluded.playstyle,
       about_you = excluded.about_you,
       backstory = excluded.backstory,
       first_action = excluded.first_action,
       rp_meaning = excluded.rp_meaning,
       goals = excluded.goals,
       referral = excluded.referral,
       pc_specs = excluded.pc_specs,
       status = 'pending',
       applied_at = excluded.applied_at,
       reviewed_at = NULL,
       reviewed_by = NULL,
       deny_reason = NULL`
  ).run(discordId, discordTag, name, age, rpBefore, playstyle, aboutYou, backstory, firstAction, rpMeaning, goals, referral, pcSpecs, nowIso());
  return getApplicationByDiscordId(discordId);
}

// SQLite is single-writer and node:sqlite executes synchronously, so wrapping
// this count-check + update in BEGIN/COMMIT serializes it the same way the
// old MySQL "SELECT ... FOR UPDATE" row lock did — two admins clicking Accept
// at once on the last slot still can't both succeed.
async function acceptApplication(applicationId, reviewerId) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const { cnt } = db.prepare("SELECT COUNT(*) AS cnt FROM wl_applications WHERE status = 'accepted'").get();
    if (cnt >= config.maxSlots) {
      db.exec('ROLLBACK');
      return { success: false, reason: 'full' };
    }

    const result = db
      .prepare("UPDATE wl_applications SET status = 'accepted', reviewed_at = ?, reviewed_by = ? WHERE id = ? AND status = 'pending'")
      .run(nowIso(), reviewerId, applicationId);

    if (result.changes === 0) {
      db.exec('ROLLBACK');
      return { success: false, reason: 'not_pending' };
    }

    db.exec('COMMIT');
    return { success: true };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

async function denyApplication(applicationId, reviewerId, reason) {
  const result = db
    .prepare("UPDATE wl_applications SET status = 'denied', reviewed_at = ?, reviewed_by = ?, deny_reason = ? WHERE id = ? AND status = 'pending'")
    .run(nowIso(), reviewerId, reason ?? null, applicationId);
  return result.changes > 0;
}

async function revokeApplication(applicationId, reviewerId) {
  const result = db
    .prepare("UPDATE wl_applications SET status = 'revoked', reviewed_at = ?, reviewed_by = ? WHERE id = ? AND status = 'accepted'")
    .run(nowIso(), reviewerId, applicationId);
  return result.changes > 0;
}

// Used by the guildMemberRemove listener: auto-revoke an accepted member who left.
async function revokeByDiscordId(discordId) {
  const result = db
    .prepare("UPDATE wl_applications SET status = 'revoked', reviewed_at = ?, reviewed_by = 'system:member_left' WHERE discord_id = ? AND status = 'accepted'")
    .run(nowIso(), discordId);
  return result.changes > 0;
}

async function getPanelMessage() {
  return db.prepare('SELECT channel_id, message_id FROM wl_panel WHERE id = 1').get() ?? null;
}

async function setPanelMessage(channelId, messageId) {
  db.prepare(
    `INSERT INTO wl_panel (id, channel_id, message_id) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id`
  ).run(channelId, messageId);
}

module.exports = {
  db,
  testConnection,
  getAcceptedCount,
  getRemainingSlots,
  getApplicationByDiscordId,
  getApplicationById,
  setAdminMessageId,
  submitApplication,
  acceptApplication,
  denyApplication,
  revokeApplication,
  revokeByDiscordId,
  getPanelMessage,
  setPanelMessage,
};

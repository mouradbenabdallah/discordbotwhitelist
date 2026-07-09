const path = require('path');
require('dotenv').config();

const REQUIRED_VARS = [
  'BOT_TOKEN',
  'GUILD_ID',
  'ADMIN_ROLE_ID',
  'PUBLIC_CHANNEL_ID',
  'ADMIN_CHANNEL_ID',
];

const missing = REQUIRED_VARS.filter((key) => !process.env[key] || process.env[key].trim() === '');
if (missing.length > 0) {
  console.error(`[config] Missing required .env values: ${missing.join(', ')}`);
  console.error('[config] Copy .env.example to .env and fill in the values before starting the bot.');
  process.exit(1);
}

const maxSlots = Number(process.env.MAX_SLOTS ?? 40);
if (!Number.isInteger(maxSlots) || maxSlots <= 0) {
  console.error('[config] MAX_SLOTS must be a positive integer.');
  process.exit(1);
}

module.exports = {
  botToken: process.env.BOT_TOKEN,
  guildId: process.env.GUILD_ID,
  adminRoleId: process.env.ADMIN_ROLE_ID,
  whitelistedRoleId: process.env.WHITELISTED_ROLE_ID || null,
  publicChannelId: process.env.PUBLIC_CHANNEL_ID,
  adminChannelId: process.env.ADMIN_CHANNEL_ID,
  // optional: fire-and-forget Discord webhook notifications, separate from the interactive admin embed
  webhookApplyUrl: process.env.WEBHOOK_APPLY_URL || null,
  webhookAcceptUrl: process.env.WEBHOOK_ACCEPT_URL || null,
  db: {
    // SQLite file, embedded — no separate database server needed.
    path: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'wl.sqlite3'),
  },
  maxSlots,
};

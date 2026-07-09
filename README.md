# Tunisian Hoods — Whitelist Bot

A standalone Discord bot that runs whitelist applications for the "Tunisian Hoods" FiveM
community: a public "Apply" panel with a live slot counter, an 11-question application form (split
across 3 chained modals — Discord caps a modal at 5 fields), and an
admin review channel with Accept / Deny / Revoke buttons backed by SQLite.

This is Discord-only — there is no FiveM/Lua integration.

---

## 1. Create the Discord application + bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Name it (e.g. `Tunisian Hoods Whitelist`) → **Bot** tab → **Reset Token** → copy it. This is your `BOT_TOKEN`.
3. Under **Bot**, enable these **Privileged Gateway Intents**:
   - **Server Members Intent** — required so the bot receives `guildMemberRemove` (auto-revoke on leave) and can look up members to assign/remove the whitelisted role.
4. Bot permissions needed (used to build the invite link in the next step):
   - View Channels
   - Send Messages
   - Embed Links
   - Manage Roles (only needed if you set `WHITELISTED_ROLE_ID`)
   - Read Message History (needed to fetch and re-edit its own embeds)
5. Gateway intents used in code: `Guilds`, `GuildMembers`. No `MessageContent` intent is needed — the bot never reads message text, only buttons/modals.

### Invite link

Go to **OAuth2 → URL Generator**, check scope `bot`, then check the permissions above. Open the
generated URL and invite the bot to your server.

> **Important — role hierarchy:** if you set `WHITELISTED_ROLE_ID`, the bot's own role must sit
> **above** that role in Server Settings → Roles, or `Manage Roles` will fail silently per-user
> (you'll see it logged to the console).

---

## 2. Local testing setup (do this before touching production)

### 2a. Throwaway test Discord server + bot

1. In Discord, create a new server just for testing (e.g. "TH Whitelist — TEST"). Do **not** reuse
   your real community server for development.
2. Create a **second** bot application in the Developer Portal (e.g. `Tunisian Hoods Whitelist [DEV]`)
   so your dev bot has its own token, separate from production. Repeat the steps in section 1 for it.
3. In your test server, create:
   - A text channel for the public panel (copy its ID → `PUBLIC_CHANNEL_ID`).
   - A text channel for admin review, visible only to staff (copy its ID → `ADMIN_CHANNEL_ID`).
   - An admin role (copy its ID → `ADMIN_ROLE_ID`) and give it to your own test account.
   - Optionally a "Whitelisted" role (copy its ID → `WHITELISTED_ROLE_ID`) if you want to test role assignment.
   - Enable Developer Mode in Discord (User Settings → Advanced) so you can right-click → Copy ID on servers/channels/roles.
4. Copy the test server's ID → `GUILD_ID`.

### 2b. Database

Nothing to install — the bot uses SQLite (`node:sqlite`, built into Node 23.4+), an embedded
single-file database. On first run it automatically creates `data/wl.sqlite3` (git-ignored) and the
`wl_applications`/`wl_panel` tables inside it. `sql/schema.sql` is kept only as reference
documentation of that schema.

If you want a custom file location, set `DB_PATH` in `.env`; otherwise it defaults to
`./data/wl.sqlite3`.

### 2c. Configure `.env`

```
cp .env.example .env
```

Fill in the **test** bot's token/IDs. `DB_PATH` can be left blank for local dev. Never commit `.env`
— it's already in `.gitignore`.

### 2d. Install and run

```
npm install
node .
```

On startup the bot logs in, connects to SQLite, and posts the public panel embed in
`PUBLIC_CHANNEL_ID`. Click **Apply**, fill out the form, then check `ADMIN_CHANNEL_ID` for the
review embed and test Accept / Deny / Revoke with your admin-role test account.

To test the leave-listener, kick/leave your test account from the test server after being
accepted and confirm the slot count goes back up.

---

## 3. Deploying to a VPS with pm2

1. Copy the project to the VPS (git clone, scp, whatever you use), `cd` into it.
2. Make sure the VPS has **Node.js 23.4+** installed (e.g. via nvm or NodeSource) — no separate
   database server needed, SQLite is embedded.
3. Create `.env` on the VPS with **production** bot token/IDs (a fresh `DB_PATH`, e.g.
   `/opt/tunisian-hoods-wl/data/wl.sqlite3`, keeps production data separate from your local dev file).
4. Install dependencies:
   ```
   npm install --omit=dev
   ```
5. Install pm2 globally if you haven't already:
   ```
   npm install -g pm2
   ```
6. Start the bot under pm2:
   ```
   pm2 start src/index.js --name tunisian-hoods-whitelist
   ```
7. Persist across reboots:
   ```
   pm2 save
   pm2 startup
   ```
   (`pm2 startup` prints a command — run the one it gives you, it needs sudo.)
8. Useful pm2 commands:
   ```
   pm2 logs tunisian-hoods-whitelist
   pm2 restart tunisian-hoods-whitelist
   pm2 stop tunisian-hoods-whitelist
   ```

---

## Project structure

```
src/
  index.js                    entrypoint: client, intents, event wiring
  config.js                   loads + validates .env
  db.js                       SQLite connection + all queries (incl. atomic accept transaction)
  constants.js                brand color, custom IDs, modal field IDs
  embeds/
    publicPanel.js            public panel embed + refresh (post-or-edit) logic
    adminApplication.js       admin review embed + Accept/Deny/Revoke buttons
  components/
    applyModal.js             11-field application form, split into 3 chained modals
    denyModal.js               optional deny-reason modal
  handlers/
    interactionCreate.js      routes all button clicks + modal submits
    guildMemberRemove.js      auto-revoke on member leave
sql/
  schema.sql                  wl_applications + wl_panel tables
```

## How the slot count stays correct

`MAX_SLOTS` is fixed in `.env`. The number of taken slots is **never stored** — every read
(`getRemainingSlots`) runs `COUNT(*) FROM wl_applications WHERE status = 'accepted'` live. Accepting
an application runs inside a SQLite transaction (`BEGIN IMMEDIATE`) that re-checks this count
immediately before the status flip, so two admins clicking Accept at the same instant on the last
slot can never both succeed.

## Notes

- Denied applicants can re-apply 24 hours after the admin's Deny click (based on `reviewed_at`), and
  only if slots are still available — their existing row, unique on `discord_id`, is reopened to
  `pending`. Revoked applicants can re-apply immediately.
- Users with a `pending` or `accepted` application are blocked from re-applying.
- All user-facing text is in English.
- Requires **Node 23.4+** (uses the built-in `node:sqlite` module and the global `fetch` for webhook notifications).

## Optional webhook notifications

Separate from the interactive admin embed, you can wire up two plain Discord webhooks:

- `WEBHOOK_APPLY_URL` — fires a short alert whenever someone submits an application.
- `WEBHOOK_ACCEPT_URL` — fires a short "welcome" alert whenever someone is accepted.

Create a webhook under a channel's **Integrations → Webhooks → New Webhook**, copy its URL into
`.env`. Leave either blank to disable it. These are separate credentials from `BOT_TOKEN` — anyone
holding a webhook URL can post to that channel, so treat it as a secret and never paste it in chat,
issues, or commits. If a webhook URL is ever exposed, delete/regenerate it from the same
Integrations page immediately.

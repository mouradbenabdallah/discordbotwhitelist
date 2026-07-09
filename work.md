Build a Discord whitelist application bot for my FiveM roleplay server "Tunisian Hoods" (community branding: red accent color).
This is a standalone Discord bot only — no FiveM/Lua integration in this task.

STACK:
- Node.js + discord.js v14+
- mysql2/promise for database
- pm2 for process management in production

CONFIG — .env file with placeholders, never hardcoded, add to .gitignore:
BOT_TOKEN, GUILD_ID, ADMIN_ROLE_ID, WHITELISTED_ROLE_ID (optional, assigned on accept),
PUBLIC_CHANNEL_ID, ADMIN_CHANNEL_ID, DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME, MAX_SLOTS=40.

DATABASE:
Table `wl_applications`: id, discord_id (unique), discord_tag, status enum('pending','accepted','denied','revoked'),
columns for each form answer, applied_at, reviewed_at, reviewed_by.
"Active members" = rows where status='accepted'.
Remaining slots is ALWAYS computed live: MAX_SLOTS - COUNT(status='accepted'). Never store the count as a stored/mutable number.

BOT BEHAVIOR:
1. On startup, post or refresh a public panel embed in PUBLIC_CHANNEL_ID: "Tunisian Hoods" branding (red accent),
   an "Apply" button, footer showing live remaining slots ("X / 40 slots left"). Re-edit this embed whenever the count changes.
2. Apply button opens a modal with these 5 fields: [FILL IN — my 5 questions].
   Use dropdown/select components for fixed-choice answers, paragraph inputs for free text.
   - Block re-apply if user already has a pending or accepted application (clear ephemeral message).
   - Block new applications if 0 slots remain ("whitelist full" message).
3. On submit: insert 'pending' row, post the application as its own embed in ADMIN_CHANNEL_ID with
   Accept / Deny / Revoke buttons, restricted to ADMIN_ROLE_ID members only (reject clicks from anyone else).
4. Accept: atomic check that live accepted-count < MAX_SLOTS (use a transaction or conditional UPDATE so two
   admins clicking Accept at the same moment on the last slot can never push it past 40).
   On success: status='accepted', assign WHITELISTED_ROLE_ID if set, edit admin embed to show who approved
   and when, DM the applicant a confirmation, refresh the public embed's slot count.
5. Deny: status='denied', edit embed, DM applicant (optional reason field for the admin to add). Denied users may re-apply.
6. Revoke: status='revoked', frees the slot, refresh count, optionally remove WHITELISTED_ROLE_ID.
7. guildMemberRemove listener: if a member with status='accepted' leaves the Discord server, auto-set their
   row to 'revoked' so the slot self-frees, refresh count.
8. Log all DB errors and connection issues clearly to console/pm2 logs.

LOCAL TESTING SETUP (do this first, before any deploy):
- Instructions for creating a throwaway private test Discord server + test bot application for local dev.
- Instructions for running MySQL locally (or via Docker) for local dev, separate from any production DB.
- .env.example showing local values vs production values.

DELIVERABLES:
- Full bot source (interaction handlers, DB module, config loader, clean file structure).
- SQL script to create the `wl_applications` table.
- README covering: creating the Discord application + bot token, invite link/permissions needed,
  setting up local test Discord server + local MySQL, `npm install`, running locally with `node .`,
  then deploying to a VPS under pm2 (pm2 start / save / startup).
- All user-facing text (buttons, embeds, DMs, deferral/error messages) in [FILL IN: French or English].

BEFORE FINALIZING, confirm with me: exact bot permissions/intents needed (Guilds, GuildMembers for the
leave-listener, etc.) and whether I want slash-command based admin tools in addition to the buttons.


i install node + i have xampp lite

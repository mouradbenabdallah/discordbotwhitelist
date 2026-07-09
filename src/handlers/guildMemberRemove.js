const config = require('../config');
const db = require('../db');
const { refreshPanel } = require('../embeds/publicPanel');
const { refreshAdminMessage } = require('../embeds/adminApplication');

module.exports = async function handleGuildMemberRemove(client, member) {
  try {
    if (member.guild.id !== config.guildId) return;

    const revoked = await db.revokeByDiscordId(member.id);
    if (!revoked) return;

    console.log(`[leave] ${member.id} left the server while accepted — auto-revoked, slot freed.`);

    const app = await db.getApplicationByDiscordId(member.id);
    if (app) await refreshAdminMessage(client, app);

    await refreshPanel(client);
  } catch (err) {
    console.error('[leave] Error handling guildMemberRemove:', err);
  }
};

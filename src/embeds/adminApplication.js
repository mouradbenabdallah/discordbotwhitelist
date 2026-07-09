const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND_COLOR, IDS } = require('../constants');
const config = require('../config');

const STATUS_LABEL = {
  pending: 'Pending',
  accepted: 'Accepted',
  denied: 'Denied',
  revoked: 'Revoked',
};

function buildAdminEmbed(app) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`Whitelist Application #${app.id}`)
    .setDescription(`Applicant: <@${app.discord_id}> (${app.discord_tag})`)
    .addFields(
      { name: 'Name', value: app.name || '—', inline: true },
      { name: 'Age', value: app.age || '—', inline: true },
      { name: 'PC Specs', value: app.pc_specs || '—', inline: true },
      { name: 'Played RP before? Where?', value: app.rp_before || '—' },
      { name: 'Legal or illegal?', value: app.playstyle || '—' },
      { name: 'About them', value: app.about_you || '—' },
      { name: "Character's backstory", value: app.backstory || '—' },
      { name: 'First thing they will do when they join', value: app.first_action || '—' },
      { name: 'What Roleplay means to them', value: app.rp_meaning || '—' },
      { name: 'Goals as an RP player', value: app.goals || '—' },
      { name: 'How they heard about the server', value: app.referral || '—' },
      { name: 'Status', value: STATUS_LABEL[app.status] ?? app.status, inline: true }
    )
    .setTimestamp(new Date(app.applied_at));

  if (app.status !== 'pending' && app.reviewed_by) {
    const reviewerLine = app.reviewed_by.startsWith('system:')
      ? 'Automatically, by the system'
      : `by <@${app.reviewed_by}>`;
    const when = app.reviewed_at ? `<t:${Math.floor(new Date(app.reviewed_at).getTime() / 1000)}:f>` : 'unknown time';
    embed.addFields({ name: 'Reviewed', value: `${reviewerLine} at ${when}` });
  }

  if (app.status === 'denied' && app.deny_reason) {
    embed.addFields({ name: 'Deny Reason', value: app.deny_reason });
  }

  return embed;
}

function buildAdminButtons(app) {
  const acceptBtn = new ButtonBuilder()
    .setCustomId(`${IDS.ACCEPT_BUTTON_PREFIX}${app.id}`)
    .setLabel('Accept')
    .setStyle(ButtonStyle.Success)
    .setDisabled(app.status !== 'pending');

  const denyBtn = new ButtonBuilder()
    .setCustomId(`${IDS.DENY_BUTTON_PREFIX}${app.id}`)
    .setLabel('Deny')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(app.status !== 'pending');

  const revokeBtn = new ButtonBuilder()
    .setCustomId(`${IDS.REVOKE_BUTTON_PREFIX}${app.id}`)
    .setLabel('Revoke')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(app.status !== 'accepted');

  return [new ActionRowBuilder().addComponents(acceptBtn, denyBtn, revokeBtn)];
}

// Re-fetches the review message by its stored id and edits it to reflect the
// application's current status. Safe to call after every accept/deny/revoke.
async function refreshAdminMessage(client, app) {
  if (!app.admin_message_id) return;
  try {
    const channel = await client.channels.fetch(config.adminChannelId);
    const message = await channel.messages.fetch(app.admin_message_id);
    await message.edit({ embeds: [buildAdminEmbed(app)], components: buildAdminButtons(app) });
  } catch (err) {
    console.error(`[admin-embed] Could not refresh review message for application #${app.id}:`, err.message);
  }
}

module.exports = { buildAdminEmbed, buildAdminButtons, refreshAdminMessage };

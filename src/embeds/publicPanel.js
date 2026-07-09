const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND_NAME, BRAND_COLOR, IDS } = require('../constants');
const config = require('../config');
const db = require('../db');

function buildPanelEmbed(remainingSlots) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`${BRAND_NAME} — Whitelist Applications`)
    .setDescription(
      'Want to join the **Tunisian Hoods** roleplay server?\n\n' +
      'Click **Apply** below and fill out the short application form. ' +
      'Our staff team will review it and get back to you as soon as possible.'
    )
    .setFooter({ text: `${remainingSlots} / ${config.maxSlots} slots left` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(IDS.APPLY_BUTTON)
      .setLabel(remainingSlots > 0 ? 'Apply' : 'Whitelist Full')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(remainingSlots <= 0)
  );

  return { embeds: [embed], components: [row] };
}

// Posts the panel if none exists yet (per wl_panel table), otherwise edits
// the existing message in place. Called on startup and whenever the slot
// count changes.
async function refreshPanel(client) {
  const remaining = await db.getRemainingSlots();
  const payload = buildPanelEmbed(remaining);

  const existing = await db.getPanelMessage();

  if (existing) {
    try {
      const channel = await client.channels.fetch(existing.channel_id);
      const message = await channel.messages.fetch(existing.message_id);
      await message.edit(payload);
      return message;
    } catch (err) {
      console.error('[panel] Could not edit existing panel message, will post a new one:', err.message);
    }
  }

  const channel = await client.channels.fetch(config.publicChannelId);
  const message = await channel.send(payload);
  await db.setPanelMessage(channel.id, message.id);
  return message;
}

module.exports = { buildPanelEmbed, refreshPanel };

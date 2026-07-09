const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { IDS, FIELDS } = require('../constants');

function buildDenyModal(applicationId) {
  const modal = new ModalBuilder().setCustomId(`${IDS.DENY_MODAL_PREFIX}${applicationId}`).setTitle('Deny Application');

  const reason = new TextInputBuilder()
    .setCustomId(FIELDS.DENY_REASON)
    .setLabel('Reason (optional)')
    .setPlaceholder('Shown to the applicant in their DM, if provided.')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder().addComponents(reason));
  return modal;
}

module.exports = { buildDenyModal };

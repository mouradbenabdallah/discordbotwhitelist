const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { IDS, FIELDS } = require('../constants');

function row(builder) {
  return new ActionRowBuilder().addComponents(builder);
}

function shortInput(customId, label, placeholder, maxLength) {
  const input = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(maxLength)
    .setRequired(true);
  if (placeholder) input.setPlaceholder(placeholder);
  return input;
}

function paragraphInput(customId, label, placeholder, maxLength) {
  const input = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(maxLength)
    .setRequired(true);
  if (placeholder) input.setPlaceholder(placeholder);
  return input;
}

// Discord caps a modal at 5 text input fields, so the 11-question application
// is split across 3 chained modals — each submit immediately opens the next.
function buildApplyModalStep1() {
  return new ModalBuilder()
    .setCustomId(IDS.APPLY_MODAL_STEP1)
    .setTitle('Whitelist Application (1/3)')
    .addComponents(
      row(shortInput(FIELDS.NAME, 'Your name', 'e.g. John Doe', 100)),
      row(shortInput(FIELDS.AGE, 'Age', 'e.g. 22', 10)),
      row(paragraphInput(FIELDS.RP_BEFORE, 'Have you played RP before? If yes, where?', 'e.g. Yes, on ServerName for 2 years', 500)),
      row(shortInput(FIELDS.PLAYSTYLE, 'What do you want to play, legal or illegal?', 'Legal / Illegal / Both', 100)),
      row(paragraphInput(FIELDS.ABOUT_YOU, 'Tell us a little about yourself.', 'Who are you outside the character?', 700))
    );
}

function buildApplyModalStep2() {
  return new ModalBuilder()
    .setCustomId(IDS.APPLY_MODAL_STEP2)
    .setTitle('Whitelist Application (2/3)')
    .addComponents(
      row(paragraphInput(FIELDS.BACKSTORY, "Your character's backstory:", 'Who is your character, where do they come from?', 1000)),
      row(paragraphInput(FIELDS.FIRST_ACTION, 'First thing you will do when you join?', 'What will you do first when you join the server?', 500)),
      row(paragraphInput(FIELDS.RP_MEANING, 'What does Roleplay mean?', 'In your own words', 500)),
      row(paragraphInput(FIELDS.GOALS, 'What are your goals as an RP player?', '', 500)),
      row(shortInput(FIELDS.REFERRAL, 'How did you hear about the server?', 'e.g. Discord ad, friend referral', 150))
    );
}

function buildApplyModalStep3() {
  return new ModalBuilder()
    .setCustomId(IDS.APPLY_MODAL_STEP3)
    .setTitle('Whitelist Application (3/3)')
    .addComponents(row(shortInput(FIELDS.PC_SPECS, 'What are your PC specs?', 'e.g. CPU/GPU/RAM', 200)));
}

module.exports = { buildApplyModalStep1, buildApplyModalStep2, buildApplyModalStep3 };

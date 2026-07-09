const { IDS, FIELDS } = require('../constants');
const config = require('../config');
const db = require('../db');
const { buildApplyModalStep1, buildApplyModalStep2, buildApplyModalStep3 } = require('../components/applyModal');
const { buildDenyModal } = require('../components/denyModal');
const { buildAdminEmbed, buildAdminButtons, refreshAdminMessage } = require('../embeds/adminApplication');
const { refreshPanel } = require('../embeds/publicPanel');
const { notifyNewApplication, notifyAccepted } = require('../webhook');

function isAdmin(interaction) {
  return interaction.member?.roles?.cache?.has(config.adminRoleId) ?? false;
}

async function replyNoPermission(interaction) {
  await interaction.reply({ content: 'You do not have permission to do this.', ephemeral: true });
}

// Discord caps a modal at 5 text inputs, so the 11-question application form
// is collected across 3 chained modals. Answers from steps 1-2 are held here
// (keyed by discord user id) until the step-3 submit, which writes the full
// row. Entries are cleared on completion and expire after 30 minutes in case
// someone abandons the flow partway through.
const inProgressApplications = new Map();
const IN_PROGRESS_TTL_MS = 30 * 60 * 1000;

function stashAnswers(userId, answers) {
  const existing = inProgressApplications.get(userId);
  if (existing) clearTimeout(existing.timeout);
  const timeout = setTimeout(() => inProgressApplications.delete(userId), IN_PROGRESS_TTL_MS);
  timeout.unref?.();
  inProgressApplications.set(userId, { answers: { ...existing?.answers, ...answers }, timeout });
}

function takeAnswers(userId) {
  const entry = inProgressApplications.get(userId);
  if (!entry) return null;
  clearTimeout(entry.timeout);
  inProgressApplications.delete(userId);
  return entry.answers;
}

// Denied applicants must wait 24h from the admin's Deny click before they can
// reapply. Returns the cooldown's end time (ms epoch) if still in effect,
// otherwise null (either not denied, or the cooldown already passed).
const DENY_REAPPLY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function denyCooldownEndsAt(app) {
  if (!app || app.status !== 'denied' || !app.reviewed_at) return null;
  const endsAt = new Date(app.reviewed_at).getTime() + DENY_REAPPLY_COOLDOWN_MS;
  return endsAt > Date.now() ? endsAt : null;
}

async function handleApplyButton(interaction) {
  const existing = await db.getApplicationByDiscordId(interaction.user.id);
  if (existing && (existing.status === 'pending' || existing.status === 'accepted')) {
    const statusText = existing.status === 'pending' ? 'a pending' : 'an accepted';
    await interaction.reply({
      content: `You already have ${statusText} whitelist application. You cannot apply again right now.`,
      ephemeral: true,
    });
    return;
  }

  const cooldownEndsAt = denyCooldownEndsAt(existing);
  if (cooldownEndsAt) {
    await interaction.reply({
      content: `Your application was denied. You can reapply <t:${Math.floor(cooldownEndsAt / 1000)}:R>.`,
      ephemeral: true,
    });
    return;
  }

  const remaining = await db.getRemainingSlots();
  if (remaining <= 0) {
    await interaction.reply({ content: 'The whitelist is currently full. Please check back later.', ephemeral: true });
    return;
  }

  await interaction.showModal(buildApplyModalStep1());
}

async function handleApplyModalStep1Submit(interaction) {
  stashAnswers(interaction.user.id, {
    name: interaction.fields.getTextInputValue(FIELDS.NAME),
    age: interaction.fields.getTextInputValue(FIELDS.AGE),
    rpBefore: interaction.fields.getTextInputValue(FIELDS.RP_BEFORE),
    playstyle: interaction.fields.getTextInputValue(FIELDS.PLAYSTYLE),
    aboutYou: interaction.fields.getTextInputValue(FIELDS.ABOUT_YOU),
  });
  await interaction.showModal(buildApplyModalStep2());
}

async function handleApplyModalStep2Submit(interaction) {
  stashAnswers(interaction.user.id, {
    backstory: interaction.fields.getTextInputValue(FIELDS.BACKSTORY),
    firstAction: interaction.fields.getTextInputValue(FIELDS.FIRST_ACTION),
    rpMeaning: interaction.fields.getTextInputValue(FIELDS.RP_MEANING),
    goals: interaction.fields.getTextInputValue(FIELDS.GOALS),
    referral: interaction.fields.getTextInputValue(FIELDS.REFERRAL),
  });
  await interaction.showModal(buildApplyModalStep3());
}

async function handleApplyModalStep3Submit(client, interaction) {
  await interaction.deferReply({ ephemeral: true });

  const priorAnswers = takeAnswers(interaction.user.id);
  if (!priorAnswers) {
    await interaction.editReply('Your application session expired (steps 1-2 took too long). Please click Apply again.');
    return;
  }
  const answers = { ...priorAnswers, pcSpecs: interaction.fields.getTextInputValue(FIELDS.PC_SPECS) };

  const existing = await db.getApplicationByDiscordId(interaction.user.id);
  if (existing && (existing.status === 'pending' || existing.status === 'accepted')) {
    await interaction.editReply('You already have a pending or accepted whitelist application.');
    return;
  }

  const cooldownEndsAt = denyCooldownEndsAt(existing);
  if (cooldownEndsAt) {
    await interaction.editReply(`Your application was denied. You can reapply <t:${Math.floor(cooldownEndsAt / 1000)}:R>.`);
    return;
  }

  const remaining = await db.getRemainingSlots();
  if (remaining <= 0) {
    await interaction.editReply('Sorry, the whitelist filled up while you were filling out the form.');
    return;
  }

  const app = await db.submitApplication({
    discordId: interaction.user.id,
    discordTag: interaction.user.tag,
    ...answers,
  });

  const adminChannel = await client.channels.fetch(config.adminChannelId);
  const message = await adminChannel.send({ embeds: [buildAdminEmbed(app)], components: buildAdminButtons(app) });
  await db.setAdminMessageId(app.id, message.id);
  await notifyNewApplication(app, message.id);

  await interaction.editReply('Your application has been submitted! We will DM you once it has been reviewed.');
}

async function handleAcceptButton(client, interaction) {
  if (!isAdmin(interaction)) return replyNoPermission(interaction);

  const appId = Number(interaction.customId.slice(IDS.ACCEPT_BUTTON_PREFIX.length));
  await interaction.deferReply({ ephemeral: true });

  const result = await db.acceptApplication(appId, interaction.user.id);
  const app = await db.getApplicationById(appId);

  if (!result.success) {
    if (app) await refreshAdminMessage(client, app);
    await interaction.editReply(
      result.reason === 'full'
        ? 'The whitelist is full — cannot accept this application.'
        : 'This application was already reviewed by someone else.'
    );
    return;
  }

  if (config.whitelistedRoleId) {
    try {
      const guild = await client.guilds.fetch(config.guildId);
      const member = await guild.members.fetch(app.discord_id);
      await member.roles.add(config.whitelistedRoleId);
    } catch (err) {
      console.error(`[accept] Could not assign whitelisted role to ${app.discord_id}:`, err.message);
    }
  }

  await refreshAdminMessage(client, app);
  await refreshPanel(client);

  try {
    const user = await client.users.fetch(app.discord_id);
    await user.send('Your whitelist application for **Tunisian Hoods** has been **accepted**! Welcome to the server.');
  } catch (err) {
    console.error(`[accept] Could not DM ${app.discord_id}:`, err.message);
  }

  await notifyAccepted(app, await db.getRemainingSlots());

  await interaction.editReply('Application accepted.');
}

async function handleDenyButton(interaction) {
  if (!isAdmin(interaction)) return replyNoPermission(interaction);

  const appId = Number(interaction.customId.slice(IDS.DENY_BUTTON_PREFIX.length));
  const app = await db.getApplicationById(appId);
  if (!app || app.status !== 'pending') {
    await interaction.reply({ content: 'This application was already reviewed.', ephemeral: true });
    return;
  }

  await interaction.showModal(buildDenyModal(appId));
}

async function handleDenyModalSubmit(client, interaction) {
  if (!isAdmin(interaction)) return replyNoPermission(interaction);

  const appId = Number(interaction.customId.slice(IDS.DENY_MODAL_PREFIX.length));
  await interaction.deferReply({ ephemeral: true });

  const reason = interaction.fields.getTextInputValue(FIELDS.DENY_REASON) || null;
  const ok = await db.denyApplication(appId, interaction.user.id, reason);
  const app = await db.getApplicationById(appId);

  if (!ok) {
    if (app) await refreshAdminMessage(client, app);
    await interaction.editReply('This application was already reviewed.');
    return;
  }

  await refreshAdminMessage(client, app);

  try {
    const user = await client.users.fetch(app.discord_id);
    const reasonLine = reason ? `\nReason: ${reason}` : '';
    await user.send(`Your whitelist application for **Tunisian Hoods** has been **denied**.${reasonLine}\nYou are welcome to re-apply.`);
  } catch (err) {
    console.error(`[deny] Could not DM ${app.discord_id}:`, err.message);
  }

  await interaction.editReply('Application denied.');
}

async function handleRevokeButton(client, interaction) {
  if (!isAdmin(interaction)) return replyNoPermission(interaction);

  const appId = Number(interaction.customId.slice(IDS.REVOKE_BUTTON_PREFIX.length));
  await interaction.deferReply({ ephemeral: true });

  const ok = await db.revokeApplication(appId, interaction.user.id);
  const app = await db.getApplicationById(appId);

  if (!ok) {
    if (app) await refreshAdminMessage(client, app);
    await interaction.editReply('This application is not currently accepted.');
    return;
  }

  if (config.whitelistedRoleId) {
    try {
      const guild = await client.guilds.fetch(config.guildId);
      const member = await guild.members.fetch(app.discord_id);
      await member.roles.remove(config.whitelistedRoleId);
    } catch (err) {
      console.error(`[revoke] Could not remove whitelisted role from ${app.discord_id}:`, err.message);
    }
  }

  await refreshAdminMessage(client, app);
  await refreshPanel(client);

  await interaction.editReply('Application revoked; slot freed.');
}

module.exports = async function handleInteraction(client, interaction) {
  try {
    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === IDS.APPLY_BUTTON) return await handleApplyButton(interaction);
      if (id.startsWith(IDS.ACCEPT_BUTTON_PREFIX)) return await handleAcceptButton(client, interaction);
      if (id.startsWith(IDS.DENY_BUTTON_PREFIX)) return await handleDenyButton(interaction);
      if (id.startsWith(IDS.REVOKE_BUTTON_PREFIX)) return await handleRevokeButton(client, interaction);
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === IDS.APPLY_MODAL_STEP1) return await handleApplyModalStep1Submit(interaction);
      if (interaction.customId === IDS.APPLY_MODAL_STEP2) return await handleApplyModalStep2Submit(interaction);
      if (interaction.customId === IDS.APPLY_MODAL_STEP3) return await handleApplyModalStep3Submit(client, interaction);
      if (interaction.customId.startsWith(IDS.DENY_MODAL_PREFIX)) return await handleDenyModalSubmit(client, interaction);
    }
  } catch (err) {
    console.error('[interaction] Unhandled error:', err);
    const payload = { content: 'Something went wrong. Please try again later.', ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (_) {
      // interaction likely expired; nothing more we can do
    }
  }
};

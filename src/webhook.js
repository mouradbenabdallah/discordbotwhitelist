const config = require('./config');

// Fire-and-forget POST to a Discord webhook. Failures are logged, never thrown —
// a broken webhook must never block the core apply/accept flow.
async function postWebhook(url, payload) {
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[webhook] POST failed (${res.status}): ${await res.text()}`);
    }
  } catch (err) {
    console.error('[webhook] POST error:', err.message);
  }
}

function jumpLink(channelId, messageId) {
  return `https://discord.com/channels/${config.guildId}/${channelId}/${messageId}`;
}

async function notifyNewApplication(app, adminMessageId) {
  await postWebhook(config.webhookApplyUrl, {
    embeds: [
      {
        color: 0xe01b24,
        description: `📥 New whitelist application from **${app.discord_tag}** — [review it](${jumpLink(config.adminChannelId, adminMessageId)})`,
      },
    ],
  });
}

async function notifyAccepted(app, remainingSlots) {
  await postWebhook(config.webhookAcceptUrl, {
    embeds: [
      {
        color: 0xe01b24,
        description: `✅ **${app.discord_tag}** has been accepted into **Tunisian Hoods**! Welcome to the crew.`,
        footer: { text: `${remainingSlots} / ${config.maxSlots} slots left` },
      },
    ],
  });
}

module.exports = { notifyNewApplication, notifyAccepted };

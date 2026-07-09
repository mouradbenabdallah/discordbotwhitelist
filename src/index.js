const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const config = require('./config');
const db = require('./db');
const { refreshPanel } = require('./embeds/publicPanel');
const handleInteraction = require('./handlers/interactionCreate');
const handleGuildMemberRemove = require('./handlers/guildMemberRemove');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // required for guild/channel caching and interactions
    GatewayIntentBits.GuildMembers, // required for guildMemberRemove + role assignment
  ],
  partials: [Partials.GuildMember],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[bot] Logged in as ${readyClient.user.tag}.`);

  try {
    await db.testConnection();
  } catch (err) {
    console.error('[db] Failed to connect to SQLite on startup:', err.message);
    process.exit(1);
  }

  try {
    await refreshPanel(readyClient);
    console.log('[panel] Public whitelist panel is up to date.');
  } catch (err) {
    console.error('[panel] Failed to post/refresh the public panel:', err);
  }
});

client.on(Events.InteractionCreate, (interaction) => {
  handleInteraction(client, interaction);
});

client.on(Events.GuildMemberRemove, (member) => {
  handleGuildMemberRemove(client, member);
});

client.on(Events.Error, (err) => {
  console.error('[bot] Client error:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[process] Unhandled promise rejection:', err);
});

client.login(config.botToken);

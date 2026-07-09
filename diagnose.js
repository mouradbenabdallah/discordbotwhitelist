// Temporary one-off diagnostic. Run with: node diagnose.js
// Reports which guilds the bot can see, and whether it can view the
// configured PUBLIC_CHANNEL_ID / ADMIN_CHANNEL_ID inside GUILD_ID.
// Safe to delete after use.
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./src/config');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
  console.log(`\nLogged in as ${client.user.tag}\n`);

  const guilds = [...client.guilds.cache.values()];
  if (guilds.length === 0) {
    console.log('The bot is not a member of ANY server. You need to (re)invite it — see the invite link steps.');
    process.exit(0);
  }

  console.log('Bot is currently a member of these server(s):');
  for (const g of guilds) {
    console.log(`  - ${g.name}  (id: ${g.id})${g.id === config.guildId ? '   <-- matches your GUILD_ID' : ''}`);
  }

  const targetGuild = client.guilds.cache.get(config.guildId);
  if (!targetGuild) {
    console.log(`\nThe bot is NOT in the server matching your GUILD_ID (${config.guildId}).`);
    console.log('Fix: either invite the bot to that exact server, or update GUILD_ID in .env to match a server it IS in.');
    process.exit(0);
  }

  console.log(`\nGUILD_ID matches "${targetGuild.name}". Checking channel access inside it...\n`);

  for (const [label, channelId] of [
    ['PUBLIC_CHANNEL_ID', config.publicChannelId],
    ['ADMIN_CHANNEL_ID', config.adminChannelId],
  ]) {
    const channel = targetGuild.channels.cache.get(channelId);
    if (!channel) {
      console.log(`${label} (${channelId}): NOT FOUND in "${targetGuild.name}". Check the ID was copied from this exact server.`);
      continue;
    }
    const me = targetGuild.members.me;
    const perms = channel.permissionsFor(me);
    const canView = perms?.has('ViewChannel');
    const canSend = perms?.has('SendMessages');
    const canEmbed = perms?.has('EmbedLinks');
    console.log(`${label} (#${channel.name}): ViewChannel=${canView} SendMessages=${canSend} EmbedLinks=${canEmbed}`);
    if (!canView) {
      console.log(`  -> The bot's role does not have View Channel permission here (likely a permission overwrite on this channel).`);
    }
  }

  process.exit(0);
});

client.login(config.botToken);

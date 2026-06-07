require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { loadEvents } = require('./src/eventLoader');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

loadEvents(client);

client.login(process.env.DISCORD_TOKEN);

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { recoveryState } = require('./src/recovery');
const { withUserLock } = require('./src/lock');
const { resolveVoiceChannels } = require('./src/voiceHandler');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user.tag}`);
    
    setTimeout(async () => {
        await recoveryState(client);
    }, 2000);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member ?? oldState.member;

    if (typeof member === 'undefined' || member === null) {
        return;
    }

    await withUserLock(
        member.id,
        async () => await resolveVoiceChannels(oldState, newState)
    );
});

client.login(process.env.DISCORD_TOKEN);
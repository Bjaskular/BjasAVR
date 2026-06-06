require('dotenv').config();

const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');
const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

const userChannels = new Map();
const channelOwners = new Map();
const userLocks = new Map();

async function recoveryState() {
    for (const guild of client.guilds.cache.values()) {
        let channels;

        try {
            channels = await guild.channels.fetch();
        } catch (err) {
            console.error(`Failed to fetch channels for guild ${guild.id}:`, err);
            continue;
        }

        for (const channel of channels.values()) {
            if (
                channel === null
                || typeof channel === 'undefined'
                || channel.type !== ChannelType.GuildVoice
                || channel.parentId !== CATEGORY_ID
                || channel.id === CREATE_CHANNEL_ID
            ) {
                continue;
            }

            const ownerOverwrite = channel.permissionOverwrites.cache.find(overwrite => 
                overwrite.type === 1 && overwrite.allow.has(PermissionsBitField.Flags.ManageChannels)
            );

            if (ownerOverwrite === undefined) {
                continue;
            }

            const ownerId = ownerOverwrite.id;
            const currentMembers = guild.voiceStates.cache.filter(state => state.channelId === channel.id).size;

            if (currentMembers === 0) {
                await channel.delete().catch(() => {});
                console.log(`Cleaned up empty channel on recovery: ${channel.name}`);
            } else {
                userChannels.set(ownerId, channel.id);
                channelOwners.set(channel.id, ownerId);
            }
        }
    }

    console.log("Recovery completed");
}

function withUserLock(userId, callback) {
    const prev = userLocks.get(userId) ?? Promise.resolve();
    const next = prev
        .catch(() => {})
        .then(() => callback())
        .catch(err => {
            console.error(err);
            throw err;
        });

    userLocks.set(userId, next);

    return next.finally(() => {
        if (userLocks.get(userId) === next) {
            userLocks.delete(userId);
        }
    });
}

async function resolveVoiceChannels(member, oldState, newState) {
    const guild = newState.guild;

    if (
        typeof member === 'undefined'
        || member === null
        || typeof guild === 'undefined'
        || guild === null
    ) {
        return;
    }

    if (newState.channelId === CREATE_CHANNEL_ID) {
        const channelId = userChannels.get(member.id);

        if (channelId !== undefined && channelId !== null) {
            const existing = await guild.channels.fetch(channelId).catch(() => null);

            if (existing !== undefined && existing !== null) {
                await member.voice.setChannel(existing).catch(() => {});
                return;
            }
        }

        let channel = null;

        try {
            channel = await guild.channels.create({
                name: `🔊 ${member.user.username}`,
                type: ChannelType.GuildVoice,
                parent: CATEGORY_ID,
                permissionOverwrites: [
                    {
                        id: member.id,
                        allow: [PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.Connect],
                    }
                ]
            });

            await member.voice.setChannel(channel);
            userChannels.set(member.id, channel.id);
            channelOwners.set(channel.id, member.id);
        } catch (err) {
            console.error('VOICE CREATE FLOW ERROR: ', err);

            if (channel !== null && channel !== undefined) {
                await channel.delete().catch(() => {});
                userChannels.delete(member.id);
                channelOwners.delete(channel.id);
            }
        }

        return;
    }

    if (
        oldState.channel !== null
        && oldState.channel !== undefined
        && channelOwners.has(oldState.channel.id)
    ) {
        const fetchedChannel = await guild.channels.fetch(oldState.channel.id).catch(() => null);
        
        if (fetchedChannel !== null && fetchedChannel !== undefined) {
            const ownerId = channelOwners.get(fetchedChannel.id);
            const activeMembersCount = guild.voiceStates.cache.filter(state => state.channelId === fetchedChannel.id).size;

            if (activeMembersCount === 0) {
                try {
                    await fetchedChannel.delete();

                    if (ownerId !== undefined && ownerId !== null && ownerId !== '') {
                        userChannels.delete(ownerId);
                    }
                        
                    channelOwners.delete(fetchedChannel.id);
                } catch (err) {
                    console.error('DELETE CHANNEL ERROR: ', err);
                }
            } else if (member.id === ownerId) {
                const targetVoiceState = guild.voiceStates.cache.find(
                    state => state.channelId === fetchedChannel.id
                    && state.id !== ownerId
                );
    
                if (targetVoiceState === undefined || targetVoiceState === null) {
                    return;
                }

                const newOwnerId = targetVoiceState.id;
                userChannels.delete(ownerId);
                userChannels.set(newOwnerId, fetchedChannel.id);
                channelOwners.set(fetchedChannel.id, newOwnerId);

                try {
                    await fetchedChannel.permissionOverwrites.create(newOwnerId, {
                        ManageChannels: true,
                        Connect: true
                    });

                    await fetchedChannel.permissionOverwrites.delete(ownerId).catch(() => {});
                } catch (err) {
                    console.error('Error updating permissions: ', err);
                }
            }
        } 
    }
}

client.once('ready', async () => {
    console.log(`Zalogowano jako ${client.user.tag}`);
    setTimeout(async () => {
        await recoveryState();
    }, 2000);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member ?? oldState.member;

    if (typeof member === 'undefined' || member === null) {
        return;
    }

    await withUserLock(
        member.id,
        async () => await resolveVoiceChannels(member, oldState, newState)
    );
});

client.login(process.env.DISCORD_TOKEN);
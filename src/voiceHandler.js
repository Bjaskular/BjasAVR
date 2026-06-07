const { ChannelType, PermissionsBitField } = require('discord.js');
const { userChannels, channelOwners } = require('./state');

const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;

async function resolveVoiceChannels(oldState, newState) {
    const {guild, member} = newState;

    if (!member || !guild) {
        return;
    }

    if (newState.channelId === CREATE_CHANNEL_ID) {
        await handleChannelCreation(member, guild);
        return;
    }

    if (oldState.channel?.id && channelOwners.has(oldState.channel.id)) {
        await handleChannelLeave(oldState.channel.id, member, guild);
        return;
    }
}

async function handleChannelCreation(member, guild) {
    const channelId = userChannels.get(member.id);

    if (channelId) {
        const existing = await guild.channels.fetch(channelId).catch(() => null);

        if (existing) {
            await member.voice.setChannel(existing).catch(() => {});
            return;
        }
    }

    let channel = null;

    try {
        channel = await guild.channels.create({
            name: `Kanał ${member.user.globalName}-a`,
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
        if (channel) {
            await channel.delete().catch(() => {});
            userChannels.delete(member.id);
            channelOwners.delete(channel.id);
        }

        throw err;
    }
}

async function handleChannelLeave(channelId, member, guild) {
    const fetchedChannel = await guild.channels
        .fetch(channelId)
        .catch(() => null);

    if (!fetchedChannel) {
        return;
    }
        
    const ownerId = channelOwners.get(fetchedChannel.id);
    const activeMembersCount = guild.voiceStates.cache
        .filter(state => state.channelId === fetchedChannel.id)
        .size;

    if (activeMembersCount === 0) {
        await fetchedChannel.delete();

        if (ownerId) {
            userChannels.delete(ownerId);
        }
            
        channelOwners.delete(fetchedChannel.id);
        return;
    }

    if (member.id === ownerId) {
        const targetVoiceState = guild.voiceStates.cache
            .find(state => state.channelId === fetchedChannel.id && state.id !== ownerId);

        if (!targetVoiceState) {
            return;
        }

        const newOwnerId = targetVoiceState.id;

        userChannels.delete(ownerId);
        userChannels.set(newOwnerId, fetchedChannel.id);
        channelOwners.set(fetchedChannel.id, newOwnerId);

        await fetchedChannel.permissionOverwrites.create(newOwnerId, {
            ManageChannels: true,
            Connect: true
        });

        await fetchedChannel.permissionOverwrites.delete(ownerId);
    }
    
}

module.exports = { resolveVoiceChannels };

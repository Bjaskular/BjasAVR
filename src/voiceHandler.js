const { ChannelType, PermissionsBitField } = require('discord.js');
const { userChannels, channelOwners } = require('./state');
const logger = require('./logger');

const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;

const getUsername = (username) => `${username}'s channel`;

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
    const channelName = getUsername(member.user?.globalName);

    try {
        channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: member.voice.channel?.parentId,
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
        logger.success(`User ${member.user.globalName} created channel: ${channelName}`);
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
        logger.success(`Channel "${fetchedChannel.name}" has been deleted`);
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

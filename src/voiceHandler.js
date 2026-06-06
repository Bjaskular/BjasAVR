const { ChannelType, PermissionsBitField } = require('discord.js');
const { userChannels, channelOwners } = require('./state');

const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;

async function resolveVoiceChannels(oldState, newState) {
    const guild = newState.guild;
    const member = newState.member;

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

module.exports = { resolveVoiceChannels };
const {ChannelType, PermissionsBitField} = require('discord.js');
const {userChannels, channelOwners} = require('./state');

const CREATE_CHANNEL_ID = process.env.CREATE_CHANNEL_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;

async function recoveryState(client) {
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

    console.log('Recovery completed');
}

module.exports = { recoveryState };

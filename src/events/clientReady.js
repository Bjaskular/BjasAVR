const {ChannelType, PermissionsBitField} = require('discord.js');
const {userChannels, channelOwners} = require('../state');
const logger = require('../logger');

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        logger.info(`Logged in as ${client.user.tag}`);

        for (const guild of client.guilds.cache.values()) {
            let channels;

            try {
                channels = await guild.channels.fetch();
            } catch (err) {
                logger.error(`Failed to fetch channels for guild ${guild.id}:`, err);
                continue;
            }

            for (const channel of channels.values()) {
                if (!channel || channel.type !== ChannelType.GuildVoice) {
                    continue;
                }

                const ownerOverwrite = channel.permissionOverwrites.cache.find(overwrite => 
                    overwrite.type === 1 && overwrite.allow.has(PermissionsBitField.Flags.ManageChannels)
                );

                if (!ownerOverwrite) {
                    continue;
                }

                const ownerId = ownerOverwrite.id;
                const currentMembers = guild.voiceStates.cache.filter(state => state.channelId === channel.id).size;

                if (currentMembers === 0) {
                    await channel.delete();
                    logger.warn(`Orphaned channel "${channel.name}" has been deleted`);
                } else {
                    userChannels.set(ownerId, channel.id);
                    channelOwners.set(channel.id, ownerId);
                }
            }
        }

        logger.info('Recovery completed');
    }
}

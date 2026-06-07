const { withUserLock } = require('../lock');
const { resolveVoiceChannels } = require('../voiceHandler');

module.exports = {
    name: 'voiceStateUpdate',
    once: false,
    async execute(oldState, newState) {
        const member = newState.member ?? oldState.member;

        if (typeof member === 'undefined' || member === null) {
            return;
        }
    
        await withUserLock(
            member.id,
            async () => await resolveVoiceChannels(oldState, newState)
        );
    }
}

import { SlashCommandBuilder } from 'discord.js';
import { getTemporaryChannelInfo, getJoinToCreateConfig } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('voicelock')
        .setDescription('Sperre oder entsperre deinen temporären Voice-Channel'),

    async execute(interaction) {
        const { member, guild } = interaction;
        
        if (!member.voice?.channel) {
            return interaction.reply({
                content: '❌ Du musst in einem Voice-Channel sein!',
                ephemeral: true
            });
        }

        const voiceChannel = member.voice.channel;
        const tempInfo = await getTemporaryChannelInfo(interaction.client, guild.id, voiceChannel.id);
        
        if (!tempInfo || tempInfo.ownerId !== member.id) {
            return interaction.reply({
                content: '❌ Nur der Besitzer kann diesen Channel (ent-)sperren!',
                ephemeral: true
            });
        }

        try {
            const everyoneRole = guild.roles.everyone;
            const currentPerms = voiceChannel.permissionOverwrites.cache.get(everyoneRole.id);
            const isLocked = currentPerms?.deny?.has('Connect') || false;
            
            if (isLocked) {
                await voiceChannel.permissionOverwrites.edit(everyoneRole, { Connect: null });
                await interaction.reply({ content: '🔓 Channel wurde **entsperrt**!', ephemeral: true });
            } else {
                await voiceChannel.permissionOverwrites.edit(everyoneRole, { Connect: false });
                await interaction.reply({ content: '🔒 Channel wurde **gesperrt**!', ephemeral: true });
            }
            
            // Lock-Status in DB speichern
            const config = await getJoinToCreateConfig(interaction.client, guild.id);
            if (config.temporaryChannels[voiceChannel.id]) {
                config.temporaryChannels[voiceChannel.id].isLocked = !isLocked;
                await interaction.client.db.set(`guild:${guild.id}:jointocreate`, config);
            }
            
            logger.info(`${member.id} toggled lock on ${voiceChannel.id} to ${!isLocked}`);
        } catch (error) {
            logger.error('Failed to toggle lock:', error);
            await interaction.reply({ content: '❌ Fehler beim (Ent-)Sperren!', ephemeral: true });
        }
    }
};
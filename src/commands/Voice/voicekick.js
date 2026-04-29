import { SlashCommandBuilder } from 'discord.js';
import { getTemporaryChannelInfo } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('voicekick')
        .setDescription('Kicke einen User aus deinem temporären Voice-Channel')
        .addUserOption(option => option
            .setName('user')
            .setDescription('Der zu kickende User')
            .setRequired(true)
        ),

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
                content: '❌ Nur der Besitzer kann User kicken!',
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const targetMember = guild.members.cache.get(targetUser.id);
        
        if (!targetMember?.voice?.channel || targetMember.voice.channel.id !== voiceChannel.id) {
            return interaction.reply({
                content: `❌ ${targetUser.username} ist nicht in deinem Voice-Channel!`,
                ephemeral: true
            });
        }
        
        if (targetMember.id === member.id) {
            return interaction.reply({
                content: '❌ Du kannst dich nicht selbst kicken!',
                ephemeral: true
            });
        }
        
        try {
            await targetMember.voice.disconnect('Vom Channel-Besitzer gekickt');
            await interaction.reply({
                content: `✅ ${targetUser.username} wurde aus dem Channel gekickt!`,
                ephemeral: true
            });
            
            logger.info(`${member.id} kicked ${targetUser.id} from ${voiceChannel.id}`);
        } catch (error) {
            logger.error('Failed to kick user:', error);
            await interaction.reply({ content: '❌ Fehler beim Kicken!', ephemeral: true });
        }
    }
};
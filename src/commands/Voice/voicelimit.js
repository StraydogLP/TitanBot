import { SlashCommandBuilder } from 'discord.js';
import { getTemporaryChannelInfo } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('voicelimit')
        .setDescription('Setze die maximale Anzahl an Slots für deinen temporären Voice-Channel')
        .addIntegerOption(option => option
            .setName('anzahl')
            .setDescription('0-99 Slots (0 = unlimitiert)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(99)
        ),

    async execute(interaction) {
        const { member, guild } = interaction;
        
        if (!member.voice?.channel) {
            return interaction.reply({
                content: '❌ Du musst in einem Voice-Channel sein, um diesen Befehl zu nutzen!',
                ephemeral: true
            });
        }

        const voiceChannel = member.voice.channel;
        const tempInfo = await getTemporaryChannelInfo(interaction.client, guild.id, voiceChannel.id);
        
        if (!tempInfo) {
            return interaction.reply({
                content: '❌ Dieser Voice-Channel ist kein temporärer Channel!',
                ephemeral: true
            });
        }

        if (tempInfo.ownerId !== member.id) {
            return interaction.reply({
                content: '❌ Nur der Besitzer dieses Channels kann die Slot-Anzahl ändern!',
                ephemeral: true
            });
        }

        const limit = interaction.options.getInteger('anzahl');
        
        try {
            await voiceChannel.edit({
                userLimit: limit === 0 ? undefined : limit
            });
            
            const limitText = limit === 0 ? 'unlimitiert' : `${limit}`;
            await interaction.reply({
                content: `✅ Die Slot-Anzahl wurde auf **${limitText}** festgelegt!`,
                ephemeral: true
            });
            
            logger.info(`${member.id} set limit of ${voiceChannel.id} to ${limit}`);
        } catch (error) {
            logger.error('Failed to set channel limit:', error);
            await interaction.reply({
                content: '❌ Fehler beim Ändern der Slot-Anzahl!',
                ephemeral: true
            });
        }
    }
};
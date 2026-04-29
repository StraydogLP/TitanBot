import { SlashCommandBuilder } from 'discord.js';
import { getTemporaryChannelInfo, getJoinToCreateConfig, formatChannelName } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('voiceclaim')
        .setDescription('Übernimm einen temporären Voice-Channel (wenn der Besitzer weg ist)'),

    async execute(interaction) {
        const { member, guild } = interaction;
        
        if (!member.voice?.channel) {
            return interaction.reply({
                content: '❌ Du musst in einem Voice-Channel sein, den du übernehmen willst!',
                ephemeral: true
            });
        }

        const voiceChannel = member.voice.channel;
        const tempInfo = await getTemporaryChannelInfo(interaction.client, guild.id, voiceChannel.id);
        
        if (!tempInfo) {
            return interaction.reply({
                content: '❌ Das ist kein temporärer Channel!',
                ephemeral: true
            });
        }
        
        if (tempInfo.ownerId === member.id) {
            return interaction.reply({
                content: '❌ Du bist bereits der Besitzer!',
                ephemeral: true
            });
        }
        
        const originalOwner = guild.members.cache.get(tempInfo.ownerId);
        if (originalOwner?.voice?.channel?.id === voiceChannel.id) {
            return interaction.reply({
                content: '❌ Der Besitzer ist noch im Channel!',
                ephemeral: true
            });
        }
        
        try {
            const config = await getJoinToCreateConfig(interaction.client, guild.id);
            config.temporaryChannels[voiceChannel.id].ownerId = member.id;
            await interaction.client.db.set(`guild:${guild.id}:jointocreate`, config);
            
            // Channel-Namen aktualisieren
            const triggerChannel = guild.channels.cache.get(tempInfo.triggerChannelId);
            const nameTemplate = config.channelOptions?.[tempInfo.triggerChannelId]?.nameTemplate || 
                                config.channelNameTemplate || "{username}'s Room";
            
            const newChannelName = formatChannelName(nameTemplate, {
                username: member.user.username,
                userTag: member.user.tag,
                displayName: member.displayName,
                guildName: guild.name,
                channelName: triggerChannel?.name || 'Voice Channel'
            }).substring(0, 100);
            
            await voiceChannel.setName(newChannelName);
            
            await voiceChannel.permissionOverwrites.edit(member.id, {
                Connect: true,
                Speak: true,
                PrioritySpeaker: true,
                MoveMembers: true
            });
            
            await interaction.reply({
                content: `✅ Du bist nun der Besitzer von **${voiceChannel.name}**!`,
                ephemeral: true
            });
            
            logger.info(`${member.id} claimed ${voiceChannel.id} from ${tempInfo.ownerId}`);
        } catch (error) {
            logger.error('Failed to claim channel:', error);
            await interaction.reply({ content: '❌ Fehler beim Übernehmen!', ephemeral: true });
        }
    }
};

const { SlashCommandBuilder } = require('discord.js');
const { nearbyRanks } = require('../database/database');
const { createLeaderboardImage, addMemberNames } = require('../utils/leaderboardImage');

module.exports = {
  data: new SlashCommandBuilder().setName('leaderboard_position').setDescription('See your leaderboard position and nearby ranks'),
  async execute(interaction) {
    const allowedChannelId = process.env.BOT_COMMANDS_CHANNEL_ID || '1558332206114406400';
    if (interaction.channelId !== allowedChannelId) {
      return interaction.reply({ content: `Please use this command in <#${allowedChannelId}>.`, ephemeral: true });
    }
    await interaction.deferReply();
    const { rank, rows: rawRows } = nearbyRanks(interaction.guildId, interaction.user.id, 2);
    const rows = await addMemberNames(rawRows, interaction.guild);
    rows.forEach((row, index) => { row.rank = Math.max(1, rank - 2) + index; });
    const image = await createLeaderboardImage({ title: 'Leaderboard Position', subtitle: `Your rank: #${rank}`, rows, highlightUserId: interaction.user.id, emptyText: 'No leaderboard data yet' });
    await interaction.editReply({ files: [image] });
  }
};

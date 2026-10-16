const { SlashCommandBuilder } = require('discord.js');
const { leaderboard } = require('../database/database');
const { createLeaderboardImage, addMemberNames } = require('../utils/leaderboardImage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('View top balances as an image')
    .addIntegerOption(option => option.setName('limit').setDescription('Number of users to show (max 10)').setMinValue(3).setMaxValue(10)),
  async execute(interaction) {
    const allowedChannelId = process.env.BOT_COMMANDS_CHANNEL_ID || '1558332206114406400';
    if (interaction.channelId !== allowedChannelId) {
      return interaction.reply({ content: `Please use this command in <#${allowedChannelId}>.`, ephemeral: true });
    }
    await interaction.deferReply();
    const limit = Math.min(10, interaction.options.getInteger('limit') || Number(process.env.TOP_LIMIT) || 10);
    const rows = await addMemberNames(leaderboard(interaction.guildId, limit), interaction.guild);
    rows.forEach((row, index) => { row.rank = index + 1; });
    const image = await createLeaderboardImage({ title: 'Leaderboard', rows });
    await interaction.editReply({ files: [image] });
  }
};

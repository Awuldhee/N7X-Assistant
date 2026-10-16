const { SlashCommandBuilder } = require('discord.js');
const { getBalance, getRank } = require('../database/database');
const { createLeaderboardImage } = require('../utils/leaderboardImage');

module.exports = {
  data: new SlashCommandBuilder().setName('my_balance').setDescription('Check your balance and rank'),
  async execute(interaction) {
    const allowedChannelId = process.env.BOT_COMMANDS_CHANNEL_ID || '1558332206114406400';
    if (interaction.channelId !== allowedChannelId) {
      return interaction.reply({ content: `Please use this command in <#${allowedChannelId}>.`, ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    const balance = getBalance(interaction.guildId, interaction.user.id);
    const rank = getRank(interaction.guildId, interaction.user.id);
    const rows = [{ user_id: interaction.user.id, name: interaction.member?.displayName || interaction.user.globalName || interaction.user.username, balance, rank }];
    const image = await createLeaderboardImage({ title: 'My Balance', subtitle: `Rank #${rank}  •  ${balance.toLocaleString('en-US')} N7X Points`, rows, highlightUserId: interaction.user.id });
    await interaction.editReply({ files: [image] });
  }
};

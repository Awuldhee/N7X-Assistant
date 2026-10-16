const { SlashCommandBuilder } = require("discord.js");
const { changeBalance, getBalance } = require("../database/database");
const { requireAdmin } = require("../utils/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove_multi")
    .setDescription("Remove the same amount of currency from multiple users")
    .addStringOption(option =>
      option
        .setName("users")
        .setDescription("Mention multiple users, separated by spaces or commas")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("N7X Points to remove from each user")
        .setMinValue(1)
        .setRequired(true)
    ),

  async execute(interaction) {
    requireAdmin(interaction);

    const input = interaction.options.getString("users", true);
    const amount = interaction.options.getInteger("amount", true);
    const matches = [...input.matchAll(/<@!?([0-9]{17,20})>|(?<![0-9])([0-9]{17,20})(?![0-9])/g)];
    const userIds = [...new Set(matches.map(match => match[1] || match[2]))];

    if (!userIds.length) {
      return interaction.reply({
        content: "Mention one or more users in the `users` option, then specify the amount.",
        ephemeral: true
      });
    }

    const lines = [];
    for (const userId of userIds) {
      try {
        const member = await interaction.guild.members.fetch(userId);
        const currentBalance = getBalance(interaction.guildId, member.id);
        if (amount > currentBalance) {
          lines.push(`• **<@${member.id}>**: skipped (insufficient balance)`);
          continue;
        }
        changeBalance(interaction.guildId, member.id, -amount);
        lines.push(`• **<@${member.id}>**: **-${amount.toLocaleString()}**`);
      } catch {
        lines.push(`• <@${userId}>: skipped (user is not a member of this server or could not be fetched)`);
      }
    }

    await interaction.reply({
      content: lines.join("\n").slice(0, 2000),
      allowedMentions: { users: userIds }
    });
  }
};

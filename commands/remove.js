const { SlashCommandBuilder } = require("discord.js");
const { changeBalance, getBalance } = require("../database/database");
const { isAdmin, currencyName, validAmount } = require("../utils/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove currency from a user (admin only)")
    .addUserOption(option => option.setName("user").setDescription("User losing currency").setRequired(true))
    .addIntegerOption(option => option.setName("amount").setDescription("Amount to remove").setRequired(true).setMinValue(1)),

  async execute(interaction) {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
    }

    const user = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);
    if (!validAmount(amount)) {
      return interaction.reply({ content: "Amount must be a positive integer.", ephemeral: true });
    }

    const current = getBalance(interaction.guildId, user.id);
    if (amount > current) {
      return interaction.reply({ content: `Insufficient balance. ${user} has ${current.toLocaleString("en-US")} ${currencyName()}.`, ephemeral: true });
    }

    changeBalance(interaction.guildId, user.id, -amount);
    return interaction.reply({ content: `Removed ${amount.toLocaleString("en-US")} ${currencyName()} from **${user}**` });
  }
};

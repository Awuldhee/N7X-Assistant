const { SlashCommandBuilder } = require("discord.js");
const { changeBalance } = require("../database/database");
const { isAdmin, currencyName, validAmount } = require("../utils/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("give")
    .setDescription("Give currency to a user (admin only)")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("User receiving currency")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Amount to give")
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    // Only members with the configured ADMIN_ROLE_ID can give points.
    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true
      });
    }

    const user = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    if (!validAmount(amount)) {
      return interaction.reply({
        content: "Amount must be a positive integer.",
        ephemeral: true
      });
    }

    changeBalance(interaction.guildId, user.id, amount);

    // Plain-text response matching the requested Discord style.
    return interaction.reply({
      content: `Gave ${amount.toLocaleString("en-US")} ${currencyName()} to **${user}**`
    });
  }
};

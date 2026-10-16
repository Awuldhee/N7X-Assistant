const { SlashCommandBuilder } = require("discord.js");
const { executeRoleConversion } = require("../utils/convertRoles");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("convert")
    .setDescription("Convert your Incentiv marketplace roles into currency"),
  async execute(interaction) {
    return executeRoleConversion(interaction, "/convert command");
  }
};

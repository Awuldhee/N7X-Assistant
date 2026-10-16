const { changeBalance } = require("../database/database");
const { currencyName } = require("./permissions");

const ROLE_CONVERSIONS = new Map([
  ["N7X Points 3", 3],
  ["N7X Points 15", 15],
  ["N7X Points 30", 30],
  ["N7X Points 75", 75],
  ["N7X Points 150", 150]
]);

async function executeRoleConversion(interaction, source) {
  if (!interaction.inGuild() || !interaction.guild) {
    return interaction.reply({ content: "This can only be used in a server.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  let member;
  try {
    member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
  } catch {
    return interaction.editReply("I couldn't load your server membership. Please try again.");
  }

  const rolesToConvert = [];
  let totalPoints = 0;
  for (const [roleName, points] of ROLE_CONVERSIONS) {
    const role = interaction.guild.roles.cache.find(candidate => candidate.name === roleName);
    if (role && member.roles.cache.has(role.id)) {
      rolesToConvert.push({ role, points });
      totalPoints += points;
    }
  }

  if (!rolesToConvert.length) {
    return interaction.editReply("You don't have any convertible marketplace roles. Supported roles: " +
      [...ROLE_CONVERSIONS.keys()].map(name => `**@${name}**`).join(", ") + ".");
  }

  try {
    await member.roles.remove(rolesToConvert.map(item => item.role), "Converted marketplace roles to N7X-Assistant points");
  } catch (error) {
    console.error("[convert] Could not remove marketplace roles:", error);
    interaction.auditLogData = { type: "role_conversion", status: "ERROR", source, roles: rolesToConvert.map(item => item.role.name), points: totalPoints, error: "Could not remove marketplace roles. No points were credited." };
    return interaction.editReply("Conversion failed because I couldn't remove your marketplace roles. No points were credited. Check the bot's **Manage Roles** permission and role hierarchy.");
  }

  try {
    changeBalance(interaction.guildId, interaction.user.id, totalPoints);
  } catch (error) {
    console.error("[convert] Could not credit converted points:", error);
    try { await member.roles.add(rolesToConvert.map(item => item.role), "Restore roles after failed point conversion"); }
    catch (restoreError) { console.error("[convert] CRITICAL: Could not restore roles:", restoreError); }
    interaction.auditLogData = { type: "role_conversion", status: "ERROR", source, roles: rolesToConvert.map(item => item.role.name), points: totalPoints, error: "Database credit failed after role removal; restoration was attempted." };
    return interaction.editReply("Conversion failed while updating your balance. The bot attempted to restore your roles. Please contact an administrator.");
  }

  interaction.auditLogData = { type: "role_conversion", status: "SUCCESS", source, roles: rolesToConvert.map(item => item.role.name), points: totalPoints, rolesConverted: rolesToConvert.length };
  const breakdown = rolesToConvert.map(item => `• **@${item.role.name}** → **+${item.points} ${currencyName()}**`);
  breakdown.push("", `**Total received: +${totalPoints} ${currencyName()}**`, "Your converted marketplace roles have been removed. This conversion is final.");
  return interaction.editReply(breakdown.join("\n"));
}

module.exports = { executeRoleConversion };

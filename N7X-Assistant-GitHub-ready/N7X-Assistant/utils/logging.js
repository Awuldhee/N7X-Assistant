const { EmbedBuilder } = require("discord.js");

function optionSummary(interaction) {
  try {
    const values = [];
    for (const option of interaction.options.data) {
      if (option.options?.length) {
        for (const nested of option.options) values.push(`${nested.name}: ${formatValue(nested.value ?? nested.user ?? nested.role ?? nested.channel)}`);
      } else values.push(`${option.name}: ${formatValue(option.value ?? option.user ?? option.role ?? option.channel)}`);
    }
    return values.length ? values.join("\n").slice(0, 1000) : "No options";
  } catch { return "Unable to read command options"; }
}

function formatValue(value) {
  if (value == null) return "—";
  if (typeof value === "object") return value.id ? `<@${value.id}>` : String(value);
  return String(value).slice(0, 200);
}

async function logCommand(interaction, status, error = null) {
  // These public-facing commands must never be written to the activity log.
  const excludedCommands = new Set(["top", "leaderboard_position", "my_balance"]);
  if (excludedCommands.has(interaction.commandName)) return;

  const channelId = process.env.LOG_CHANNEL_ID;
  if (!channelId || !interaction.guild) return;
  try {
    const channel = await interaction.client.channels.fetch(channelId);
    if (!channel?.isTextBased?.() || !channel.send) return console.error("LOG_CHANNEL_ID does not point to a text-based channel.");

    const detail = interaction.auditLogData;
    let embed;
    if (detail?.type === "role_conversion") {
      embed = new EmbedBuilder()
        .setColor(detail.status === "ERROR" ? 0xED4245 : 0x2ECC71)
        .setTitle("🔄 Marketplace Role Conversion Log")
        .setDescription(`**Performed by:** <@${interaction.user.id}> (${interaction.user.tag})\n**Source:** ${detail.source || "/convert command"}\n**Status:** ${detail.status || status}`)
        .addFields(
          { name: "Roles Converted", value: (detail.roles || []).map(name => `• ${name}`).join("\n").slice(0, 1000) || "None", inline: false },
          { name: "Points Credited", value: `${Number(detail.points || 0).toLocaleString()} N7X Points`, inline: true },
          { name: "Roles Removed", value: String(detail.rolesConverted ?? (detail.status === "SUCCESS" ? (detail.roles || []).length : 0)), inline: true }
        )
        .setTimestamp();
      if (detail.error || error) embed.addFields({ name: "Error", value: String(detail.error || error.message || error).slice(0, 1000), inline: false });
    } else if (detail?.type === "thread_role") {
      embed = new EmbedBuilder()
        .setColor(detail.status === "ERROR" ? 0xED4245 : 0x5865F2)
        .setTitle("🧵 Thread Role Assignment Log")
        .setDescription(`**Performed by:** <@${interaction.user.id}> (${interaction.user.tag})\n**Thread:** <#${detail.threadId}>\n**Role:** ${detail.roleName ? `**${detail.roleName}**` : "Unknown"}\n**Source:** /assign_roles_from_thread_authors`)
        .addFields(
          { name: "Messages Scanned", value: String(detail.messagesScanned ?? 0), inline: true },
          { name: "Unique Authors", value: String(detail.authorsFound ?? 0), inline: true },
          { name: "Roles Assigned", value: String(detail.assigned ?? 0), inline: true },
          { name: "Skipped", value: String(detail.skipped ?? 0), inline: true }
        )
        .setTimestamp();
      if (detail.skippedFile) embed.addFields({ name: "Skipped Authors CSV", value: detail.skippedFile, inline: false });
      if (detail.error || error) embed.addFields({ name: "Error", value: String(detail.error || error.message || error).slice(0, 1000), inline: false });
    } else if (["give_role_points", "remove_role_points"].includes(interaction.commandName)) {
      const roleOption = interaction.options.getRole("role");
      const amount = interaction.options.getInteger("amount") ?? 0;
      const isGive = interaction.commandName === "give_role_points";
      const usersAffected = detail?.usersAffected ?? 0;
      const totalChanged = detail?.totalChanged ?? 0;
      const reason = isGive
        ? `Distributed points to all members of '${roleOption?.name ?? "unknown"}' role.`
        : `Removed points from members of '${roleOption?.name ?? "unknown"}' role.`;
      embed = new EmbedBuilder()
        .setColor(isGive ? 0x2ECC71 : 0xED4245)
        .setTitle("📊 Bulk Currency Change Log")
        .setDescription(`**Performed by:** <@${interaction.user.id}> (${interaction.user.tag})\n**Reason:** ${reason}\n**Source:** ${interaction.commandName} command`)
        .addFields(
          { name: "Users Affected", value: String(usersAffected), inline: true },
          { name: "Total Amount Changed", value: `${Number(totalChanged).toLocaleString()} N7X Points`, inline: true },
          { name: "Amount Per User (requested)", value: `${amount.toLocaleString()} N7X Points`, inline: true }
        )
        .setTimestamp();
    } else {
      embed = new EmbedBuilder()
        .setColor(status === "ERROR" ? 0xED4245 : status === "DENIED" ? 0xFEE75C : 0x5865F2)
        .setTitle(`Command Log: /${interaction.commandName}`)
        .addFields(
          { name: "Performed by", value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
          { name: "Status", value: status, inline: true },
          { name: "Channel", value: interaction.channelId ? `<#${interaction.channelId}>` : "Unknown", inline: true },
          { name: "Options", value: optionSummary(interaction), inline: false }
        )
        .setTimestamp();
      if (error) embed.addFields({ name: "Error", value: String(error.message || error).slice(0, 1000), inline: false });
    }
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (logError) {
    console.error("Could not send command log:", logError.message);
  }
}

module.exports = { logCommand };

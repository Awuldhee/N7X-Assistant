const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const { isAdmin } = require("../utils/permissions");

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("assign_roles_from_thread_authors")
    .setDescription("Assign a role to members who have posted in a thread (admin only)")
    .addStringOption(option => option.setName("thread_id").setDescription("ID of the thread to scan").setRequired(true))
    .addRoleOption(option => option.setName("role").setDescription("Role to assign to thread authors").setRequired(true)),

  async execute(interaction) {
    if (!isAdmin(interaction)) return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
    if (!interaction.inGuild()) return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });

    const threadId = interaction.options.getString("thread_id", true).trim();
    const role = interaction.options.getRole("role", true);
    if (!/^\d{17,20}$/.test(threadId)) return interaction.reply({ content: "Invalid thread ID. Please provide the thread's numeric ID.", ephemeral: true });
    if (role.managed || role.id === interaction.guild.id) return interaction.reply({ content: "That role cannot be assigned by the bot.", ephemeral: true });

    const botMember = interaction.guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: "The bot needs the **Manage Roles** permission.", ephemeral: true });
    if (botMember.roles.highest.comparePositionTo(role) <= 0) return interaction.reply({ content: "The target role must be below the bot's highest role in Server Settings → Roles.", ephemeral: true });

    await interaction.deferReply();
    try {
      const thread = await interaction.guild.channels.fetch(threadId);
      if (!thread || ![ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread].includes(thread.type)) {
        interaction.auditLogData = { type: "thread_role", status: "ERROR", threadId, roleName: role.name, scanned: 0, assigned: 0, skipped: 0, reason: "Invalid thread ID" };
        return interaction.editReply("That ID does not belong to a thread in this server.");
      }

      const authors = new Map();
      let before;
      let messagesScanned = 0;
      while (true) {
        const fetchOptions = { limit: 100 };
        if (before) fetchOptions.before = before;
        const batch = await thread.messages.fetch(fetchOptions);
        if (!batch.size) break;
        messagesScanned += batch.size;
        for (const message of batch.values()) {
          if (!message.author.bot && !authors.has(message.author.id)) {
            authors.set(message.author.id, `https://discord.com/channels/${interaction.guildId}/${threadId}/${message.id}`);
          }
        }
        before = batch.last().id;
        if (batch.size < 100) break;
      }

      let assigned = 0;
      const skippedRows = [];
      for (const [userId, messageLink] of authors) {
        try {
          const member = await interaction.guild.members.fetch(userId).catch(() => null);
          if (!member) {
            skippedRows.push({ userId, reason: "Member is no longer in the server", messageLink });
            continue;
          }
          if (member.roles.cache.has(role.id)) {
            skippedRows.push({ userId, reason: "Member already has the role", messageLink });
            continue;
          }
          await member.roles.add(role, `Requested by ${interaction.user.tag} using /assign_roles_from_thread_authors`);
          assigned++;
        } catch (error) {
          skippedRows.push({ userId, reason: `Role assignment failed: ${error.message || error}`, messageLink });
        }
      }

      const csv = ["user_id,reason,message_link", ...skippedRows.map(row => [row.userId, row.reason, row.messageLink].map(csvEscape).join(","))].join("\n");
      const safeThreadId = threadId.replace(/[^0-9]/g, "");
      const attachment = new AttachmentBuilder(Buffer.from(csv, "utf8"), { name: `skipped_authors_thread_${safeThreadId}.csv` });
      interaction.auditLogData = {
        type: "thread_role", status: "SUCCESS", threadId, threadName: thread.name || threadId,
        roleId: role.id, roleName: role.name, messagesScanned, authorsFound: authors.size,
        assigned, skipped: skippedRows.length, skippedFile: attachment.name
      };

      const result = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setDescription(`✅ Finished scanning thread <#${threadId}>.\n📨 Messages scanned: **${messagesScanned}**\n🟢 Roles assigned: **${assigned}**\n⚠️ Skipped: **${skippedRows.length}**\n📁 Summary saved to \`${attachment.name}\``)
        .setTimestamp();
      return interaction.editReply({ embeds: [result], files: [attachment] });
    } catch (error) {
      console.error("/assign_roles_from_thread_authors failed:", error);
      interaction.auditLogData = { type: "thread_role", status: "ERROR", threadId, roleName: role.name, error: error.message || String(error) };
      return interaction.editReply("Could not scan that thread. Check the thread ID and ensure the bot can view the thread and read its messages.");
    }
  }
};

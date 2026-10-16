require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
require("./database/database");
const { logCommand } = require("./utils/logging");

if (!process.env.DISCORD_TOKEN) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember]
});
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

const CONVERT_BUTTON_ID = "incentiv_assistant_convert_roles";
const CONVERT_PANEL_CHANNEL_ID = process.env.CONVERT_PANEL_CHANNEL_ID || "1558349020991193198";

async function ensureConvertPanel() {
  try {
    const channel = await client.channels.fetch(CONVERT_PANEL_CHANNEL_ID);
    if (!channel?.isTextBased?.() || !channel.send) {
      console.error("CONVERT_PANEL_CHANNEL_ID is not a text channel the bot can send messages to.");
      return;
    }
    // History access is optional for posting the panel. If the bot cannot read
    // recent messages, log the issue but continue and post a panel rather than
    // silently skipping the setup.
    try {
      const recent = await channel.messages.fetch({ limit: 50 });
      const existing = recent.find(message =>
        message.author.id === client.user.id &&
        message.components.some(row =>
          row.components.some(component => component.customId === CONVERT_BUTTON_ID)
        )
      );
      if (existing) {
        console.log(`Convert panel already exists in channel ${CONVERT_PANEL_CHANNEL_ID}.`);
        return;
      }
    } catch (historyError) {
      console.warn(
        `Could not check existing convert panel in channel ${CONVERT_PANEL_CHANNEL_ID}. ` +
        `The bot may lack Read Message History. Will try to post a panel anyway.`,
        historyError.message
      );
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("Convert Incentiv Roles to Points")
      .setDescription("Click the button to convert your Incentiv roles into currency.\n\nRoles will be removed. Conversion is final.");
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(CONVERT_BUTTON_ID).setLabel("Convert").setStyle(ButtonStyle.Success)
    );
    await channel.send({ embeds: [embed], components: [row] });
    console.log(`Convert panel posted in channel ${CONVERT_PANEL_CHANNEL_ID}.`);
  } catch (error) {
    console.error("Could not ensure convert panel:", error);
  }
}

client.once("ready", async () => {
  console.log(`N7X-Assistant is online as ${client.user.tag}`);
  console.log(`Loaded ${client.commands.size} slash commands.`);
  await ensureConvertPanel();
});
client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton() && interaction.customId === CONVERT_BUTTON_ID) {
    let status = "SUCCESS";
    let failure = null;
    try {
      const { executeRoleConversion } = require("./utils/convertRoles");
      interaction.commandName = "convert_button";
      await executeRoleConversion(interaction, "Convert panel button");
    } catch (error) {
      status = "ERROR";
      failure = error;
      console.error("Convert panel button failed:", error);
      const message = "An unexpected error occurred while converting your roles.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
      }
    } finally {
      await logCommand(interaction, status, failure);
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  let status = "SUCCESS";
  let failure = null;
  try {
    // Regular members may use only these three public commands. Every other command
    // is restricted to the configured admin role, regardless of Discord UI visibility.
    const memberCommands = new Set(["top", "leaderboard_position", "my_balance", "convert"]);
    const { isAdmin } = require("./utils/permissions");
    if (!memberCommands.has(interaction.commandName) && !isAdmin(interaction)) {
      status = "DENIED";
      await interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true
      });
      return;
    }
    await command.execute(interaction);
  } catch (error) {
    status = "ERROR";
    failure = error;
    console.error(`Command /${interaction.commandName} failed:`, error);
    const message = "An unexpected error occurred while processing this command.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    }
  } finally {
    await logCommand(interaction, status, failure);
  }
});
client.login(process.env.DISCORD_TOKEN);

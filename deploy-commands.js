require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID) throw new Error("DISCORD_TOKEN and CLIENT_ID must be set in .env");
  const commands = [];
  const dir = path.join(__dirname, "commands");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    commands.push(require(path.join(dir, file)).data.toJSON());
  }
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`Successfully registered ${commands.length} slash commands${GUILD_ID ? ` to guild ${GUILD_ID}` : " globally"}.`);
}
main().catch((error) => { console.error(error); process.exit(1); });

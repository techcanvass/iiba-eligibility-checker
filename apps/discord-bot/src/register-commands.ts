// Registers the /iiba-eligibility slash command with Discord. Run once, and again after changing options.
import { REST, Routes } from "discord.js";
import { data } from "./commands/eligibility";

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const rest = new REST().setToken(DISCORD_TOKEN);
const route = DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID) // instant, one server
  : Routes.applicationCommands(DISCORD_CLIENT_ID); // global, can take up to an hour

await rest.put(route, { body: [data.toJSON()] });
console.log(`Registered /${data.name} ${DISCORD_GUILD_ID ? `in guild ${DISCORD_GUILD_ID}` : "globally"}.`);

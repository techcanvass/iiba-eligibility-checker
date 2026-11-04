import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { loadRules, type RuleSet } from "@iiba/core";
import * as eligibility from "./commands/eligibility";

const { DISCORD_TOKEN, RULES_URL } = process.env;

if (!DISCORD_TOKEN) {
  console.error("Missing DISCORD_TOKEN. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

let rules: RuleSet;

async function refreshRules() {
  const loaded = await loadRules({ url: RULES_URL || undefined });
  rules = loaded.rules;
  console.log(`Rules v${rules.version} loaded (${loaded.source}${loaded.error ? `: ${loaded.error}` : ""})`);
}

await refreshRules();
setInterval(refreshRules, 6 * 60 * 60 * 1000); // pick up rule changes every 6 hours

// Slash commands only need the Guilds intent — no message-content access required.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => console.log(`Logged in as ${c.user.tag}`));

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== eligibility.data.name) return;
  try {
    await eligibility.execute(interaction, rules);
  } catch (err) {
    console.error(err);
    const reply = { content: "Something went wrong. Please try again.", flags: MessageFlags.Ephemeral } as const;
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
    else await interaction.reply(reply);
  }
});

await client.login(DISCORD_TOKEN);

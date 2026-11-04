import {
  MessageFlags,
  SlashCommandBuilder,
  type APIEmbed,
  type ChatInputCommandInteraction,
} from "discord.js";
import {
  checkEligibility,
  EligibilityInputError,
  type CandidateInput,
  type KnowledgeAreaId,
  type RuleSet,
} from "@iiba/core";

const KA_OPTIONS: { id: KnowledgeAreaId; option: string; label: string }[] = [
  { id: "planning", option: "ka_planning", label: "BA Planning & Monitoring" },
  { id: "elicitation", option: "ka_elicitation", label: "Elicitation & Collaboration" },
  { id: "lifecycle", option: "ka_lifecycle", label: "Requirements Life Cycle Mgmt" },
  { id: "strategy", option: "ka_strategy", label: "Strategy Analysis" },
  { id: "radd", option: "ka_radd", label: "Requirements Analysis & Design" },
  { id: "evaluation", option: "ka_evaluation", label: "Solution Evaluation" },
];

const COLORS = { eligible: 0x1d7a46, partial: 0x1f5fd1, none: 0xb42318 } as const;

export const data = (() => {
  const b = new SlashCommandBuilder()
    .setName("iiba-eligibility")
    .setDescription("Check your eligibility for IIBA ECBA, CCBA and CBAP")
    .addIntegerOption((o) =>
      o
        .setName("ba_hours")
        .setDescription("Business analysis work hours in the last 10 years (full-time ≈ 2,000/yr)")
        .setMinValue(0)
        .setMaxValue(50000)
        .setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("pd_hours")
        .setDescription("Professional development hours in the last 4 years (not self-study)")
        .setMinValue(0)
        .setMaxValue(1000)
        .setRequired(true),
    )
    .addBooleanOption((o) =>
      o
        .setName("agree_ethics")
        .setDescription("Do you agree to follow the IIBA Code of Ethical Conduct?")
        .setRequired(true),
    );
  for (const ka of KA_OPTIONS) {
    b.addIntegerOption((o) =>
      o
        .setName(ka.option)
        .setDescription(`Hours in ${ka.label} (needed for CCBA/CBAP)`)
        .setMinValue(0)
        .setMaxValue(50000),
    );
  }
  return b;
})();

export interface CommandValues {
  baHours: number;
  pdHours: number;
  agreesToEthics: boolean;
  kaHours: Partial<Record<KnowledgeAreaId, number>>;
}

/** Pure function: values → Discord embed. Unit-tested without a Discord connection. */
export function buildEmbed(values: CommandValues, rules: RuleSet, asOf?: string): APIEmbed {
  const input: CandidateInput = {
    asOf,
    baHours: values.baHours,
    pdHours: values.pdHours,
    kaHours: values.kaHours,
    agreesToEthics: values.agreesToEthics,
  };

  try {
    const report = checkEligibility(input, rules);
    const allEligible = report.results.every((r) => r.eligible);

    const fields = report.results.map((r) => {
      const lines = r.requirements.map((q) => `${q.met ? "✅" : "❌"} ${q.met ? q.label : q.gap}`);
      const refs = rules.certifications.find((c) => c.code === r.code)?.references ?? 0;
      if (refs > 0) lines.push(`📝 Application also needs ${refs} references`);
      if (r.courseUrl) {
        lines.push(`[${r.eligible ? "Prepare" : "Explore"} ${r.code} training](${r.courseUrl}?utm_source=discord)`);
      }
      return {
        name: `${r.eligible ? "🟢" : "🔴"} ${r.code} — ${r.eligible ? "Eligible" : "Not yet"}`,
        value: lines.join("\n").slice(0, 1024),
      };
    });

    if (report.warnings.length) {
      fields.push({ name: "⚠️ Heads up", value: report.warnings.join("\n").slice(0, 1024) });
    }

    return {
      title: report.recommended
        ? `You're eligible for ${report.recommended}`
        : "You're not eligible for an IIBA certification yet",
      color: allEligible ? COLORS.eligible : report.recommended ? COLORS.partial : COLORS.none,
      fields,
      footer: {
        text: `Rules v${report.rulesVersion} · A guide, not an official IIBA decision — confirm on iiba.org`,
      },
    };
  } catch (e) {
    const msg =
      e instanceof EligibilityInputError
        ? e.errors.map((x) => `• ${x.message}`).join("\n")
        : (e as Error).message;
    return { title: "Couldn't check eligibility", description: msg, color: COLORS.none };
  }
}

/** Read slash-command options into CommandValues. */
export function readValues(interaction: ChatInputCommandInteraction): CommandValues {
  const kaHours: CommandValues["kaHours"] = {};
  for (const ka of KA_OPTIONS) {
    const v = interaction.options.getInteger(ka.option);
    if (v !== null) kaHours[ka.id] = v;
  }
  return {
    baHours: interaction.options.getInteger("ba_hours", true),
    pdHours: interaction.options.getInteger("pd_hours", true),
    agreesToEthics: interaction.options.getBoolean("agree_ethics", true),
    kaHours,
  };
}

export async function execute(interaction: ChatInputCommandInteraction, rules: RuleSet) {
  const embed = buildEmbed(readValues(interaction), rules);
  // Ephemeral: only the user who ran the command sees their hours.
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

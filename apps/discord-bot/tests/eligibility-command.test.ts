import { describe, expect, it } from "vitest";
import { BUNDLED_RULES } from "@iiba/core";
import { buildEmbed, data } from "../src/commands/eligibility";

const AS_OF = "2026-10-30";

describe("/iiba-eligibility command definition", () => {
  const json = data.toJSON();

  it("has a valid name and stays within Discord's 25-option limit", () => {
    expect(json.name).toBe("iiba-eligibility");
    expect(json.options!.length).toBeLessThanOrEqual(25);
  });

  it("puts required options before optional ones (Discord rejects otherwise)", () => {
    const required = json.options!.map((o) => ("required" in o ? Boolean(o.required) : false));
    const firstOptional = required.indexOf(false);
    expect(required.slice(firstOptional).every((r) => !r)).toBe(true);
  });

  it("keeps every description within 100 characters", () => {
    for (const o of json.options!) expect(o.description.length).toBeLessThanOrEqual(100);
  });
});

describe("buildEmbed", () => {
  it("CBAP-ready candidate → all eligible, green, CBAP recommended", () => {
    const embed = buildEmbed(
      {
        baHours: 8000,
        pdHours: 35,
        agreesToEthics: true,
        kaHours: { planning: 1000, elicitation: 1000, radd: 1000, strategy: 1000 },
      },
      BUNDLED_RULES,
      AS_OF,
    );
    expect(embed.title).toBe("You're eligible for CBAP");
    expect(embed.color).toBe(0x1d7a46);
    expect(embed.fields).toHaveLength(3);
    expect(embed.fields!.every((f) => f.name.includes("Eligible"))).toBe(true);
  });

  it("new BA → ECBA only, with CCBA gaps listed", () => {
    const embed = buildEmbed(
      { baHours: 1000, pdHours: 10, agreesToEthics: true, kaHours: {} },
      BUNDLED_RULES,
      AS_OF,
    );
    expect(embed.title).toBe("You're eligible for ECBA");
    const ccba = embed.fields!.find((f) => f.name.includes("CCBA"))!;
    expect(ccba.value).toContain("2,750 more BA work hours needed");
    expect(ccba.value).toContain("11 more PD hours needed");
  });

  it("no ethics agreement → nothing eligible, red", () => {
    const embed = buildEmbed(
      { baHours: 9000, pdHours: 40, agreesToEthics: false, kaHours: {} },
      BUNDLED_RULES,
      AS_OF,
    );
    expect(embed.title).toBe("You're not eligible for an IIBA certification yet");
    expect(embed.color).toBe(0xb42318);
  });

  it("adds course links with UTM tagging", () => {
    const embed = buildEmbed(
      { baHours: 0, pdHours: 0, agreesToEthics: true, kaHours: {} },
      BUNDLED_RULES,
      AS_OF,
    );
    expect(embed.fields![0]!.value).toMatch(/techcanvass\.com\/ecba-certification-training\?utm_source=discord/);
  });

  it("returns an error embed instead of throwing on bad input", () => {
    const embed = buildEmbed(
      { baHours: -1, pdHours: 0, agreesToEthics: true, kaHours: {} },
      BUNDLED_RULES,
      AS_OF,
    );
    expect(embed.title).toBe("Couldn't check eligibility");
    expect(embed.description).toContain("BA hours must be a number");
  });
});

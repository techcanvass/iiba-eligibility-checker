/**
 * Runs src/Code.js the way Google Apps Script does: plain script files sharing one global
 * scope, with SpreadsheetApp / DocumentApp / HtmlService simulated. BACore is the shared core.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import * as core from "@iiba/core";

const CODE = readFileSync(join(__dirname, "../src/Code.js"), "utf8");

type Env = "sheets" | "docs";

function load(env: Env = "sheets") {
  const calls: string[] = [];
  const ui = {
    createAddonMenu: () => {
      const menu = {
        addItem: (label: string, fn: string) => (calls.push(`menu:${label}->${fn}`), menu),
        addToUi: () => (calls.push("menu:addToUi"), undefined),
      };
      return menu;
    },
    showSidebar: (html: { title: string; file: string }) => calls.push(`sidebar:${html.file}:${html.title}`),
  };
  const notHere = () => {
    throw new Error("Cannot call getUi() from this context.");
  };
  const ctx: Record<string, unknown> = {
    BACore: core,
    HtmlService: {
      createHtmlOutputFromFile: (file: string) => {
        const out = { file, title: "", setTitle: (t: string) => ((out.title = t), out) };
        return out;
      },
    },
    SpreadsheetApp: { getUi: env === "sheets" ? () => ui : notHere },
    DocumentApp: { getUi: env === "docs" ? () => ui : notHere },
    SlidesApp: { getUi: notHere },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  return { g: ctx as Record<string, (...a: unknown[]) => unknown>, calls };
}

describe("menu and sidebar", () => {
  it.each(["sheets", "docs"] as const)("works in Google %s", (env) => {
    const { g, calls } = load(env);
    g.onOpen({});
    g.showSidebar();
    expect(calls).toEqual([
      "menu:Open BA Certification Finder->showSidebar",
      "menu:addToUi",
      "sidebar:Sidebar:BA Certification Finder",
    ]);
  });

  it("onInstall builds the menu too", () => {
    const { g, calls } = load();
    g.onInstall({});
    expect(calls[0]).toContain("menu:Open BA Certification Finder");
  });
});

describe("=BA_ELIGIBILITY()", () => {
  const { g } = load();
  const KA4 = [[1000, 1000, 1000, 1000, 0, 0]];

  it("single person", () => {
    expect(g.BA_ELIGIBILITY(8000, 35, KA4)).toBe("CBAP");
    expect(g.BA_ELIGIBILITY(1000, 10)).toBe("ECBA");
    expect(g.BA_ELIGIBILITY(4000, 21, [[900, 0, 0, 0, 900, 0]])).toBe("CCBA");
  });

  it("whole columns, skipping blank rows", () => {
    const result = g.BA_ELIGIBILITY(
      [[8000], [1000], [""], [4000]],
      [[35], [10], [""], [21]],
      [[1000, 1000, 1000, 1000, 0, 0], ["", "", "", "", "", ""], ["", "", "", "", "", ""], [900, 0, 0, 0, 900, 0]],
    );
    expect(result).toEqual([["CBAP"], ["ECBA"], [""], ["CCBA"]]);
  });

  it("shows a readable error in the cell for bad input", () => {
    expect(() => g.BA_ELIGIBILITY(-5, 0)).toThrow("BA hours must be a number ≥ 0");
    expect(() => g.BA_ELIGIBILITY("abc", 0)).toThrow("BA hours must be a number");
  });
});

describe("=BA_ELIGIBILITY_DETAILS()", () => {
  it("returns a table with the gaps from the shared core", () => {
    const { g } = load();
    const rows = g.BA_ELIGIBILITY_DETAILS(1000, 10) as string[][];
    expect(rows[0]).toEqual(["Certification", "Eligible", "What's missing"]);
    expect(rows[1]).toEqual(["ECBA", "Yes", "—"]);
    expect(rows[2]![0]).toBe("CCBA");
    expect(rows[2]![2]).toContain("2,750 more BA work hours needed");
  });
});

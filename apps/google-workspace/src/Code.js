/**
 * BA Certification Finder — Google Workspace editor add-on (Sheets, Docs and Slides).
 *
 * All certification logic is in Core.js, which is a copy of packages/core/dist/ba-core.js:
 * the same file used by the browser extension, WordPress plugin and Python package.
 * This file only adds the menu, the sidebar and two Sheets formulas around it.
 */

/* global BACore, HtmlService, SpreadsheetApp, DocumentApp, SlidesApp */

function onInstall(e) {
  onOpen(e);
}

/** Adds Extensions → BA Certification Finder → Open. */
function onOpen(e) {
  getUi_()
    .createAddonMenu()
    .addItem("Open BA Certification Finder", "showSidebar")
    .addToUi();
}

/** Opens the guided finder (same screens as the website) in the sidebar. */
function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile("Sidebar").setTitle("BA Certification Finder");
  getUi_().showSidebar(html);
}

/** The same code runs in Sheets, Docs and Slides: use whichever app opened the add-on. */
function getUi_() {
  var hosts = [
    typeof SpreadsheetApp !== "undefined" ? SpreadsheetApp : null,
    typeof DocumentApp !== "undefined" ? DocumentApp : null,
    typeof SlidesApp !== "undefined" ? SlidesApp : null,
  ];
  for (var i = 0; i < hosts.length; i++) {
    if (!hosts[i]) continue;
    try {
      return hosts[i].getUi();
    } catch (err) {
      // Not this app (e.g. SpreadsheetApp.getUi() inside a Doc) — try the next one.
    }
  }
  throw new Error("BA Certification Finder works in Google Sheets, Docs and Slides.");
}

/**
 * Recommends the highest IIBA certification (ECBA, CCBA or CBAP) the hours qualify for.
 * Works on one row or on whole columns, e.g. =BA_ELIGIBILITY(B2:B50, C2:C50, D2:I50)
 *
 * @param {number|number[][]} baHours BA work hours in the last 10 years.
 * @param {number|number[][]} pdHours Professional development hours in the last 4 years.
 * @param {number[][]} [kaHours] Six cells per row: hours in Planning, Elicitation, Life Cycle, Strategy, Requirements Analysis & Design, Solution Evaluation.
 * @return {string|string[][]} The recommended certification, or "Not yet eligible".
 * @customfunction
 */
function BA_ELIGIBILITY(baHours, pdHours, kaHours) {
  return eachRow_(baHours, pdHours, kaHours, function (report) {
    return report.recommended || "Not yet eligible";
  });
}

/**
 * Per-certification breakdown for one person: eligible or not, and what is still missing.
 *
 * @param {number} baHours BA work hours in the last 10 years.
 * @param {number} pdHours Professional development hours in the last 4 years.
 * @param {number[][]} [kaHours] Six cells: hours per BABOK knowledge area (same order as BA_ELIGIBILITY).
 * @return {string[][]} A table: Certification | Eligible | What's missing.
 * @customfunction
 */
function BA_ELIGIBILITY_DETAILS(baHours, pdHours, kaHours) {
  var report = check_(single_(baHours), single_(pdHours), flatten_(kaHours));
  var rows = [["Certification", "Eligible", "What's missing"]];
  report.results.forEach(function (r) {
    var gaps = r.requirements
      .filter(function (q) {
        return !q.met;
      })
      .map(function (q) {
        return q.gap;
      });
    rows.push([r.code, r.eligible ? "Yes" : "Not yet", gaps.join("; ") || "—"]);
  });
  return rows;
}

// ---------- helpers ----------

/** Custom functions can't ask questions, so the ethics agreement is assumed. */
function check_(baHours, pdHours, ka) {
  var kaHours = {};
  BACore.KNOWLEDGE_AREA_IDS.forEach(function (id, i) {
    if (ka[i] !== null && ka[i] !== undefined && ka[i] !== "") kaHours[id] = Number(ka[i]);
  });
  try {
    return BACore.checkEligibility(
      { baHours: toNumber_(baHours, "BA hours"), pdHours: toNumber_(pdHours, "PD hours"), kaHours: kaHours, agreesToEthics: true },
      BACore.BUNDLED_RULES,
    );
  } catch (err) {
    var details = (err.errors || []).map(function (x) {
      return x.message;
    });
    throw new Error(details.length ? details.join("; ") : err.message);
  }
}

function eachRow_(baHours, pdHours, kaHours, pick) {
  if (!Array.isArray(baHours)) return pick(check_(baHours, single_(pdHours), flatten_(kaHours)));
  return baHours.map(function (row, i) {
    var ba = row[0];
    if (ba === "" || ba === null) return [""]; // blank row in a column range
    var pd = Array.isArray(pdHours) ? (pdHours[i] || [""])[0] : pdHours;
    var ka = Array.isArray(kaHours) && Array.isArray(kaHours[i]) ? kaHours[i] : [];
    return [pick(check_(ba, pd, ka))];
  });
}

function toNumber_(value, label) {
  var n = value === "" || value === null || value === undefined ? 0 : Number(value);
  if (!isFinite(n)) throw new Error(label + " must be a number");
  return n;
}

function single_(value) {
  return Array.isArray(value) ? (value[0] || [""])[0] : value;
}

function flatten_(range) {
  if (!Array.isArray(range)) return range === undefined ? [] : [range];
  return range.reduce(function (all, row) {
    return all.concat(Array.isArray(row) ? row : [row]);
  }, []);
}

/**
 * Caffeine maths for the buzzoffapp.com tools. One ES module, no dependencies,
 * no DOM, no storage, no network. Tested by .claude/tests/caffeine-model.test.mjs
 * (node .claude/tests/caffeine-model.test.mjs).
 *
 * Mirror in the app: same constants, same functions (port to TypeScript).
 */

/**
 * Caffeine half-life in healthy adults: mean about 5 hours, range 1.5 to 9.5
 * hours. National Academy of Sciences (2001), Pharmacology of Caffeine,
 * https://www.ncbi.nlm.nih.gov/books/NBK223808/
 */
export const HALF_LIFE = Object.freeze({ meanH: 5, minH: 1.5, maxH: 9.5 });

/**
 * Absorption: 99% is absorbed within 45 minutes (same source), so the
 * absorption half-life is 45 min / log2(100), about 6.8 minutes. With the
 * defaults the peak comes about 38 minutes after a drink, inside the 15 to
 * 120 minutes the source gives for peak plasma levels.
 */
export const ABSORPTION_HALF_LIFE_H = 45 / 60 / Math.log2(100);

const HOUR_MS = 60 * 60 * 1000;

/**
 * Caffeine in the body at `atMs`: a one-compartment model with first-order
 * absorption (the Bateman function), summed over doses. It returns mg in the
 * body (an amount, not a blood concentration), so no body weight is needed.
 *
 *   amount(t) = Σ D · ka/(ka − ke) · (e^(−ke·Δt) − e^(−ka·Δt)),  Δt = t − takenAt > 0
 *   ke = ln2 / halfLifeH,  ka = ln2 / absorptionHalfLifeH
 *   (when ka = ke the limit is D · k · Δt · e^(−k·Δt))
 *
 * @param {{mg: number, takenAt: number}[]} doses  takenAt in ms (any epoch)
 * @param {number} atMs
 * @param {{halfLifeH?: number, absorptionHalfLifeH?: number}} [opts]
 * @returns {number} mg in the body; doses not yet taken count as 0
 */
export function caffeineInBodyMg(
  doses,
  atMs,
  { halfLifeH = HALF_LIFE.meanH, absorptionHalfLifeH = ABSORPTION_HALF_LIFE_H } = {}
) {
  const ke = Math.LN2 / halfLifeH;
  const ka = Math.LN2 / absorptionHalfLifeH;
  let total = 0;
  for (const dose of doses) {
    const mg = Number(dose.mg);
    if (!Number.isFinite(mg) || mg <= 0) continue;
    const dt = (atMs - dose.takenAt) / HOUR_MS;
    if (!(dt > 0)) continue;
    if (Math.abs(ka - ke) < 1e-9) {
      total += mg * ke * dt * Math.exp(-ke * dt);
    } else {
      total += mg * (ka / (ka - ke)) * (Math.exp(-ke * dt) - Math.exp(-ka * dt));
    }
  }
  return total;
}

/**
 * Sampled curve from `fromMs` to `toMs` inclusive, every `stepMin` minutes.
 * @returns {{t: number, mg: number}[]}
 */
export function caffeineCurve(doses, fromMs, toMs, stepMin = 10, opts) {
  const step = stepMin * 60 * 1000;
  const out = [];
  for (let t = fromMs; t <= toMs; t += step) {
    out.push({ t, mg: caffeineInBodyMg(doses, t, opts) });
  }
  return out;
}

/* ---- Gradual plan: keep in sync with buzzoff-final lib/gradualPlan.ts ---- */
export const PLAN_WEEK_COUNT = 6;
const WEEKLY_REDUCTION_RATE = 0.15;
const MIN_TARGET_MG = 25;
/** The app's mg per cup (lib/gradualPlan.ts DEFAULT_MG_PER_CUP). */
export const MG_PER_CUP = 95;

function targetMgForPlanWeek(baselineMg, week) {
  const baseline = Math.max(1, Math.round(baselineMg));
  if (week <= 1) return baseline;
  const factor = Math.pow(1 - WEEKLY_REDUCTION_RATE, week - 1);
  return Math.max(MIN_TARGET_MG, Math.round(baseline * factor));
}

/**
 * The app's 6-week Gradual roadmap (buildPlanRoadmap): week 1 is the baseline
 * ("Track and learn"), then 15% less each week, never under 25 mg.
 * @returns {{week: number, targetMg: number, subtitle: string}[]}
 */
export function planRoadmap(baselineMg) {
  return Array.from({ length: PLAN_WEEK_COUNT }, (_, i) => {
    const week = i + 1;
    let subtitle = "Step down";
    if (week === 1) subtitle = "Track and learn";
    else if (week === PLAN_WEEK_COUNT) subtitle = "Maintain or adjust";
    return { week, targetMg: targetMgForPlanWeek(baselineMg, week), subtitle };
  });
}

/** The app's mgToApproxCups wording. */
export function mgToApproxCups(mg, mgPerCup = MG_PER_CUP) {
  if (mg <= 0) return "~0 cups";
  const cups = mg / mgPerCup;
  if (cups < 0.35) return "under ½ cup";
  return `~${cups.toFixed(1)} cups`;
}
/* ---- end of the lib/gradualPlan.ts mirror ---- */

/**
 * Drinks for the pickers. Each figure is as its source gives it:
 * efsa = EFSA caffeine topic page (2015 Scientific Opinion),
 *        https://www.efsa.europa.eu/en/topics/topic/caffeine
 * fda  = FDA, Spilling the Beans (content current as of 28 Aug 2024),
 *        https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much
 * Decaf uses the top of the FDA's 2–15 mg range.
 */
export const DRINKS = Object.freeze([
  { id: "filter-coffee", label: "Filter coffee", serving: "200 ml cup", mg: 90, source: "efsa" },
  { id: "espresso", label: "Espresso", serving: "60 ml", mg: 80, source: "efsa" },
  { id: "decaf", label: "Decaf coffee", serving: "8 fl oz, top of 2–15 mg", mg: 15, source: "fda" },
  { id: "black-tea", label: "Black tea", serving: "220 ml cup", mg: 50, source: "efsa" },
  { id: "green-tea", label: "Green tea", serving: "12 fl oz", mg: 37, source: "fda" },
  { id: "cola", label: "Cola", serving: "355 ml can", mg: 40, source: "efsa" },
  { id: "energy-drink", label: "Energy drink", serving: "250 ml can", mg: 80, source: "efsa" },
  { id: "plain-chocolate", label: "Plain chocolate", serving: "50 g bar", mg: 25, source: "efsa" },
  { id: "milk-chocolate", label: "Milk chocolate", serving: "50 g bar", mg: 10, source: "efsa" },
]);

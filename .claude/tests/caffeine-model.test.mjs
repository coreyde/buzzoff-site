// Tests for assets/js/caffeine-model.js. No packages needed:
//   node .claude/tests/caffeine-model.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The site has no package.json, so load the browser module as an ES module
// from its source (no "type": "module" warning, nothing to install).
const src = readFileSync(new URL("../../assets/js/caffeine-model.js", import.meta.url), "utf8");
const {
  caffeineInBodyMg,
  caffeineCurve,
  planRoadmap,
  mgToApproxCups,
  DRINKS,
  HALF_LIFE,
  MG_PER_CUP,
} = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: got ${actual}, want ${expected} ± ${tol}`);

test("100 mg follows the documented checkpoints (5 h half-life)", () => {
  const doses = [{ mg: 100, takenAt: 0 }];
  near(caffeineInBodyMg(doses, 45 * MIN), 91, 1, "45 min");
  near(caffeineInBodyMg(doses, 5 * HOUR), 51, 1, "5 h");
  near(caffeineInBodyMg(doses, 10 * HOUR), 26, 1, "10 h");
  near(caffeineInBodyMg(doses, 15 * HOUR), 13, 1, "15 h");
});

test("the peak falls inside the 15–120 min the source gives", () => {
  const curve = caffeineCurve([{ mg: 100, takenAt: 0 }], 0, 4 * HOUR, 1);
  const peak = curve.reduce((a, b) => (b.mg > a.mg ? b : a));
  assert.ok(peak.t >= 15 * MIN && peak.t <= 120 * MIN, `peak at ${peak.t / MIN} min`);
  near(peak.t / MIN, 38, 2, "peak minute");
});

test("nothing is counted before a dose is taken", () => {
  const doses = [{ mg: 100, takenAt: 2 * HOUR }];
  assert.equal(caffeineInBodyMg(doses, 0), 0);
  assert.equal(caffeineInBodyMg(doses, 2 * HOUR - 1), 0);
  assert.equal(caffeineInBodyMg(doses, 2 * HOUR), 0);
  assert.ok(caffeineInBodyMg(doses, 2 * HOUR + 10 * MIN) > 0);
});

test("doses add up", () => {
  const a = { mg: 100, takenAt: 0 };
  const b = { mg: 50, takenAt: 3 * HOUR };
  const at = 6 * HOUR;
  near(caffeineInBodyMg([a, b], at), caffeineInBodyMg([a], at) + caffeineInBodyMg([b], at), 1e-9, "sum");
});

test("half-life option changes clearance", () => {
  const doses = [{ mg: 100, takenAt: 0 }];
  const fast = caffeineInBodyMg(doses, 10 * HOUR, { halfLifeH: HALF_LIFE.minH });
  const slow = caffeineInBodyMg(doses, 10 * HOUR, { halfLifeH: HALF_LIFE.maxH });
  assert.ok(fast < 2 && slow > 45, `fast ${fast}, slow ${slow}`);
});

test("absorption half-life equal to elimination half-life uses the limit", () => {
  const doses = [{ mg: 100, takenAt: 0 }];
  const v = caffeineInBodyMg(doses, 5 * HOUR, { halfLifeH: 2, absorptionHalfLifeH: 2 });
  const k = Math.LN2 / 2;
  near(v, 100 * k * 5 * Math.exp(-k * 5), 1e-9, "limit");
  const nearly = caffeineInBodyMg(doses, 5 * HOUR, { halfLifeH: 2, absorptionHalfLifeH: 2.000001 });
  near(v, nearly, 1e-3, "continuous");
});

test("bad doses are ignored", () => {
  assert.equal(caffeineInBodyMg([{ mg: -5, takenAt: 0 }, { mg: NaN, takenAt: 0 }], HOUR), 0);
  assert.equal(caffeineInBodyMg([], HOUR), 0);
});

test("caffeineCurve steps from start to end inclusive", () => {
  const curve = caffeineCurve([{ mg: 100, takenAt: 0 }], 0, HOUR, 10);
  assert.equal(curve.length, 7);
  assert.equal(curve[0].t, 0);
  assert.equal(curve[6].t, HOUR);
});

test("planRoadmap matches the app's Gradual plan (lib/gradualPlan.ts)", () => {
  assert.deepEqual(planRoadmap(300).map((w) => w.targetMg), [300, 255, 217, 184, 157, 133]);
  assert.deepEqual(planRoadmap(200).map((w) => w.targetMg), [200, 170, 144, 123, 104, 89]);
  assert.deepEqual(planRoadmap(300).map((w) => w.week), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(
    planRoadmap(300).map((w) => w.subtitle),
    ["Track and learn", "Step down", "Step down", "Step down", "Step down", "Maintain or adjust"]
  );
});

test("planRoadmap keeps the 25 mg floor and rounds the baseline", () => {
  assert.deepEqual(planRoadmap(60).map((w) => w.targetMg), [60, 51, 43, 37, 31, 27]);
  assert.deepEqual(planRoadmap(40).map((w) => w.targetMg), [40, 34, 29, 25, 25, 25]);
  assert.equal(planRoadmap(0)[0].targetMg, 1);
  assert.equal(planRoadmap(99.6)[0].targetMg, 100);
});

test("mgToApproxCups mirrors the app's wording", () => {
  assert.equal(MG_PER_CUP, 95);
  assert.equal(mgToApproxCups(0), "~0 cups");
  assert.equal(mgToApproxCups(30), "under ½ cup");
  assert.equal(mgToApproxCups(95), "~1.0 cups");
  assert.equal(mgToApproxCups(300), "~3.2 cups");
});

test("every drink has a positive mg and a source", () => {
  assert.ok(DRINKS.length >= 8);
  const ids = new Set();
  for (const d of DRINKS) {
    assert.ok(d.id && d.label && d.serving, `drink fields: ${JSON.stringify(d)}`);
    assert.ok(Number.isFinite(d.mg) && d.mg > 0, `${d.id} mg`);
    assert.ok(["efsa", "fda"].includes(d.source), `${d.id} source`);
    assert.ok(!ids.has(d.id), `duplicate ${d.id}`);
    ids.add(d.id);
  }
});

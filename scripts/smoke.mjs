// Runs the built package on the oldest Node in `engines`, through import and require.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const input = {
	vehicle: "car",
	year: 2019,
	month: 3,
	fuel: "petrol",
	cc: 1199,
	co2: 110,
	cycle: "nedc",
};

for (const [via, iuc] of [
	["import", await import("iuc-portugal")],
	["require", require("iuc-portugal")],
]) {
	const result = iuc.computeIuc(input);
	assert.equal(result.status, "due", via);
	assert.equal(result.totalCents, 11146, via);
	assert.equal(iuc.RATES_YEAR, 2026, via);
	console.log(`${via}: ok`);
}

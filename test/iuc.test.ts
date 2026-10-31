/**
 * Checked against the AT's published examples and the worked example DECO
 * published for a WLTP diesel. Every amount is in integer cents.
 */

import { describe, expect, it } from "vitest";

import {
	computeIuc,
	type IucInput,
	iucCategory,
	iucSchedule,
	RATES_SOURCE,
	RATES_YEAR,
	tables,
} from "../src/index.js";

const total = (input: IucInput) => {
	const result = computeIuc(input);
	expect(result.status, JSON.stringify(input)).toBe("due");
	return result.status === "due" ? result.totalCents : -1;
};
const car = { vehicle: "car", month: 6, cycle: "nedc", co2: null } as const;
const moto = {
	vehicle: "motorcycle",
	month: 1,
	fuel: "petrol",
	co2: null,
	cycle: "nedc",
} as const;

describe("computeIuc, category B", () => {
	it("prices by engine and CO2, times the year's coefficient", () => {
		// (31,77 + 65,15) x 1,15.
		expect(
			total({ ...car, year: 2019, fuel: "petrol", cc: 1199, co2: 110 }),
		).toBe(11146);
		// (63,74 + 65,15) x 1,15 + 10,07 of gasóleo, WLTP (DECO's example).
		expect(
			total({
				...car,
				year: 2022,
				fuel: "diesel",
				cc: 1598,
				co2: 120,
				cycle: "wltp",
			}),
		).toBe(15829);
	});

	it("adds the extra CO2 tax from 2017 only", () => {
		const input = { ...car, fuel: "petrol", cc: 2000, co2: 190 } as const;
		expect(total({ ...input, year: 2018 })).toBe(
			Math.round(((12735 + 21204 + 3177) * 115) / 100),
		);
		expect(total({ ...input, year: 2016 })).toBe(
			Math.round(((12735 + 21204) * 115) / 100),
		);
	});

	it("treats every upper limit as inclusive", () => {
		const at = (cc: number, co2: number) =>
			total({ ...car, year: 2007, month: 7, fuel: "petrol", cc, co2 });
		expect(at(1250, 120)).toBe(3177 + 6515);
		expect(at(1251, 120)).toBe(6374 + 6515);
		expect(at(1250, 121)).toBe(3177 + 9763);
	});

	it("reads the CO2 bands of the cycle the figure was measured on", () => {
		const input = {
			...car,
			year: 2007,
			month: 7,
			fuel: "petrol",
			cc: 1000,
			co2: 130,
		} as const;
		expect(total({ ...input, cycle: "nedc" })).toBe(3177 + 9763);
		expect(total({ ...input, cycle: "wltp" })).toBe(3177 + 6515);
	});

	it("applies the coefficient of the year of first registration", () => {
		expect(tables.B_COEFFICIENT(2007)).toBe(100);
		expect(tables.B_COEFFICIENT(2008)).toBe(105);
		expect(tables.B_COEFFICIENT(2009)).toBe(110);
		expect(tables.B_COEFFICIENT(2010)).toBe(115);
	});

	it("lists every line that makes up the total", () => {
		const result = computeIuc({
			...car,
			year: 2022,
			fuel: "diesel",
			cc: 1598,
			co2: 120,
			cycle: "wltp",
		});
		expect(result).toEqual({
			status: "due",
			category: "B",
			totalCents: 15829,
			belowMinimum: false,
			lines: [
				{ key: "engine", cents: 6374 },
				{ key: "co2", cents: 6515 },
				{ key: "coefficient", cents: 1933, factor: 1.15 },
				{ key: "diesel", cents: 1007 },
			],
		});
	});

	it("asks for the CO2 figure when it is missing", () => {
		expect(
			computeIuc({ ...car, year: 2019, fuel: "petrol", cc: 1199 }),
		).toEqual({ status: "needs", field: "co2" });
	});
});

describe("computeIuc, category A", () => {
	it("prices by engine and year, with the gasóleo extra", () => {
		expect(total({ ...car, year: 2005, fuel: "diesel", cc: 1900 })).toBe(4626);
		expect(total({ ...car, year: 1993, fuel: "petrol", cc: 1200 })).toBe(2245);
	});

	it("does not need a CO2 figure", () => {
		expect(
			computeIuc({ ...car, year: 2000, fuel: "petrol", cc: 999 }).status,
		).toBe("due");
	});

	it("moves from A to B on 1 July 2007", () => {
		expect(iucCategory({ vehicle: "car", year: 2007, month: 6 })).toBe("A");
		expect(iucCategory({ vehicle: "car", year: 2007, month: 7 })).toBe("B");
		expect(
			total({
				...car,
				year: 2007,
				month: 7,
				fuel: "petrol",
				cc: 1400,
				co2: 150,
			}),
		).toBe(6374 + 9763);
	});
});

describe("computeIuc, category E", () => {
	it("prices motorcycles from the table", () => {
		expect(total({ ...moto, year: 2015, cc: 650 })).toBe(6362);
		expect(total({ ...moto, year: 1994, cc: 300 })).toBe(619);
	});

	it("charges nothing under 120 cm3", () => {
		expect(total({ ...moto, year: 2020, cc: 119 })).toBe(0);
	});

	it("uses the older column for 1992 to 1996", () => {
		expect(total({ ...moto, year: 1996, cc: 800 })).toBe(6776);
		expect(total({ ...moto, year: 1997, cc: 800 })).toBe(13815);
	});
});

describe("computeIuc, nothing due", () => {
	it("exempts electric vehicles", () => {
		expect(computeIuc({ ...car, year: 2023, fuel: "electric", cc: 0 })).toEqual(
			{
				status: "exempt",
				reason: "electric",
			},
		);
	});

	it("leaves out cars before 1981 and motorcycles before 1992", () => {
		expect(
			computeIuc({ ...car, year: 1980, fuel: "petrol", cc: 1300 }),
		).toEqual({ status: "outside", reason: "carBefore1981" });
		expect(computeIuc({ ...moto, year: 1991, cc: 600 })).toEqual({
			status: "outside",
			reason: "motorcycleBefore1992",
		});
	});

	it("flags an amount under ten euros, which is not collected", () => {
		const result = computeIuc({ ...moto, year: 1994, cc: 300 });
		expect(result.status === "due" && result.belowMinimum).toBe(true);
	});
});

describe("computeIuc, invalid input", () => {
	const valid: IucInput = {
		vehicle: "car",
		year: 2019,
		month: 6,
		fuel: "petrol",
		cc: 1199,
		co2: 110,
		cycle: "nedc",
	};

	it.each([
		[{ month: 0 }, RangeError],
		[{ month: 13 }, RangeError],
		[{ year: 2019.5 }, RangeError],
		[{ cc: -1 }, RangeError],
		[{ cc: Number.NaN }, RangeError],
		[{ co2: -5 }, RangeError],
		[{ co2: Number.POSITIVE_INFINITY }, RangeError],
		[{ fuel: "lpg" }, TypeError],
		[{ vehicle: "truck" }, TypeError],
		[{ cycle: "epa" }, TypeError],
	])("rejects %o", (change, error) => {
		expect(() => computeIuc({ ...valid, ...change } as IucInput)).toThrow(
			error,
		);
	});
});

describe("iucSchedule", () => {
	it("splits the payments by the owner's total from 2027", () => {
		expect(iucSchedule(10000)).toEqual({ y2027: "october", y2028: "april" });
		expect(iucSchedule(10001)).toEqual({
			y2027: "october",
			y2028: "aprilOctober",
		});
		expect(iucSchedule(50000)).toEqual({
			y2027: "october",
			y2028: "aprilOctober",
		});
		expect(iucSchedule(50001)).toEqual({
			y2027: "julyOctober",
			y2028: "aprilJulyOctober",
		});
	});

	it("rejects a total that is not whole cents", () => {
		expect(() => iucSchedule(12.5)).toThrow(RangeError);
		expect(() => iucSchedule(-1)).toThrow(RangeError);
	});
});

describe("tables", () => {
	it("cannot be changed at run time", () => {
		const engine = tables.B_ENGINE as unknown as number[][];
		expect(Object.isFrozen(engine)).toBe(true);
		expect(Object.isFrozen(engine[0])).toBe(true);
		expect(Object.isFrozen(tables.B_CO2.wltp)).toBe(true);
		expect(() => engine.push([1, 1])).toThrow(TypeError);
	});

	it("say which year's rates they hold", () => {
		expect(RATES_YEAR).toBe(2026);
		expect(RATES_SOURCE).toContain("82/2023");
	});
});

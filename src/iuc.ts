/*
 * IUC (Imposto Único de Circulação) for passenger cars and motorcycles, at
 * the rates in force in 2026: the tables of the Código do IUC as worded by
 * Lei 82/2023 (unchanged by the 2025 and 2026 budgets) and the gasóleo
 * adicional of Lei 82-B/2014 art. 216, kept in force by Lei 73-A/2025 art. 94.
 * Checked against the AT's consolidated code on 2 October 2026.
 *
 * Money is integer cents from the tables to the total, and the coefficient
 * is integer hundredths, so no float ever decides a cent. The coefficient is
 * the one multiplication; its result is rounded half up to the cent, which is
 * how every published example reads (the code itself states no rounding rule).
 *
 * Out of scope on purpose: goods vehicles (categories C and D), the
 * exemptions that depend on who owns the car (disability, IPSS, taxis), and
 * the Azores and Madeira, where the CO2 figure is the ISV one.
 */

import {
	A_DIESEL,
	A_DIESEL_RATES,
	A_OTHER,
	A_PETROL,
	A_RATES,
	B_CO2,
	B_CO2_EXTRA,
	B_COEFFICIENT,
	B_DIESEL,
	B_ENGINE,
	type Bands,
	E_RATES,
	IUC_MINIMUM_CENTS,
} from "./tables.js";

export type IucVehicle = "car" | "motorcycle";
export type IucFuel = "petrol" | "diesel" | "other" | "electric";
/** The homologation cycle the CO2 figure was measured on. */
export type IucCycle = "nedc" | "wltp";

export interface IucInput {
	vehicle: IucVehicle;
	/** Year of first registration in Portugal or anywhere in the EU/EEA. */
	year: number;
	/** Month of first registration, 1 to 12. */
	month: number;
	fuel: IucFuel;
	/** Engine size in cm3. */
	cc: number;
	/** CO2 in g/km. Needed for category B cars only, so it may be null otherwise. */
	co2: number | null;
	cycle: IucCycle;
}

export type IucCategory = "A" | "B" | "E";

export interface IucLine {
	key: "engine" | "co2" | "co2Extra" | "coefficient" | "diesel" | "table";
	cents: number;
	/** The coefficient line carries its factor as well as the amount it adds. */
	factor?: number;
}

export type IucResult =
	| { status: "exempt"; reason: "electric" }
	| { status: "outside"; reason: "carBefore1981" | "motorcycleBefore1992" }
	| { status: "needs"; field: "co2" }
	| {
			status: "due";
			category: IucCategory;
			totalCents: number;
			lines: IucLine[];
			/** Under 10 euros nothing is collected (CIUC art. 16). */
			belowMinimum: boolean;
	  };

const VEHICLES: readonly IucVehicle[] = ["car", "motorcycle"];
const FUELS: readonly IucFuel[] = ["petrol", "diesel", "other", "electric"];
const CYCLES: readonly IucCycle[] = ["nedc", "wltp"];

/*
 * The first row whose upper limit holds the value. Upper bounds are inclusive
 * ("até") and every table ends in an open band ("mais de"), so a finite value
 * always finds one.
 */
function rowFor<Row extends readonly [number, ...number[]]>(
	rows: ReadonlyArray<Row>,
	value: number,
): Row {
	for (const row of rows) if (value <= row[0]) return row;
	throw new RangeError(`No IUC band holds ${value}`);
}

const band = (bands: Bands, value: number) => rowFor(bands, value)[1];

/* A row of a category A table, by the index a band gives. */
function rates(
	table: ReadonlyArray<readonly [number, number, number]>,
	index: number,
): readonly [number, number, number] {
	const row = table[index];
	if (!row) throw new RangeError(`No IUC rate row ${index}`);
	return row;
}

const aColumn = (year: number): 0 | 1 | 2 =>
	year >= 1996 ? 0 : year >= 1990 ? 1 : 2;

function assertInput(input: IucInput): void {
	if (!VEHICLES.includes(input.vehicle))
		throw new TypeError(`Unknown vehicle: ${String(input.vehicle)}`);
	if (!FUELS.includes(input.fuel))
		throw new TypeError(`Unknown fuel: ${String(input.fuel)}`);
	if (!CYCLES.includes(input.cycle))
		throw new TypeError(`Unknown cycle: ${String(input.cycle)}`);
	if (!Number.isInteger(input.year) || input.year < 1900)
		throw new RangeError(`year must be an integer from 1900: ${input.year}`);
	if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12)
		throw new RangeError(
			`month must be an integer from 1 to 12: ${input.month}`,
		);
	if (!Number.isFinite(input.cc) || input.cc < 0)
		throw new RangeError(`cc must be a number from 0: ${input.cc}`);
	if (input.co2 !== null && (!Number.isFinite(input.co2) || input.co2 < 0))
		throw new RangeError(`co2 must be null or a number from 0: ${input.co2}`);
}

/** Category A runs to 30 June 2007; the code entered into force on 1 July. */
export function iucCategory(
	input: Pick<IucInput, "vehicle" | "year" | "month">,
): IucCategory {
	if (input.vehicle === "motorcycle") return "E";
	return input.year < 2007 || (input.year === 2007 && input.month < 7)
		? "A"
		: "B";
}

/**
 * The yearly IUC of one car or motorcycle, line by line, in integer cents.
 *
 * Throws a `TypeError` or `RangeError` when the input is not a vehicle the
 * tables can price (an unknown fuel, a month of 13, a negative engine size).
 */
export function computeIuc(input: IucInput): IucResult {
	assertInput(input);

	if (input.fuel === "electric")
		return { status: "exempt", reason: "electric" };
	if (input.vehicle === "car" && input.year < 1981)
		return { status: "outside", reason: "carBefore1981" };
	if (input.vehicle === "motorcycle" && input.year < 1992)
		return { status: "outside", reason: "motorcycleBefore1992" };

	const category = iucCategory(input);
	const lines: IucLine[] = [];

	if (category === "E") {
		const row = rowFor(E_RATES, input.cc);
		lines.push({ key: "table", cents: input.year >= 1997 ? row[1] : row[2] });
	} else if (category === "A") {
		const column = aColumn(input.year);
		const row =
			input.fuel === "petrol"
				? band(A_PETROL, input.cc)
				: band(A_OTHER, input.cc);
		lines.push({ key: "table", cents: rates(A_RATES, row)[column] });
		if (input.fuel === "diesel")
			lines.push({
				key: "diesel",
				cents: rates(A_DIESEL_RATES, band(A_DIESEL, input.cc))[column],
			});
	} else {
		if (input.co2 === null) return { status: "needs", field: "co2" };
		const engine = band(B_ENGINE, input.cc);
		const co2 = band(B_CO2[input.cycle], input.co2);
		const extra =
			input.year >= 2017 ? band(B_CO2_EXTRA[input.cycle], input.co2) : 0;
		const hundredths = B_COEFFICIENT(input.year);
		const base = engine + co2 + extra;
		lines.push({ key: "engine", cents: engine }, { key: "co2", cents: co2 });
		if (extra) lines.push({ key: "co2Extra", cents: extra });
		lines.push({
			key: "coefficient",
			// base x hundredths is an integer, so the halves are exact.
			cents: Math.round((base * hundredths) / 100) - base,
			factor: hundredths / 100,
		});
		if (input.fuel === "diesel")
			lines.push({ key: "diesel", cents: band(B_DIESEL, input.cc) });
	}

	const totalCents = lines.reduce((sum, line) => sum + line.cents, 0);
	return {
		status: "due",
		category,
		totalCents,
		lines,
		belowMinimum: totalCents < IUC_MINIMUM_CENTS,
	};
}

/*
 * When the amount is paid. 2026 still runs on the anniversary month; DL
 * 161/2026 moves every vehicle to the calendar year from 2027, with the
 * number of instalments set by the owner's TOTAL across all vehicles, so pass
 * the sum of every vehicle the owner pays for.
 */
export type IucSchedule2027 = "october" | "julyOctober";
export type IucSchedule2028 = "april" | "aprilOctober" | "aprilJulyOctober";

export function iucSchedule(totalCents: number): {
	y2027: IucSchedule2027;
	y2028: IucSchedule2028;
} {
	if (!Number.isInteger(totalCents) || totalCents < 0)
		throw new RangeError(`totalCents must be an integer from 0: ${totalCents}`);
	return {
		y2027: totalCents <= 50000 ? "october" : "julyOctober",
		y2028:
			totalCents <= 10000
				? "april"
				: totalCents <= 50000
					? "aprilOctober"
					: "aprilJulyOctober",
	};
}

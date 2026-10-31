/*
 * The rate tables of the Código do IUC (Lei 82/2023) and the gasóleo
 * adicional (Lei 82-B/2014 art. 216), in integer cents.
 *
 * A band is `[upper limit, value]`. Upper limits are inclusive ("até") and the
 * last band is open ("mais de").
 */

export type Bands = ReadonlyArray<readonly [number, number]>;

/** The year whose rates these tables hold. */
export const RATES_YEAR = 2026;

/** The laws the tables come from, for a "rates as of" note in your UI. */
export const RATES_SOURCE =
	"Código do IUC (Lei n.º 82/2023), adicional de gasóleo (Lei n.º 82-B/2014, art. 216.º, mantido pela Lei n.º 73-A/2025, art. 94.º)";

/*
 * Frozen all the way down. The types already say readonly, but a JavaScript
 * caller could still push a row into a shared table and change every
 * calculation in the process.
 */
function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}

/** Category B, art. 10 n.º 1: engine size in cm3. */
export const B_ENGINE: Bands = deepFreeze([
	[1250, 3177],
	[1750, 6374],
	[2500, 12735],
	[Number.POSITIVE_INFINITY, 43584],
]);

/** Category B, art. 10 n.º 1: CO2 in g/km, one euro column for two cycle scales. */
export const B_CO2: Readonly<Record<"nedc" | "wltp", Bands>> = deepFreeze({
	nedc: [
		[120, 6515],
		[180, 9763],
		[250, 21204],
		[Number.POSITIVE_INFINITY, 36325],
	],
	wltp: [
		[140, 6515],
		[205, 9763],
		[260, 21204],
		[Number.POSITIVE_INFINITY, 36325],
	],
});

/** Art. 10 n.º 2: extra CO2 tax, for cars first registered from 2017. */
export const B_CO2_EXTRA: Readonly<Record<"nedc" | "wltp", Bands>> = deepFreeze(
	{
		nedc: [
			[180, 0],
			[250, 3177],
			[Number.POSITIVE_INFINITY, 6374],
		],
		wltp: [
			[205, 0],
			[260, 3177],
			[Number.POSITIVE_INFINITY, 6374],
		],
	},
);

/** Art. 10 n.º 3, by year of first registration, in hundredths. */
export const B_COEFFICIENT = (year: number): number =>
	year <= 2007 ? 100 : year === 2008 ? 105 : year === 2009 ? 110 : 115;

/** Lei 82-B/2014 art. 216, gasóleo, category B, by engine size. */
export const B_DIESEL: Bands = deepFreeze([
	[1250, 502],
	[1750, 1007],
	[2500, 2012],
	[Number.POSITIVE_INFINITY, 6885],
]);

/*
 * Category A, art. 9: the band picks a row of `A_RATES`. Petrol and every
 * other fuel are banded separately.
 */
export const A_PETROL: Bands = deepFreeze([
	[1000, 0],
	[1300, 1],
	[1750, 2],
	[2600, 3],
	[3500, 4],
	[Number.POSITIVE_INFINITY, 5],
]);
export const A_OTHER: Bands = deepFreeze([
	[1500, 0],
	[2000, 1],
	[3000, 2],
	[Number.POSITIVE_INFINITY, 3],
]);

/** Three columns by year of registration: from 1996, 1990 to 1995, 1981 to 1989. */
export const A_RATES = deepFreeze([
	[1990, 1255, 880],
	[3995, 2245, 1255],
	[6240, 3487, 1749],
	[15831, 8349, 3609],
	[28749, 15654, 7972],
	[51223, 26311, 12090],
] as const);

/** Lei 82-B/2014 art. 216, gasóleo, category A, same three columns. */
export const A_DIESEL: Bands = deepFreeze([
	[1500, 0],
	[2000, 1],
	[3000, 2],
	[Number.POSITIVE_INFINITY, 3],
]);
export const A_DIESEL_RATES = deepFreeze([
	[314, 198, 139],
	[631, 355, 198],
	[986, 551, 276],
	[2501, 1319, 570],
] as const);

/**
 * Category E, art. 13: motorcycles from 1992, nothing under 120 cm3.
 * Columns: upper limit in cm3, registered from 1997, registered 1992 to 1996.
 */
export const E_RATES: ReadonlyArray<readonly [number, number, number]> =
	deepFreeze([
		[119, 0, 0],
		[250, 619, 0],
		[350, 876, 619],
		[500, 2118, 1253],
		[750, 6362, 3747],
		[Number.POSITIVE_INFINITY, 13815, 6776],
	]);

/** CIUC art. 16: an amount under 10 euros is not collected. */
export const IUC_MINIMUM_CENTS = 1000;

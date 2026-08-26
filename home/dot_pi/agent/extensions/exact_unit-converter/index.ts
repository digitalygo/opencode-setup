import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const ConvertUnitsParams = Type.Object({
	value: Type.Number({ description: "The magnitude to convert." }),
	from: Type.String({ description: "The source unit." }),
	to: Type.String({ description: "The target unit." }),
});

interface UnitDefinition {
	display: string;
	factor: number;
	offset: number;
	aliases: readonly string[];
}

interface UnitCategory {
	name: string;
	base: string;
	affine: boolean;
	units: Record<string, UnitDefinition>;
}

interface ResolvedUnit {
	category: UnitCategory;
	unit: UnitDefinition;
}

const CATEGORIES: UnitCategory[] = [
	{
		name: "data size",
		base: "B",
		affine: false,
		units: {
			"B": { display: "B", factor: 1, offset: 0, aliases: ["byte", "bytes"] },
			"kB": { display: "kB", factor: 1000, offset: 0, aliases: ["kilobyte"] },
			"MB": { display: "MB", factor: 1000000, offset: 0, aliases: ["megabyte"] },
			"GB": { display: "GB", factor: 1000000000, offset: 0, aliases: ["gigabyte"] },
			"TB": { display: "TB", factor: 1000000000000, offset: 0, aliases: ["terabyte"] },
			"PB": { display: "PB", factor: 1000000000000000, offset: 0, aliases: ["petabyte"] },
			"KiB": { display: "KiB", factor: 1024, offset: 0, aliases: ["kibibyte"] },
			"MiB": { display: "MiB", factor: 1048576, offset: 0, aliases: ["mebibyte"] },
			"GiB": { display: "GiB", factor: 1073741824, offset: 0, aliases: ["gibibyte"] },
			"TiB": { display: "TiB", factor: 1099511627776, offset: 0, aliases: ["tebibyte"] },
			"PiB": { display: "PiB", factor: 1125899906842624, offset: 0, aliases: ["pebibyte"] },
			"bit": { display: "bit", factor: 0.125, offset: 0, aliases: ["bits"] },
			"kbit": { display: "kbit", factor: 125, offset: 0, aliases: ["kilobit"] },
			"Mbit": { display: "Mbit", factor: 125000, offset: 0, aliases: ["megabit"] },
			"Gbit": { display: "Gbit", factor: 125000000, offset: 0, aliases: ["gigabit"] },
			"Tbit": { display: "Tbit", factor: 125000000000, offset: 0, aliases: ["terabit"] },
		},
	},
	{
		name: "length",
		base: "m",
		affine: false,
		units: {
			"mm": { display: "mm", factor: 0.001, offset: 0, aliases: ["millimeter", "millimetre"] },
			"cm": { display: "cm", factor: 0.01, offset: 0, aliases: ["centimeter", "centimetre"] },
			"m": { display: "m", factor: 1, offset: 0, aliases: ["meter", "metre", "meters", "metres"] },
			"km": { display: "km", factor: 1000, offset: 0, aliases: ["kilometer", "kilometre"] },
			"in": { display: "in", factor: 0.0254, offset: 0, aliases: ["inch", "inches"] },
			"ft": { display: "ft", factor: 0.3048, offset: 0, aliases: ["foot", "feet"] },
			"yd": { display: "yd", factor: 0.9144, offset: 0, aliases: ["yard", "yards"] },
			"mi": { display: "mi", factor: 1609.344, offset: 0, aliases: ["mile", "miles"] },
			"nmi": { display: "nmi", factor: 1852, offset: 0, aliases: ["nautical mile", "nauticalmile"] },
		},
	},
	{
		name: "mass",
		base: "kg",
		affine: false,
		units: {
			"mg": { display: "mg", factor: 0.000001, offset: 0, aliases: ["milligram"] },
			"g": { display: "g", factor: 0.001, offset: 0, aliases: ["gram"] },
			"kg": { display: "kg", factor: 1, offset: 0, aliases: ["kilogram"] },
			"t": { display: "t", factor: 1000, offset: 0, aliases: ["tonne", "ton"] },
			"oz": { display: "oz", factor: 0.028349523125, offset: 0, aliases: ["ounce", "ounces"] },
			"lb": { display: "lb", factor: 0.45359237, offset: 0, aliases: ["pound", "pounds", "lbs"] },
			"st": { display: "st", factor: 6.35029318, offset: 0, aliases: ["stone", "stones"] },
		},
	},
	{
		name: "temperature",
		base: "K",
		affine: true,
		units: {
			"C": { display: "C", factor: 1, offset: 273.15, aliases: ["celsius", "centigrade"] },
			"F": { display: "F", factor: 5 / 9, offset: 273.15 - (32 * 5) / 9, aliases: ["fahrenheit"] },
			"K": { display: "K", factor: 1, offset: 0, aliases: ["kelvin"] },
		},
	},
	{
		name: "volume",
		base: "l",
		affine: false,
		units: {
			"ml": { display: "ml", factor: 0.001, offset: 0, aliases: ["milliliter"] },
			"l": { display: "l", factor: 1, offset: 0, aliases: ["liter", "litre"] },
			"m3": { display: "m3", factor: 1000, offset: 0, aliases: ["cubic meter", "cubic metre"] },
			"tsp": { display: "tsp", factor: 0.00492892159375, offset: 0, aliases: ["teaspoon"] },
			"tbsp": { display: "tbsp", factor: 0.01478676478125, offset: 0, aliases: ["tablespoon"] },
			"fl oz": { display: "fl oz", factor: 0.0295735295625, offset: 0, aliases: ["fluid ounce", "fluid oz", "floz"] },
			"cup": { display: "cup", factor: 0.2365882365, offset: 0, aliases: ["cups"] },
			"pt": { display: "pt", factor: 0.473176473, offset: 0, aliases: ["pint"] },
			"qt": { display: "qt", factor: 0.946352946, offset: 0, aliases: ["quart"] },
			"gal": { display: "gal", factor: 3.785411784, offset: 0, aliases: ["gallon"] },
			"gal (imperial)": { display: "gal (imperial)", factor: 4.54609, offset: 0, aliases: ["imperial gallon", "imperial gal", "uk gal", "imp gal"] },
		},
	},
	{
		name: "area",
		base: "m2",
		affine: false,
		units: {
			"m2": { display: "m2", factor: 1, offset: 0, aliases: ["square meter", "square metre"] },
			"km2": { display: "km2", factor: 1000000, offset: 0, aliases: ["square kilometer"] },
			"ha": { display: "ha", factor: 10000, offset: 0, aliases: ["hectare"] },
			"ft2": { display: "ft2", factor: 0.09290304, offset: 0, aliases: ["square foot", "square feet", "sq ft"] },
			"acre": { display: "acre", factor: 4046.8564224, offset: 0, aliases: ["acres"] },
			"mi2": { display: "mi2", factor: 2589988.110336, offset: 0, aliases: ["square mile"] },
		},
	},
	{
		name: "time",
		base: "s",
		affine: false,
		units: {
			"ms": { display: "ms", factor: 0.001, offset: 0, aliases: ["millisecond"] },
			"s": { display: "s", factor: 1, offset: 0, aliases: ["second", "seconds", "sec"] },
			"min": { display: "min", factor: 60, offset: 0, aliases: ["minute", "minutes"] },
			"h": { display: "h", factor: 3600, offset: 0, aliases: ["hour", "hours", "hr"] },
			"day": { display: "day", factor: 86400, offset: 0, aliases: ["days"] },
			"week": { display: "week", factor: 604800, offset: 0, aliases: ["weeks"] },
			"year": { display: "year", factor: 31536000, offset: 0, aliases: ["years"] },
		},
	},
	{
		name: "speed",
		base: "m/s",
		affine: false,
		units: {
			"m/s": { display: "m/s", factor: 1, offset: 0, aliases: ["meters per second", "metres per second"] },
			"km/h": { display: "km/h", factor: 0.2777777777777778, offset: 0, aliases: ["kph", "kmh"] },
			"mph": { display: "mph", factor: 0.44704, offset: 0, aliases: ["miles per hour"] },
			"knot": { display: "knot", factor: 0.5144444444444445, offset: 0, aliases: ["knots"] },
		},
	},
	{
		name: "data transfer rate",
		base: "bit/s",
		affine: false,
		units: {
			"bit/s": { display: "bit/s", factor: 1, offset: 0, aliases: ["bits per second"] },
			"kbit/s": { display: "kbit/s", factor: 1000, offset: 0, aliases: ["kilobits per second"] },
			"Mbit/s": { display: "Mbit/s", factor: 1000000, offset: 0, aliases: ["megabits per second"] },
			"Gbit/s": { display: "Gbit/s", factor: 1000000000, offset: 0, aliases: ["gigabits per second"] },
			"B/s": { display: "B/s", factor: 8, offset: 0, aliases: ["bytes per second"] },
			"kB/s": { display: "kB/s", factor: 8000, offset: 0, aliases: ["kilobytes per second"] },
			"MB/s": { display: "MB/s", factor: 8000000, offset: 0, aliases: ["megabytes per second"] },
		},
	},
	{
		name: "energy",
		base: "J",
		affine: false,
		units: {
			"J": { display: "J", factor: 1, offset: 0, aliases: ["joule", "joules"] },
			"kJ": { display: "kJ", factor: 1000, offset: 0, aliases: ["kilojoule"] },
			"Wh": { display: "Wh", factor: 3600, offset: 0, aliases: ["watt hour", "watthour", "watt-hour"] },
			"kWh": { display: "kWh", factor: 3600000, offset: 0, aliases: ["kilowatt hour", "kilowatt-hour"] },
			"cal": { display: "cal", factor: 4.184, offset: 0, aliases: ["calorie", "calories"] },
			"kcal": { display: "kcal", factor: 4184, offset: 0, aliases: ["kilocalorie"] },
		},
	},
	{
		name: "power",
		base: "W",
		affine: false,
		units: {
			"W": { display: "W", factor: 1, offset: 0, aliases: ["watt", "watts"] },
			"kW": { display: "kW", factor: 1000, offset: 0, aliases: ["kilowatt"] },
			"MW": { display: "MW", factor: 1000000, offset: 0, aliases: ["megawatt"] },
			"hp": { display: "hp", factor: 745.69987158227022, offset: 0, aliases: ["horsepower"] },
		},
	},
	{
		name: "pressure",
		base: "Pa",
		affine: false,
		units: {
			"Pa": { display: "Pa", factor: 1, offset: 0, aliases: ["pascal", "pascals"] },
			"kPa": { display: "kPa", factor: 1000, offset: 0, aliases: ["kilopascal"] },
			"bar": { display: "bar", factor: 100000, offset: 0, aliases: [] },
			"atm": { display: "atm", factor: 101325, offset: 0, aliases: ["atmosphere", "atmospheres"] },
			"psi": { display: "psi", factor: 6894.757293168361, offset: 0, aliases: ["pound per square inch"] },
			"mmHg": { display: "mmHg", factor: 133.322387415, offset: 0, aliases: ["millimeter of mercury", "millimetre of mercury"] },
		},
	},
	{
		name: "angle",
		base: "rad",
		affine: false,
		units: {
			"deg": { display: "deg", factor: Math.PI / 180, offset: 0, aliases: ["degree", "degrees"] },
			"rad": { display: "rad", factor: 1, offset: 0, aliases: ["radian", "radians"] },
			"grad": { display: "grad", factor: Math.PI / 200, offset: 0, aliases: ["gradian", "gradians", "gon"] },
		},
	},
];

function normalizeUnitName(rawName: string): string {
	return rawName.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildUnitLookup(): Map<string, ResolvedUnit> {
	const lookup = new Map<string, ResolvedUnit>();
	for (const category of CATEGORIES) {
		for (const [unitKey, unit] of Object.entries(category.units)) {
			const resolved = { category, unit };
			lookup.set(normalizeUnitName(unitKey), resolved);
			for (const alias of unit.aliases) {
				lookup.set(normalizeUnitName(alias), resolved);
			}
		}
	}
	return lookup;
}

const UNIT_LOOKUP = buildUnitLookup();

function listUnitNames(category: UnitCategory): string {
	return Object.keys(category.units).join(", ");
}

function listAllUnits(): string {
	return CATEGORIES.map((category) => `${category.name}: ${listUnitNames(category)}`).join("\n");
}

function resolveUnit(rawName: string, category?: UnitCategory): ResolvedUnit {
	const resolved = UNIT_LOOKUP.get(normalizeUnitName(rawName));
	if (!resolved) {
		const supported = category ? `${category.name}: ${listUnitNames(category)}` : listAllUnits();
		throw new Error(`Unknown unit "${rawName}". Supported units:\n${supported}`);
	}
	return resolved;
}

function toCanonical(unit: UnitDefinition, value: number): number {
	return value * unit.factor + unit.offset;
}

function fromCanonical(unit: UnitDefinition, value: number): number {
	return (value - unit.offset) / unit.factor;
}

function formatNumber(value: number): string {
	if (value === 0) return "0";
	if (Number.isSafeInteger(value)) return value.toLocaleString("en-US");
	const rounded = Number(value.toPrecision(12));
	if (Math.abs(rounded) < 1e-12) return "0";
	return new Intl.NumberFormat("en-US", { maximumFractionDigits: 12 }).format(rounded);
}

function affineFormula(from: UnitDefinition, to: UnitDefinition, gain: number): string {
	const intercept = (from.offset - to.offset) / to.factor;
	const interceptText = intercept < 0
		? `- ${formatNumber(-intercept)}`
		: `+ ${formatNumber(intercept)}`;
	return `${to.display} = (${from.display} × ${formatNumber(gain)}) ${interceptText}`;
}

export default function unitConverter(pi: ExtensionAPI) {
	pi.registerTool({
		name: "convert_units",
		label: "Convert Units",
		description:
			"Convert a value between units of measurement for data size, length, mass, temperature, volume, area, time, speed, data transfer rate, energy, power, pressure, and angle.",
		promptSnippet: "Convert a value between units of measurement",
		promptGuidelines: [
			"Use convert_units for precise unit conversions between units of measurement.",
			"Use convert_units whenever a task depends on converting between units of measurement.",
		],
		parameters: ConvertUnitsParams,
		async execute(_toolCallId, params, _signal) {
			const from = resolveUnit(params.from);
			const to = resolveUnit(params.to, from.category);
			if (from.category.name !== to.category.name) {
				throw new Error(
					`Cannot convert between ${from.category.name} and ${to.category.name}: ${from.unit.display} is a ${from.category.name} unit and ${to.unit.display} is a ${to.category.name} unit.`,
				);
			}
			if (!Number.isFinite(params.value)) {
				throw new Error(`value must be finite; got ${params.value}.`);
			}

			const category = from.category;
			const value = params.value;
			const canonicalValue = toCanonical(from.unit, value);
			const result = fromCanonical(to.unit, canonicalValue);
			const gain = from.unit.factor / to.unit.factor;
			const formula = category.affine
				? affineFormula(from.unit, to.unit, gain)
				: `${to.unit.display} = ${from.unit.display} × ${formatNumber(gain)}`;
			const steps = [
				`${formatNumber(value)} ${from.unit.display} = ${formatNumber(canonicalValue)} ${category.base} (convert to the ${category.base} canonical base for ${category.name})`,
				`${formatNumber(canonicalValue)} ${category.base} = ${formatNumber(result)} ${to.unit.display} (convert to the target unit)`,
			];

			return {
				content: [
					{ type: "text", text: `${formatNumber(value)} ${from.unit.display} = ${formatNumber(result)} ${to.unit.display}` },
				],
				details: category.affine
					? {
						value,
						fromUnit: from.unit.display,
						toUnit: to.unit.display,
						fromCategory: from.category.name,
						toCategory: to.category.name,
						factor: null,
						formula,
						steps,
						result,
					}
					: {
						value,
						fromUnit: from.unit.display,
						toUnit: to.unit.display,
						fromCategory: from.category.name,
						toCategory: to.category.name,
						canonicalBase: category.base,
						canonicalValue,
						factor: gain,
						formula,
						steps,
						result,
					},
			};
		},
	});
}
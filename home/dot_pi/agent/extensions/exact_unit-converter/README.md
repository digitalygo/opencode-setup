# Unit converter extension for pi

Adds one global tool:

- `convert_units` (label "Convert Units"), converting a value between units of measurement

It is a pure local computation: no network access, no API key, no configuration, and no external dependencies.

## Tool

`convert_units` converts a numeric `value` from a source unit `from` to a target unit `to`. Parameters:

- `value` (number): the magnitude to convert
- `from` (string): the source unit
- `to` (string): the target unit

The tool returns the converted value, precisely formatted and including the target unit, plus a `details` object with the conversion factor and any intermediate steps. Temperature conversions use the correct offset formulas; they are not a simple multiplicative factor.

## Units

Unit lookup is case-insensitive and accepts common aliases. For example `KB`, `kB`, `kb`, and `Kb` all mean kilobyte. Kilobyte and kilobit are distinct: bits are always spelled with "bit", as in `kbit` and `Mbit`.

Supported categories:

- Data size: B, kB, MB, GB, TB, PB, KiB, MiB, GiB, TiB, PiB, bit, kbit, Mbit, Gbit, Tbit. Decimal bytes are powers of 10^3, binary bytes are powers of 2^10, and 1 byte = 8 bits.
- Length: mm, cm, m, km, in, ft, yd, mi, nmi
- Mass: mg, g, kg, t (metric tonne), oz, lb, st
- Temperature: C, F, K
- Volume: ml, l, m3, tsp, tbsp, fl oz (US), cup (US), pt (US), qt (US), gal (US), gal (imperial)
- Area: m2, km2, ha, ft2, acre, mi2
- Time: ms, s, min, h, day, week, year (365 days)
- Speed: m/s, km/h, mph, knot
- Data transfer rate: bit/s, kbit/s, Mbit/s, Gbit/s, B/s, kB/s, MB/s
- Energy: J, kJ, Wh, kWh, cal, kcal
- Power: W, kW, MW, hp (mechanical)
- Pressure: Pa, kPa, bar, atm, psi, mmHg
- Angle: deg, rad, grad

MB (10^6 bytes), MiB (2^20 bytes), and Mbit (10^6 bits) are three distinct units and are never conflated. For example, 1 MB to MiB is approximately 0.9537, not 1.

## Usage

Ask pi naturally, for example:

- `Convert 1 MB to B.`
- `What is 0 degrees Celsius in Fahrenheit?`

Results follow the format `value from = result to`, for example:

```text
1 MB = 1,000,000 B
1 MiB = 1,048,576 B
1 MB = 8 Mbit
0 C = 32 F
1 km = 0.621371192237 mi
1 MB = 0.953674316406 MiB
```

## Error handling

For an unknown unit, the tool returns a clear error naming the supported units in that category, or all categories when the unit is unrecognized. Converting between different categories is rejected.
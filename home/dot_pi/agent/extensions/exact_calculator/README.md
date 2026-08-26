# Calculator extension for pi

Adds a `calculator` tool that evaluates mathematical expressions with a hand-written parser instead of executing code.

## What it does

- Registers a `calculator` tool the model can call.
- Evaluates expressions such as `2 + 3 * 4` or `sqrt(2)^2` without `eval` or dynamic code execution.
- Returns a formatted numeric string plus the raw numeric result in the tool details.
- Rejects invalid expressions with a clear error message.

## Supported syntax

- Arithmetic operators `+ - * / % ^`.
- Parentheses and unary `+` and `-` signs.
- Constants `pi` and `e`, case-insensitive.
- Number literals including scientific notation such as `12.5`, `.5`, `1e3`, and `1.5e-2`.
- Functions, case-insensitive: `abs`, `sqrt`, `cbrt`, `exp`, `ln`, `log10`, `log` (one or two arguments), `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `floor`, `ceil`, `round` (one or two arguments), `min`, `max`, and `pow`.
- Trigonometric functions use radians.
- Precedence is conventional: `^` binds tightest and is right-associative, unary minus binds looser than `^`, then `* / %`, then `+ -`.

## Result formatting

- Zero renders as `0`, including negative zero.
- Integers below `1e17` render without a decimal point or exponent.
- Other values round to 16 significant digits, which hides common binary floating point artifacts such as `0.1 + 0.2` rendering as `0.3`.
- Values of magnitude `1e15` or greater, or smaller than `1e-9`, use scientific notation.

## Loading the extension

`/reload` activates the extension if it was not present at startup. A plain restart also loads it.

## Limitations

- Results use IEEE 754 double precision and may show floating point rounding, so the tool is not suitable for exact financial decimal arithmetic.
- Expressions are limited to 512 characters, 32 levels of nesting, and 128 operations.
- Exponent magnitudes are limited to 1000, and rounding precision is limited to 10 decimal places.

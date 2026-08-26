import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const MAX_LENGTH = 512;
const MAX_DEPTH = 32;
const MAX_OPERATIONS = 128;
const MAX_EXPONENT = 1000;
const MAX_ROUND_PRECISION = 10;

const SIGNIFICANT_DIGITS = 16;
const SCIENTIFIC_UPPER_BOUND = 1e15;
const SCIENTIFIC_LOWER_BOUND = 1e-9;
const INTEGER_FIXED_LIMIT = 1e17;

const CONSTANTS = new Map<string, number>([
	["pi", Math.PI],
	["e", Math.E],
]);

const FUNCTIONS = new Map<string, { min: number; max: number }>([
	["abs", { min: 1, max: 1 }],
	["sqrt", { min: 1, max: 1 }],
	["cbrt", { min: 1, max: 1 }],
	["exp", { min: 1, max: 1 }],
	["ln", { min: 1, max: 1 }],
	["log10", { min: 1, max: 1 }],
	["log", { min: 1, max: 2 }],
	["sin", { min: 1, max: 1 }],
	["cos", { min: 1, max: 1 }],
	["tan", { min: 1, max: 1 }],
	["asin", { min: 1, max: 1 }],
	["acos", { min: 1, max: 1 }],
	["atan", { min: 1, max: 1 }],
	["floor", { min: 1, max: 1 }],
	["ceil", { min: 1, max: 1 }],
	["round", { min: 1, max: 2 }],
	["min", { min: 2, max: Number.POSITIVE_INFINITY }],
	["max", { min: 2, max: Number.POSITIVE_INFINITY }],
	["pow", { min: 2, max: 2 }],
]);

function roundedMantissaAndExponent(value: number): [string, number] {
	const scientific = value.toExponential(SIGNIFICANT_DIGITS);
	const index = scientific.indexOf("e");
	const mantissa = scientific.slice(0, index);
	let exponent = parseInt(scientific.slice(index + 1), 10);
	const digits = mantissa.replace(".", "");
	let prefix = digits.slice(0, SIGNIFICANT_DIGITS);
	if (parseInt(digits[SIGNIFICANT_DIGITS], 10) >= 5) {
		prefix = (BigInt(prefix) + 1n).toString();
		if (prefix.length > SIGNIFICANT_DIGITS) {
			prefix = "1" + "0".repeat(SIGNIFICANT_DIGITS - 1);
			exponent++;
		}
	}
	return [prefix[0] + "." + prefix.slice(1), exponent];
}

function toFixed(mantissa: string, exponent: number): string {
	const digits = mantissa.replace(".", "").replace(/0+$/, "");
	const pointPosition = exponent + 1;
	if (pointPosition >= digits.length) {
		return digits + "0".repeat(pointPosition - digits.length);
	}
	if (pointPosition <= 0) {
		return "0." + "0".repeat(-pointPosition) + digits;
	}
	return digits.slice(0, pointPosition) + "." + digits.slice(pointPosition);
}

function toScientific(mantissa: string, exponent: number): string {
	return mantissa.replace(/0+$/, "").replace(/\.$/, "") + "e" + exponent;
}

function formatResult(value: number): string {
	if (value === 0) {
		return "0";
	}
	const negative = value < 0;
	const absolute = Math.abs(value);
	if (Math.floor(absolute) === absolute && absolute < INTEGER_FIXED_LIMIT) {
		return (negative ? "-" : "") + absolute.toString();
	}
	const [mantissa, exponent] = roundedMantissaAndExponent(absolute);
	const result =
		absolute >= SCIENTIFIC_UPPER_BOUND || absolute < SCIENTIFIC_LOWER_BOUND
			? toScientific(mantissa, exponent)
			: toFixed(mantissa, exponent);
	return negative ? "-" + result : result;
}

class ExpressionEvaluator {
	private source = "";
	private position = 0;
	private length = 0;
	private depth = 0;
	private operations = 0;

	evaluate(expression: string): number {
		if (expression.length > MAX_LENGTH) {
			throw new Error("Expression is too long.");
		}
		if (expression.trim() === "") {
			throw new Error("Expression cannot be empty.");
		}
		this.source = expression;
		this.position = 0;
		this.length = expression.length;
		this.depth = 0;
		this.operations = 0;
		const value = this.parseExpression();
		this.skipWhitespace();
		if (this.position < this.length) {
			throw new Error("Unexpected token in expression.");
		}
		return value;
	}

	private parseExpression(): number {
		let value = this.parseTerm();
		while (true) {
			this.skipWhitespace();
			const operator = this.peek();
			if (operator === "+") {
				this.position++;
				this.countOperation();
				value = this.checkFinite(value + this.parseTerm());
				continue;
			}
			if (operator === "-") {
				this.position++;
				this.countOperation();
				value = this.checkFinite(value - this.parseTerm());
				continue;
			}
			return value;
		}
	}

	private parseTerm(): number {
		let value = this.parseUnary();
		while (true) {
			this.skipWhitespace();
			const operator = this.peek();
			if (operator === "*") {
				this.position++;
				this.countOperation();
				value = this.checkFinite(value * this.parseUnary());
				continue;
			}
			if (operator === "/") {
				this.position++;
				this.countOperation();
				value = this.divide(value, this.parseUnary());
				continue;
			}
			if (operator === "%") {
				this.position++;
				this.countOperation();
				value = this.modulo(value, this.parseUnary());
				continue;
			}
			return value;
		}
	}

	private parseUnary(): number {
		this.skipWhitespace();
		const operator = this.peek();
		if (operator === "+" || operator === "-") {
			this.beginNesting();
			this.position++;
			this.countOperation();
			const operand = this.parseUnary();
			this.endNesting();
			return operator === "-" ? -operand : operand;
		}
		return this.parsePower();
	}

	private parsePower(): number {
		const base = this.parsePrimary();
		this.skipWhitespace();
		if (this.peek() === "^") {
			this.beginNesting();
			this.position++;
			this.countOperation();
			const exponent = this.parseUnary();
			this.endNesting();
			return this.power(base, exponent);
		}
		return base;
	}

	private parsePrimary(): number {
		this.skipWhitespace();
		const char = this.peek();
		if (char === "") {
			throw new Error("Unexpected end of expression.");
		}
		if (this.isDigit(char) || char === ".") {
			return this.parseNumber();
		}
		if (this.isLetter(char)) {
			return this.parseIdentifier();
		}
		if (char === "(") {
			this.beginNesting();
			this.position++;
			const value = this.parseExpression();
			this.skipWhitespace();
			if (this.peek() !== ")") {
				throw new Error("Missing closing parenthesis.");
			}
			this.position++;
			this.endNesting();
			return value;
		}
		throw new Error("Unexpected token in expression.");
	}

	private parseNumber(): number {
		const start = this.position;
		let hasDigits = false;
		let hasDot = false;
		while (this.position < this.length) {
			const char = this.source[this.position];
			if (this.isDigit(char)) {
				hasDigits = true;
				this.position++;
				continue;
			}
			if (char === ".") {
				if (hasDot) {
					throw new Error("Malformed number in expression.");
				}
				hasDot = true;
				this.position++;
				continue;
			}
			if (char === "e" || char === "E") {
				let exponentDigits = this.position + 1;
				if (
					exponentDigits < this.length &&
					(this.source[exponentDigits] === "+" || this.source[exponentDigits] === "-")
				) {
					exponentDigits++;
				}
				if (exponentDigits >= this.length || !this.isDigit(this.source[exponentDigits])) {
					break;
				}
				this.position++;
				if (
					this.position < this.length &&
					(this.source[this.position] === "+" || this.source[this.position] === "-")
				) {
					this.position++;
				}
				while (this.position < this.length && this.isDigit(this.source[this.position])) {
					this.position++;
				}
				break;
			}
			break;
		}
		if (!hasDigits) {
			throw new Error("Malformed number in expression.");
		}
		const literal = this.source.slice(start, this.position);
		const value = Number(literal);
		if (!Number.isFinite(value)) {
			throw new Error("Number out of range in expression.");
		}
		return value;
	}

	private parseIdentifier(): number {
		const start = this.position;
		while (this.position < this.length) {
			const char = this.source[this.position];
			if (!this.isLetter(char) && !this.isDigit(char)) {
				break;
			}
			this.position++;
		}
		const name = this.source.slice(start, this.position).toLowerCase();
		this.skipWhitespace();
		if (this.peek() === "(") {
			return this.parseFunctionCall(name);
		}
		if (CONSTANTS.has(name)) {
			return CONSTANTS.get(name)!;
		}
		throw new Error("Unknown identifier in expression.");
	}

	private parseFunctionCall(name: string): number {
		if (!FUNCTIONS.has(name)) {
			throw new Error("Unknown function in expression.");
		}
		this.beginNesting();
		this.position++;
		const args: number[] = [];
		this.skipWhitespace();
		if (this.peek() !== ")") {
			while (true) {
				args.push(this.parseExpression());
				this.skipWhitespace();
				if (this.peek() === ",") {
					this.position++;
					this.skipWhitespace();
					continue;
				}
				break;
			}
		}
		if (this.peek() !== ")") {
			throw new Error("Missing closing parenthesis.");
		}
		this.position++;
		this.endNesting();
		const arity = FUNCTIONS.get(name)!;
		const count = args.length;
		if (count < arity.min || count > arity.max) {
			throw new Error("Function argument count mismatch.");
		}
		this.countOperation();
		return this.applyFunction(name, args);
	}

	private applyFunction(name: string, args: number[]): number {
		for (const arg of args) {
			if (!Number.isFinite(arg)) {
				throw new Error("Invalid function domain.");
			}
		}
		const first = args[0];
		switch (name) {
			case "abs":
				return Math.abs(first);
			case "sqrt":
				return this.squareRoot(first);
			case "cbrt":
				return this.cubeRoot(first);
			case "exp":
				return this.checkFinite(Math.exp(first));
			case "ln":
				return this.logarithm(first, Math.E);
			case "log10":
				return this.logarithm(first, 10);
			case "log":
				return this.logarithm(first, args[1] ?? Math.E);
			case "sin":
				return Math.sin(first);
			case "cos":
				return Math.cos(first);
			case "tan":
				return Math.tan(first);
			case "asin":
				return this.arcSine(first);
			case "acos":
				return this.arcCosine(first);
			case "atan":
				return Math.atan(first);
			case "floor":
				return Math.floor(first);
			case "ceil":
				return Math.ceil(first);
			case "round":
				return this.round(first, args[1] ?? 0);
			case "min":
				return Math.min(...args);
			case "max":
				return Math.max(...args);
			case "pow":
				return this.power(first, args[1]);
		}
		throw new Error("Unknown function in expression.");
	}

	private squareRoot(value: number): number {
		this.requireNonNegative(value);
		return Math.sqrt(value);
	}

	private cubeRoot(value: number): number {
		if (value < 0) {
			return -((-value) ** (1 / 3));
		}
		return value ** (1 / 3);
	}

	private requireNonNegative(value: number): void {
		if (value < 0) {
			throw new Error("Invalid function domain.");
		}
	}

	private logarithm(value: number, base: number): number {
		if (value <= 0 || base <= 0 || base === 1) {
			throw new Error("Invalid function domain.");
		}
		return this.checkFinite(Math.log(value) / Math.log(base));
	}

	private arcSine(value: number): number {
		if (value < -1 || value > 1) {
			throw new Error("Invalid function domain.");
		}
		return Math.asin(value);
	}

	private arcCosine(value: number): number {
		if (value < -1 || value > 1) {
			throw new Error("Invalid function domain.");
		}
		return Math.acos(value);
	}

	private round(value: number, precision: number): number {
		if (precision !== Math.floor(precision)) {
			throw new Error("Round precision must be an integer.");
		}
		if (Math.abs(precision) > MAX_ROUND_PRECISION) {
			throw new Error("Round precision out of range.");
		}
		return Math.sign(value) * Math.round(Math.abs(value) * 10 ** precision) / 10 ** precision;
	}

	private power(base: number, exponent: number): number {
		if (Math.abs(exponent) > MAX_EXPONENT) {
			throw new Error("Exponent out of range.");
		}
		if (base === 0 && exponent < 0) {
			throw new Error("Division by zero.");
		}
		if (base < 0 && exponent !== Math.floor(exponent)) {
			throw new Error("Invalid function domain.");
		}
		return this.checkFinite(base ** exponent);
	}

	private divide(left: number, right: number): number {
		if (right === 0) {
			throw new Error("Division by zero.");
		}
		return this.checkFinite(left / right);
	}

	private modulo(left: number, right: number): number {
		if (right === 0) {
			throw new Error("Modulo by zero.");
		}
		return this.checkFinite(left % right);
	}

	private checkFinite(value: number): number {
		if (!Number.isFinite(value)) {
			throw new Error("Result is not a finite number.");
		}
		return value;
	}

	private countOperation(): void {
		this.operations++;
		if (this.operations > MAX_OPERATIONS) {
			throw new Error("Too many operations in expression.");
		}
	}

	private beginNesting(): void {
		this.depth++;
		if (this.depth > MAX_DEPTH) {
			throw new Error("Expression is too deeply nested.");
		}
	}

	private endNesting(): void {
		this.depth--;
	}

	private skipWhitespace(): void {
		while (this.position < this.length && this.isWhitespace(this.source[this.position])) {
			this.position++;
		}
	}

	private isWhitespace(char: string): boolean {
		return char === " " || char === "\t" || char === "\n" || char === "\r";
	}

	private peek(): string {
		if (this.position >= this.length) {
			return "";
		}
		return this.source[this.position];
	}

	private isDigit(char: string): boolean {
		return char >= "0" && char <= "9";
	}

	private isLetter(char: string): boolean {
		return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
	}
}

function evaluateExpression(expression: string): number {
	return new ExpressionEvaluator().evaluate(expression);
}

export function evaluate(expression: string): string {
	return formatResult(evaluateExpression(expression));
}

export default function calculatorExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "calculator",
		label: "Calculator",
		description:
			"Evaluate mathematical expressions reliably: arithmetic (+ - * / % ^), parentheses, unary signs, constants pi and e, and functions abs, sqrt, cbrt, exp, ln, log10, log, sin, cos, tan, asin, acos, atan, floor, ceil, round, min, max, pow. Results use IEEE 754 double precision and may have floating-point rounding, so do not use for exact financial-decimal arithmetic.",
		promptSnippet: "Evaluate a mathematical expression",
		promptGuidelines: [
			"Use calculator when the user asks for a numerical or mathematical calculation so the result is computed exactly instead of estimated.",
		],
		parameters: Type.Object({
			expression: Type.String({
				description: 'Mathematical expression to evaluate, e.g. "2 + 3 * 4" or "sqrt(2)^2"',
			}),
		}),
		async execute(_toolCallId, params) {
			const result = evaluateExpression(params.expression);
			return {
				content: [{ type: "text", text: formatResult(result) }],
				details: { expression: params.expression, result },
			};
		},
	});
}

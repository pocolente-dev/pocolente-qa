import { describe, it, expect } from "vitest";
import { shannonEntropy, isHighEntropySecret } from "../src/entropy.js";

describe("shannonEntropy", () => {
  it("returns 0 for empty string", () => {
    expect(shannonEntropy("")).toBe(0);
  });

  it("returns 0 for single-char repeated string", () => {
    expect(shannonEntropy("aaaaaaa")).toBe(0);
  });

  it("returns high entropy for random-looking strings", () => {
    expect(shannonEntropy("aB3kM9xZpQ2wF7jL5nR8")).toBeGreaterThan(4.0);
  });

  it("returns low entropy for natural English", () => {
    expect(shannonEntropy("hello world")).toBeLessThan(3.5);
  });
});

describe("isHighEntropySecret", () => {
  it("detects high-entropy string in assignment context", () => {
    const line = 'const token = "aB3kM9xZpQ2wF7jL5nR8vY4cE6hT1uI";';
    expect(isHighEntropySecret(line)).not.toBeNull();
    expect(isHighEntropySecret(line)!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("ignores strings shorter than 20 chars", () => {
    const line = 'const x = "short";';
    expect(isHighEntropySecret(line)).toBeNull();
  });

  it("ignores strings in comments", () => {
    const line = '// const token = "aB3kM9xZpQ2wF7jL5nR8vY4cE6hT1uI";';
    expect(isHighEntropySecret(line)).toBeNull();
  });

  it("ignores import paths", () => {
    const line = 'import { foo } from "@scope/very-long-package-name-here";';
    expect(isHighEntropySecret(line)).toBeNull();
  });

  it("ignores URLs without credentials", () => {
    const line = 'const url = "https://api.example.com/v1/long/path/here";';
    expect(isHighEntropySecret(line)).toBeNull();
  });

  it("detects high-entropy in object property", () => {
    const line = '  apiKey: "xK9mB2pL7wQ4vR8nF3jZ5cH1tY6uE0aG",';
    expect(isHighEntropySecret(line)).not.toBeNull();
  });
});

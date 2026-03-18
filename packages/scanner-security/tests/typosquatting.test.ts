import { describe, it, expect } from "vitest";
import { checkTyposquatting } from "../src/typosquatting.js";

describe("checkTyposquatting", () => {
  it("flags name with Levenshtein distance 1 from popular package", () => {
    const result = checkTyposquatting("lodas");
    expect(result).not.toBeNull();
    expect(result!.similarTo).toBe("lodash");
    expect(result!.distance).toBe(1);
  });

  it("flags name with Levenshtein distance 2", () => {
    const result = checkTyposquatting("exprss");
    expect(result).not.toBeNull();
    expect(result!.similarTo).toBe("express");
  });

  it("does NOT flag exact matches", () => {
    expect(checkTyposquatting("lodash")).toBeNull();
  });

  it("does NOT flag names with distance > 2", () => {
    expect(checkTyposquatting("completely-different-name")).toBeNull();
  });

  it("does NOT flag scoped packages", () => {
    expect(checkTyposquatting("@types/lodas")).toBeNull();
  });
});

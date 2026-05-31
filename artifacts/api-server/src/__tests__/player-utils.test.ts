import { describe, it, expect } from "vitest";
import { normName, slugVariants, similarity } from "../lib/player-utils.js";

describe("normName", () => {
  it("lowercases and strips accents", () => {
    expect(normName("Aurélien")).toBe("aurelien");
    expect(normName("Tchouaméni")).toBe("tchouameni");
  });

  it("removes non-alpha characters", () => {
    expect(normName("O'Brien")).toBe("obrien");
    expect(normName("Müller")).toBe("muller");
  });

  it("trims surrounding whitespace", () => {
    expect(normName("  Messi  ")).toBe("messi");
  });
});

describe("slugVariants", () => {
  it("returns forward and reversed variants for a two-word name", () => {
    const variants = slugVariants("Lionel Messi");
    expect(variants).toContain("lionel-messi");
    expect(variants).toContain("messi-lionel");
    expect(variants).toHaveLength(2);
  });

  it("strips accents and produces correct slugs", () => {
    const variants = slugVariants("Aurélien Tchouaméni");
    expect(variants).toContain("aurelien-tchouameni");
    expect(variants).toContain("tchouameni-aurelien");
  });

  it("adds first-last shorthand for names with more than two parts", () => {
    const variants = slugVariants("Vinicius Junior Santos");
    expect(variants).toContain("vinicius-junior-santos");
    expect(variants).toContain("santos-junior-vinicius");
    expect(variants).toContain("vinicius-santos");
    expect(variants).toHaveLength(3);
  });

  it("returns a single slug for a one-word name", () => {
    expect(slugVariants("Pelé")).toEqual(["pele"]);
  });

  it("deduplicates when reversed equals forward", () => {
    // "jean-jean" reversed is still "jean-jean"
    expect(slugVariants("Jean Jean")).toEqual(["jean-jean"]);
  });
});

describe("similarity", () => {
  it("returns 1.0 for identical names", () => {
    expect(similarity("Messi", "Messi")).toBe(1.0);
  });

  it("returns 1.0 regardless of accent differences", () => {
    expect(similarity("Aurélien Tchouaméni", "Aurelien Tchouameni")).toBe(1.0);
  });

  it("returns 1.0 for swapped word order", () => {
    expect(similarity("Lionel Messi", "Messi Lionel")).toBe(1.0);
  });

  it("returns partial score when only some words overlap", () => {
    // 1 shared word out of max(2, 1) = 2
    expect(similarity("Lionel Messi", "Lionel")).toBeCloseTo(0.5);
  });

  it("returns 0 for completely different names", () => {
    expect(similarity("Messi", "Ronaldo")).toBe(0);
  });

  it("ignores single-character words in scoring", () => {
    // "a" (length 1) is filtered; only "silva" counts on both sides
    expect(similarity("A Silva", "Silva")).toBe(1.0);
  });
});

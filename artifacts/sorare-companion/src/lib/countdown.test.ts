import { describe, it, expect } from "vitest";
import { computeCountdown } from "./countdown";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

describe("computeCountdown", () => {
  it("returns past:true when target equals now", () => {
    const result = computeCountdown(1000, 1000);
    expect(result.past).toBe(true);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
  });

  it("returns past:true when target is in the past", () => {
    const result = computeCountdown(500, 1000);
    expect(result.past).toBe(true);
  });

  it("returns correct days/hours/minutes/seconds for a future target", () => {
    const now = 0;
    const target = 2 * DAY + 3 * HOUR + 4 * 60 * 1000 + 5 * 1000;
    const result = computeCountdown(target, now);
    expect(result.past).toBe(false);
    if (!result.past) {
      expect(result.days).toBe(2);
      expect(result.hours).toBe(3);
      expect(result.minutes).toBe(4);
      expect(result.seconds).toBe(5);
    }
  });

  it("truncates sub-second remainder", () => {
    const result = computeCountdown(1999, 0);
    expect(result.past).toBe(false);
    if (!result.past) {
      expect(result.seconds).toBe(1);
    }
  });

  it("handles exactly one second remaining", () => {
    const result = computeCountdown(1000, 0);
    expect(result.past).toBe(false);
    if (!result.past) {
      expect(result.seconds).toBe(1);
      expect(result.minutes).toBe(0);
    }
  });

  it("rolls hours correctly within a day", () => {
    const result = computeCountdown(23 * HOUR + 59 * 60 * 1000 + 59 * 1000, 0);
    expect(result.past).toBe(false);
    if (!result.past) {
      expect(result.days).toBe(0);
      expect(result.hours).toBe(23);
      expect(result.minutes).toBe(59);
      expect(result.seconds).toBe(59);
    }
  });
});

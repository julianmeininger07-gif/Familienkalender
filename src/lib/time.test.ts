import { describe, expect, it } from "vitest";
import { berlinToUtc, utcToBerlin } from "./time";

describe("Berliner Zeit", () => {
  it("Winterzeit (UTC+1)", () => {
    expect(berlinToUtc("2027-01-15", "10:00").toISOString()).toBe("2027-01-15T09:00:00.000Z");
  });
  it("Sommerzeit (UTC+2)", () => {
    expect(berlinToUtc("2027-07-15", "10:00").toISOString()).toBe("2027-07-15T08:00:00.000Z");
  });
  it("Mitternacht am Tag der Umstellung", () => {
    expect(berlinToUtc("2027-03-28", "00:00").toISOString()).toBe("2027-03-27T23:00:00.000Z");
    expect(berlinToUtc("2027-03-28", "12:00").toISOString()).toBe("2027-03-28T10:00:00.000Z");
  });
  it("hin und zurück", () => {
    expect(utcToBerlin(new Date("2027-12-31T23:30:00Z"))).toEqual({ date: "2028-01-01", time: "00:30" });
  });
});

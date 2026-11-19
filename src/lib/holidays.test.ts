import { describe, expect, it } from "vitest";
import { bavarianHolidays, bussUndBettag, easterSunday, holidaysBetween } from "./holidays";
import { isoWeek } from "./dates";

describe("Ostern", () => {
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
    [2030, "2030-04-21"],
    [2038, "2038-04-25"],
  ])("%i: %s", (year, date) => expect(easterSunday(year)).toBe(date));
});

describe("Feiertage Bayern 2027", () => {
  const byName = Object.fromEntries(bavarianHolidays(2027).map((h) => [h.name, h.date]));
  it("bewegliche Feiertage", () => {
    expect(byName["Karfreitag"]).toBe("2027-03-26");
    expect(byName["Ostermontag"]).toBe("2027-03-29");
    expect(byName["Christi Himmelfahrt"]).toBe("2027-05-06");
    expect(byName["Pfingstmontag"]).toBe("2027-05-17");
    expect(byName["Fronleichnam"]).toBe("2027-05-27");
  });
  it("feste Feiertage und kein Friedensfest", () => {
    expect(byName["Heilige Drei Könige"]).toBe("2027-01-06");
    expect(byName["Mariä Himmelfahrt"]).toBe("2027-08-15");
    expect(byName["Allerheiligen"]).toBe("2027-11-01");
    expect(Object.values(byName)).not.toContain("2027-08-08");
  });
});

describe("Buß- und Bettag", () => {
  it.each([
    [2026, "2026-11-18"],
    [2027, "2027-11-17"],
    [2028, "2028-11-22"],
  ])("%i: %s", (year, date) => expect(bussUndBettag(year)).toBe(date));
});

it("Zeitraum über den Jahreswechsel", () => {
  expect(holidaysBetween("2026-12-20", "2027-01-10").map((h) => h.name)).toEqual([
    "1. Weihnachtstag",
    "2. Weihnachtstag",
    "Neujahr",
    "Heilige Drei Könige",
  ]);
});

it("Kalenderwoche", () => {
  expect(isoWeek("2027-01-01")).toBe(53);
  expect(isoWeek("2027-01-04")).toBe(1);
});

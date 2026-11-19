import { describe, expect, it } from "vitest";
import { describeRule, expand, formatRule, parseRule, seriesEnd } from "./recurrence";
import { berlinToUtc, utcToBerlin } from "./time";

const local = (d: Date) => {
  const b = utcToBerlin(d);
  return `${b.date} ${b.time}`;
};

describe("Wiederholungen", () => {
  it("Regel hin und zurück", () => {
    const r = { freq: "WEEKLY" as const, interval: 2, until: "2027-12-31" };
    expect(formatRule(r)).toBe("FREQ=WEEKLY;INTERVAL=2;UNTIL=20271231");
    expect(parseRule(formatRule(r))).toEqual(r);
    expect(describeRule(r)).toBe("alle 2 Wochen, bis 31.12.2027");
  });

  it("wöchentlich bleibt über die Zeitumstellung um 18 Uhr", () => {
    const ev = { startsAt: berlinToUtc("2027-03-15", "18:00"), endsAt: berlinToUtc("2027-03-15", "19:00"), allDay: false };
    const occ = expand(ev, { freq: "WEEKLY", interval: 1 }, berlinToUtc("2027-03-01"), berlinToUtc("2027-04-10"));
    expect(occ.map((o) => local(o.startsAt))).toEqual([
      "2027-03-15 18:00",
      "2027-03-22 18:00",
      "2027-03-29 18:00",
      "2027-04-05 18:00",
    ]);
    expect(occ.every((o) => o.endsAt.getTime() - o.startsAt.getTime() === 3600000)).toBe(true);
  });

  it("monatlich am 31. überspringt kurze Monate", () => {
    const ev = { startsAt: berlinToUtc("2027-01-31", "09:00"), endsAt: berlinToUtc("2027-01-31", "10:00"), allDay: false };
    const occ = expand(ev, { freq: "MONTHLY", interval: 1, count: 4 }, berlinToUtc("2027-01-01"), berlinToUtc("2028-01-01"));
    expect(occ.map((o) => local(o.startsAt).slice(0, 10))).toEqual(["2027-01-31", "2027-03-31", "2027-05-31", "2027-07-31"]);
  });

  it("jährlicher Geburtstag (ganztägig)", () => {
    const ev = { startsAt: berlinToUtc("1950-06-12"), endsAt: berlinToUtc("1950-06-13"), allDay: true };
    const occ = expand(ev, { freq: "YEARLY", interval: 1 }, berlinToUtc("2027-01-01"), berlinToUtc("2028-01-01"));
    expect(occ).toHaveLength(1);
    expect(local(occ[0].startsAt)).toBe("2027-06-12 00:00");
    expect(local(occ[0].endsAt)).toBe("2027-06-13 00:00");
  });

  it("Anzahl und Serienende", () => {
    const ev = { startsAt: berlinToUtc("2027-05-03", "08:00"), endsAt: berlinToUtc("2027-05-03", "09:00"), allDay: false };
    const rule = { freq: "DAILY" as const, interval: 1, count: 5 };
    expect(local(seriesEnd(ev, rule)!)).toBe("2027-05-07 09:00");
    expect(seriesEnd(ev, { freq: "DAILY", interval: 1 })).toBeNull();
  });

  it("nur Vorkommen im Zeitraum", () => {
    const ev = { startsAt: berlinToUtc("2027-01-04", "08:00"), endsAt: berlinToUtc("2027-01-04", "09:00"), allDay: false };
    const occ = expand(ev, { freq: "DAILY", interval: 1 }, berlinToUtc("2027-06-01"), berlinToUtc("2027-06-03"));
    expect(occ.map((o) => local(o.startsAt))).toEqual(["2027-06-01 08:00", "2027-06-02 08:00"]);
  });
});

it("tägliche Serie weit in der Zukunft", () => {
  const ev = { startsAt: berlinToUtc("2027-01-04", "08:00"), endsAt: berlinToUtc("2027-01-04", "09:00"), allDay: false };
  const occ = expand(ev, { freq: "DAILY", interval: 1 }, berlinToUtc("2045-06-01"), berlinToUtc("2045-06-02"));
  expect(occ.map((o) => utcToBerlin(o.startsAt))).toEqual([{ date: "2045-06-01", time: "08:00" }]);
  const counted = expand(ev, { freq: "DAILY", interval: 1, count: 10 }, berlinToUtc("2027-01-10"), berlinToUtc("2027-02-01"));
  expect(counted.map((o) => utcToBerlin(o.startsAt).date)).toEqual(["2027-01-10", "2027-01-11", "2027-01-12", "2027-01-13"]);
});

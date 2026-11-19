/**
 * Schulferien Bayern (erster und letzter Ferientag, jeweils inklusive).
 * Quellen: KMK-Ferienkalender (Schuljahr 2026/27, Stand 09.10.2025) und die Ferientermine des
 * Bayerischen Kultusministeriums (Schuljahr 2027/28). Weitere Jahre pflegt der Admin in der App.
 */
export const DEFAULT_SCHOOL_HOLIDAYS: { name: string; startDate: string; endDate: string; schoolYear: string }[] = [
  // Schuljahr 2026/27
  { schoolYear: "2026/27", name: "Herbstferien", startDate: "2026-11-02", endDate: "2026-11-06" },
  { schoolYear: "2026/27", name: "Buß- und Bettag", startDate: "2026-11-18", endDate: "2026-11-18" },
  { schoolYear: "2026/27", name: "Weihnachtsferien", startDate: "2026-12-24", endDate: "2027-01-08" },
  { schoolYear: "2026/27", name: "Frühjahrsferien", startDate: "2027-02-08", endDate: "2027-02-12" },
  { schoolYear: "2026/27", name: "Osterferien", startDate: "2027-03-22", endDate: "2027-04-02" },
  { schoolYear: "2026/27", name: "Pfingstferien", startDate: "2027-05-18", endDate: "2027-05-28" },
  { schoolYear: "2026/27", name: "Sommerferien", startDate: "2027-08-02", endDate: "2027-09-13" },
  // Schuljahr 2027/28
  { schoolYear: "2027/28", name: "Herbstferien", startDate: "2027-11-02", endDate: "2027-11-05" },
  { schoolYear: "2027/28", name: "Buß- und Bettag", startDate: "2027-11-17", endDate: "2027-11-17" },
  { schoolYear: "2027/28", name: "Weihnachtsferien", startDate: "2027-12-24", endDate: "2028-01-07" },
  { schoolYear: "2027/28", name: "Frühjahrsferien", startDate: "2028-02-28", endDate: "2028-03-03" },
  { schoolYear: "2027/28", name: "Osterferien", startDate: "2028-04-10", endDate: "2028-04-21" },
  { schoolYear: "2027/28", name: "Pfingstferien", startDate: "2028-06-06", endDate: "2028-06-16" },
  { schoolYear: "2027/28", name: "Sommerferien", startDate: "2028-07-31", endDate: "2028-09-11" },
];

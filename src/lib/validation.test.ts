import { describe, expect, it } from "vitest";
import { acceptInvitationSchema, inviteSchema, loginSchema } from "./validation";

describe("Formular-Prüfung", () => {
  it("normalisiert E-Mail-Adressen auf Kleinbuchstaben", () => {
    const r = loginSchema.parse({ email: "  Oma@Example.COM ", password: "x" });
    expect(r.email).toBe("oma@example.com");
  });

  it("verlangt gleiche Passwörter", () => {
    const r = acceptInvitationSchema.safeParse({
      name: "Oma",
      email: "oma@example.com",
      password: "kuchen123",
      passwordRepeat: "kuchen124",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Die Passwörter stimmen nicht überein.");
  });

  it("lehnt zu kurze Passwörter ab", () => {
    const r = acceptInvitationSchema.safeParse({ name: "Oma", email: "o@e.de", password: "kurz", passwordRepeat: "kurz" });
    expect(r.success).toBe(false);
  });

  it("erlaubt Einladungen ohne E-Mail", () => {
    const r = inviteSchema.parse({ name: "Opa", email: "", role: "reader" });
    expect(r.email).toBeNull();
  });

  it("lehnt unbekannte Rollen ab", () => {
    expect(inviteSchema.safeParse({ name: "Opa", email: "", role: "superuser" }).success).toBe(false);
  });
});

import { schoolHolidaySchema, schoolYearOf } from "./validation";

describe("Schulferien", () => {
  it("Schuljahr aus Datum", () => {
    expect(schoolYearOf("2026-11-02")).toBe("2026/27");
    expect(schoolYearOf("2027-05-18")).toBe("2026/27");
    expect(schoolYearOf("2027-08-02")).toBe("2027/28");
  });
  it("Ende vor Beginn wird abgelehnt", () => {
    expect(schoolHolidaySchema.safeParse({ name: "X", startDate: "2027-05-10", endDate: "2027-05-01" }).success).toBe(false);
  });
});

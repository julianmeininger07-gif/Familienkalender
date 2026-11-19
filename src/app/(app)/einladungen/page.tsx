import Link from "next/link";
import { respondToEvent } from "@/actions/events";
import { SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatEventTime } from "@/lib/format";
import { myInvitations } from "@/lib/invitations";
import { describeRule, parseRule } from "@/lib/recurrence";

export const metadata = { title: "Einladungen · Familienkalender" };

export default async function InvitationsPage() {
  const me = await requireUser();
  const all = await myInvitations(me.id);
  const open = all.filter((i) => i.required && i.response === "pending");
  const rest = all.filter((i) => !(i.required && i.response === "pending"));

  const Item = ({ i, actions }: { i: (typeof all)[number]; actions: boolean }) => {
    const rule = i.rrule ? parseRule(i.rrule) : null;
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={`/termin/${i.eventId}`} className="min-w-0">
          <span className="block font-semibold">{i.title}</span>
          <span className="block text-sm text-gray-600">
            {formatEventTime(i)}
            {rule && ` · 🔁 ${describeRule(rule)}`}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="h-2 w-2 rounded-full" style={{ background: i.ownerColor }} /> von {i.ownerName}
            {!actions && i.response !== "pending" && ` · ${i.response === "accepted" ? "zugesagt" : "abgesagt"}`}
            {!actions && i.response === "pending" && " · zur Info"}
          </span>
        </Link>
        {actions && (
          <div className="flex gap-2">
            <form action={respondToEvent.bind(null, i.eventId, "accepted", "/einladungen")}>
              <SubmitButton variant="secondary">✓ Zusagen</SubmitButton>
            </form>
            <form action={respondToEvent.bind(null, i.eventId, "declined", "/einladungen")}>
              <SubmitButton variant="secondary">✗ Absagen</SubmitButton>
            </form>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <h2 className="mb-3 text-xl font-semibold">Warten auf deine Antwort</h2>
        {open.length === 0 ? (
          <p className="text-sm text-gray-500">Keine offenen Einladungen. 🎉</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-ferien-soft/40">
            {open.map((i) => (
              <Item key={i.eventId} i={i} actions />
            ))}
          </ul>
        )}
      </section>
      {rest.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Weitere Termine, zu denen du eingeladen bist</h2>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
            {rest.map((i) => (
              <Item key={i.eventId} i={i} actions={false} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

import { CalendarView } from "@/components/calendar/calendar-view";
import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/events";
import { activePeople, allCategories, filtersFor } from "@/lib/people";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ datum?: string }> }) {
  const user = await requireUser();
  const { datum } = await searchParams;
  const [people, categories, filters] = await Promise.all([activePeople(), allCategories(), filtersFor(user)]);
  return (
    <CalendarView
      people={people}
      categories={categories}
      initialFilters={filters}
      canCreate={canCreate(user)}
      initialDate={datum && /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : undefined}
    />
  );
}

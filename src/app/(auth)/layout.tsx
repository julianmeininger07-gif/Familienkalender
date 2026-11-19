// Alle Seiten lesen die Datenbank, nichts davon darf beim Build vorgerendert werden.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-ferien text-xl font-bold">
          27
        </div>
        <h1 className="text-2xl font-bold">Familienkalender</h1>
      </div>
      {children}
    </main>
  );
}

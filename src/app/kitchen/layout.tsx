import { logout } from "@/app/actions";
import { requireRole } from "@/lib/guards";

export default async function KitchenLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireRole("KITCHEN", "MANAGER");
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="sticky top-0 z-10 border-b border-gray-700 bg-gray-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="font-bold">
            کافه آنوش{" "}
            <span className="text-xs font-normal text-gray-400">
              · آشپزخانه / Kitchen · {session.name}
            </span>
          </div>
          <form action={logout}>
            <button className="text-sm text-gray-300">خروج / Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

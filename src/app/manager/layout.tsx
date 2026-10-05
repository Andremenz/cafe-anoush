import { logout } from "@/app/actions";
import { requireRole } from "@/lib/guards";

export default async function ManagerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireRole("MANAGER");
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="font-bold">
            کافه آنوش{" "}
            <span className="text-xs font-normal text-gray-500">
              · مدیریت / Manager · {session.name}
            </span>
          </div>
          <form action={logout}>
            <button className="text-sm text-gray-600">خروج / Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

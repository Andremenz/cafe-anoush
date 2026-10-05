"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-bold">کافه آنوش</h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Café Anoush — ورود پرسنل / Staff login
        </p>
        {state?.error && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="staffCode" className="block text-sm font-medium">
              کد پرسنلی / Staff code
            </label>
            <input
              id="staffCode"
              name="staffCode"
              autoComplete="username"
              required
              maxLength={32}
              className="mt-1 w-full rounded-md border border-gray-300 p-2"
              placeholder="W-101"
            />
          </div>
          <div>
            <label htmlFor="pin" className="block text-sm font-medium">
              پین / PIN
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              required
              inputMode="numeric"
              pattern="[0-9]{4}"
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-gray-300 p-2"
              placeholder="1234"
            />
          </div>
          <button
            disabled={pending}
            className="w-full rounded-md bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? "…" : "ورود / Sign in"}
          </button>
        </form>
        <div className="mt-6 space-y-1 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
          <p className="font-semibold text-gray-700">Demo accounts (PIN 1234):</p>
          <p>W-101 Waiter · K-201 Kitchen · C-301 Cashier · M-001 Manager (Café Anoush)</p>
          <p>S-901 Waiter (Kababi Salar — isolation demo)</p>
        </div>
      </div>
    </main>
  );
}

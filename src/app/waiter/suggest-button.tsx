"use client";

import { useState } from "react";
import { ActionForm } from "@/app/action-form";
import { addItem, getSuggestions } from "@/app/waiter/actions";
import { toman } from "@/lib/money";

type Suggestion = { id: string; nameFa: string; priceToman: number };

export function SuggestButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    try {
      const result = await getSuggestions(orderId);
      setItems(result.items);
      setNotice(result.notice);
    } catch (error) {
      console.error("Could not load smart add-on suggestions.", error);
      setNotice("Suggestions are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded border border-purple-300 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 disabled:opacity-50"
      >
        {loading ? "…" : "✦ پیشنهاد هوشمند / Smart add-ons"}
      </button>
      {notice && <p className="mt-1 text-xs text-gray-500">{notice}</p>}
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <ActionForm key={item.id} action={addItem} className="inline-flex">
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="menuItemId" value={item.id} />
              <button className="rounded bg-purple-600 px-2 py-1 text-xs text-white">
                + {item.nameFa} · {toman(item.priceToman)}
              </button>
            </ActionForm>
          ))}
        </div>
      )}
    </div>
  );
}

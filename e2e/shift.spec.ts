import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function login(ctx: BrowserContext, code: string): Promise<Page> {
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("W-101").fill(code);
  await page.getByPlaceholder("1234").fill("1234");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  return page;
}

test("full shift: waiter → kitchen → cashier, live across stations", async ({
  browser,
}) => {
  const waiterContext = await browser.newContext();
  const kitchenContext = await browser.newContext();
  const cashierContext = await browser.newContext();

  try {
    const waiter = await login(waiterContext, "W-101");
    const kitchen = await login(kitchenContext, "K-201");
    const cashier = await login(cashierContext, "C-301");

    await waiter.goto("/waiter");
    await waiter.getByRole("button", { name: /New order/ }).first().click();
    await expect(waiter).toHaveURL(/\/waiter\/orders\//, { timeout: 20_000 });
    const heading = await waiter.locator("h1").first().innerText();
    const label = heading.match(/Table\s+(\S+)/)?.[1];
    expect(label).toBeTruthy();
    await waiter
      .locator("form")
      .filter({ hasText: "Chelo Kabab Koobideh" })
      .getByRole("button")
      .first()
      .click();
    await waiter
      .locator("form")
      .filter({ hasText: "Doogh" })
      .getByRole("button")
      .first()
      .click();

    await kitchen.goto("/kitchen");
    const card = kitchen
      .locator(".rounded-lg.border")
      .filter({ hasText: `Table ${label} ` })
      .filter({ hasText: "Chelo Kabab Koobideh" })
      .first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByRole("button", { name: /Start/ }).click();
    await expect(
      card.getByRole("button", { name: /Ready/ }),
    ).toBeVisible({ timeout: 15_000 });
    await card.getByRole("button", { name: /Ready/ }).click();

    await waiter.bringToFront();
    await expect(waiter.getByText("READY", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await waiter.getByRole("button", { name: /Served/ }).first().click();
    await waiter.getByRole("button", { name: /Request bill/ }).click();

    const billLink = cashier.getByRole("link", {
      name: new RegExp(`Table\\s+${label}(?!\\d)`),
    });
    await cashier.goto("/cashier");
    await cashier.bringToFront();
    await expect(billLink).toBeVisible({ timeout: 15_000 });
    const billHref = await billLink.getAttribute("href");
    if (!billHref) throw new Error("The selected bill has no link.");
    const selectedOrderId = new URL(
      billHref,
      "http://127.0.0.1:3000",
    ).searchParams.get("order");
    if (!selectedOrderId) throw new Error("The selected bill link has no order ID.");
    await billLink.click();
    await expect(cashier).toHaveURL(
      new RegExp(`[?&]order=${selectedOrderId}(?:&|$)`),
      { timeout: 15_000 },
    );
    const paymentForm = cashier
      .locator("form")
      .filter({ hasText: "POS card" });
    await expect(paymentForm.locator('input[name="orderId"]')).toHaveValue(
      selectedOrderId!,
    );
    const responsePromise = cashier.waitForResponse(
      (response) => response.request().method() === "POST",
    );
    await paymentForm.getByRole("button").first().click();
    const paymentResponse = await responsePromise;
    expect(paymentResponse.ok()).toBeTruthy();
    await expect(paymentForm).toHaveAttribute("aria-busy", "false");
    await expect(billLink).toHaveCount(0, { timeout: 15_000 });
    await kitchen.bringToFront();
    await expect(card).toHaveCount(0, { timeout: 15_000 });
  } finally {
    await Promise.all([
      waiterContext.close(),
      kitchenContext.close(),
      cashierContext.close(),
    ]);
  }
});

test("cross-tenant: Kababi Salar staff cannot open Café Anoush orders", async ({
  browser,
}) => {
  const anoushContext = await browser.newContext();
  const intruderContext = await browser.newContext();

  try {
    const anoush = await login(anoushContext, "W-101");
    await anoush.goto("/waiter");
    if ((await anoush.locator('a[href*="/waiter/orders/"]').count()) === 0) {
      await anoush.getByRole("button", { name: /New order/ }).first().click();
    } else {
      await anoush.locator('a[href*="/waiter/orders/"]').first().click();
    }
    await expect(anoush).toHaveURL(/\/waiter\/orders\//, { timeout: 20_000 });
    const url = anoush.url();

    const intruder = await login(intruderContext, "S-901");
    await intruder.goto(url);
    await expect(intruder.getByText("404", { exact: true })).toBeVisible();
  } finally {
    await Promise.all([anoushContext.close(), intruderContext.close()]);
  }
});

import { expect, test, type Page } from "@playwright/test";

/**
 * The live path at the venue: the operator taps plates and saves, the TV (a second window on the
 * same device, reading the same IndexedDB) follows without a server in between.
 */

/** Fails the test on any uncaught error or console error in the page. */
function watchErrors(page: Page, errors: string[]) {
  page.on("pageerror", (err) => errors.push(`${page.url()}: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${page.url()}: ${msg.text()}`);
  });
}

async function openDemoInRound1(page: Page) {
  await page.goto("/operator/live?c=demo");
  await expect(page.getByText("Demowedstrijd · demo")).toBeVisible();
  await page.getByRole("radio", { name: "Ronde 1" }).click();
  await page.getByRole("button", { name: "Scoren", exact: true }).click();
  await expect(page.getByText("Junior · ronde 1 · beurt 1")).toBeVisible();
}

const knockdown = (page: Page, kd: number) => page.getByRole("group", { name: new RegExp(`^Knockdown ${kd}:`) });

test("taps, saves and undo reach the TV", async ({ context, page }) => {
  const errors: string[] = [];
  watchErrors(page, errors);
  await openDemoInRound1(page);

  const tv = await context.newPage();
  watchErrors(tv, errors);
  await tv.goto("/tv?c=demo");
  const line = tv.locator("section", { hasText: "Nu aan de lijn" });
  await expect(line).toContainText("Lotte D.");
  await expect(line).toContainText("Noor W.");

  // Unsaved taps already show on the TV.
  await knockdown(page, 1).getByRole("button", { name: "Links 3 (3 ptn)" }).click();
  await knockdown(page, 1).getByRole("button", { name: "Midden 10 (10 ptn)" }).click();
  await knockdown(page, 2).getByRole("button", { name: "Midden 6 (6 ptn)" }).click();
  await expect(line).toContainText("totaal 13");
  await expect(line).toContainText("totaal 6");

  // Save: the pair swaps knockdowns, on the operator screen and on the TV.
  await page.getByRole("button", { name: /Opslaan & wisselen/ }).click();
  await expect(page.getByText("Fase 2 van 2")).toBeVisible();
  await expect(line).toContainText("gewisseld");
  await expect(knockdown(page, 1)).toContainText("Noor Wouters");

  // Undo: back to phase 1 with the taps as drafts, so only the mistake needs fixing.
  await page.getByRole("button", { name: /Ongedaan maken/ }).click();
  await expect(page.getByText("Fase 1 van 2")).toBeVisible();
  await expect(page.getByRole("button", { name: /Ongedaan maken/ })).toHaveCount(0);
  await expect(line).not.toContainText("gewisseld");
  await expect(knockdown(page, 1)).toContainText("13");
  await expect(line).toContainText("totaal 13");

  // Fix one plate and save again.
  await knockdown(page, 1).getByRole("button", { name: "Midden 10 (10 ptn)" }).click();
  await expect(line).toContainText("totaal 3");
  await page.getByRole("button", { name: /Opslaan & wisselen/ }).click();
  await expect(page.getByText("Fase 2 van 2")).toBeVisible();
  await expect(tv.locator("section", { hasText: "Voorlopige stand" })).toContainText("6");

  expect(errors).toEqual([]);
});

test("undo survives a reload and works with the keyboard", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcut");
  await openDemoInRound1(page);
  // Keys only work when no button has the focus (Enter on a focused button presses that button).
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("1");
  await expect(knockdown(page, 1).getByRole("button", { name: "Links 3 (3 ptn), geraakt" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Fase 2 van 2")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Scoren", exact: true }).click();
  await expect(page.getByRole("button", { name: /Ongedaan maken/ })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByText("Fase 1 van 2")).toBeVisible();
  await expect(knockdown(page, 1).getByRole("button", { name: "Links 3 (3 ptn), geraakt" })).toBeVisible();
});

test("on a touchscreen every operator control is at least 44px", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch layout only");
  await openDemoInRound1(page);
  for (const tab of ["Scoren", "Inschrijving", "Volgorde", "Stand", "Afkamping", "Afronden", "Voorbereiden"]) {
    await page.getByRole("button", { name: tab, exact: false }).first().click();
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".touch-targets :is(button, a[href], [role=radio], select, input:not([type=checkbox]):not([type=radio]))")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ el: (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30), r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width < 43.5 || r.height < 43.5)
        .map(({ el, r }) => `${el} ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    expect(small, tab).toEqual([]);
  }
  // Keyboard hints are for laptops only.
  await page.getByRole("button", { name: "Scoren", exact: true }).click();
  await expect(page.getByText("Enter opslaan")).toBeHidden();
  await expect(knockdown(page, 2)).toContainText("tik een plaat");
});

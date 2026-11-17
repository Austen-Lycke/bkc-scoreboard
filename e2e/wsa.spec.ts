import { expect, test, type Page } from "@playwright/test";

/**
 * A WSA day on the WSA demo: Junior and Volwassenen on the line, the line running ahead of the
 * scorecards (typed in Kaarten), the series countdown and the warmup on the TV, then the semi-final,
 * the final and the podium.
 */

function watchErrors(page: Page, errors: string[]) {
  page.on("pageerror", (err) => errors.push(`${page.url()}: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${page.url()}: ${msg.text()}`);
  });
}

/** The beurt on the line (Scoren). */
const heading = (page: Page) => page.locator("main").getByText(/ · (ronde \d|halve finale|finale · reeks \d) · beurt \d+$/);
/** The beurt whose cards are being typed (Kaarten). */
const cardsTitle = (page: Page) => page.locator("main h2");
const cells = (page: Page) => page.locator("main input[inputmode=numeric]");
const tab = (page: Page, name: string) => page.locator("nav").getByRole("button", { name: new RegExp(`^${name}`) });

async function openWsaInRound1(page: Page) {
  await page.goto("/operator/live?c=demo-wsa");
  await expect(page.getByText("Demowedstrijd WSA · demo")).toBeVisible();
  await page.getByLabel("Fase").selectOption({ label: "Ronde 1" });
  await tab(page, "Scoren").click();
  await expect(page.getByText("Junior · ronde 1 · beurt 1")).toBeVisible();
}

/** A part of the day is done (round 1, the qualification, the semi-final): go straight on. */
async function goOnIfAsked(page: Page) {
  const goOn = page.getByRole("button", { name: /^Meteen door met / });
  await expect(heading(page).or(goOn)).toBeVisible();
  if (await goOn.isVisible()) {
    await goOn.click();
    await expect(heading(page)).toBeVisible();
  }
}

/**
 * On Kaarten: types every card of the beurt shown with the keyboard (Enter to the next cell, Enter on
 * the last one saves). Round 1 (2·4·6·8·10) gives every row its own score, so nobody ties; later all
 * 10s. Returns how many cells there were.
 */
async function typeCards(page: Page) {
  const title = await cardsTitle(page).innerText();
  const series = /finale · reeks/.test(title) ? 1 : 2;
  const n = await cells(page).count();
  await cells(page).first().focus();
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / series);
    const value = / ronde 1 /.test(title) ? (i % series === 0 ? 2 * (row + 1) : 2) : 10;
    await page.keyboard.type(String(value));
    await page.keyboard.press("Enter");
  }
  // Read in one step: the title goes once the last open beurt is in.
  await expect.poll(async () => (await cardsTitle(page).allInnerTexts())[0] ?? "done").not.toBe(title);
  return n;
}

/** The beurt on the line shoots, its cards get typed right after it, and the line follows. Returns the number of cells. */
async function shootHeat(page: Page) {
  await goOnIfAsked(page);
  const title = await heading(page).innerText();
  await tab(page, "Kaarten").click();
  await expect(cardsTitle(page)).toHaveText(title);
  const n = await typeCards(page);
  await tab(page, "Scoren").click();
  await expect.poll(async () => (await heading(page).allInnerTexts())[0] ?? "done").not.toBe(title);
  return n;
}

/** A tab, or Volgorde: the second part of Inschrijving. */
async function openView(page: Page, name: string) {
  if (name === "Volgorde") {
    await tab(page, "Inschrijving").click();
    await page.getByRole("tab", { name: "Volgorde" }).click();
  } else await page.getByRole("button", { name, exact: false }).first().click();
}

test("the line runs ahead of the cards; the TV shows saved scores only; a typo is refused; save and undo", async ({ context, page }) => {
  const errors: string[] = [];
  watchErrors(page, errors);
  await openWsaInRound1(page);

  const tv = await context.newPage();
  watchErrors(tv, errors);
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto("/tv?c=demo-wsa");
  const line = tv.getByRole("region", { name: "Nu aan de lijn" });
  await expect(line).toContainText("Ronde 1 · Junior");
  // The board: a header row and the three juniors.
  await expect(line.getByRole("row")).toHaveCount(4);

  // The juniors are done shooting: the adults go to their frames before any card is typed.
  await page.getByRole("button", { name: "Volgende beurt →" }).click();
  await expect(page.getByText("Volwassenen · ronde 1 · beurt 1")).toBeVisible();
  await expect(line).toContainText("Ronde 1 · Volwassenen");
  await expect(page.locator("main")).toContainText("3 kaarten nog in te typen");
  await expect(tab(page, "Kaarten")).toHaveText("Kaarten1");

  // Terug undoes a mis-click, and Volgende beurt puts the adults back.
  await page.getByRole("button", { name: "← Terug naar de vorige beurt" }).click();
  await expect(line).toContainText("Ronde 1 · Junior");
  await page.getByRole("button", { name: "Volgende beurt →" }).click();
  await expect(line).toContainText("Ronde 1 · Volwassenen");

  // Kaarten opens on the oldest open beurt: the juniors.
  await tab(page, "Kaarten").click();
  await expect(cardsTitle(page)).toHaveText("Junior · ronde 1 · beurt 1");
  await expect(cells(page)).toHaveCount(6);

  // 25 can't be made on 2·4·6·8·10: red, and no saving.
  const first = cells(page).first();
  await first.fill("25");
  await cells(page).nth(1).focus();
  const typo = page.getByRole("alert").filter({ hasText: "kan niet" });
  await expect(typo).toContainText("25 kan niet");
  await expect(page.getByRole("button", { name: /Eerst de rode vakjes/ })).toBeDisabled();

  await first.fill("24");
  await expect(typo).toHaveCount(0);
  for (let i = 1; i < 6; i++) await cells(page).nth(i).fill(String(2 * i));
  await page.getByRole("button", { name: /^Opslaan/ }).click();
  // On to the beurt on the line; the TV stays on it, the juniors' totals count.
  await expect(cardsTitle(page)).toHaveText("Volwassenen · ronde 1 · beurt 1");
  await expect(cells(page)).toHaveCount(28);
  await expect(line).toContainText("Ronde 1 · Volwassenen");
  await expect(tab(page, "Kaarten")).toHaveText("Kaarten");

  // Typed but not saved: not on the TV. Saved: the series and the total.
  const shown28 = line.getByRole("cell", { name: "28", exact: true });
  await cells(page).first().fill("28");
  await expect(shown28).toHaveCount(0);
  await page.getByRole("button", { name: /^Opslaan/ }).click();
  await expect(shown28).toHaveCount(2);

  // Undo: the adult card goes back to a draft.
  await page.getByRole("button", { name: /Ongedaan maken/ }).click();
  await expect(cells(page).first()).toHaveValue("28");
  await expect(shown28).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("the series countdown and the warmup run on the TV", async ({ context, page }) => {
  await openWsaInRound1(page);
  const tv = await context.newPage();
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto("/tv?c=demo-wsa");

  // Series 1 starts after a 3-2-1 on the TV; the series clock starts at "Start!".
  await page.getByRole("button", { name: "Start reeks 1" }).click();
  await expect(page.locator("main")).toContainText("Aftellen op TV");
  await expect(tv.getByRole("timer", { name: "Aftellen" })).toHaveText(/^[321]$/);
  await expect(tv.getByRole("timer", { name: "Reekstimer" })).toHaveText(/^Reeks 1\s*van 2\s*2:30$/);
  await expect(page.locator("main")).toContainText(/Reeks 1\s*2:(30|29|28)/, { timeout: 6000 });
  await expect(tv.getByRole("timer", { name: "Reekstimer" })).toHaveText(/^Reeks 1\s*van 2\s*2:(30|29|28)$/);
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(tv.getByRole("timer", { name: "Reekstimer" })).toHaveText(/^Reeks 1\s*van 2\s*2:30$/);

  await page.getByLabel("Fase").selectOption({ label: "Opwarming" });
  await expect(page.getByText("Opwarmtimer op TV")).toBeVisible();
  await expect(tv.getByText(/^(5:00|4:59|4:58)$/)).toBeVisible();
});

test("starting series 1 during the warmup moves on to round 1, so the TV shows the countdown", async ({ context, page }) => {
  await page.goto("/operator/live?c=demo-wsa");
  await expect(page.getByText("Demowedstrijd WSA · demo")).toBeVisible();
  await page.getByLabel("Fase").selectOption({ label: "Opwarming" });
  await page.getByRole("button", { name: "Scoren", exact: true }).click();
  const tv = await context.newPage();
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto("/tv?c=demo-wsa");
  await expect(tv.getByText(/^(5:00|4:59|4:58)$/)).toBeVisible();

  await page.getByRole("button", { name: "Start reeks 1" }).click();
  await expect(page.getByLabel("Fase")).toHaveValue("round1");
  // One countdown: the warmup's is gone, the series' is on the TV.
  await expect(page.getByText("Opwarmtimer op TV")).toHaveCount(0);
  await expect(tv.getByRole("timer", { name: "Reekstimer" })).toHaveText(/^Reeks 1\s*van 2\s*2:(30|29|28)$/, { timeout: 6000 });
});

test("semi-final and final can be switched off in Voorbereiden", async ({ page }) => {
  await openWsaInRound1(page);
  await expect(page.getByLabel("Fase").locator("option", { hasText: /^Halve finale$/ })).toHaveCount(1);
  await page.getByRole("button", { name: "Voorbereiden" }).click();
  await page.getByRole("switch", { name: /Halve finale/ }).click();
  await expect(page.getByRole("switch", { name: /Halve finale/ })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByLabel("Fase").locator("option", { hasText: /^Halve finale$/ })).toHaveCount(0);
  await expect(page.getByLabel("Fase").locator("option", { hasText: /^Finale$/ })).toHaveCount(1);
});

test("a whole WSA day: qualification, semi-final, final and podium", async ({ context, page, isMobile }) => {
  test.skip(isMobile, "types every card with the keyboard");
  test.setTimeout(120_000);
  const errors: string[] = [];
  watchErrors(page, errors);
  await openWsaInRound1(page);

  // Round 1: both beurten shoot before any card is typed. Round 1 is done once the line is on round 2.
  const next = page.getByRole("button", { name: "Volgende beurt →" });
  await next.click();
  await expect(heading(page)).toHaveText("Volwassenen · ronde 1 · beurt 1");
  await next.click();
  await expect(page.getByText("Ronde 1 is klaar")).toBeVisible();
  await expect(page.locator("main")).toContainText("17 kaarten nog in te typen");
  // The break: the cards of round 1 get typed meanwhile, then round 2 starts on the line.
  await page.getByRole("button", { name: "Pauze starten" }).click();
  await expect(page.getByLabel("Fase")).toHaveValue("break");
  await tab(page, "Kaarten").click();
  // Both beurten of round 1, and the juniors already on the line for round 2.
  await expect(page.getByRole("tab")).toHaveCount(3);
  await typeCards(page);
  await typeCards(page);
  await expect(cardsTitle(page)).toHaveText("Junior · ronde 2 · beurt 1");
  await tab(page, "Scoren").click();
  await expect(heading(page)).toHaveText("Junior · ronde 2 · beurt 1");

  // Round 2: each beurt's cards right after it.
  for (let i = 0; i < 2; i++) await shootHeat(page);
  await expect(page.getByText("Ronde 2 is klaar")).toBeVisible();
  await goOnIfAsked(page);
  await expect(page.getByLabel("Fase")).toHaveValue("semifinal");
  await expect(heading(page)).toHaveText("Junior · halve finale · beurt 1");
  // The semi-finals of both groups shoot; the final waits for their cards.
  await next.click();
  // The best half of 14 adults: 7.
  await expect(heading(page)).toHaveText("Volwassenen · halve finale · beurt 1");
  await expect(next).toHaveCount(0);
  await expect(page.locator("main")).toContainText("Typ eerst alle open kaarten in");
  await tab(page, "Kaarten").click();
  expect(await typeCards(page)).toBe(6);
  expect(await typeCards(page)).toBe(14);
  await tab(page, "Scoren").click();

  // Final: 3 juniors and floor(7 / 2) = 3 adults: one podium series each.
  await goOnIfAsked(page);
  await expect(heading(page)).toHaveText("Junior · finale · reeks 1 · beurt 1");
  expect(await shootHeat(page)).toBe(3);
  await expect(heading(page)).toHaveText("Volwassenen · finale · reeks 1 · beurt 1");
  await shootHeat(page);
  await expect(page.getByText("Alle beurten zijn geschoten")).toBeVisible();

  const tv = await context.newPage();
  watchErrors(tv, errors);
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto("/tv?c=demo-wsa");
  await expect(tv.getByText("Podium", { exact: true })).toBeVisible();
  await expect(tv.locator("section", { hasText: "Volwassenen" })).toContainText("1");

  // Standings: the podium on top, then the final's, the semi-final's and the qualification's.
  await page.getByRole("button", { name: "Stand", exact: true }).click();
  await page.getByRole("tab", { name: "Volwassenen" }).click();
  await expect(page.getByText("HF · reeks 1")).toBeVisible();
  await expect(page.getByText("F1", { exact: true })).toBeVisible();

  expect(errors).toEqual([]);
});

test("on a touchscreen the WSA controls are at least 44px", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch layout only");
  await openWsaInRound1(page);
  for (const view of ["Scoren", "Kaarten", "Inschrijving", "Volgorde", "Stand", "Voorbereiden"]) {
    await openView(page, view);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".touch-targets :is(button, a[href], [role=radio], [role=tab], [role=switch], select, input:not([type=checkbox]):not([type=radio]))")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ el: (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30), r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width < 43.5 || r.height < 43.5)
        .map(({ el, r }) => `${el} ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    expect(small, view).toEqual([]);
  }
});

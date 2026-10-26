import { expect, test, type Page } from "@playwright/test";

/**
 * A WSA day on the WSA demo: Junior and Volwassenen on the line, scores typed from the scorecards,
 * the series countdown and the warmup on the TV, then the semi-final, the final and the podium.
 */

function watchErrors(page: Page, errors: string[]) {
  page.on("pageerror", (err) => errors.push(`${page.url()}: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${page.url()}: ${msg.text()}`);
  });
}

const heading = (page: Page) => page.locator("main").getByText(/ · (ronde \d|halve finale|finale · reeks \d) · beurt \d+$/);
const cells = (page: Page) => page.locator("main input[inputmode=numeric]");

async function openWsaInRound1(page: Page) {
  await page.goto("/operator/live?c=demo-wsa");
  await expect(page.getByText("Demowedstrijd WSA · demo")).toBeVisible();
  await page.getByRole("radio", { name: "Ronde 1" }).click();
  await page.getByRole("button", { name: "Scoren", exact: true }).click();
  await expect(page.getByText("Junior · ronde 1 · beurt 1")).toBeVisible();
}

/**
 * Types every card of the heat on the line with the keyboard (Enter to the next cell, Enter on the
 * last one saves). Round 1 (2·4·6·8·10) gives every row its own score, so nobody ties; later all 10s.
 */
/** A part of the day is done (round 1, the qualification, the semi-final): go straight on. */
async function goOnIfAsked(page: Page) {
  const goOn = page.getByRole("button", { name: /^Meteen door met / });
  await expect(heading(page).or(goOn)).toBeVisible();
  if (await goOn.isVisible()) {
    await goOn.click();
    await expect(heading(page)).toBeVisible();
  }
}

async function shootHeat(page: Page) {
  await goOnIfAsked(page);
  const title = await heading(page).innerText();
  const series = /finale · reeks/.test(title) ? 1 : 2;
  const n = await cells(page).count();
  await cells(page).first().focus();
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / series);
    const value = / ronde 1 /.test(title) ? (i % series === 0 ? 2 * (row + 1) : 2) : 10;
    await page.keyboard.type(String(value));
    await page.keyboard.press("Enter");
  }
  // Read in one step: the heading may go between a count and a read (the "Ronde 1 is klaar" card).
  await expect.poll(async () => (await heading(page).allInnerTexts())[0] ?? "done").not.toBe(title);
}

test("typed scores reach the TV; a typo is refused; save and undo", async ({ context, page }) => {
  const errors: string[] = [];
  watchErrors(page, errors);
  await openWsaInRound1(page);

  const tv = await context.newPage();
  watchErrors(tv, errors);
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto("/tv?c=demo-wsa");
  const line = tv.locator("section", { hasText: "Nu aan de lijn" });
  await expect(line).toContainText("Ronde 1 · Junior");
  await expect(line).toContainText("KD 3");

  // 25 can't be made on 2·4·6·8·10: red, not on the TV, and no saving.
  const first = cells(page).first();
  await first.fill("25");
  await cells(page).nth(1).focus();
  const typo = page.getByRole("alert").filter({ hasText: "kan niet" });
  await expect(typo).toContainText("25 kan niet");
  await expect(page.getByRole("button", { name: /Eerst de rode vakjes/ })).toBeDisabled();
  await expect(line).not.toContainText("25");

  await first.fill("24");
  await expect(typo).toHaveCount(0);
  await expect(line).toContainText("24 · –");

  for (let i = 1; i < 6; i++) await cells(page).nth(i).fill(String(2 * i));
  await page.getByRole("button", { name: /Opslaan & volgende/ }).click();
  await expect(page.getByText("Volwassenen · ronde 1 · beurt 1")).toBeVisible();
  await expect(cells(page)).toHaveCount(28);
  await expect(line).toContainText("Volwassenen");

  // Undo: back to the juniors with their scores as drafts.
  await page.getByRole("button", { name: /Ongedaan maken/ }).click();
  await expect(page.getByText("Junior · ronde 1 · beurt 1")).toBeVisible();
  await expect(cells(page).first()).toHaveValue("24");
  await expect(line).toContainText("Junior");

  expect(errors).toEqual([]);
});

test("the series countdown and the warmup run on the TV", async ({ context, page }) => {
  await openWsaInRound1(page);
  const tv = await context.newPage();
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto("/tv?c=demo-wsa");

  await page.getByRole("button", { name: "Start reeks 1" }).click();
  await expect(page.locator("main")).toContainText(/Reeks 1\s*2:(30|29|28)/);
  await expect(tv.locator("section", { hasText: "Nu aan de lijn" })).toContainText(/Reeks 1\s*2:(30|29|28)/);
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(tv.locator("section", { hasText: "Nu aan de lijn" })).toContainText("2 × 2:30");

  await page.getByRole("radio", { name: "Opwarming" }).click();
  await expect(page.getByText("Opwarmtimer op TV")).toBeVisible();
  await expect(tv.getByText(/^(5:00|4:59|4:58)$/)).toBeVisible();
});

test("starting series 1 during the warmup moves on to round 1, so the TV shows the countdown", async ({ context, page }) => {
  await page.goto("/operator/live?c=demo-wsa");
  await expect(page.getByText("Demowedstrijd WSA · demo")).toBeVisible();
  await page.getByRole("radio", { name: "Opwarming" }).click();
  await page.getByRole("button", { name: "Scoren", exact: true }).click();
  const tv = await context.newPage();
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto("/tv?c=demo-wsa");
  await expect(tv.getByText(/^(5:00|4:59|4:58)$/)).toBeVisible();

  await page.getByRole("button", { name: "Start reeks 1" }).click();
  await expect(page.getByRole("radio", { name: "Ronde 1" })).toHaveAttribute("aria-checked", "true");
  // One countdown: the warmup's is gone, the series' is on the TV.
  await expect(page.getByText("Opwarmtimer op TV")).toHaveCount(0);
  await expect(tv.locator("section", { hasText: "Nu aan de lijn" })).toContainText(/Reeks 1\s*2:(30|29|28)/);
});

test("semi-final and final can be switched off in Voorbereiden", async ({ page }) => {
  await openWsaInRound1(page);
  await expect(page.getByRole("radio", { name: "Halve finale" })).toBeVisible();
  await page.getByRole("button", { name: "Voorbereiden" }).click();
  await page.getByRole("switch", { name: /Halve finale/ }).click();
  await expect(page.getByRole("switch", { name: /Halve finale/ })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("radio", { name: "Halve finale" })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Finale" })).toBeVisible();
});

test("a whole WSA day: qualification, semi-final, final and podium", async ({ context, page, isMobile }) => {
  test.skip(isMobile, "types every card with the keyboard");
  test.setTimeout(120_000);
  const errors: string[] = [];
  watchErrors(page, errors);
  await openWsaInRound1(page);

  // Qualification: 2 rounds of Junior (3) and Volwassenen (14).
  for (let i = 0; i < 4; i++) await shootHeat(page);
  await expect(page.getByText("Ronde 2 is klaar")).toBeVisible();
  await goOnIfAsked(page);
  await expect(page.getByRole("radio", { name: "Halve finale" })).toHaveAttribute("aria-checked", "true");
  await expect(heading(page)).toHaveText("Junior · halve finale · beurt 1");
  await expect(cells(page)).toHaveCount(6);
  await shootHeat(page);
  // The best half of 14 adults: 7.
  await expect(heading(page)).toHaveText("Volwassenen · halve finale · beurt 1");
  await expect(cells(page)).toHaveCount(14);
  await shootHeat(page);

  // Final: 3 juniors and floor(7 / 2) = 3 adults: one podium series each.
  await goOnIfAsked(page);
  await expect(heading(page)).toHaveText("Junior · finale · reeks 1 · beurt 1");
  await expect(cells(page)).toHaveCount(3);
  await shootHeat(page);
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
  for (const tab of ["Scoren", "Volgorde", "Stand", "Voorbereiden"]) {
    await page.getByRole("button", { name: tab, exact: false }).first().click();
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".touch-targets :is(button, a[href], [role=radio], [role=switch], select, input:not([type=checkbox]):not([type=radio]))")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ el: (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30), r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width < 43.5 || r.height < 43.5)
        .map(({ el, r }) => `${el} ${Math.round(r.width)}×${Math.round(r.height)}`),
    );
    expect(small, tab).toEqual([]);
  }
});

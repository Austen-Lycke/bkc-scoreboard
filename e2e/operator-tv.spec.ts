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
  // Knockdown 2 hit nothing: "0" is Niets, otherwise saving asks first.
  await page.keyboard.press("w");
  await page.keyboard.press("0");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Fase 2 van 2")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Scoren", exact: true }).click();
  await expect(page.getByRole("button", { name: /Ongedaan maken/ })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByText("Fase 1 van 2")).toBeVisible();
  await expect(knockdown(page, 1).getByRole("button", { name: "Links 3 (3 ptn), geraakt" })).toBeVisible();
});

test("a knockdown nobody filled in is only saved as 0 after asking", async ({ page }) => {
  await openDemoInRound1(page);
  const save = page.getByRole("button", { name: "Opslaan & wisselen" });
  const question = page.getByRole("alert").filter({ hasText: "Nog niets ingevuld" });

  // A double tap on Opslaan with nothing filled in: asks, saves nothing.
  await save.click();
  await save.click();
  await expect(question).toContainText("Lotte D. & Noor W.");
  await expect(page.getByText("Fase 1 van 2")).toBeVisible();

  // Niets counts as filled in; the question then only names the other knockdown.
  await knockdown(page, 1).getByRole("button", { name: "Niets" }).click();
  await expect(question).toContainText("Noor W.");
  await expect(question).not.toContainText("Lotte D.");
  await question.getByRole("button", { name: "0 opslaan" }).click();
  await expect(page.getByText("Fase 2 van 2")).toBeVisible();
  await expect(question).toHaveCount(0);

  // A plate tapped on both sides saves straight away.
  await knockdown(page, 1).getByRole("button", { name: "Links 3 (3 ptn)" }).click();
  await knockdown(page, 2).getByRole("button", { name: "Rechts 2 (2 ptn)" }).click();
  await page.getByRole("button", { name: "Opslaan & volgende" }).click();
  await expect(page.getByText("Junior · ronde 1 · beurt 2")).toBeVisible();
  await expect(question).toHaveCount(0);
});

test("Einde asks on Afronden before scoring locks", async ({ page }) => {
  await openDemoInRound1(page);
  const einde = page.getByRole("radio", { name: "Einde" });

  await einde.click();
  await expect(page.getByRole("heading", { name: "Afronden" })).toBeVisible();
  await expect(page.getByText("Nog niet alles is volledig. Toch beëindigen?")).toBeVisible();
  await expect(einde).toHaveAttribute("aria-checked", "false");

  // Leaving the tab drops the question; scoring still works.
  await page.getByRole("button", { name: "Scoren", exact: true }).click();
  await expect(page.getByRole("button", { name: "Opslaan & wisselen" })).toBeEnabled();
  await page.getByRole("button", { name: "Afronden" }).click();
  await expect(page.getByText("Toch beëindigen?")).toHaveCount(0);

  await einde.click();
  await page.getByRole("button", { name: "Ja, beëindigen" }).click();
  await expect(page.getByText("Wedstrijd beëindigd ✓")).toBeVisible();
  await expect(einde).toHaveAttribute("aria-checked", "true");
});

test("the TV afkamping keeps five tied shooters and their plates inside their cards", async ({ context, page, isMobile }) => {
  test.skip(isMobile, "uses the keyboard to shoot the whole day");
  test.setTimeout(90_000);
  await openDemoInRound1(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  // Every pass Niets: all ranks end tied, 3de klasse five-way.
  const where = page.locator("main").getByText(/^Fase \d van \d/);
  const heading = page.locator("main").getByText(/ · ronde \d · beurt \d+$/);
  const shootRound = async () => {
    for (let i = 0; i < 60 && (await heading.count()) > 0; i++) {
      const before = `${await heading.innerText()} ${await where.innerText()}`;
      for (const key of ["0", "w", "0", "Enter"]) await page.keyboard.press(key);
      // Read in one step: the heading may go between a count and a read (the "Ronde 1 is klaar" card).
      await expect
        .poll(async () => [...(await heading.allInnerTexts()), ...(await where.allInnerTexts())].join(" ") || "done")
        .not.toBe(before);
    }
  };
  await shootRound();
  // Round 1 is shot: the break or straight on, and the TV says so meanwhile.
  await expect(page.getByText("Ronde 1 is klaar")).toBeVisible();
  await page.getByRole("button", { name: "Meteen door met ronde 2" }).click();
  await expect(page.getByRole("radio", { name: "Ronde 2" })).toHaveAttribute("aria-checked", "true");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await shootRound();
  await expect(page.getByText("Alle beurten zijn geschoten")).toBeVisible();

  await page.getByRole("radio", { name: "Afkamping" }).click();
  await page.getByRole("button", { name: /^Afkamping/ }).click();
  const card = page
    .locator("main div")
    .filter({ has: page.getByText("3de klasse", { exact: true }) })
    .filter({ has: page.getByRole("button", { name: "Afkamping starten" }) })
    .last();
  await card.getByRole("button", { name: "Afkamping starten" }).click();

  const tv = await context.newPage();
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto("/tv?c=demo");
  await expect(tv.getByText("Afkamping · 3de klasse")).toBeVisible();
  const cards = tv.locator("section");
  await expect(cards).toHaveCount(5);
  await expect(cards.first()).toContainText("Jens V.");

  const problems = await cards.evaluateAll((sections) =>
    sections.flatMap((s) => {
      const box = s.getBoundingClientRect();
      const name = s.firstElementChild as HTMLElement;
      const out = [...s.querySelectorAll<HTMLElement>("span.rounded-full")].filter((p) => {
        const r = p.getBoundingClientRect();
        return r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1;
      });
      // A hidden line, not the few px the tight line height lets glyphs stick out.
      const halfLine = parseFloat(getComputedStyle(name).fontSize) / 2;
      return [
        ...(out.length ? [`${name.innerText}: ${out.length} plates outside the card`] : []),
        ...(name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + halfLine ? [`${name.innerText}: name cut off`] : []),
      ];
    }),
  );
  expect(problems).toEqual([]);
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

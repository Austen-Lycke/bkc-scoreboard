import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Every protected page, server action and API route checks the role itself. A check in a layout is
 * not enough: Next still renders the page and sends its data along with the redirect (the
 * 2026-10-20 pen test). These tests fail when a new file forgets it.
 */

const read = (file: string) => readFileSync(file, "utf8");
const files = (pattern: string) => globSync(pattern).sort();

/** Static shells: they only read this device's IndexedDB, so they must load without a session (offline). */
const PUBLIC_SHELLS = ["app/operator/live/page.tsx"];

/** The bodies of the top-level functions in a module, by name. */
function functions(source: string) {
  const parts = source.split(/^(?=(?:export )?(?:default )?(?:async )?function )/m).slice(1);
  return parts.map((body) => ({
    name: body.match(/function (\w+)/)?.[1] ?? "default",
    exported: body.startsWith("export"),
    body,
  }));
}

describe("access checks", () => {
  it("every admin page requires the admin role", () => {
    const pages = files("app/admin/**/page.tsx");
    expect(pages.length).toBeGreaterThan(5);
    for (const page of pages) expect(read(page), page).toMatch(/await requireRole\("admin"\)/);
  });

  it("every operator page requires a role, except the offline shells", () => {
    for (const page of files("app/operator/**/page.tsx").filter((p) => !PUBLIC_SHELLS.includes(p))) {
      expect(read(page), page).toMatch(/await requireRole\(/);
    }
  });

  it("every exported server action checks the role first", () => {
    const modules = files("app/**/actions.ts");
    expect(modules.length).toBeGreaterThan(0);
    for (const file of modules) {
      const fns = functions(read(file));
      // Local helpers that do the check, e.g. `guard(userId)`.
      const guards = fns.filter((f) => !f.exported && f.body.includes("requireRole(")).map((f) => f.name);
      for (const fn of fns.filter((f) => f.exported)) {
        const checked = fn.body.includes("requireRole(") || guards.some((g) => fn.body.includes(`${g}(`));
        expect(checked, `${file}: ${fn.name}`).toBe(true);
      }
    }
  });

  it("every admin API route requires the admin role", () => {
    const routes = files("app/api/admin/**/route.ts");
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      for (const fn of functions(read(route)).filter((f) => f.exported)) {
        expect(fn.body, `${route}: ${fn.name}`).toMatch(/sessionWithRole\(request, "admin"\)/);
      }
    }
  });

  it("every operator API route requires a role", () => {
    const routes = files("app/api/operator/**/route.ts");
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      for (const fn of functions(read(route)).filter((f) => f.exported)) {
        expect(fn.body, `${route}: ${fn.name}`).toMatch(/sessionWithRole\(request, /);
      }
    }
  });

  it("API routes are only public under /api/public and /api/auth", () => {
    const unguarded = files("app/api/**/route.ts").filter(
      (r) => !r.startsWith("app/api/public/") && !r.startsWith("app/api/auth/") && !read(r).includes("sessionWithRole("),
    );
    expect(unguarded).toEqual([]);
  });
});

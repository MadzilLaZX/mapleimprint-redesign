import { test, expect } from "@playwright/test";

/** Real-browser verification of ContactTabs' WAI-ARIA tabs pattern -- no mocks needed, /contact
 *  itself doesn't touch Supabase (only the wizard's own submit does, and nothing here submits). */

test("ContactTabs: arrow keys move focus and selection, Home/End jump to the ends, wrapping at both edges", async ({ page }) => {
  await page.goto("/contact");
  const quoteTab = page.getByRole("tab", { name: "Get a Project Quote" });
  const appointmentTab = page.getByRole("tab", { name: "Book an Appointment" });
  const generalTab = page.getByRole("tab", { name: "General Inquiry" });
  const locationTab = page.getByRole("tab", { name: "Location" });

  // Default tab (no ?type= param) is "quote".
  await expect(quoteTab).toHaveAttribute("aria-selected", "true");
  await quoteTab.focus();

  await page.keyboard.press("ArrowRight");
  await expect(appointmentTab).toBeFocused();
  await expect(appointmentTab).toHaveAttribute("aria-selected", "true");
  await expect(quoteTab).toHaveAttribute("aria-selected", "false");

  await page.keyboard.press("ArrowRight");
  await expect(generalTab).toBeFocused();
  await expect(generalTab).toHaveAttribute("aria-selected", "true");

  // Wraps past the last tab back to the first.
  await page.keyboard.press("ArrowRight");
  await expect(locationTab).toBeFocused();
  await expect(locationTab).toHaveAttribute("aria-selected", "true");

  // Wraps the other direction too.
  await page.keyboard.press("ArrowLeft");
  await expect(generalTab).toBeFocused();

  await page.keyboard.press("Home");
  await expect(locationTab).toBeFocused();
  await expect(locationTab).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("End");
  await expect(generalTab).toBeFocused();
  await expect(generalTab).toHaveAttribute("aria-selected", "true");

  // The panel's own aria-labelledby really tracks the selected tab, not just the button's own attribute.
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "contact-tab-general");
});

test("ContactTabs: only the selected tab sits in the Tab key sequence (roving tabindex)", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByRole("tab", { name: "Get a Project Quote" })).toHaveAttribute("tabindex", "0");
  await expect(page.getByRole("tab", { name: "Location" })).toHaveAttribute("tabindex", "-1");
  await expect(page.getByRole("tab", { name: "Book an Appointment" })).toHaveAttribute("tabindex", "-1");
  await expect(page.getByRole("tab", { name: "General Inquiry" })).toHaveAttribute("tabindex", "-1");
});

test("ContactTabs: clicking a tab selects it and swaps the panel content", async ({ page }) => {
  await page.goto("/contact");
  await page.getByRole("tab", { name: "Location" }).click();
  await expect(page.getByRole("tab", { name: "Location" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "contact-tab-location");
});

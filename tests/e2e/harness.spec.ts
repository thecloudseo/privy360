import { test, expect } from "@playwright/test";

test("synthetic browser harness", async ({ page }) => {
  await page.setContent('<button type="button">Synthetic action</button>');
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Synthetic action" }),
  ).toBeFocused();
});

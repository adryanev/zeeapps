import { expect, test } from "@playwright/test";

test.describe("Companion settings", () => {
  test("offers local settings and restores the Companion's choices", async ({ page }) => {
    await page.goto("/");

    const settings = page.getByTestId("companion-settings");
    await expect(settings).toBeVisible();
    await expect(page.getByLabel("Lembut")).toBeChecked();
    await expect(page.getByLabel("Normal")).not.toBeChecked();
    await expect(page.getByLabel("Senyap")).not.toBeChecked();
    await expect(page.getByLabel("Reduced Motion")).not.toBeChecked();

    await page.getByLabel("Normal").check();
    await page.getByLabel("Reduced Motion").check();
    await page.reload();

    await expect(page.getByLabel("Normal")).toBeChecked();
    await expect(page.getByLabel("Reduced Motion")).toBeChecked();
  });

  test("applies every Sound Profile and Reduced Motion when the Game starts", async ({ page }) => {
    for (const profile of ["Lembut", "Normal", "Senyap"]) {
      await page.goto("/");
      await page.getByLabel(profile).check();
      await page.getByLabel("Reduced Motion").check();
      await page.getByRole("button", { name: "Mulai Depot Tenang" }).click();

      await expect(page.getByTestId("child-stage")).toHaveAttribute(
        "data-sound-profile",
        profile.toLowerCase(),
      );
      await expect(page.getByTestId("child-stage")).toHaveAttribute("data-reduced-motion", "true");
    }
  });

  test("shows when device-local settings storage is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error("storage disabled");
      };
      Storage.prototype.setItem = () => {
        throw new Error("storage disabled");
      };
    });

    await page.goto("/");

    await expect(page.getByTestId("settings-storage-error")).toBeVisible();
    await page.getByLabel("Normal").check();
    await expect(page.getByTestId("settings-storage-error")).toContainText("device");
  });
});

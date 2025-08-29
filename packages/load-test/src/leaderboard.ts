import { Page } from "@playwright/test";

export const config = {
  target: process.env.HOST,
  phases: [
    {
      name: "Warmup",
      duration: "5m",
      arrivalRate: 2,
      maxVusers: 100,
    },
  ],
  engines: {
    playwright: {},
  },
};

export const scenarios = [
  {
    name: "Leaderboard pagination and agent profile navigation",
    engine: "playwright",
    testFunction: leaderboardScenario,
  },
];

async function leaderboardScenario(page: Page) {
  // Navigate to the leaderboard page
  await page.goto("/leaderboards");

  // Wait for the table element to be present
  await page.waitForSelector("table");

  // Wait for the table header to be rendered
  await page.waitForSelector("thead.bg-card");

  // Wait for at least one table row to be present in the tbody
  await page.waitForSelector("tbody tr", { state: "visible" });

  // Additional wait to ensure the table content is fully loaded
  await page.waitForSelector("td", { state: "visible" });

  // Check if there is a next button and click it
  const nextButton = await page.$("svg.lucide-chevron-right.cursor-pointer");
  if (nextButton) {
    await nextButton.click();
    // Wait for the table to update
    await page.waitForResponse((resp) => resp.url().includes("/leaderboard"));
  }

  // Click on the first agent in the table
  const firstAgent = await page.$("tbody tr:first-child");
  if (firstAgent) {
    await firstAgent.click();
    await page.waitForURL("**/agents/**");
  }
}

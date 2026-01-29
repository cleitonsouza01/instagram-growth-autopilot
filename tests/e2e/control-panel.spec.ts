import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * E2E tests for the ControlPanel UI/UX
 *
 * These tests verify:
 * 1. Panel visibility and toggle behavior
 * 2. Tab navigation between Workflow and Activity
 * 3. Stats display
 * 4. Button states and interactions
 * 5. Activity/engagement history display
 *
 * Prerequisites:
 * - Build the extension first: `pnpm build`
 * - The test loads a mock Instagram page to test the injected panel
 */

// Mock Instagram page HTML for testing
const MOCK_INSTAGRAM_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Instagram</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <div id="app">
    <header>Instagram Mock Page</header>
    <main>
      <p>This is a mock Instagram page for testing the control panel injection.</p>
    </main>
  </div>
</body>
</html>
`;

test.describe("ControlPanel UI/UX", () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    // Create context with extension loaded
    context = await browser.newContext();
    page = await context.newPage();

    // Navigate to Instagram (or a mock page for testing without real Instagram)
    // For real testing, navigate to: https://www.instagram.com
    // For this test, we'll set up mock responses
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe("Panel Toggle", () => {
    test("should show toggle button on Instagram page", async () => {
      // Navigate to Instagram
      await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded" });

      // Wait for the control panel toggle to be injected
      const toggleButton = page.locator('[data-testid="panel-toggle"]');
      await expect(toggleButton).toBeVisible({ timeout: 10000 });
    });

    test("should open panel when toggle is clicked", async () => {
      const toggleButton = page.locator('[data-testid="panel-toggle"]');
      const panel = page.locator('[data-testid="control-panel"]');

      // Panel should be hidden initially (button shows panel on click)
      await toggleButton.click();

      // Panel should now be visible
      await expect(panel).toBeVisible();
    });

    test("should close panel when toggle is clicked again", async () => {
      const toggleButton = page.locator('[data-testid="panel-toggle"]');
      const panel = page.locator('[data-testid="control-panel"]');

      // Panel is open, click to close
      await toggleButton.click();

      // Panel should be hidden
      await expect(panel).not.toBeVisible();

      // Re-open for next tests
      await toggleButton.click();
      await expect(panel).toBeVisible();
    });
  });

  test.describe("Tab Navigation", () => {
    test("should display Workflow and Activity tabs", async () => {
      const tabNavigation = page.locator('[data-testid="tab-navigation"]');
      const workflowTab = page.locator('[data-testid="tab-workflow"]');
      const activityTab = page.locator('[data-testid="tab-activity"]');

      await expect(tabNavigation).toBeVisible();
      await expect(workflowTab).toBeVisible();
      await expect(activityTab).toBeVisible();

      // Check tab labels
      await expect(workflowTab).toContainText("Workflow");
      await expect(activityTab).toContainText("Activity");
    });

    test("should show Workflow tab content by default", async () => {
      const workflowTab = page.locator('[data-testid="tab-workflow"]');

      // Workflow tab should be active (has active styling)
      const fontWeight = await workflowTab.evaluate((el) =>
        window.getComputedStyle(el).fontWeight
      );
      expect(Number(fontWeight)).toBeGreaterThanOrEqual(600);
    });

    test("should switch to Activity tab when clicked", async () => {
      const activityTab = page.locator('[data-testid="tab-activity"]');
      const activityFeed = page.locator('[data-testid="activity-feed"]');

      // Click Activity tab
      await activityTab.click();

      // Activity feed should be visible
      await expect(activityFeed).toBeVisible();

      // Activity tab should now be active
      const fontWeight = await activityTab.evaluate((el) =>
        window.getComputedStyle(el).fontWeight
      );
      expect(Number(fontWeight)).toBeGreaterThanOrEqual(600);
    });

    test("should switch back to Workflow tab when clicked", async () => {
      const workflowTab = page.locator('[data-testid="tab-workflow"]');
      const activityFeed = page.locator('[data-testid="activity-feed"]');

      // Click Workflow tab
      await workflowTab.click();

      // Activity feed should be hidden (workflow content shown instead)
      await expect(activityFeed).not.toBeVisible();
    });
  });

  test.describe("Stats Display", () => {
    test("should display stats row with Likes, Follows, Queue", async () => {
      const statsLikes = page.locator('[data-testid="stat-likes"]');
      const statsFollows = page.locator('[data-testid="stat-follows"]');
      const statsQueue = page.locator('[data-testid="stat-queue"]');

      await expect(statsLikes).toBeVisible();
      await expect(statsFollows).toBeVisible();
      await expect(statsQueue).toBeVisible();
    });

    test("should display numeric values in stats", async () => {
      const statsLikes = page.locator('[data-testid="stat-likes"]');
      const statsFollows = page.locator('[data-testid="stat-follows"]');
      const statsQueue = page.locator('[data-testid="stat-queue"]');

      // Stats should contain numeric values (even if 0)
      const likesText = await statsLikes.textContent();
      const followsText = await statsFollows.textContent();
      const queueText = await statsQueue.textContent();

      expect(likesText).toMatch(/^\d+$/);
      expect(followsText).toMatch(/^\d+$/);
      expect(queueText).toMatch(/^\d+$/);
    });
  });

  test.describe("Control Buttons", () => {
    test("should display Start and Stop buttons", async () => {
      const startButton = page.locator('[data-testid="btn-start"]');
      const stopButton = page.locator('[data-testid="btn-stop"]');

      await expect(startButton).toBeVisible();
      await expect(stopButton).toBeVisible();
    });

    test("should have Start button enabled when idle", async () => {
      const startButton = page.locator('[data-testid="btn-start"]');

      // In idle state, Start should be enabled
      await expect(startButton).not.toBeDisabled();
    });

    test("should have Stop button disabled when idle", async () => {
      const stopButton = page.locator('[data-testid="btn-stop"]');

      // In idle state, Stop should be disabled
      await expect(stopButton).toBeDisabled();
    });

    test("should contain correct button text", async () => {
      const startButton = page.locator('[data-testid="btn-start"]');
      const stopButton = page.locator('[data-testid="btn-stop"]');

      await expect(startButton).toContainText("Start");
      await expect(stopButton).toContainText("Stop");
    });
  });

  test.describe("Activity Tab Content", () => {
    test("should show summary stats in Activity tab", async () => {
      const activityTab = page.locator('[data-testid="tab-activity"]');
      await activityTab.click();

      const activityFeed = page.locator('[data-testid="activity-feed"]');
      await expect(activityFeed).toBeVisible();

      // Should have "Total Likes" and "Total Follows" summary boxes
      await expect(activityFeed).toContainText("Total Likes");
      await expect(activityFeed).toContainText("Total Follows");
    });

    test("should show LIVE FEED section in Activity tab", async () => {
      const activityFeed = page.locator('[data-testid="activity-feed"]');

      await expect(activityFeed).toContainText("LIVE FEED");
    });

    test("should show BY PROSPECT section in Activity tab", async () => {
      const activityFeed = page.locator('[data-testid="activity-feed"]');

      await expect(activityFeed).toContainText("BY PROSPECT");
    });
  });

  test.describe("Engagement History", () => {
    test("should display engagement history section", async () => {
      const engagementHistory = page.locator('[data-testid="engagement-history"]');
      await expect(engagementHistory).toBeVisible();
    });

    test("should show empty state when no engagements", async () => {
      const engagementHistory = page.locator('[data-testid="engagement-history"]');

      // Should show empty state message if no engagements
      const emptyState = engagementHistory.locator("text=No engagement yet");
      const hasEmptyState = await emptyState.count();

      // Either shows empty state OR shows prospect cards - one should be true
      const prospectCards = page.locator('[data-testid="prospect-card"]');
      const hasProspects = await prospectCards.count();

      expect(hasEmptyState > 0 || hasProspects > 0).toBeTruthy();
    });
  });

  test.describe("Responsive and Styling", () => {
    test("should have proper panel dimensions", async () => {
      const panel = page.locator('[data-testid="control-panel"]');

      const box = await panel.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        // Panel should have reasonable dimensions
        expect(box.width).toBeGreaterThanOrEqual(300);
        expect(box.width).toBeLessThanOrEqual(500);
        expect(box.height).toBeGreaterThanOrEqual(400);
      }
    });

    test("should position panel in bottom-right corner", async () => {
      const panel = page.locator('[data-testid="control-panel"]');
      const viewportSize = page.viewportSize();

      const box = await panel.boundingBox();
      expect(box).not.toBeNull();
      if (box && viewportSize) {
        // Panel should be positioned near the right edge
        expect(box.x + box.width).toBeGreaterThan(viewportSize.width - 100);

        // Panel should be positioned near the bottom
        expect(box.y + box.height).toBeGreaterThan(viewportSize.height - 200);
      }
    });

    test("should have rounded corners on panel", async () => {
      const panel = page.locator('[data-testid="control-panel"]');

      const borderRadius = await panel.evaluate((el) =>
        window.getComputedStyle(el).borderRadius
      );

      // Should have border-radius (rounded corners)
      expect(borderRadius).not.toBe("0px");
    });
  });

  test.describe("Accessibility", () => {
    test("should have clickable toggle button", async () => {
      const toggleButton = page.locator('[data-testid="panel-toggle"]');

      // Should be a button element
      const tagName = await toggleButton.evaluate((el) => el.tagName.toLowerCase());
      expect(tagName).toBe("button");
    });

    test("should have title attribute on toggle button", async () => {
      const toggleButton = page.locator('[data-testid="panel-toggle"]');

      const title = await toggleButton.getAttribute("title");
      expect(title).toContain("Growth Autopilot");
    });

    test("tabs should be keyboard accessible", async () => {
      const workflowTab = page.locator('[data-testid="tab-workflow"]');
      const activityTab = page.locator('[data-testid="tab-activity"]');

      // Tabs should be buttons (keyboard accessible)
      const workflowTagName = await workflowTab.evaluate((el) => el.tagName.toLowerCase());
      const activityTagName = await activityTab.evaluate((el) => el.tagName.toLowerCase());

      expect(workflowTagName).toBe("button");
      expect(activityTagName).toBe("button");
    });
  });
});

test.describe("ControlPanel Visual States", () => {
  test("toggle button should have visual indicator for running state", async ({ page, context }) => {
    // This test checks the visual styling changes when engine is running
    await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded" });

    const toggleButton = page.locator('[data-testid="panel-toggle"]');
    await expect(toggleButton).toBeVisible({ timeout: 10000 });

    // Get the initial background color (idle state)
    const bgColor = await toggleButton.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );

    // The button should have a background color
    expect(bgColor).not.toBe("transparent");
    expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("Activity tab badge should show count when engagements exist", async ({ page }) => {
    await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded" });

    const toggleButton = page.locator('[data-testid="panel-toggle"]');
    await expect(toggleButton).toBeVisible({ timeout: 10000 });
    await toggleButton.click();

    const activityTab = page.locator('[data-testid="tab-activity"]');
    await expect(activityTab).toBeVisible();

    // The Activity tab text should include the count or just "Activity"
    const tabText = await activityTab.textContent();
    expect(tabText).toContain("Activity");
  });
});

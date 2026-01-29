import { MessageType } from "../../types/messages";

// Track which profiles have buttons injected
const injectedProfiles = new Set<string>();
// Track which profiles are already competitors
let competitorSet = new Set<string>();

/**
 * Extract username from an Instagram profile link
 */
function extractUsername(href: string): string | null {
  // Match patterns like /username/ or /username
  const match = href.match(/instagram\.com\/([a-zA-Z0-9._]+)\/?$/);
  if (match) {
    const username = match[1].toLowerCase();
    // Filter out known non-profile paths
    const reserved = [
      "explore", "direct", "accounts", "p", "reel", "reels",
      "stories", "live", "tv", "about", "legal", "api", "developer"
    ];
    if (!reserved.includes(username)) {
      return username;
    }
  }
  return null;
}

/**
 * Create the "+" button element
 */
function createAddButton(username: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "ga-add-competitor-btn";
  btn.dataset.username = username;
  btn.innerHTML = "+";
  btn.title = `Add @${username} as competitor`;

  // Check if already a competitor
  if (competitorSet.has(username)) {
    btn.innerHTML = "✓";
    btn.title = `@${username} is a competitor`;
    btn.classList.add("ga-added");
  }

  // Styling
  Object.assign(btn.style, {
    marginLeft: "4px",
    padding: "0 6px",
    fontSize: "12px",
    fontWeight: "bold",
    lineHeight: "18px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    background: competitorSet.has(username) ? "#22c55e" : "#6366f1",
    color: "white",
    opacity: "0.8",
    transition: "opacity 0.2s, background 0.2s",
    verticalAlign: "middle",
  });

  btn.addEventListener("mouseenter", () => {
    btn.style.opacity = "1";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.opacity = "0.8";
  });

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (competitorSet.has(username)) {
      // Already added - could implement remove here
      return;
    }

    // Show loading state
    btn.innerHTML = "...";
    btn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.ADD_COMPETITOR,
        payload: { username },
      });

      if (response?.success) {
        btn.innerHTML = "✓";
        btn.title = `@${username} is a competitor`;
        btn.style.background = "#22c55e";
        btn.classList.add("ga-added");
        competitorSet.add(username);

        // Update all other buttons for this username
        document.querySelectorAll(`.ga-add-competitor-btn[data-username="${username}"]`).forEach((el) => {
          const b = el as HTMLButtonElement;
          b.innerHTML = "✓";
          b.title = `@${username} is a competitor`;
          b.style.background = "#22c55e";
          b.classList.add("ga-added");
        });
      } else {
        btn.innerHTML = "!";
        btn.title = response?.error || "Failed to add";
        btn.style.background = "#ef4444";
        setTimeout(() => {
          btn.innerHTML = "+";
          btn.style.background = "#6366f1";
          btn.disabled = false;
        }, 2000);
      }
    } catch (err) {
      btn.innerHTML = "!";
      btn.style.background = "#ef4444";
      setTimeout(() => {
        btn.innerHTML = "+";
        btn.style.background = "#6366f1";
        btn.disabled = false;
      }, 2000);
    }
  });

  return btn;
}

/**
 * Scan page and inject buttons next to profile links
 */
function injectProfileButtons(): void {
  // Find all profile links - these are links that go to /<username>/
  const links = document.querySelectorAll('a[href^="/"]');

  links.forEach((link) => {
    const href = (link as HTMLAnchorElement).href;
    const username = extractUsername(href);

    if (!username) return;

    // Skip if already processed this specific element
    if (link.classList.contains("ga-profile-link-processed")) return;
    link.classList.add("ga-profile-link-processed");

    // Find the text content - usually the username display
    // Look for parent containers that might hold the username text
    const parent = link.parentElement;
    if (!parent) return;

    // Skip if this is just an avatar/image link without text
    const hasText = link.textContent?.trim().length;
    if (!hasText) return;

    // Skip very long text (probably not a username display)
    if ((link.textContent?.length ?? 0) > 50) return;

    // Check if button already exists nearby
    if (parent.querySelector(".ga-add-competitor-btn")) return;

    // Create and insert button
    const btn = createAddButton(username);

    // Insert after the link
    if (link.nextSibling) {
      parent.insertBefore(btn, link.nextSibling);
    } else {
      parent.appendChild(btn);
    }

    injectedProfiles.add(username);
  });
}

/**
 * Fetch current competitors list from background
 */
async function refreshCompetitors(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GET_COMPETITORS,
    });
    if (response?.competitors) {
      competitorSet = new Set(response.competitors);

      // Update existing buttons
      document.querySelectorAll(".ga-add-competitor-btn").forEach((el) => {
        const btn = el as HTMLButtonElement;
        const username = btn.dataset.username;
        if (username && competitorSet.has(username)) {
          btn.innerHTML = "✓";
          btn.title = `@${username} is a competitor`;
          btn.style.background = "#22c55e";
          btn.classList.add("ga-added");
        }
      });
    }
  } catch (err) {
    console.error("[GA-Autopilot] Failed to fetch competitors:", err);
  }
}

/**
 * Initialize profile button injection
 */
export function initProfileButtons(): void {
  // First fetch current competitors
  refreshCompetitors().then(() => {
    // Initial scan
    injectProfileButtons();

    // Re-scan periodically for dynamically loaded content
    setInterval(() => {
      injectProfileButtons();
    }, 2000);

    // Also use MutationObserver for faster detection
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) {
        // Debounce with requestAnimationFrame
        requestAnimationFrame(() => {
          injectProfileButtons();
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });

  // Refresh competitors list periodically
  setInterval(refreshCompetitors, 30000);
}

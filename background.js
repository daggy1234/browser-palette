// background.js

// Default shortcut values
const DEFAULT_TAB_SWITCHER = /Firefox/i.test(navigator.userAgent)
  ? "Cmd+Shift+K"
  : "Cmd+K";
const DEFAULT_COMMAND_PALETTE = /Firefox/i.test(navigator.userAgent)
  ? "Cmd+Shift+P"
  : "Cmd+Shift+P";

chrome.runtime.onInstalled.addListener(() => {
  console.info("Quick Command Palette extension installed/updated.");
  // You could potentially load and cache shortcuts here if preferred
  // Or set initial default values in storage if they don't exist
  // chrome.storage.sync.get(['tabSwitcherShortcut', 'commandPaletteShortcut'], (data) => {
  //   if (!data.tabSwitcherShortcut) {
  //     chrome.storage.sync.set({ tabSwitcherShortcut: DEFAULT_TAB_SWITCHER });
  //   }
  //   if (!data.commandPaletteShortcut) {
  //     chrome.storage.sync.set({ commandPaletteShortcut: DEFAULT_COMMAND_PALETTE });
  //   }
  // });
});

// Refactored command execution logic
async function executeCommandInTab(tab, mode) {
  if (!tab || typeof tab.id === "undefined") {
    console.warn("executeCommandInTab called without a valid tab. Ignoring.");
    return;
  }
  const tabId = tab.id;

  try {
    console.debug(`Sending 'isAlive' to tab ${tabId}`);
    const response = await chrome.tabs.sendMessage(tabId, {
      action: "isAlive",
    });

    if (response && response.status === "ready") {
      console.debug(
        `Content script alive in tab ${tabId}. Sending 'togglePalette'.`
      );
      await chrome.tabs.sendMessage(tabId, {
        action: "togglePalette",
        mode: mode,
      });
    } else {
      console.info(
        `Content script in tab ${tabId} not ready or unresponsive. Proceeding to inject.`
      );
      throw new Error("Content script not ready or unresponsive");
    }
  } catch (e) {
    console.warn(
      `'isAlive' check failed for tab ${tabId} (Error: ${e.message}). Attempting to inject script.`
    );
    try {
      console.debug(`Injecting content.js into tab ${tabId}`);
      if (typeof chrome.scripting !== "undefined") {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["content.js"],
        });
      } else if (chrome.tabs && chrome.tabs.executeScript) {
        await chrome.tabs.executeScript(tabId, { file: "content.js" });
      }
      console.info(
        `Successfully injected content.js into tab ${tabId}. Sending 'initPalette'.`
      );
      await chrome.tabs.sendMessage(tabId, {
        action: "initPalette",
        mode: mode,
      });
      console.debug(`'initPalette' sent to tab ${tabId}`);
    } catch (injectionError) {
      console.error(
        `Failed to inject script or initialize palette in tab ${tabId}:`,
        injectionError.message
      );
      if (
        tab.url &&
        (tab.url.startsWith("chrome://") ||
          tab.url.startsWith("edge://") ||
          tab.url.startsWith("file://"))
      ) {
        console.warn(
          `Cannot inject scripts into special URL: ${tab.url}. This is expected for security reasons.`
        );
      } else if (
        injectionError.message.includes("No tab with id") ||
        injectionError.message.includes("The tab was closed")
      ) {
        console.warn(
          `Tab ${tabId} was closed or became invalid during operation.`
        );
      } else if (
        injectionError.message.includes("Cannot access contents of the page")
      ) {
        console.warn(
          `Cannot access contents of the page at ${tab.url}. This might be due to permissions or a protected page.`
        );
      }
    }
  }
}

// Remove or comment out the old chrome.commands.onCommand.addListener
/*
chrome.commands.onCommand.addListener(async (command, tab) => {
  // ... old logic was here ...
});
*/

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // New handler for dynamically configured shortcuts
  if (request.action === "executeCommandBasedOnShortcut") {
    const pressedShortcut = request.shortcut;
    // console.log("Shortcut message received from content script:", pressedShortcut, "from tab", sender.tab.id);

    chrome.storage.sync.get(
      ["tabSwitcherShortcut", "commandPaletteShortcut", "blockedSites"],
      (data) => {
        const tabSwitcherShortcut =
          data.tabSwitcherShortcut || DEFAULT_TAB_SWITCHER;
        const commandPaletteShortcut =
          data.commandPaletteShortcut || DEFAULT_COMMAND_PALETTE;
        const blockedSites = data.blockedSites || [];

        let modeToExecute = null;
        if (pressedShortcut === tabSwitcherShortcut) {
          modeToExecute = "tab-switcher";
        } else if (pressedShortcut === commandPaletteShortcut) {
          modeToExecute = "general";
        }

        if (modeToExecute && sender.tab && sender.tab.id) {
          const tabUrl = sender.tab.url;
          let isBlocked = false;
          if (tabUrl) { // Ensure tabUrl is available
            for (const site of blockedSites) {
              if (site && tabUrl.includes(site)) { // Ensure site string is not empty/null
                isBlocked = true;
                console.log(
                  `Site ${tabUrl} is blocked by rule ${site}. Command not executed.`
                );
                break;
              }
            }
          }


          if (isBlocked) {
            sendResponse({ status: "blocked" });
          } else {
            console.log(
              `Executing command for mode ${modeToExecute} in tab ${sender.tab.id} due to shortcut ${pressedShortcut}`
            );
            executeCommandInTab(sender.tab, modeToExecute)
              .then(() => {
                sendResponse({ status: "executed" });
              })
              .catch((error) => {
                console.error("Error executing command in tab:", error);
                sendResponse({ status: "error", message: error.message });
              });
          }
        } else {
          // No matching shortcut or invalid sender/tab
          sendResponse({ status: "no_match_or_invalid_sender" });
        }
      }
    );
    return true; // Indicate async response because of chrome.storage.sync.get
  }

  // Existing onMessage handlers
  switch (request.action) {
    case "closePalette":
      if (sender.tab && sender.tab.id) {
        chrome.tabs.sendMessage(
          sender.tab.id,
          { action: "removePalette" },
          () => {
            // Use an empty callback for sendMessage if not expecting a specific response
            if (chrome.runtime.lastError) {
              console.warn(
                `Error sending 'removePalette' to content script (tab ${sender.tab.id}):`,
                chrome.runtime.lastError.message
              );
            } else {
              console.debug(
                `'removePalette' message sent to tab ${sender.tab.id}.`
              );
            }
          }
        );
        sendResponse({ success: true });
      } else {
        console.warn(
          "'closePalette' message received without valid sender tab ID."
        );
        sendResponse({ success: false, error: "Missing sender tab ID" });
      }
      return true; // Indicate async response because of sendMessage

    case "queryTabs":
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error querying tabs:",
            chrome.runtime.lastError.message
          );
          sendResponse({ error: chrome.runtime.lastError.message });
          return;
        }
        const filteredTabs = tabs.map((tab) => {
          let favIconUrl = tab.favIconUrl;
          if (!favIconUrl) {
            try {
              // Attempt to construct a fallback favicon URL only for http/https URLs
              const urlObj = new URL(tab.url);
              if (urlObj.protocol.startsWith("http")) {
                favIconUrl = `https://www.google.com/s2/favicons?sz=32&domain_url=${urlObj.origin}`;
              } else {
                favIconUrl = ""; // No fallback for non-http/s URLs
              }
            } catch (e) {
              favIconUrl = ""; // Invalid URL, no favicon
            }
          }
          return {
            id: tab.id,
            title: tab.title,
            url: tab.url,
            favIconUrl: favIconUrl,
          };
        });
        sendResponse({ tabs: filteredTabs });
      });
      return true; // Indicates that the response is sent asynchronously

    case "switchToTab":
      if (request.tabId) {
        chrome.tabs.update(request.tabId, { active: true }, (updatedTab) => {
          if (chrome.runtime.lastError) {
            console.error(
              `Error switching to tab ${request.tabId}:`,
              chrome.runtime.lastError.message
            );
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          if (updatedTab && updatedTab.windowId) {
            chrome.windows.update(
              updatedTab.windowId,
              { focused: true },
              () => {
                if (chrome.runtime.lastError) {
                  console.warn(
                    `Error focusing window ${updatedTab.windowId}:`,
                    chrome.runtime.lastError.message
                  );
                }
              }
            );
          }
          sendResponse({ success: true });
        });
      } else {
        console.warn("'switchToTab' message received without tabId.");
        sendResponse({ success: false, error: "No tabId provided" });
      }
      return true;

    case "openNewTab":
      chrome.tabs.create({});
      sendResponse({ success: true });
      return true;
    case "openBookmarks":
      chrome.tabs.create({ url: "chrome://bookmarks/" });
      sendResponse({ success: true });
      return true;
    case "openHistory":
      chrome.tabs.create({ url: "chrome://history/" });
      sendResponse({ success: true });
      return true;

    default:
      return false;
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, {
    action: "togglePalette",
    mode: "general",
  });
});

// Note on Firefox compatibility:
// While 'chrome' namespace is often aliased to 'browser' in Firefox,
// specific APIs like 'chrome.scripting' might require the 'browser.scripting' namespace explicitly.
// Manifest v3 support and promise-based APIs are generally good in Firefox but always test.

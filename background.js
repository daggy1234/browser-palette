// background.js

// Log when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("Quick Command Palette extension installed/updated.");
});

// Listen for commands defined in manifest.json
chrome.commands.onCommand.addListener(async (command, tab) => {
  console.log(`Command received: ${command}`);

  if (command === "open-tab-switcher" || command === "open-general-palette") {
    // Ensure we have an active tab to inject into
    if (tab && tab.id) {
      try {
        // Check if the palette is already injected
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () =>
            !!document.getElementById("quick-command-palette-container"),
        });

        if (chrome.runtime.lastError) {
          console.error(
            "Error checking for existing palette:",
            chrome.runtime.lastError.message
          );
          return;
        }

        const isPaletteInjected = results && results[0] && results[0].result;
        const mode =
          command === "open-tab-switcher" ? "tab-switcher" : "general";

        if (isPaletteInjected) {
          console.log("Palette already injected. Sending toggle message.");
          try {
            const response = await chrome.tabs.sendMessage(tab.id, {
              action: "togglePalette",
              mode: mode,
            });
            console.log("Toggle response:", response);
          } catch (err) {
            console.warn("Failed to toggle palette, reinitializing...");
            // If message fails, content script might have been unloaded
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content_script.js"],
            });
            // After reinjecting, initialize the palette
            setTimeout(async () => {
              await chrome.tabs.sendMessage(tab.id, {
                action: "initPalette",
                mode: mode,
              });
            }, 100);
          }
        } else {
          console.log(
            "Injecting content script and palette for the first time."
          );
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content_script.js"],
          });
          // After injecting, initialize the palette
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                action: "initPalette",
                mode: mode,
              });
            } catch (err) {
              console.error("Failed to initialize palette:", err);
            }
          }, 100);
        }
      } catch (e) {
        console.error("Error executing script or sending message:", e);
        // This can happen on special pages like chrome:// pages
        if (
          e.message.includes("Cannot access a chrome:// URL") ||
          e.message.includes("No tab with id")
        ) {
          console.warn("Cannot inject script into this page:", tab.url);
        }
      }
    } else {
      console.warn("No active tab found to inject the palette into.");
    }
  }
});

// Listen for messages from the palette UI (e.g., to close it, or perform actions)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "queryTabs") {
    chrome.tabs.query({}, (tabs) => {
      // Filter out internal chrome pages or new tab page if desired, though not strictly necessary
      const filteredTabs = tabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        favIconUrl:
          tab.favIconUrl ||
          `https://www.google.com/s2/favicons?domain=${
            new URL(tab.url).hostname
          }`, // Fallback favicon
      }));
      sendResponse({ tabs: filteredTabs });
    });
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === "switchToTab") {
    if (request.tabId) {
      chrome.tabs.update(request.tabId, { active: true }, (tab) => {
        if (tab && tab.windowId) {
          chrome.windows.update(tab.windowId, { focused: true });
        }
        sendResponse({ success: true });
      });
    }
    return true; // Async response
  } else if (request.action === "closePalette") {
    // This message would come from the palette UI (inside the iframe)
    // It tells the content script to remove the iframe.
    if (sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(
        sender.tab.id,
        { action: "removePalette" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.log(
              "Error sending removePalette to content script:",
              chrome.runtime.lastError.message
            );
          } else {
            console.log("Palette removal acknowledged by content script.");
          }
        }
      );
    }
    sendResponse({ success: true });
    return true;
  }
  // Add more message handlers here for other general palette commands
});

// For Firefox compatibility:
// Replace 'chrome' with 'browser' namespace.
// For example, chrome.tabs.query -> browser.tabs.query
// The manifest structure is largely compatible but check Firefox specific keys if needed.

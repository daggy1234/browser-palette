// content_script.js

let paletteFrame = null;
let paletteVisible = false;
let currentPaletteMode = "general"; // 'general' or 'tab-switcher'

// Function to create and inject the iframe
function createPaletteFrame(mode) {
  if (document.getElementById("quick-command-palette-container")) {
    console.log("Palette container already exists.");
    return document.getElementById("quick-command-palette-container");
  }

  const container = document.createElement("div");
  container.id = "quick-command-palette-container";
  // Basic styling for the container - will be positioned by iframe's internal CSS
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.zIndex = "2147483647"; // Max z-index
  container.style.display = "none"; // Initially hidden
  container.style.backgroundColor = "rgba(0, 0, 0, 0.3)"; // Backdrop

  paletteFrame = document.createElement("iframe");
  paletteFrame.id = "quick-command-palette-iframe";
  paletteFrame.src = chrome.runtime.getURL(`palette.html?mode=${mode}`);
  // Styling for the iframe itself
  paletteFrame.style.position = "fixed";
  paletteFrame.style.top = "10%"; // Adjust as needed
  paletteFrame.style.left = "50%";
  paletteFrame.style.transform = "translateX(-50%)";
  paletteFrame.style.width = "clamp(300px, 60%, 700px)"; // Responsive width
  paletteFrame.style.height = "clamp(200px, 70%, 500px)"; // Responsive height
  paletteFrame.style.border = "none";
  paletteFrame.style.boxShadow =
    "0 10px 25px rgba(0,0,0,0.1), 0 5px 10px rgba(0,0,0,0.05)";
  paletteFrame.style.borderRadius = "12px"; // Rounded corners for the iframe
  paletteFrame.style.opacity = "0"; // Start hidden for transition
  paletteFrame.style.transition =
    "opacity 0.2s ease-in-out, transform 0.2s ease-in-out";
  paletteFrame.style.transform = "translateX(-50%) scale(0.95)";

  container.appendChild(paletteFrame);
  document.body.appendChild(container);

  // Close palette if user clicks outside the iframe
  container.addEventListener("click", (event) => {
    if (event.target === container) {
      // Clicked on the backdrop
      hidePalette();
    }
  });

  return container;
}

function showPalette(mode) {
  let container = document.getElementById("quick-command-palette-container");
  if (!container) {
    container = createPaletteFrame(mode);
  } else {
    // If exists, ensure iframe source is correct if mode changes (though typically it won't once opened)
    const currentFrame = document.getElementById(
      "quick-command-palette-iframe"
    );
    if (currentFrame && !currentFrame.src.includes(`mode=${mode}`)) {
      currentFrame.src = chrome.runtime.getURL(`palette.html?mode=${mode}`);
    }
  }

  currentPaletteMode = mode;
  container.style.display = "block"; // Show backdrop

  // Ensure iframe is loaded before trying to focus or send messages
  const frame = document.getElementById("quick-command-palette-iframe");
  if (frame) {
    frame.onload = () => {
      // Send a message to the iframe to focus its input
      frame.contentWindow.postMessage(
        { action: "focusInput", mode: currentPaletteMode },
        "*"
      );
      // Apply visible styles with slight delay for transition
      setTimeout(() => {
        frame.style.opacity = "1";
        frame.style.transform = "translateX(-50%) scale(1)";
      }, 10); // Small delay for CSS transition
    };
    // If already loaded (e.g. toggling visibility)
    if (
      frame.contentWindow &&
      frame.contentDocument &&
      frame.contentDocument.readyState === "complete"
    ) {
      frame.contentWindow.postMessage(
        { action: "focusInput", mode: currentPaletteMode },
        "*"
      );
      setTimeout(() => {
        frame.style.opacity = "1";
        frame.style.transform = "translateX(-50%) scale(1)";
      }, 10);
    }
  }
  paletteVisible = true;
  document.body.style.overflow = "hidden"; // Prevent background scroll
}

function hidePalette() {
  const container = document.getElementById("quick-command-palette-container");
  const frame = document.getElementById("quick-command-palette-iframe");

  if (frame) {
    frame.style.opacity = "0";
    frame.style.transform = "translateX(-50%) scale(0.95)";
  }

  if (container) {
    // Wait for transition to complete before hiding
    setTimeout(() => {
      container.style.display = "none";
      // Optionally remove the frame to save resources if not frequently used
      // if (paletteFrame && paletteFrame.parentNode) {
      //   paletteFrame.parentNode.removeChild(paletteFrame);
      //   paletteFrame = null;
      // }
      // if (container.parentNode) {
      //    container.parentNode.removeChild(container);
      // }
    }, 200); // Match transition duration
  }
  paletteVisible = false;
  document.body.style.overflow = ""; // Restore scroll
}

// Listen for messages from the background script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);
  if (request.action === "initPalette" || request.action === "togglePalette") {
    if (!paletteVisible) {
      // Show palette if it's not visible
      showPalette(request.mode);
      sendResponse({ status: "Palette shown" });
    } else if (request.action === "togglePalette") {
      if (currentPaletteMode !== request.mode) {
        // Mode changed, update mode and refocus
        currentPaletteMode = request.mode;
        const frame = document.getElementById("quick-command-palette-iframe");
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage(
            { action: "updateMode", mode: currentPaletteMode },
            "*"
          );
          frame.contentWindow.postMessage(
            { action: "focusInput", mode: currentPaletteMode },
            "*"
          );
        }
        sendResponse({ status: "Palette mode updated" });
      } else {
        // Same mode, hide the palette
        hidePalette();
        sendResponse({ status: "Palette hidden" });
      }
    }
    return true; // Required for async sendResponse
  } else if (request.action === "removePalette") {
    const container = document.getElementById(
      "quick-command-palette-container"
    );
    if (container) {
      container.remove();
      paletteFrame = null; // Clear reference
      paletteVisible = false;
      document.body.style.overflow = ""; // Restore scroll
      sendResponse({ status: "Palette removed" });
    } else {
      sendResponse({ status: "Palette not found, nothing to remove" });
    }
  }
  return true; // Keep message channel open for async response if needed
});

// Listen for messages from the iframe (palette.html)
window.addEventListener("message", (event) => {
  // Basic security: check event.origin if the iframe could load untrusted content
  // For an extension page, chrome.runtime.getURL('palette.html') is trusted.
  if (event.source !== paletteFrame.contentWindow) {
    return;
  }

  if (event.data.action === "closePalette") {
    hidePalette();
    // Optionally, notify background that palette was closed by user action
    chrome.runtime.sendMessage({ action: "paletteClosedByUser" });
  } else if (event.data.action === "performGeneralAction") {
    // Handle general palette actions here
    console.log("Action from palette:", event.data.details);
    // Example: chrome.runtime.sendMessage({ action: 'executeSomeOtherAction', details: event.data.details });
    hidePalette();
  }
});

console.log("Quick Command Palette content script loaded.");

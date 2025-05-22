// content.js

let paletteFrame = null; // Stores the iframe DOM element
let paletteContainer = null; // Stores the container div for the palette and backdrop
let paletteVisible = false; // Tracks if the palette UI is currently considered visible
let currentPaletteMode = "general"; // Can be 'general' or 'tab-switcher'

function createPaletteFrame(mode) {
  if (document.getElementById("quick-command-palette-container")) {
    console.debug("Palette container already exists. Using existing one.");
    paletteContainer = document.getElementById(
      "quick-command-palette-container"
    );
    paletteFrame = document.getElementById("quick-command-palette-iframe");
    if (paletteFrame && !paletteFrame.src.includes(`mode=${mode}`)) {
      console.info(
        `Reconfiguring existing palette frame for new mode: ${mode}`
      );
      paletteFrame.src = chrome.runtime.getURL(`palette.html?mode=${mode}`);
    }
    return paletteContainer;
  }

  console.info("Creating new palette container and iframe for mode:", mode);
  paletteContainer = document.createElement("div");
  paletteContainer.id = "quick-command-palette-container";
  paletteContainer.style.position = "fixed";
  paletteContainer.style.top = "0";
  paletteContainer.style.left = "0";
  paletteContainer.style.width = "100%";
  paletteContainer.style.height = "100%";
  paletteContainer.style.zIndex = "2147483647"; // Ensure it's on top
  paletteContainer.style.display = "none"; // Start hidden
  paletteContainer.style.backgroundColor = "rgba(0, 0, 0, 0.3)"; // Semi-transparent backdrop

  paletteFrame = document.createElement("iframe");
  paletteFrame.id = "quick-command-palette-iframe";
  paletteFrame.src = chrome.runtime.getURL(`palette.html?mode=${mode}`);
  paletteFrame.style.position = "fixed";
  paletteFrame.style.top = "10%"; // Position from top
  paletteFrame.style.left = "50%"; // Center horizontally
  paletteFrame.style.width = "clamp(300px, 60%, 700px)"; // Responsive width
  paletteFrame.style.height = "clamp(200px, 70%, 500px)"; // Responsive height
  paletteFrame.style.border = "none";
  paletteFrame.style.boxShadow =
    "0 10px 25px rgba(0,0,0,0.1), 0 5px 10px rgba(0,0,0,0.05)";
  paletteFrame.style.borderRadius = "12px";
  paletteFrame.style.opacity = "0"; // Start transparent for fade-in animation
  paletteFrame.style.transition =
    "opacity 0.2s ease-in-out, transform 0.2s ease-in-out";
  paletteFrame.style.transform = "translateX(-50%) scale(0.95)"; // Initial state for animation (centered, slightly scaled down)

  paletteContainer.appendChild(paletteFrame);
  document.body.appendChild(paletteContainer); // Standard practice

  paletteContainer.addEventListener("click", (event) => {
    if (event.target === paletteContainer) {
      hidePalette();
    }
  });

  return paletteContainer;
}

function showPalette(mode) {
  console.debug(
    `showPalette called. Requested mode: ${mode}. Current mode: ${currentPaletteMode}, Visible: ${paletteVisible}`
  );
  currentPaletteMode = mode; // Update current mode immediately

  // Create palette container and frame if they don't exist, or reconfigure if necessary
  if (
    !paletteContainer ||
    !document.getElementById("quick-command-palette-container")
  ) {
    console.info("Palette container or frame missing. Recreating...");
    paletteContainer = createPaletteFrame(mode);
    paletteFrame = document.getElementById("quick-command-palette-iframe"); // Re-assign after creation
  } else {
    // If frame exists, ensure its src matches the requested mode.
    const currentFrameSrc = paletteFrame.src;
    const expectedSrc = chrome.runtime.getURL(`palette.html?mode=${mode}`);
    if (currentFrameSrc !== expectedSrc) {
      console.info(
        `Palette mode changed or frame src incorrect. Updating src to: ${expectedSrc}`
      );
      paletteFrame.src = expectedSrc;
      // When iframe src changes, it reloads. Opacity and transform might be reset by the browser.
      // Re-apply initial hidden state for a consistent transition effect triggered by onload.
      paletteFrame.style.opacity = "0";
      paletteFrame.style.transform = "translateX(-50%) scale(0.95)";
    }
  }

  // Defensive check: If palette elements are still not available, abort.
  if (!paletteContainer || !paletteFrame) {
    console.error(
      "Critical: Failed to create or find palette elements. Cannot show palette."
    );
    if (paletteContainer) paletteContainer.style.display = "none"; // Attempt to hide backdrop
    document.body.style.overflow = ""; // Restore scroll
    paletteVisible = false;
    return;
  }

  paletteContainer.style.display = "block"; // Show backdrop and container
  document.body.style.overflow = "hidden"; // Prevent background page scrolling

  // Callback function for when the iframe is loaded
  const onFrameLoad = () => {
    console.debug(
      `iframe onload event triggered. Current mode: ${currentPaletteMode}`
    );
    if (paletteFrame.contentWindow) {
      // Send message to iframe to focus its input field
      paletteFrame.contentWindow.postMessage(
        { action: "focusInput", mode: currentPaletteMode },
        "*"
      );

      // Apply visible styles for transition
      paletteFrame.style.opacity = "1";
      paletteFrame.style.transform = "translateX(-50%) scale(1)";
      paletteVisible = true;
      console.info(
        "Palette displayed and 'focusInput' sent. Mode:",
        currentPaletteMode
      );
    } else {
      console.error(
        "iframe contentWindow not available after load. Cannot interact with palette."
      );
      hidePalette(); // Attempt to cleanup if interaction is not possible
    }
  };

  // Check if the iframe is already loaded with the correct src.
  // The `onload` event is the most reliable way to handle iframe loading, especially after `src` changes.
  // `readyState === 'complete'` can be true for a previously loaded iframe with a different src.
  if (
    paletteFrame.src === chrome.runtime.getURL(`palette.html?mode=${mode}`) &&
    paletteFrame.contentDocument &&
    paletteFrame.contentDocument.readyState === "complete"
  ) {
    console.debug(
      "iframe already loaded with correct src. Proceeding with onFrameLoad actions."
    );
    onFrameLoad();
  } else {
    console.debug(
      "iframe not yet loaded or src has changed. Setting up onload listener."
    );
    paletteFrame.onload = onFrameLoad;
    // Fallback: In some rare cases (e.g., extremely fast cached loads), onload might fire before listener is attached.
    // A small timeout can help catch this, but primary reliance should be on the onload handler setup above.
    setTimeout(() => {
      if (
        !paletteVisible &&
        paletteFrame.contentDocument &&
        paletteFrame.contentDocument.readyState === "complete" &&
        paletteFrame.src === chrome.runtime.getURL(`palette.html?mode=${mode}`)
      ) {
        console.debug(
          "Fallback check: iframe loaded and seems ready, but onload might have been missed. Triggering onFrameLoad."
        );
        onFrameLoad();
      }
    }, 50); // Small delay for the fallback
  }
}

/**
 * Hides the palette UI and restores page scroll.
 */
function hidePalette() {
  console.debug("hidePalette called.");
  if (paletteFrame) {
    // Apply transition styles to hide
    paletteFrame.style.opacity = "0";
    paletteFrame.style.transform = "translateX(-50%) scale(0.95)";
  }

  if (paletteContainer) {
    // Wait for CSS transition to complete before hiding the container and restoring scroll
    setTimeout(() => {
      if (paletteContainer) {
        // Check again, element might have been removed by other means
        paletteContainer.style.display = "none";
        // Remove the elements from DOM to ensure clean state
        paletteContainer.remove();
        paletteContainer = null;
        paletteFrame = null;
      }
      document.body.style.overflow = ""; // Restore background page scroll
      console.info("Palette hidden and scroll restored.");
    }, 200); // Duration should match CSS transition time
  } else {
    // If no container, still attempt to restore scroll as a safety measure
    document.body.style.overflow = "";
  }
  paletteVisible = false;
}

// Listen for messages from the background script (e.g., to toggle visibility, set mode)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.debug("Content script received message:", request);

  switch (request.action) {
    case "isAlive":
      sendResponse({
        status: "ready",
        visible: paletteVisible,
        mode: currentPaletteMode,
      });
      break;
    case "initPalette":
      console.info("initPalette request received. Mode:", request.mode);
      showPalette(request.mode);
      sendResponse({ status: "Palette initialization process started." });
      break;
    case "togglePalette":
      console.info(
        `togglePalette request. Requested mode: ${request.mode}. Visible: ${paletteVisible}. Current mode: ${currentPaletteMode}`
      );
      if (paletteVisible) {
        if (currentPaletteMode !== request.mode) {
          console.info("Mode changed while visible. Re-showing with new mode.");
          showPalette(request.mode); // showPalette handles src update and focus
          sendResponse({ status: "Palette mode updated and shown." });
        } else {
          console.info("Same mode, hiding palette.");
          hidePalette();
          sendResponse({ status: "Palette hidden." });
        }
      } else {
        console.info("Palette not visible, showing palette.");
        showPalette(request.mode);
        sendResponse({ status: "Palette shown." });
      }
      break;
    case "removePalette":
      console.info("removePalette request received.");
      if (paletteContainer) {
        paletteContainer.remove(); // Remove the entire palette from the DOM
        paletteContainer = null; // Clear references
        paletteFrame = null;
      }
      paletteVisible = false;
      document.body.style.overflow = ""; // Ensure scroll is restored
      sendResponse({ status: "Palette removed." });
      break;
    default:
      // console.debug("Unhandled message action in content script:", request.action);
      sendResponse({ status: "Unknown action." });
      return false; // Indicate no async response if not one of the handled cases that returns true
  }
  return true; // Indicate that sendResponse will be called asynchronously for handled cases
});

// Listen for messages from the embedded iframe (palette.html)
window.addEventListener("message", (event) => {
  // Security: Validate the origin of the message
  if (event.origin !== new URL(chrome.runtime.getURL("palette.html")).origin) {
    console.warn(
      "Content script: Ignored message from unexpected origin:",
      event.origin
    );
    return;
  }

  // Security: Validate that the source is the content window of our palette iframe
  if (!paletteFrame || event.source !== paletteFrame.contentWindow) {
    console.warn(
      "Content script: Ignored message not from palette iframe's content window."
    );
    return;
  }

  const { action, details, mode } = event.data;
  console.debug("Content script received message from iframe:", event.data);

  switch (action) {
    case "closePalette":
      hidePalette();
      // Optional: Notify background script that the user closed the palette.
      // chrome.runtime.sendMessage({ action: "paletteClosedByUser" });
      break;
    case "performGeneralAction":
      // This is a placeholder for actions triggered from the general command palette
      // that the content script might need to handle or relay.
      console.info("Action received from palette:", details);
      // Example: chrome.runtime.sendMessage({ action: 'executeSomeOtherAction', details: details });
      hidePalette(); // Typically hide palette after an action is performed
      break;
    case "paletteReady":
      // The palette iframe signals it has loaded its own scripts and is ready.
      // This can be used for finer-grained coordination if needed.
      console.info("Notification from iframe: Palette is ready. Mode:", mode);
      break;
    default:
      // console.debug("Content script: Unhandled action from iframe:", action);
      break;
  }
});

console.info("Quick Command Palette content script loaded and ready.");

// --- Global Shortcut Listener ---
window.addEventListener('keydown', (event) => {
  // Ignore keydowns if the palette is currently visible and the event is within the palette iframe
  if (paletteVisible && event.target && event.target.id === 'quick-command-palette-iframe' && event.target.contentWindow === window.frames.namedItem('quick-command-palette-iframe')) {
    // console.log("Keydown event inside the palette iframe, content script ignoring.");
    return;
  }
  
  // 5. Consider Active Input Fields
  if (event.target.isContentEditable ||
      event.target.tagName === 'INPUT' ||
      event.target.tagName === 'TEXTAREA' ||
      event.target.tagName === 'SELECT') {
    // console.log("Keydown in input/editable field, content script ignoring for global shortcuts.");
    return;
  }

  // 2. Construct Shortcut String
  let keys = [];
  if (event.metaKey) keys.push("Cmd");
  if (event.ctrlKey) keys.push("Ctrl");
  if (event.altKey) keys.push("Alt");
  if (event.shiftKey) keys.push("Shift");

  // Normalize key name, matching settings.js logic
  let keyName = event.key;
  if (keyName.length === 1) {
    keyName = keyName.toUpperCase();
  } else {
    // For special keys like "ArrowUp", "Enter", "F1", etc.
    // Check if it's a key we want to include.
    // Exclude modifiers if they are the primary key (e.g. just pressing Shift)
    const upperKey = keyName.toUpperCase();
    if (["META", "CONTROL", "ALT", "SHIFT", "OS"].includes(upperKey)) {
      // If only modifiers are pressed, or it's a standalone modifier key event
      if (keys.length === 0 || keys.every(k => ["Cmd","Ctrl","Alt","Shift"].includes(k))) {
         // console.log("Only modifiers pressed or standalone modifier key, not forming shortcut.");
         return;
      }
    }
  }
  
  // Add the actual key if it's not a modifier already part of the 'keys' array by its name
  // (e.g., if event.key is "Shift", we don't want "Shift+Shift")
  const normalizedKeyName = keyName.length === 1 ? keyName : event.key; // Use original case for multi-char keys like 'ArrowUp'
  const upperKeyName = normalizedKeyName.toUpperCase();

  if (!["CMD", "META", "CONTROL", "CTRL", "ALT", "SHIFT", "OS"].includes(upperKeyName)) {
    keys.push(normalizedKeyName);
  } else if (keys.length === 0 && ["CMD", "META", "CONTROL", "CTRL", "ALT", "SHIFT", "OS"].includes(upperKeyName)) {
    // This case handles if a modifier key itself is the event.key but no other non-modifier key is pressed.
    // However, our initial modifier checks (event.metaKey etc.) should generally cover this.
    // This mainly prevents adding a modifier name if it's the *only* key pressed and it somehow wasn't caught.
    return;
  }


  // Filter out shortcuts that are only modifiers (e.g. "Cmd" or "Shift")
  // or if a modifier is also the main key (e.g. "Shift+Shift" should not happen)
  const nonModifierKeyExists = keys.some(k => !["Cmd", "Ctrl", "Alt", "Shift"].includes(k));
  if (!nonModifierKeyExists && keys.length > 0) {
      // console.log("Shortcut consists only of modifiers, ignoring:", keys.join("+"));
      return;
  }
  
  if (keys.length === 0) {
    // console.log("No keys for shortcut formed.");
    return; 
  }

  const pressedShortcut = keys.join("+");
  // console.log("Potential shortcut pressed in content.js:", pressedShortcut);

  // If a potential shortcut is formed (more than just a single character without modifiers,
  // or multiple keys including modifiers)
  if (pressedShortcut && keys.length > 1 || (keys.length === 1 && !["Cmd", "Ctrl", "Alt", "Shift"].includes(keys[0]) && keys[0].length > 1) ) {
    // Send message to background script
    // console.log(`Sending shortcut to background: ${pressedShortcut}`);
    
    // 3. Prevent Default Action (Proactive approach)
    // We prevent default if we are sending *any* potential shortcut to background.
    // Background will decide if it's a *valid extension* shortcut.
    // This is to avoid race conditions with webpage handlers for common shortcuts (e.g. Cmd+K for search)
    event.preventDefault();
    event.stopPropagation();

    chrome.runtime.sendMessage(
      { action: "executeCommandBasedOnShortcut", shortcut: pressedShortcut },
      (response) => {
        if (chrome.runtime.lastError) {
          // console.error("Error sending shortcut message:", chrome.runtime.lastError.message);
          // If there was an error, the shortcut likely wasn't processed,
          // but we've already called preventDefault. This is a trade-off.
        } else if (response) {
          if (response.status === "executed") {
            // console.log("Shortcut executed by background script:", pressedShortcut);
          } else if (response.status === "blocked") {
            // console.log("Shortcut blocked by background script:", pressedShortcut);
          } else if (response.status === "no_match_or_invalid_sender") {
            // console.log("Shortcut not recognized or invalid sender by background script:", pressedShortcut);
            // If not matched by our extension, we have already prevented default.
            // This is a conscious decision to prioritize extension shortcuts.
          } else {
            // console.log("Shortcut not executed by background, response:", response, "Shortcut:", pressedShortcut);
          }
        } else {
            // console.log("No response from background for shortcut:", pressedShortcut);
        }
      }
    );
  } else {
    // console.log("Not a valid shortcut to send:", pressedShortcut);
  }
});

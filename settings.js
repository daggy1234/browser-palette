document.addEventListener("DOMContentLoaded", () => {
  const tabSwitcherDisplay = document.getElementById(
    "tabSwitcherShortcutDisplay"
  );
  const commandPaletteDisplay = document.getElementById(
    "commandPaletteShortcutDisplay"
  );
  const tabSwitcherBtn = document.getElementById("tabSwitcherCapture");
  const commandPaletteBtn = document.getElementById("commandPaletteCapture");
  const status = document.getElementById("status");
  const form = document.getElementById("settingsForm");

  // New DOM elements for Blocked Sites
  const blockedSiteInput = document.getElementById("blockedSiteInput");
  const addBlockedSiteBtn = document.getElementById("addBlockedSiteBtn");
  const blockedSitesListDiv = document.getElementById("blockedSitesList");

  // Set your desired defaults here
  const DEFAULT_TAB_SWITCHER = /Firefox/i.test(navigator.userAgent)
    ? "Cmd+Shift+K"
    : "Cmd+K";
  const DEFAULT_COMMAND_PALETTE = /Firefox/i.test(navigator.userAgent)
    ? "Cmd+Shift+P"
    : "Cmd+Shift+P";

  let tabSwitcherShortcut = "";
  let commandPaletteShortcut = "";
  let blockedSites = []; // Initialize blockedSites array

  function renderShortcutPill(displayEl, shortcut) {
    displayEl.innerHTML = "";
    if (shortcut) {
      const pill = document.createElement("span");
      pill.className =
        "inline-block bg-blue-700 text-white px-3 py-1 rounded-full text-sm font-semibold";
      pill.textContent = shortcut;
      displayEl.appendChild(pill);
    } else {
      displayEl.innerHTML =
        '<span class="text-gray-500">No shortcut set</span>';
    }
  }

  function loadShortcuts() {
    chrome.storage.sync.get(
      ["tabSwitcherShortcut", "commandPaletteShortcut"],
      (data) => {
        tabSwitcherShortcut = data.tabSwitcherShortcut || DEFAULT_TAB_SWITCHER;
        commandPaletteShortcut =
          data.commandPaletteShortcut || DEFAULT_COMMAND_PALETTE;
        renderShortcutPill(tabSwitcherDisplay, tabSwitcherShortcut);
        renderShortcutPill(commandPaletteDisplay, commandPaletteShortcut);
      }
    );
  }

  function listenForShortcut(setter, displayEl, keyName) {
    let listening = true;
    displayEl.innerHTML =
      '<span class="text-gray-400">Press your shortcut...</span>';
    function handler(e) {
      if (!listening) return;
      e.preventDefault();
      let keys = [];
      if (e.metaKey) keys.push("Cmd");
      if (e.ctrlKey) keys.push("Ctrl");
      if (e.altKey) keys.push("Alt");
      if (e.shiftKey) keys.push("Shift");
      if (!["Meta", "Control", "Alt", "Shift"].includes(e.key)) {
        keys.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      }
      const shortcut = keys.join("+");
      setter(shortcut);
      chrome.storage.sync.set({ [keyName]: shortcut }, () => {
        loadShortcuts();
      });
      listening = false;
      window.removeEventListener("keydown", handler, true);
    }
    window.addEventListener("keydown", handler, true);
  }

  tabSwitcherBtn.addEventListener("click", () => {
    listenForShortcut(
      (shortcut) => {
        tabSwitcherShortcut = shortcut;
      },
      tabSwitcherDisplay,
      "tabSwitcherShortcut"
    );
  });
  commandPaletteBtn.addEventListener("click", () => {
    listenForShortcut(
      (shortcut) => {
        commandPaletteShortcut = shortcut;
      },
      commandPaletteDisplay,
      "commandPaletteShortcut"
    );
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    chrome.storage.sync.set(
      { tabSwitcherShortcut, commandPaletteShortcut },
      () => {
        status.classList.remove("hidden");
        setTimeout(() => status.classList.add("hidden"), 2000);
      }
    );
  });

  loadShortcuts();

  // --- Blocked Sites Functionality ---

  function renderBlockedSites() {
    blockedSitesListDiv.innerHTML = ""; // Clear current list
    blockedSites.forEach((site) => {
      const siteDiv = document.createElement("div");
      siteDiv.className =
        "flex justify-between items-center p-2 bg-gray-800 rounded-md";

      const siteSpan = document.createElement("span");
      siteSpan.className = "text-gray-300";
      siteSpan.textContent = site;

      const removeButton = document.createElement("button");
      removeButton.className =
        "text-red-500 hover:text-red-700 font-semibold remove-blocked-site-btn";
      removeButton.textContent = "Remove";
      removeButton.dataset.site = site; // Store site URL in data attribute

      removeButton.addEventListener("click", (event) => {
        const siteToRemove = event.target.dataset.site;
        blockedSites = blockedSites.filter((s) => s !== siteToRemove);
        chrome.storage.sync.set({ blockedSites: blockedSites }, () => {
          renderBlockedSites(); // Re-render the list
          // Optionally, show a status message for removal
        });
      });

      siteDiv.appendChild(siteSpan);
      siteDiv.appendChild(removeButton);
      blockedSitesListDiv.appendChild(siteDiv);
    });
  }

  function loadBlockedSites() {
    chrome.storage.sync.get(["blockedSites"], (data) => {
      blockedSites = data.blockedSites || [];
      renderBlockedSites();
    });
  }

  addBlockedSiteBtn.addEventListener("click", () => {
    const newSite = blockedSiteInput.value.trim();
    if (newSite === "") {
      // Optionally, show an error message to the user
      console.warn("Blocked site input is empty.");
      return;
    }
    if (blockedSites.includes(newSite)) {
      // Optionally, show an error message (e.g., site already exists)
      console.warn(`Site "${newSite}" is already in the blocked list.`);
      blockedSiteInput.value = ""; // Clear input even if duplicate
      return;
    }

    blockedSites.push(newSite);
    chrome.storage.sync.set({ blockedSites: blockedSites }, () => {
      renderBlockedSites();
      blockedSiteInput.value = ""; // Clear input field
      // Optionally, show a success message
    });
  });

  // Initial load of blocked sites
  loadBlockedSites();
});

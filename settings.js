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

  let tabSwitcherShortcut = "";
  let commandPaletteShortcut = "";

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

  // Load settings
  chrome.storage.sync.get(
    ["tabSwitcherShortcut", "commandPaletteShortcut"],
    (data) => {
      tabSwitcherShortcut = data.tabSwitcherShortcut || "";
      commandPaletteShortcut = data.commandPaletteShortcut || "";
      renderShortcutPill(tabSwitcherDisplay, tabSwitcherShortcut);
      renderShortcutPill(commandPaletteDisplay, commandPaletteShortcut);
    }
  );

  function listenForShortcut(setter, displayEl) {
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
      // Only add the main key if it's not a modifier
      if (!["Meta", "Control", "Alt", "Shift"].includes(e.key)) {
        keys.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      }
      const shortcut = keys.join("+");
      setter(shortcut);
      renderShortcutPill(displayEl, shortcut);
      listening = false;
      window.removeEventListener("keydown", handler, true);
    }
    window.addEventListener("keydown", handler, true);
  }

  tabSwitcherBtn.addEventListener("click", () => {
    listenForShortcut((shortcut) => {
      tabSwitcherShortcut = shortcut;
    }, tabSwitcherDisplay);
  });
  commandPaletteBtn.addEventListener("click", () => {
    listenForShortcut((shortcut) => {
      commandPaletteShortcut = shortcut;
    }, commandPaletteDisplay);
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
});

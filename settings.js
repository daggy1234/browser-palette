document.addEventListener("DOMContentLoaded", () => {
  const tabSwitcherInput = document.getElementById("tabSwitcherShortcut");
  const commandPaletteInput = document.getElementById("commandPaletteShortcut");
  const status = document.getElementById("status");
  const form = document.getElementById("settingsForm");

  // Load settings
  chrome.storage.sync.get(
    ["tabSwitcherShortcut", "commandPaletteShortcut"],
    (data) => {
      if (data.tabSwitcherShortcut)
        tabSwitcherInput.value = data.tabSwitcherShortcut;
      if (data.commandPaletteShortcut)
        commandPaletteInput.value = data.commandPaletteShortcut;
    }
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const tabSwitcherShortcut = tabSwitcherInput.value.trim();
    const commandPaletteShortcut = commandPaletteInput.value.trim();
    chrome.storage.sync.set(
      { tabSwitcherShortcut, commandPaletteShortcut },
      () => {
        // Try to update commands (only works in Chrome, not Firefox)
        if (chrome.commands && chrome.commands.update) {
          if (tabSwitcherShortcut) {
            chrome.commands.update({
              name: "open-tab-switcher",
              shortcut: tabSwitcherShortcut,
            });
          }
          if (commandPaletteShortcut) {
            chrome.commands.update({
              name: "open-general-palette",
              shortcut: commandPaletteShortcut,
            });
          }
        }
        status.classList.remove("hidden");
        setTimeout(() => status.classList.add("hidden"), 2000);
      }
    );
  });
});

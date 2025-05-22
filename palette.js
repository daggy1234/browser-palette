// palette.js

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const resultsList = document.getElementById("resultsList");
  const modeIndicator = document.getElementById("palette-mode-indicator");
  let currentMode = "general"; // 'tab-switcher' or 'general'
  let allTabs = [];
  let filteredResults = [];
  let selectedIndex = -1;

  const urlParams = new URLSearchParams(window.location.search);
  currentMode = urlParams.get("mode") || "general";
  updateModeIndicatorAndPlaceholder();

  function updateModeIndicatorAndPlaceholder() {
    if (modeIndicator) {
      modeIndicator.textContent =
        currentMode === "tab-switcher" ? "Tab Switcher" : "Commands";
    }
    if (searchInput) {
      searchInput.placeholder =
        currentMode === "tab-switcher"
          ? "Search open tabs..."
          : "Type a command...";
    }
  }

  function closePalette() {
    window.parent.postMessage({ action: "closePalette" }, "*");
  }

  window.addEventListener("message", (event) => {
    if (
      event.source !== window.parent &&
      event.origin !== chrome.runtime.getURL("").slice(0, -1)
    ) {
      // Check origin for security
      // console.warn("Message from unexpected source:", event.origin, "Expected:", chrome.runtime.getURL('').slice(0,-1));
      // return; // Be careful with strict origin checks in extensions if not fully tested
    }

    const { action, mode: newMode } = event.data;

    if (action === "focusInput") {
      searchInput.focus();
      if (newMode) {
        currentMode = newMode;
        updateModeIndicatorAndPlaceholder();
        loadInitialDataForMode();
      }
    } else if (action === "updateMode") {
      currentMode = newMode;
      updateModeIndicatorAndPlaceholder();
      searchInput.value = "";
      loadInitialDataForMode();
    }
  });

  function loadInitialDataForMode() {
    if (currentMode === "tab-switcher") {
      fetchAndRenderTabs("");
    } else {
      renderGeneralCommands("");
    }
  }

  async function fetchAndRenderTabs(query) {
    if (currentMode !== "tab-switcher") return;
    try {
      const response = await chrome.runtime.sendMessage({
        action: "queryTabs",
      });
      if (response && response.tabs) {
        allTabs = response.tabs;
        filterAndDisplayTabs(query);
      } else {
        resultsList.innerHTML =
          '<li class="p-4 text-center text-gray-500">No tabs found or error loading.</li>';
      }
    } catch (error) {
      console.error("Error fetching tabs:", error);
      resultsList.innerHTML = `<li class="p-4 text-center text-gray-500">Error: ${error.message}.</li>`;
    }
  }

  function getWebsiteName(url) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === "chrome:") {
        // For chrome:// URLs, use a more descriptive name if possible
        if (url.startsWith("chrome://newtab")) return "New Tab";
        if (url.startsWith("chrome://extensions")) return "Extensions";
        if (url.startsWith("chrome://history")) return "History";
        if (url.startsWith("chrome://bookmarks")) return "Bookmarks";
        if (url.startsWith("chrome://settings")) return "Settings";
        if (url.startsWith("chrome://downloads")) return "Downloads";
        // Fallback for other chrome URLs
        return parsedUrl.hostname || "Chrome Page";
      }
      // Remove 'www.' if it exists for cleaner display
      let hostname = parsedUrl.hostname;
      if (hostname.startsWith("www.")) {
        hostname = hostname.substring(4);
      }
      return hostname || "Unknown Website";
    } catch (e) {
      // If URL is invalid or cannot be parsed (e.g. internal pages not following http/https)
      if (url && url.includes("://")) {
        return url.split("://")[0]; // e.g. "file" or "about"
      }
      return "Invalid URL";
    }
  }

  function filterAndDisplayTabs(query) {
    const lowerQuery = query.toLowerCase();
    filteredResults = allTabs.filter((tab) => {
      const websiteName = getWebsiteName(tab.url).toLowerCase();
      return (
        tab.title.toLowerCase().includes(lowerQuery) ||
        websiteName.includes(lowerQuery)
      ); // Search website name too
    });
    renderResults(filteredResults, "tab");
  }

  function renderGeneralCommands(query) {
    if (currentMode !== "general") return;
    const commands = [
      {
        id: "cmd_new_tab",
        title: "Open New Tab",
        actionDetail: "new_tab",
        icon: "➕",
      }, // Example with emoji icon
      {
        id: "cmd_history",
        title: "Show History",
        actionDetail: "show_history",
        icon: "📜",
      },
      {
        id: "cmd_bookmarks",
        title: "Show Bookmarks",
        actionDetail: "show_bookmarks",
        icon: "🔖",
      },
    ];
    const lowerQuery = query.toLowerCase();
    filteredResults = commands.filter((cmd) =>
      cmd.title.toLowerCase().includes(lowerQuery)
    );
    renderResults(filteredResults, "command");
  }

  function renderResults(items, type) {
    resultsList.innerHTML = "";
    selectedIndex = -1;

    if (items.length === 0) {
      resultsList.innerHTML = `<li class="p-4 text-center text-gray-400 rounded-md">No ${
        type === "tab" ? "tabs" : "commands"
      } found.</li>`;
      return;
    }

    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.className =
        "result-item px-3 py-2.5 rounded-lg flex items-center space-x-3 cursor-pointer"; // Tailwind classes for item
      li.dataset.index = index;

      if (type === "tab") {
        li.dataset.tabId = item.id;

        const favIconContainer = document.createElement("div");
        favIconContainer.className = "flex-shrink-0";

        const favIcon = document.createElement("img");
        favIcon.src =
          item.favIconUrl ||
          `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(
            item.url
          )}`; // Higher res favicon, better fallback
        favIcon.alt = "";
        favIcon.className = "fav-icon";

        const placeholder = document.createElement("div");
        placeholder.className = "placeholder-icon hidden"; // Start hidden
        const titleInitial = item.title
          ? item.title.charAt(0).toUpperCase()
          : getWebsiteName(item.url)
          ? getWebsiteName(item.url).charAt(0).toUpperCase()
          : "?";
        placeholder.textContent = titleInitial;

        favIcon.onerror = function () {
          this.classList.add("hidden"); // Hide broken image
          placeholder.classList.remove("hidden"); // Show placeholder
        };
        favIcon.onload = function () {
          // Ensure placeholder is hidden if image loads
          placeholder.classList.add("hidden");
          this.classList.remove("hidden");
        };

        // Check if src is valid, otherwise show placeholder immediately
        if (!item.favIconUrl && !item.url.startsWith("http")) {
          // No good favicon source for non-http
          favIcon.classList.add("hidden");
          placeholder.classList.remove("hidden");
        }

        favIconContainer.appendChild(favIcon);
        favIconContainer.appendChild(placeholder);
        li.appendChild(favIconContainer);

        const textDiv = document.createElement("div");
        textDiv.className = "tab-info flex-grow overflow-hidden"; // Ensure this class is present

        const titleDiv = document.createElement("div");
        titleDiv.className = "tab-title truncate text-sm"; // Tailwind classes for title
        titleDiv.textContent = item.title || "Untitled Tab";
        textDiv.appendChild(titleDiv);

        const websiteNameDiv = document.createElement("div");
        websiteNameDiv.className = "website-name truncate"; // Tailwind classes for website name
        websiteNameDiv.textContent = getWebsiteName(item.url);
        textDiv.appendChild(websiteNameDiv);
        li.appendChild(textDiv);
      } else if (type === "command") {
        li.dataset.commandAction = item.actionDetail;
        // Optional: Icon for command
        if (item.icon) {
          const iconSpan = document.createElement("span");
          iconSpan.className = "mr-2 text-lg"; // Style for emoji/icon
          iconSpan.textContent = item.icon;
          li.appendChild(iconSpan);
        }
        const commandTitle = document.createElement("span");
        commandTitle.className = "tab-title"; // Reuse tab title style for consistency
        commandTitle.textContent = item.title;
        li.appendChild(commandTitle);
      }

      li.addEventListener("click", () => {
        handleSelection(item, type);
      });
      resultsList.appendChild(li);
    });
    updateSelectionUI(); // Initial call to ensure no selection highlight
  }

  function updateSelectionUI() {
    const items = resultsList.querySelectorAll("li.result-item");
    items.forEach((itemEl, idx) => {
      // Renamed item to itemEl to avoid conflict
      if (idx === selectedIndex) {
        itemEl.classList.add("selected");
        itemEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else {
        itemEl.classList.remove("selected");
      }
    });
  }

  function handleSelection(selectedItem, type) {
    // Renamed item to selectedItem
    if (!selectedItem) return;

    if (type === "tab") {
      chrome.runtime.sendMessage(
        { action: "switchToTab", tabId: selectedItem.id },
        (response) => {
          if (response && response.success) {
            closePalette();
          }
        }
      );
    } else if (type === "command") {
      window.parent.postMessage(
        { action: "performGeneralAction", details: selectedItem },
        "*"
      );
    }
  }

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value;
    if (currentMode === "tab-switcher") {
      filterAndDisplayTabs(query);
    } else {
      renderGeneralCommands(query);
    }
    // Reset selection on new input, but don't clear if user is just arrowing
    if (e.inputType && e.inputType !== "insertTextFromPaste") {
      // Heuristic: don't reset if navigating
      // selectedIndex = -1; // This was causing issues with arrow keys after typing
      // updateSelectionUI();
    }
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePalette();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredResults.length) {
        handleSelection(
          filteredResults[selectedIndex],
          currentMode === "tab-switcher" ? "tab" : "command"
        );
      } else if (filteredResults.length > 0 && selectedIndex === -1) {
        // If no arrow selection, take first item
        handleSelection(
          filteredResults[0],
          currentMode === "tab-switcher" ? "tab" : "command"
        );
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredResults.length > 0) {
        selectedIndex = (selectedIndex + 1) % filteredResults.length;
        updateSelectionUI();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredResults.length > 0) {
        selectedIndex =
          (selectedIndex - 1 + filteredResults.length) % filteredResults.length;
        updateSelectionUI();
      }
    }
  });

  loadInitialDataForMode();
  searchInput.focus();
});

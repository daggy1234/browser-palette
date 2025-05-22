import "./src/styles.css";

// palette.js

// NOTE: Chrome extensions cannot inject content scripts into chrome://newtab, chrome://*, or some other special pages due to browser security restrictions. This is a browser limitation, not a bug in this extension. See: https://developer.chrome.com/docs/extensions/mv3/declare_permissions/#host-permissions

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
    window.parent.postMessage({ action: "closePalette" }, "*"); // No origin check needed for posting to parent
  }

  window.addEventListener("message", (event) => {
    // Critical security check: only accept messages from the parent window (content script)
    if (event.source !== window.parent) {
      console.warn(
        "Palette.js: Ignoring message from non-parent source:",
        event.source,
        "Origin:",
        event.origin
      );
      return;
    }

    // The primary security check `event.source === window.parent` is crucial for iframes.
    // Origin checking for the parent (content script) is tricky as it inherits the page's origin.
    // Trust is based on the content script itself being secure and validating data if needed.

    const { action, mode: newMode, ...data } = event.data; // Destructure for clarity
    console.debug("Palette received message:", event.data);

    if (action === "focusInput") {
      searchInput.focus(); // Always ensure focus
      if (newMode && newMode !== currentMode) {
        console.info(
          `Mode changed via focusInput: from ${currentMode} to ${newMode}`
        );
        currentMode = newMode;
        updateModeIndicatorAndPlaceholder();
        searchInput.value = ""; // Clear input on mode change for a fresh start
        loadInitialDataForMode(); // Reload data for the new mode
      } else if (newMode && newMode === currentMode) {
        console.debug(
          `Mode confirmed via focusInput: ${currentMode}. Input focused.`
        );
        // Data is typically loaded by `loadInitialDataForMode` if mode changes.
        // If data could become stale even without a mode change and needs refresh on focus, add logic here.
      }
    }
    // Note: The 'updateMode' message type from older versions is now handled by 'focusInput'
    // when 'newMode' is present and different.
  });

  /**
   * Clears current results and loads new data based on the current palette mode.
   * Typically called when the mode changes or the palette is first initialized.
   */
  function loadInitialDataForMode() {
    console.info(`Loading initial data for mode: ${currentMode}`);
    resultsList.innerHTML = ""; // Clear previous results from the list
    filteredResults = []; // Reset the array of filtered results
    selectedIndex = -1; // Reset the selection index

    if (currentMode === "tab-switcher") {
      fetchAndRenderTabs(""); // Fetch all tabs for tab-switcher mode
    } else {
      renderGeneralCommands(""); // Render predefined general commands
    }
  }

  /**
   * Fetches open tabs from the background script and renders them.
   * @param {string} query - The search query to filter tabs (initially empty).
   */
  async function fetchAndRenderTabs(query) {
    if (currentMode !== "tab-switcher") {
      console.warn(
        "fetchAndRenderTabs called but currentMode is not 'tab-switcher'. Aborting."
      );
      return;
    }
    console.debug("Fetching tabs for query:", query);
    try {
      // chrome.runtime.sendMessage returns a Promise when used with async/await.
      // Errors (like disconnected port) will cause the promise to reject and be caught.
      const response = await chrome.runtime.sendMessage({
        action: "queryTabs",
      });

      // It's good practice to check response structure, even if errors are caught.
      if (response && response.tabs) {
        allTabs = response.tabs;
        filterAndDisplayTabs(query);
      } else {
        console.warn(
          "No tabs found or unexpected response structure from 'queryTabs'. Response:",
          response
        );
        resultsList.innerHTML =
          '<li class="p-4 text-center text-gray-500">No tabs found or error loading.</li>';
      }
    } catch (error) {
      console.error(
        "Error during 'queryTabs' sendMessage or processing:",
        error.message
      );
      resultsList.innerHTML = `<li class="p-4 text-center text-gray-500">Error fetching tabs: ${error.message}.</li>`;
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
      },
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
      {
        id: "cmd_devtools",
        title: "Open DevTools",
        actionDetail: "open_devtools",
        icon: "🛠️",
      },
      {
        id: "cmd_settings",
        title: "Open Settings",
        actionDetail: "open_settings",
        icon: "⚙️",
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
    selectedIndex = items.length > 0 ? 0 : -1; // Select first item if any

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
          iconSpan.className =
            "flex items-center justify-center w-6 h-6 rounded bg-blue-500/10 text-blue-500 text-lg font-semibold mr-2";
          iconSpan.textContent = item.icon;
          li.appendChild(iconSpan);
        }
        const textDiv = document.createElement("div");
        textDiv.className = "tab-info flex-grow overflow-hidden";
        const commandTitle = document.createElement("div");
        commandTitle.className = "tab-title truncate text-sm";
        commandTitle.textContent = item.title;
        textDiv.appendChild(commandTitle);
        textDiv.appendChild(document.createElement("div")); // For alignment with website name
        li.appendChild(textDiv);
      }

      li.addEventListener("click", () => {
        handleSelection(item, type);
      });
      resultsList.appendChild(li);
    });
    updateSelectionUI(); // Initial call to ensure selection highlight
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

  /**
   * Handles the selection of an item from the results list.
   * @param {object} selectedItem - The tab or command object that was selected.
   * @param {string} type - 'tab' or 'command'.
   */
  function handleSelection(selectedItem, type) {
    if (!selectedItem) {
      console.warn("handleSelection called with no selectedItem.");
      return;
    }

    console.debug(`Handling selection: Type - ${type}, Item -`, selectedItem);

    if (type === "tab") {
      chrome.runtime.sendMessage(
        { action: "switchToTab", tabId: selectedItem.id },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error switching tab:",
              chrome.runtime.lastError.message
            );
            return;
          }
          if (response && response.success) {
            closePalette();
          } else {
            console.warn(
              "switchToTab was not successful or no response.",
              response
            );
          }
        }
      );
    } else if (type === "command") {
      if (selectedItem.actionDetail === "open_settings") {
        // Open settings page in a new tab
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL("settings.html"), "_blank");
        }
        closePalette();
        return;
      }
      // Handle new tab, bookmarks, history, devtools
      if (selectedItem.actionDetail === "new_tab") {
        chrome.runtime.sendMessage({ action: "openNewTab" });
        closePalette();
        return;
      }
      if (selectedItem.actionDetail === "show_bookmarks") {
        chrome.runtime.sendMessage({ action: "openBookmarks" });
        closePalette();
        return;
      }
      if (selectedItem.actionDetail === "show_history") {
        chrome.runtime.sendMessage({ action: "openHistory" });
        closePalette();
        return;
      }
      if (selectedItem.actionDetail === "open_devtools") {
        // Not possible to programmatically open DevTools, show alert
        alert(
          "Due to browser security, extensions cannot open DevTools automatically. Use Cmd+Opt+I or F12."
        );
        closePalette();
        return;
      }
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
    // Consider resetting selectedIndex to -1 on new typed input,
    // but be careful not to interfere with arrow key navigation.
    // The current behavior (not resetting selectedIndex here) is often preferred.
    // if (e.inputType && e.inputType.startsWith("insert")) {
    //   selectedIndex = -1;
    //   updateSelectionUI();
    // }
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePalette();
      return; // Prevent other keydown actions for Escape
    }

    if (filteredResults.length > 0) {
      if (e.key === "Enter") {
        e.preventDefault(); // Prevent default form submission if any
        const itemToSelect =
          selectedIndex >= 0 && selectedIndex < filteredResults.length
            ? filteredResults[selectedIndex]
            : // If no arrow key selection yet, Enter on the first item
            selectedIndex === -1 && filteredResults.length > 0
            ? filteredResults[0]
            : null;
        if (itemToSelect) {
          handleSelection(
            itemToSelect,
            currentMode === "tab-switcher" ? "tab" : "command"
          );
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault(); // Prevent page scrolling
        selectedIndex = (selectedIndex + 1) % filteredResults.length;
        updateSelectionUI();
      } else if (e.key === "ArrowUp") {
        e.preventDefault(); // Prevent page scrolling
        selectedIndex =
          (selectedIndex - 1 + filteredResults.length) % filteredResults.length;
        updateSelectionUI();
      }
    } else if (e.key === "Enter") {
      // No results, and Enter is pressed
      e.preventDefault(); // Prevent any default action
      console.debug("Enter pressed with no results to select.");
      // Optionally, provide visual feedback like a slight shake or a message
    }
  });

  // Initial setup when the DOM is fully loaded
  loadInitialDataForMode(); // Load tabs or commands based on the initial mode
  searchInput.focus(); // Focus the search input field
  console.info(`Palette.js initialized. Mode: ${currentMode}.`);

  // Inform the parent window (content_script.js) that the palette is ready.
  // This is a good practice for inter-frame communication.
  window.parent.postMessage({ action: "paletteReady", mode: currentMode }, "*");
});

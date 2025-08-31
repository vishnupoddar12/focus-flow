// background.js - Service Worker

/**
 * Manages the background logic for the FocusFlow extension.
 * This class handles tab blocking, state initialization, and notifications.
 */
class FocusFlowBackground {
  /**
   * Defines the keys used for storing data in chrome.storage.local.
   * @returns {object} An object containing the storage keys.
   */
  static get STORAGE_KEYS() {
    return {
      TIMER_STATE: "timerState",
      END_TIME: "endTime",
      DURATION: "duration",
    };
  }

  /**
   * Defines the possible states of the timer.
   * @returns {object} An object containing the timer states.
   */
  static get TIMER_STATE() {
    return {
      START: "start",
      RUNNING: "running",
      END: "end",
    };
  }

  /**
   * Initializes the FocusFlowBackground instance and sets up listeners.
   */
  constructor() {
    this.setupListeners();
  }

  /**
   * Sets up the necessary event listeners for the extension.
   */
  setupListeners() {
    chrome.runtime.onInstalled.addListener(this.handleInstallation.bind(this));
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  /**
   * Handles the initial setup when the extension is installed.
   * Sets the initial state in storage.
   */
  handleInstallation() {
    chrome.storage.local.set(
      {
        [FocusFlowBackground.STORAGE_KEYS.TIMER_STATE]:
          FocusFlowBackground.TIMER_STATE.START,
        [FocusFlowBackground.STORAGE_KEYS.END_TIME]: null,
        [FocusFlowBackground.STORAGE_KEYS.DURATION]: 0,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error("Error initializing state:", chrome.runtime.lastError);
        } else {
          console.log("FocusFlow initialized.");
        }
      }
    );
  }

  /**
   * Converts a user-defined wildcard string to a regular expression.
   * @param {string} wildcard - The wildcard string (e.g., *google.com*).
   * @returns {RegExp} - A regular expression object.
   */
  wildcardToRegex(wildcard) {
    const escaped = wildcard.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    const regexString = escaped.replace(/\*/g, ".*");
    return new RegExp(`^${regexString}$`, "i");
  }

  /**
   * Handles tab updates to block sites when the timer is not running.
   * @param {number} tabId - The ID of the updated tab.
   * @param {object} changeInfo - An object containing information about the changes to the tab.
   * @param {object} tab - The updated tab object.
   */
  async handleTabUpdate(tabId, changeInfo, tab) {
    if (tab.url && changeInfo.status === "complete") {
      try {
        const result = await chrome.storage.local.get([
          FocusFlowBackground.STORAGE_KEYS.TIMER_STATE,
          "excludedUrls",
        ]);

        const state = result[FocusFlowBackground.STORAGE_KEYS.TIMER_STATE];
        const excludedUrls = result.excludedUrls || [];

        if (
          state !== FocusFlowBackground.TIMER_STATE.RUNNING &&
          this.isUrlBlockable(tab.url, excludedUrls)
        ) {
          this.redirectToHomePage(tabId);
        }
      } catch (error) {
        console.error("FocusFlow: Error handling tab update:", error);
      }
    }
  }

  /**
   * Handles incoming messages from other parts of the extension.
   * @param {object} request - The message sent by the calling script.
   * @param {object} sender - An object containing information about the script that sent the message.
   * @param {function} sendResponse - A function to call to send a response.
   */
  handleMessage(request, sender, sendResponse) {
    if (request.type === "timerFinished") {
      this.showTimerFinishedNotification();
    }
  }

  /**
   * Checks if a given URL should be blocked.
   * @param {string} url - The URL to check.
   * @param {string[]} excludedUrls - An array of user-defined wildcard patterns.
   * @returns {boolean} - True if the URL is blockable, false otherwise.
   */
  isUrlBlockable(url, excludedUrls) {
    const isChromeInternal = url.startsWith("chrome://");
    const isExtensionPage = url.includes(chrome.runtime.id);
    const isNewTabPage = url === "chrome://newtab/";
    const isWebPage = url.startsWith("http://") || url.startsWith("https://");

    if (isChromeInternal || isExtensionPage || isNewTabPage || !isWebPage) {
      return false;
    }

    // Check against the user's exclusion list
    for (const wildcard of excludedUrls) {
      const regex = this.wildcardToRegex(wildcard);
      if (regex.test(url)) {
        return false; // This URL is excluded, so it's not blockable
      }
    }

    return true; // The URL is not in the exclusion list, so it's blockable
  }

  /**
   * Redirects a tab to the extension's home page.
   * @param {number} tabId - The ID of the tab to redirect.
   */
  redirectToHomePage(tabId) {
    chrome.tabs.update(
      tabId,
      { url: chrome.runtime.getURL("home.html") },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error redirecting tab:",
            chrome.runtime.lastError.message
          );
        }
      }
    );
  }

  /**
   * Shows a notification when the timer session is complete.
   */
  showTimerFinishedNotification() {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon48.png",
      title: "FocusFlow Session Complete!",
      message: "Time to log your session and take a break.",
      priority: 2,
    });
  }
}

// Initialize the background script logic.
new FocusFlowBackground();

// home.js - Logic for the main extension UI

/**
 * Manages the user interface and logic for the FocusFlow extension's home page.
 */
class FocusFlowHome {
  // --- Constants ---

  static get TIMER_STATE() {
    return {
      START: "start",
      RUNNING: "running",
      END: "end",
    };
  }

  static get STORAGE_KEYS() {
    return {
      TIMER_STATE: "timerState",
      END_TIME: "endTime",
      DURATION: "duration",
      SESSION_ID: "sessionId",
      CURRENT_SUMMARY: "currentSummary",
      CURRENT_NOTE: "currentNote",
    };
  }

  static get DB_CONFIG() {
    return {
      NAME: "FocusFlowDB",
      STORE: "fileHandles",
      KEY: "logFileHandle",
    };
  }

  static get MIN_SUMMARY_WORDS() {
    return 50;
  }

  // --- Initialization ---

  constructor() {
    this.cacheDOMElements();
    this.initializeState();
    this.setupEventListeners();
    this.initializeView();
  }

  /**
   * Caches references to frequently used DOM elements.
   */
  cacheDOMElements() {
    this.startStateDiv = document.getElementById("start-state");
    this.runningStateDiv = document.getElementById("running-state");
    this.endStateDiv = document.getElementById("end-state");
    this.timerDisplay = document.getElementById("timer-display");
    this.summarySection = document.getElementById("summary-section");
    this.summaryInput = document.getElementById("summary-input");
    this.wordCounter = document.getElementById("word-counter");
    this.submitLogBtn = document.getElementById("submit-log-btn");
    this.noteInput = document.getElementById("note-input");
    this.submitNoteBtn = document.getElementById("submit-note-btn");
    this.pomoLogContainer = document.getElementById("pomo-log-container");
    this.errorSection = document.getElementById("error-section");
    this.errorMessage = document.getElementById("error-message");
  }

  /**
   * Initializes the component's state variables.
   */
  initializeState() {
    this.countdownInterval = null;
    this.fileHandle = null;
    this.debouncedSyncSummary = this.debounce((text) => {
      chrome.storage.local.set({
        [FocusFlowHome.STORAGE_KEYS.CURRENT_SUMMARY]: text,
      });
    }, 250);
    this.debouncedSyncNote = this.debounce((text) => {
      chrome.storage.local.set({
        [FocusFlowHome.STORAGE_KEYS.CURRENT_NOTE]: text,
      });
    }, 250);
  }

  /**
   * Sets up all necessary event listeners.
   */
  setupEventListeners() {
    document.querySelectorAll(".start-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const duration = parseInt(e.target.dataset.duration, 10);
        this.startTimer(duration);
      });
    });

    this.summaryInput.addEventListener(
      "input",
      this.validateSummary.bind(this)
    );
    this.noteInput.addEventListener("input", (e) => {
      this.debouncedSyncNote(e.target.value);
    });
    this.submitLogBtn.addEventListener("click", this.saveLog.bind(this));
    this.submitNoteBtn.addEventListener("click", this.saveNote.bind(this));

    chrome.storage.onChanged.addListener(this.handleStorageChange.bind(this));
  }

  /**
   * Initializes the view when the DOM is loaded.
   */
  async initializeView() {
    this.fileHandle = await this.getFileHandle();
    this.hideError();
    this.updateUI();
    this.loadLogs();
  }

  // --- IndexedDB Utility for File Handle Persistence ---

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(FocusFlowHome.DB_CONFIG.NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(FocusFlowHome.DB_CONFIG.STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async setFileHandle(handle) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FocusFlowHome.DB_CONFIG.STORE, "readwrite");
      const store = tx.objectStore(FocusFlowHome.DB_CONFIG.STORE);
      const request = store.put(handle, FocusFlowHome.DB_CONFIG.KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFileHandle() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FocusFlowHome.DB_CONFIG.STORE, "readonly");
      const store = tx.objectStore(FocusFlowHome.DB_CONFIG.STORE);
      const request = store.get(FocusFlowHome.DB_CONFIG.KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Utilities ---

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // --- Event Handlers ---

  /**
   * Listens for changes in chrome.storage.local and updates the UI accordingly.
   * This is the core function for ensuring that all open FocusFlow tabs stay in sync.
   *
   * @param {object} changes - An object where keys are the names of the storage items that changed,
   * and values are objects describing the change (containing `oldValue` and `newValue`).
   * @param {string} namespace - The name of the storage area that changed. For this extension, it will always be "local".
   */
  handleStorageChange(changes, namespace) {
    if (namespace !== "local") return;

    // Syncs the session summary textarea if it was changed in another tab.
    if (changes[FocusFlowHome.STORAGE_KEYS.CURRENT_SUMMARY]) {
      const newText =
        changes[FocusFlowHome.STORAGE_KEYS.CURRENT_SUMMARY].newValue || "";
      if (this.summaryInput.value !== newText) {
        this.summaryInput.value = newText;
        this.validateSummary();
      }
    }

    // Syncs the note textarea if it was changed in another tab.
    if (changes[FocusFlowHome.STORAGE_KEYS.CURRENT_NOTE]) {
      const newText =
        changes[FocusFlowHome.STORAGE_KEYS.CURRENT_NOTE].newValue || "";
      if (this.noteInput.value !== newText) {
        this.noteInput.value = newText;
      }
    }

    // Responds to changes in the global timer state.
    if (changes[FocusFlowHome.STORAGE_KEYS.TIMER_STATE]) {
      this.updateUI();
      if (
        changes[FocusFlowHome.STORAGE_KEYS.TIMER_STATE].newValue ===
        FocusFlowHome.TIMER_STATE.START
      ) {
        this.loadLogs();
      }
    }
  }

  // --- UI Management ---

  showError(message) {
    this.errorMessage.textContent = message;
    this.errorSection.classList.remove("hidden");
  }

  hideError() {
    this.errorSection.classList.add("hidden");
  }

  updateUI() {
    chrome.storage.local.get(
      [
        FocusFlowHome.STORAGE_KEYS.TIMER_STATE,
        FocusFlowHome.STORAGE_KEYS.END_TIME,
        FocusFlowHome.STORAGE_KEYS.CURRENT_SUMMARY,
      ],
      (result) => {
        const state =
          result[FocusFlowHome.STORAGE_KEYS.TIMER_STATE] ||
          FocusFlowHome.TIMER_STATE.START;

        // Sync the note input as well
        this.noteInput.value =
          result[FocusFlowHome.STORAGE_KEYS.CURRENT_NOTE] || "";

        // Hide all sections initially
        this.startStateDiv.classList.add("hidden");
        this.runningStateDiv.classList.add("hidden");
        this.endStateDiv.classList.add("hidden");
        this.summarySection.classList.add("hidden");

        if (state === FocusFlowHome.TIMER_STATE.START) {
          this.startStateDiv.classList.remove("hidden");
        } else if (state === FocusFlowHome.TIMER_STATE.RUNNING) {
          this.runningStateDiv.classList.remove("hidden");
          this.startCountdown(result[FocusFlowHome.STORAGE_KEYS.END_TIME]);
        } else if (state === FocusFlowHome.TIMER_STATE.END) {
          this.endStateDiv.classList.remove("hidden");
          this.summarySection.classList.remove("hidden");
          this.summaryInput.value =
            result[FocusFlowHome.STORAGE_KEYS.CURRENT_SUMMARY] || "";
          this.validateSummary();
        }
      }
    );
  }

  // --- Timer Logic ---

  startTimer(durationInMinutes) {
    const now = new Date();
    const endTime = new Date(now.getTime() + durationInMinutes * 60 * 1000);
    const sessionId = crypto.randomUUID();

    chrome.storage.local.set(
      {
        [FocusFlowHome.STORAGE_KEYS.TIMER_STATE]:
          FocusFlowHome.TIMER_STATE.RUNNING,
        [FocusFlowHome.STORAGE_KEYS.END_TIME]: endTime.toISOString(),
        [FocusFlowHome.STORAGE_KEYS.DURATION]: durationInMinutes,
        [FocusFlowHome.STORAGE_KEYS.SESSION_ID]: sessionId,
        [FocusFlowHome.STORAGE_KEYS.CURRENT_SUMMARY]: "",
      },
      () => {
        console.log(`Timer started for ${durationInMinutes} minutes.`);
        this.updateUI();
      }
    );
  }

  startCountdown(endTimeISO) {
    const endTime = new Date(endTimeISO);

    if (isNaN(endTime.getTime())) {
      console.error("Invalid endTime received from storage:", endTimeISO);
      this.showError(
        "An error occurred with the timer. Please start a new session."
      );
      this.resetToStartState();
      return;
    }

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    this.countdownInterval = setInterval(() => {
      const now = new Date();
      const timeLeft = endTime - now;

      if (timeLeft <= 0) {
        clearInterval(this.countdownInterval);
        this.timerDisplay.textContent = "00:00";
        chrome.storage.local.set(
          {
            [FocusFlowHome.STORAGE_KEYS.TIMER_STATE]:
              FocusFlowHome.TIMER_STATE.END,
          },
          () => {
            chrome.runtime.sendMessage({ type: "timerFinished" });
            this.updateUI();
          }
        );
        return;
      }

      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

      this.timerDisplay.textContent = `${String(minutes).padStart(
        2,
        "0"
      )}:${String(seconds).padStart(2, "0")}`;
    }, 1000);
  }

  // --- Summary & Logging Logic ---

  validateSummary() {
    const text = this.summaryInput.value;
    this.debouncedSyncSummary(text);

    const words = text.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    this.wordCounter.textContent = `${wordCount} / 50 words`;

    if (wordCount >= FocusFlowHome.MIN_SUMMARY_WORDS) {
      this.submitLogBtn.disabled = false;
      this.wordCounter.style.color = "var(--success-color)";
    } else {
      this.submitLogBtn.disabled = true;
      this.wordCounter.style.color = "var(--secondary-text)";
    }
  }

  async saveLog() {
    const summaryText = this.summaryInput.value;
    if (summaryText.trim().length === 0) return;

    const { duration, endTime, sessionId } = await chrome.storage.local.get([
      FocusFlowHome.STORAGE_KEYS.DURATION,
      FocusFlowHome.STORAGE_KEYS.END_TIME,
      FocusFlowHome.STORAGE_KEYS.SESSION_ID,
    ]);
    const endDate = new Date(endTime);
    const startDate = new Date(endDate.getTime() - duration * 60 * 1000);

    const logEntry = {
      type: "session",
      sessionId: sessionId,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      duration: duration,
      summary_text: summaryText,
    };

    await this.appendLogToFile(logEntry);
    this.resetToStartState();
  }

  async saveNote() {
    const noteText = this.noteInput.value;
    if (noteText.trim().length === 0) return;

    const logEntry = {
      type: "note",
      sessionId: crypto.randomUUID(), // For editing purposes
      end_time: new Date().toISOString(),
      summary_text: noteText,
    };

    await this.appendLogToFile(logEntry);
    this.noteInput.value = ""; // Clear the input

    // Clear the note from storage to sync the empty state across all tabs.
    chrome.storage.local.set({ [FocusFlowHome.STORAGE_KEYS.CURRENT_NOTE]: "" });
    this.loadLogs();
  }

  async appendLogToFile(logEntry) {
    try {
      if (!this.fileHandle) {
        this.fileHandle = await window.showSaveFilePicker({
          suggestedName: "pomo_log.txt",
          types: [
            {
              description: "Text Files",
              accept: { "text/plain": [".txt"] },
            },
          ],
        });
        await this.setFileHandle(this.fileHandle);
      }

      if (
        (await this.fileHandle.queryPermission({ mode: "readwrite" })) !==
        "granted"
      ) {
        if (
          (await this.fileHandle.requestPermission({ mode: "readwrite" })) !==
          "granted"
        ) {
          console.error("File access permission was not granted.");
          this.fileHandle = null;
          await this.setFileHandle(null);
          return;
        }
      }

      const file = await this.fileHandle.getFile();
      const oldContent = await file.text();
      const newContent =
        oldContent +
        (oldContent.length > 0 ? "\n" : "") +
        JSON.stringify(logEntry);

      const writable = await this.fileHandle.createWritable();
      await writable.write(newContent);
      await writable.close();

      console.log("Log appended successfully.");
    } catch (err) {
      console.error("Error saving log:", err);
      if (err.name !== "AbortError") {
        this.showError("Could not save the log file. Please try again.");
      }
      this.fileHandle = null;
    }
  }

  async loadLogs() {
    this.pomoLogContainer.innerHTML = "";
    this.hideError();

    if (!this.fileHandle) {
      this.pomoLogContainer.innerHTML =
        '<p class="log-summary">Your session logs will appear here once you save your first session.</p>';
      return;
    }

    try {
      const permissionStatus = await this.fileHandle.queryPermission({
        mode: "read",
      });

      if (permissionStatus === "granted") {
        const file = await this.fileHandle.getFile();
        const content = await file.text();
        if (content.trim() === "") {
          this.pomoLogContainer.innerHTML =
            '<p class="log-summary">No entries logged yet.</p>';
          return;
        }
        const logEntries = content
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        logEntries.sort((a, b) => new Date(b.end_time) - new Date(a.end_time));
        this.renderLogs(logEntries);
      } else if (permissionStatus === "prompt") {
        this.pomoLogContainer.innerHTML = `
          <p class="log-summary">This extension needs permission to read your log file.</p>
          <button id="grant-permission-btn" class="start-btn">Grant Permission and Load Logs</button>
        `;
        document
          .getElementById("grant-permission-btn")
          .addEventListener("click", async () => {
            try {
              if (
                (await this.fileHandle.requestPermission({ mode: "read" })) ===
                "granted"
              ) {
                this.loadLogs();
              } else {
                this.showError("Permission to read the log file was denied.");
              }
            } catch (err) {
              console.error("Error requesting permission:", err);
              this.showError(
                "An error occurred while requesting file permission."
              );
            }
          });
      } else {
        this.showError("Permission to read the log file has been denied.");
      }
    } catch (err) {
      console.error("Error loading logs:", err);
      this.showError(
        "Could not load the log file. It may have been moved or deleted."
      );
    }
  }

  renderLogs(logEntries) {
    this.pomoLogContainer.innerHTML = "";
    if (logEntries.length === 0) {
      this.pomoLogContainer.innerHTML = "<p>No entries logged yet.</p>";
      return;
    }

    const fragment = document.createDocumentFragment();

    logEntries.forEach((entry) => {
      const entryDiv = document.createElement("div");
      entryDiv.className = "log-entry";
      entryDiv.dataset.sessionId = entry.sessionId;

      const date = new Date(entry.end_time).toLocaleString();
      const isNote = entry.type === "note";

      const headerHTML = `
              <div class="log-header">
                  <span class="log-date">${date}</span>
                  <div class="log-actions">
                    ${
                      isNote
                        ? '<span class="log-type">Note</span>'
                        : `<span class="log-duration">${entry.duration} min session</span>`
                    }
                    <button class="edit-log-btn">Edit</button>
                  </div>
              </div>
          `;
      entryDiv.innerHTML = headerHTML;

      const summaryP = document.createElement("p");
      summaryP.className = "log-summary";
      summaryP.textContent = entry.summary_text;

      entryDiv.appendChild(summaryP);
      fragment.appendChild(entryDiv);
    });

    this.pomoLogContainer.appendChild(fragment);

    // Add event listeners after appending to the DOM
    this.pomoLogContainer
      .querySelectorAll(".edit-log-btn")
      .forEach((button) => {
        button.addEventListener("click", this.handleEditLog.bind(this));
      });
  }

  handleEditLog(event) {
    const button = event.target;
    const entryDiv = button.closest(".log-entry");
    const summaryP = entryDiv.querySelector(".log-summary");
    const originalText = summaryP.textContent;

    // Create textarea
    const textArea = document.createElement("textarea");
    textArea.className = "edit-summary-textarea";
    textArea.value = originalText;

    // Create save button
    const saveButton = document.createElement("button");
    saveButton.textContent = "Save";
    saveButton.className = "save-edit-btn";

    // Replace paragraph with textarea and save button
    summaryP.replaceWith(textArea, saveButton);
    button.style.display = "none"; // Hide edit button

    saveButton.addEventListener("click", async () => {
      const newText = textArea.value;
      const sessionId = entryDiv.dataset.sessionId;

      await this.updateLogEntry(sessionId, newText);

      // Restore the view
      summaryP.textContent = newText;
      textArea.replaceWith(summaryP);
      saveButton.remove();
      button.style.display = "inline-block"; // Show edit button again
    });
  }

  async updateLogEntry(sessionId, newSummaryText) {
    try {
      const file = await this.fileHandle.getFile();
      const content = await file.text();
      const logEntries = content
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

      const entryIndex = logEntries.findIndex(
        (entry) => entry.sessionId === sessionId
      );
      if (entryIndex === -1) {
        throw new Error("Log entry not found.");
      }

      logEntries[entryIndex].summary_text = newSummaryText;

      const newContent = logEntries
        .map((entry) => JSON.stringify(entry))
        .join("\n");

      const writable = await this.fileHandle.createWritable();
      await writable.write(newContent);
      await writable.close();

      console.log("Log updated successfully.");
    } catch (err) {
      console.error("Error updating log:", err);
      this.showError("Could not update the log file.");
    }
  }

  resetToStartState() {
    this.summaryInput.value = "";
    this.validateSummary();

    chrome.storage.local.set(
      {
        [FocusFlowHome.STORAGE_KEYS.TIMER_STATE]:
          FocusFlowHome.TIMER_STATE.START,
        [FocusFlowHome.STORAGE_KEYS.END_TIME]: null,
        [FocusFlowHome.STORAGE_KEYS.DURATION]: 0,
        [FocusFlowHome.STORAGE_KEYS.SESSION_ID]: null,
        [FocusFlowHome.STORAGE_KEYS.CURRENT_SUMMARY]: "",
      },
      () => {
        this.updateUI();
        this.loadLogs();
      }
    );
  }
}

// Initialize the home page logic once the DOM is ready.
document.addEventListener("DOMContentLoaded", () => {
  new FocusFlowHome();
});

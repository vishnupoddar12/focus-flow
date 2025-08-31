/**
 * Manages the logic for the FocusFlow options page.
 */
class FocusFlowOptions {
  constructor() {
    this.wildcardInput = document.getElementById("wildcard-input");
    this.wildcardList = document.getElementById("wildcard-list");
    this.addWildcardForm = document.getElementById("add-wildcard-form");
    this.excludedUrls = [];

    this.setupEventListeners();
    this.loadWildcards();
  }

  /**
   * Sets up event listeners for the form and list.
   */
  setupEventListeners() {
    this.addWildcardForm.addEventListener(
      "submit",
      this.handleAddWildcard.bind(this)
    );
  }

  /**
   * Loads the list of excluded URLs from chrome.storage.
   */
  async loadWildcards() {
    const result = await chrome.storage.local.get(["excludedUrls"]);
    this.excludedUrls = result.excludedUrls || [];
    this.renderWildcards();
  }

  /**
   * Renders the list of wildcards in the UI.
   */
  renderWildcards() {
    this.wildcardList.innerHTML = ""; // Clear existing list
    if (this.excludedUrls.length === 0) {
      this.wildcardList.innerHTML = "<li>No URLs excluded yet.</li>";
      return;
    }

    this.excludedUrls.forEach((url, index) => {
      const listItem = document.createElement("li");
      listItem.innerHTML = `
        <span class="url-text">${url}</span>
        <button class="delete-btn" data-index="${index}">&times;</button>
      `;
      this.wildcardList.appendChild(listItem);
    });

    // Add event listeners to the new delete buttons
    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", this.handleDeleteWildcard.bind(this));
    });
  }

  /**
   * Handles the submission of a new wildcard.
   * @param {Event} e - The form submission event.
   */
  async handleAddWildcard(e) {
    e.preventDefault();
    const newWildcard = this.wildcardInput.value.trim();
    if (newWildcard && !this.excludedUrls.includes(newWildcard)) {
      this.excludedUrls.push(newWildcard);
      await chrome.storage.local.set({ excludedUrls: this.excludedUrls });
      this.wildcardInput.value = "";
      this.renderWildcards();
    }
  }

  /**
   * Handles the deletion of a wildcard.
   * @param {Event} e - The button click event.
   */
  async handleDeleteWildcard(e) {
    const indexToDelete = parseInt(e.target.dataset.index, 10);
    this.excludedUrls.splice(indexToDelete, 1);
    await chrome.storage.local.set({ excludedUrls: this.excludedUrls });
    this.renderWildcards();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new FocusFlowOptions();
});

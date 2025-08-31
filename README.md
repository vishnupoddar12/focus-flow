# FocusFlow

FocusFlow is designed to enhance productivity by blocking distracting tabs and enforcing session logging. This tool helps you maintain focus and keep a record of your accomplishments.

---

## Features

- **Pomodoro Timer:** Start a focused work session with a timer. You can choose from preset durations of 1, 25, 35, 45, or 55 minutes.
- **Tab Blocking:** While the timer is running, FocusFlow blocks access to distracting websites, redirecting you to the FocusFlow home page to keep you on task.
- **Session Logging:** At the end of each session, you are required to log what you accomplished. This encourages reflection and accountability. Session logs are saved to a local text file for your records.
- **Session History:** View your notes and past Pomodoro sessions, including the date, duration, and a summary of what you accomplished.
- **State Persistence:** The timer's state is saved, so if you close and reopen your browser, the timer will continue from where it left off.
- **Cross-Tab Syncing:** The timer and session summary messages are synchronized across all open FocusFlow tabs.

---

## Getting Started

Follow these instructions to get the FocusFlow extension set up and running in your Chrome browser.

### Prerequisites

- Google Chrome

### Installation

1.  **Download the project:** Obtain the project files and save them to a local directory on your computer.
2.  **Open Chrome Extensions:** Open Google Chrome and navigate to `chrome://extensions/`.
3.  **Enable Developer Mode:** In the top right corner of the Extensions page, toggle the "Developer mode" switch to the "on" position.
4.  **Load the extension:**
    - Click the "Load unpacked" button that appears on the top left of the page.
    - In the file selection dialog, navigate to the directory where you saved the project files and select the root folder of the project.
5.  **Pin the extension:** After the extension has been loaded, it will appear in your list of extensions. You can click the puzzle piece icon in the Chrome toolbar and then click the pin icon next to "FocusFlow" to make it easily accessible.

### How to Use

1.  **Open FocusFlow:** Click on the FocusFlow icon in your Chrome toolbar and then click the "Open FocusFlow" button. This will open the FocusFlow home page in a new tab.
2.  **Start a Session:** On the FocusFlow home page, choose a session duration from the available buttons (e.g., "25 minutes") to start the timer.
3.  **Stay Focused:** While the timer is running, any attempt to navigate to a distracting website will result in you being redirected back to the FocusFlow home page.
4.  **Log Your Session:** When the timer finishes, you will be prompted to write a summary of at least 50 words describing what you accomplished during the session.
5.  **Save Your Log:** After writing your summary, click the "Submit Log" button. You will be prompted to choose a location to save your `activity_log.txt` file. This file will store all of your future session logs.
6.  **View Past Sessions:** Your past session logs will be displayed on the FocusFlow home page after you have saved your first session.

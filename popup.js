document.getElementById('openHome').addEventListener('click', () => {
    chrome.tabs.create({ url: 'home.html' });
});


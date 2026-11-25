
// PhishBuster AI — background.js

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("mail.google.com")
  ) {
    chrome.action.setBadgeText({
      text: "●",
      tabId
    });

    chrome.action.setBadgeBackgroundColor({
      color: "#00d4ff",
      tabId
    });
  }
});

// Listen for messages from popup.js and content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[PhishBuster] Message received:", message);

  if (message.action === "logThreat") {
    console.log("[PhishBuster] Threat detected:", message.data);

    sendResponse({ success: true });
    return false;
  }

  sendResponse({
    success: false,
    error: "Unknown message action"
  });

  return false;
});

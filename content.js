
// PhishBuster AI — content.js
// Runs inside Gmail to extract email data

console.log("[PhishBuster] Gmail content script loaded.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractEmail") {
    try {
      const data = extractEmailData();

      sendResponse({
        success: true,
        data
      });
    } catch (err) {
      console.error("[PhishBuster] Extraction error:", err);

      sendResponse({
        success: false,
        error: err.message
      });
    }

    return false;
  }
});

function extractEmailData() {
  let subject = "Unknown Subject";
  let sender = "Unknown Sender";
  let body = "";

  // Extract subject
  const subjectEl =
    document.querySelector("h2.hP") ||
    document.querySelector("[data-thread-perm-id] h2");

  if (subjectEl) {
    subject = subjectEl.textContent.trim();
  }

  // Extract sender
  const senderEl =
    document.querySelector(".gD") ||
    document.querySelector("span[email]");

  if (senderEl) {
    sender =
      senderEl.getAttribute("email") ||
      senderEl.textContent.trim();
  }

  // Extract email body
  const bodyEl =
    document.querySelector(".a3s.aiL") ||
    document.querySelector(".a3s");

  if (bodyEl) {
    body = bodyEl.textContent.trim().substring(0, 3000);
  }

  // Extract URLs from email HTML
  const emailHTML = bodyEl ? bodyEl.innerHTML : "";

  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

  const urls = [
    ...new Set(emailHTML.match(urlPattern) || [])
  ].slice(0, 10);

  return {
    subject,
    sender,
    body,
    urls
  };
}

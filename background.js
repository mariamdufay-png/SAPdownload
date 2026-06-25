chrome.runtime.onInstalled.addListener(() => {
  console.log("SAP Invoice Downloader installed");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "SID_LOG") {
    console.log("SAP Invoice Downloader:", message.payload);
    sendResponse({ ok: true });
    return true;
  }
});

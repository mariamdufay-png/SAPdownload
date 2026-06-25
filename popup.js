async function sendToActiveTab(type) {
  const result = document.getElementById("result");
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length || !tabs[0].id) {
      result.textContent = "Aucun onglet actif trouve.";
      return;
    }
    const response = await chrome.tabs.sendMessage(tabs[0].id, { type });
    result.textContent = JSON.stringify(response, null, 2);
  } catch (error) {
    result.textContent = "Erreur: " + error.message + "\n\nRecharge la page SAP, puis reessaie.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("detectBtn").addEventListener("click", () => sendToActiveTab("SID_DETECT"));
  document.getElementById("panelBtn").addEventListener("click", () => sendToActiveTab("SID_SHOW_PANEL"));
});

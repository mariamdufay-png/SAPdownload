(() => {
  const STATE = {
    running: false,
    stepDelayMs: 900,
    targetAttachmentText: "France - Supplier Invoices",
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function textOf(el) {
    if (!el) return "";
    return (
      el.innerText ||
      el.textContent ||
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      ""
    ).trim();
  }

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function log(message) {
    const line = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.log("SAP Invoice Downloader:", message);
    const box = document.getElementById("sid-log");
    if (box) {
      box.textContent += line + "\n";
      box.scrollTop = box.scrollHeight;
    }
  }

  function candidates() {
    return [...document.querySelectorAll("button, [role='button'], a, span, div, td")].filter(visible);
  }

  function findByText(text, options = {}) {
    const exact = options.exact || false;
    const wanted = text.toLowerCase();
    return candidates().find((el) => {
      const label = textOf(el).toLowerCase();
      if (!label) return false;
      return exact ? label === wanted : label.includes(wanted);
    });
  }

  function findButtonByText(text) {
    const labelEl = findByText(text);
    if (!labelEl) return null;
    return labelEl.closest("button, [role='button'], .sapMBtn, .sapUiBtn") || labelEl;
  }

  function clickElement(el, label) {
    if (!el) throw new Error(`${label} introuvable`);
    el.scrollIntoView({ block: "center", inline: "center" });
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
    log(`Clic: ${label}`);
  }

  function detect() {
    const found = {
      url: location.href,
      attachmentList: !!findButtonByText("Attachment List"),
      display: !!findButtonByText("Display"),
      franceSupplierInvoices: !!findByText(STATE.targetAttachmentText),
      download: !!findButtonByText("Download") || !!findButtonByText("Télécharger") || !!findButtonByText("Telecharger"),
      visibleButtons: candidates()
        .map((el) => textOf(el))
        .filter(Boolean)
        .filter((t) => /Attachment|Display|Download|France|Supplier|Invoice|Télécharger|Telecharger/i.test(t))
        .slice(0, 30),
    };
    log("Detection: " + JSON.stringify(found));
    return found;
  }

  async function openAttachmentList() {
    const btn = findButtonByText("Attachment List");
    clickElement(btn, "Attachment List");
    await sleep(STATE.stepDelayMs);
    return detect();
  }

  async function openFranceSupplierInvoice() {
    const rowText = findByText(STATE.targetAttachmentText);
    clickElement(rowText, STATE.targetAttachmentText);
    await sleep(400);
    const display = findButtonByText("Display");
    clickElement(display, "Display");
    await sleep(STATE.stepDelayMs);
    return detect();
  }

  async function clickDownload() {
    const btn = findButtonByText("Download") || findButtonByText("Télécharger") || findButtonByText("Telecharger");
    clickElement(btn, "Download");
    await sleep(STATE.stepDelayMs);
    return detect();
  }

  async function testOneInvoice() {
    STATE.running = true;
    try {
      log("Test facture courante lance.");
      await openAttachmentList();
      await openFranceSupplierInvoice();
      log("PDF ouvert. Clique ensuite sur Telecharger si le bouton est detecte, ou utilise le bouton du panneau.");
      return { ok: true, message: "Attachment List puis Display executes." };
    } catch (error) {
      log("Erreur: " + error.message);
      return { ok: false, error: error.message };
    } finally {
      STATE.running = false;
    }
  }

  function ensurePanel() {
    if (document.getElementById("sid-panel")) return;
    const panel = document.createElement("div");
    panel.id = "sid-panel";
    panel.innerHTML = `
      <header>SAP Invoice Downloader</header>
      <div class="sid-body">
        <button id="sid-detect">Tester la detection</button>
        <button id="sid-attachment">Cliquer Attachment List</button>
        <button id="sid-display">Ouvrir France Supplier Invoices</button>
        <button id="sid-download">Cliquer Download</button>
        <button id="sid-test-one" class="secondary">Test facture courante</button>
        <pre id="sid-log"></pre>
      </div>
    `;
    document.documentElement.appendChild(panel);
    document.getElementById("sid-detect").addEventListener("click", detect);
    document.getElementById("sid-attachment").addEventListener("click", openAttachmentList);
    document.getElementById("sid-display").addEventListener("click", openFranceSupplierInvoice);
    document.getElementById("sid-download").addEventListener("click", clickDownload);
    document.getElementById("sid-test-one").addEventListener("click", testOneInvoice);
    log("Panneau charge.");
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;
    if (message.type === "SID_DETECT") {
      sendResponse({ ok: true, data: detect() });
      return true;
    }
    if (message.type === "SID_SHOW_PANEL") {
      ensurePanel();
      sendResponse({ ok: true, message: "Panneau affiche" });
      return true;
    }
  });

  ensurePanel();
})();

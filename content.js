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

  function norm(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
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

  function findByText(text) {
    const wanted = norm(text);
    return candidates().find((el) => norm(textOf(el)).includes(wanted));
  }

  function findButtonByText(text) {
    const el = findByText(text);
    return el ? el.closest("button, [role='button'], .sapMBtn, .sapUiBtn") || el : null;
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

  async function waitFor(predicate, label, timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const value = predicate();
      if (value) return value;
      await sleep(250);
    }
    throw new Error(`${label} introuvable après ${timeoutMs} ms`);
  }

  function getAttachmentDialog() {
    const all = [...document.querySelectorAll("[role='dialog'], .sapMDialog, div")].filter(visible);
    return all.find((el) => norm(textOf(el)).includes("attachment list")) || document.body;
  }

  function getRows(scope = document) {
    const selectors = [
      "tr",
      "[role='row']",
      ".sapMListTblRow",
      ".sapMLIB",
      ".sapUiTableRow"
    ];
    return [...new Set(selectors.flatMap((s) => [...scope.querySelectorAll(s)]))].filter(visible);
  }

  function findAttachmentRow() {
    const scope = getAttachmentDialog();
    const wanted = norm(STATE.targetAttachmentText);

    const rows = getRows(scope);
    const row = rows.find((r) => norm(textOf(r)).includes(wanted));
    if (row) return row;

    const cell = [...scope.querySelectorAll("td, [role='gridcell'], span, div")]
      .filter(visible)
      .find((el) => norm(textOf(el)).includes(wanted));

    return cell ? cell.closest("tr, [role='row'], .sapMListTblRow, .sapMLIB, .sapUiTableRow") || cell : null;
  }

  function findDisplayButton() {
    const dialog = getAttachmentDialog();
    const buttons = [...dialog.querySelectorAll("button, [role='button'], div, span")].filter(visible);

    return (
      findButtonByText("Display") ||
      buttons.find((el) => {
        const label = norm([
          el.innerText,
          el.textContent,
          el.getAttribute("title"),
          el.getAttribute("aria-label"),
          el.getAttribute("id")
        ].filter(Boolean).join(" "));
        return label.includes("display") || label.includes("atta_display") || label.includes("afficher");
      })
    );
  }

  function findDownloadButton() {
    const buttons = [...document.querySelectorAll("button, [role='button'], div, span")].filter(visible);

    return (
      findButtonByText("Download") ||
      findButtonByText("Télécharger") ||
      findButtonByText("Telecharger") ||
      buttons.find((el) => {
        const label = norm([
          el.innerText,
          el.textContent,
          el.getAttribute("title"),
          el.getAttribute("aria-label"),
          el.getAttribute("id")
        ].filter(Boolean).join(" "));
        return label.includes("download") || label.includes("télécharger") || label.includes("telecharger");
      })
    );
  }

  function detect() {
    const dialog = getAttachmentDialog();
    const found = {
      url: location.href,
      attachmentList: !!findButtonByText("Attachment List"),
      franceSupplierInvoices: !!findAttachmentRow(),
      display: !!findDisplayButton(),
      download: !!findDownloadButton(),
      rowsSeen: getRows(dialog).map((r) => textOf(r)).filter(Boolean).slice(0, 8),
    };
    log("Detection: " + JSON.stringify(found));
    return found;
  }

  async function openAttachmentList() {
    const btn = findButtonByText("Attachment List");
    clickElement(btn, "Attachment List");
    await waitFor(() => norm(textOf(getAttachmentDialog())).includes("attachment list"), "fenêtre Attachment List");
    await sleep(STATE.stepDelayMs);
    return detect();
  }

  async function selectFranceSupplierInvoice() {
    const row = await waitFor(() => findAttachmentRow(), "France - Supplier Invoices");
    clickElement(row, "France - Supplier Invoices");
    await sleep(600);
    return row;
  }

  async function clickDisplay() {
    const btn = await waitFor(() => findDisplayButton(), "Display");
    clickElement(btn, "Display");
    await sleep(STATE.stepDelayMs);
    return detect();
  }

  async function openFranceSupplierInvoice() {
    await selectFranceSupplierInvoice();
    await clickDisplay();
    return detect();
  }

  async function clickDownload() {
    const btn = await waitFor(() => findDownloadButton(), "Download");
    clickElement(btn, "Download");
    await sleep(STATE.stepDelayMs);
    return detect();
  }

  async function testOneInvoice() {
    STATE.running = true;
    try {
      log("Test facture courante lancé.");
      await openAttachmentList();
      await openFranceSupplierInvoice();
      log("PDF ouvert. Tu peux maintenant tester Cliquer Download.");
      return { ok: true };
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
        <button id="sid-display">Selectionner France + Display</button>
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

    log("Panneau chargé.");
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === "SID_DETECT") {
      sendResponse({ ok: true, data: detect() });
      return true;
    }

    if (message.type === "SID_SHOW_PANEL") {
      ensurePanel();
      sendResponse({ ok: true, message: "Panneau affiché" });
      return true;
    }
  });

  ensurePanel();
})();

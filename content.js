(() => {
  const CONFIG = {
    iframeContains: "VIMAnalytics",
    attachmentText: "France - Supplier Invoices",
    delay: 900
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function log(msg) {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log("SAP Invoice Downloader:", msg);
    const box = document.getElementById("sid-log");
    if (box) {
      box.textContent += line + "\n";
      box.scrollTop = box.scrollHeight;
    }
  }

  function norm(x) {
    return String(x || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function textOf(el) {
    return (
      el?.innerText ||
      el?.textContent ||
      el?.getAttribute?.("title") ||
      el?.getAttribute?.("aria-label") ||
      ""
    ).trim();
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = el.ownerDocument.defaultView.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
  }

  function click(el, label) {
    if (!el) throw new Error(label + " introuvable");
    el.scrollIntoView({ block: "center", inline: "center" });
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
    log("Clic: " + label);
  }

  async function waitFor(fn, label, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(250);
    }
    throw new Error(label + " introuvable après " + timeout + " ms");
  }

  function getIframeDocument() {
    const iframe = [...document.querySelectorAll("iframe")]
      .find(f => f.id.includes(CONFIG.iframeContains) || f.name.includes(CONFIG.iframeContains));

    if (!iframe?.contentWindow?.document) {
      throw new Error("iframe VIMAnalytics introuvable");
    }

    return iframe.contentWindow.document;
  }

  function all(doc, selector) {
    return [...doc.querySelectorAll(selector)].filter(visible);
  }

  function findByText(doc, text) {
    const wanted = norm(text);
    return all(doc, "button,[role='button'],a,span,div,td,tr")
      .find(e => norm(textOf(e)).includes(wanted));
  }

  function findButtonByText(doc, text) {
    const el = findByText(doc, text);
    return el?.closest("button,[role='button'],.sapMBtn,.sapUiBtn") || el;
  }

  function findMainAttachmentButton() {
    return findButtonByText(document, "Attachment List");
  }

  function findAttachmentTextElement(sapDoc) {
    return [...sapDoc.querySelectorAll("td,span,div")]
      .filter(visible)
      .find(e => e.innerText?.trim() === CONFIG.attachmentText);
  }

  function findDisplayButton(sapDoc) {
    return (
      sapDoc.querySelector('[title="Display"][aria-label="Display"]') ||
      sapDoc.querySelector('[title="Display"]') ||
      sapDoc.querySelector('[aria-label="Display"]') ||
      [...sapDoc.querySelectorAll('[id$="_toolbar_btn2"]')].find(e =>
        e.getAttribute("title") === "Display" ||
        e.getAttribute("aria-label") === "Display"
      )
    );
  }

  function findDownloadButton() {
    const docs = [document];

    try {
      docs.push(getIframeDocument());
    } catch (_) {}

    for (const doc of docs) {
      const btn =
        doc.querySelector('[title="Download"]') ||
        doc.querySelector('[aria-label="Download"]') ||
        doc.querySelector('[title="Télécharger"]') ||
        doc.querySelector('[aria-label="Télécharger"]') ||
        findButtonByText(doc, "Download") ||
        findButtonByText(doc, "Télécharger") ||
        findButtonByText(doc, "Telecharger");

      if (btn) return btn;
    }

    return null;
  }

  function detect() {
    let sapDoc = null;
    try {
      sapDoc = getIframeDocument();
    } catch (_) {}

    const result = {
      mainAttachmentList: !!findMainAttachmentButton(),
      iframe: !!sapDoc,
      iframeRows: sapDoc ? all(sapDoc, "tr,[role='row'],.sapMListTblRow,.sapMLIB,.sapUiTableRow").length : 0,
      bodyHasFrance: sapDoc ? sapDoc.body.innerText.includes(CONFIG.attachmentText) : false,
      franceTextElement: sapDoc ? !!findAttachmentTextElement(sapDoc) : false,
      display: sapDoc ? !!findDisplayButton(sapDoc) : false,
      download: !!findDownloadButton()
    };

    log("Detection: " + JSON.stringify(result));
    return result;
  }

  async function openAttachmentList() {
    const btn = await waitFor(() => findMainAttachmentButton(), "Attachment List page principale");
    click(btn, "Attachment List");
    await sleep(1200);
    detect();
  }

  async function selectFranceSupplierInvoice() {
    const sapDoc = getIframeDocument();

    const el = await waitFor(
      () => findAttachmentTextElement(sapDoc),
      CONFIG.attachmentText,
      10000
    );

    const r = el.getBoundingClientRect();

    const target =
      sapDoc.elementFromPoint(r.left + 40, r.top + r.height / 2) ||
      sapDoc.elementFromPoint(r.left + 20, r.top + r.height / 2) ||
      el;

    click(target, "Sélection ligne France - Supplier Invoices");
    await sleep(1200);
  }

  async function clickDisplay() {
    const sapDoc = getIframeDocument();

    const display = await waitFor(
      () => findDisplayButton(sapDoc),
      "Display",
      10000
    );

    click(display, "Display");
    await sleep(1500);
  }

  async function openFranceAndDisplay() {
    try {
      await selectFranceSupplierInvoice();
      await clickDisplay();
      log("Display exécuté.");
    } catch (e) {
      log("Erreur: " + e.message);
    }
  }

  async function testOneInvoice() {
    try {
      log("Test facture courante lancé.");
      await openAttachmentList();
      await selectFranceSupplierInvoice();
      await clickDisplay();
      log("PDF demandé.");
    } catch (e) {
      log("Erreur: " + e.message);
    }
  }

  async function clickDownload() {
    try {
      const btn = await waitFor(() => findDownloadButton(), "Download", 10000);
      click(btn, "Download");
      await sleep(1000);
      detect();
    } catch (e) {
      log("Erreur: " + e.message);
    }
  }

  function ensurePanel() {
    if (document.getElementById("sid-panel")) return;

    const panel = document.createElement("div");
    panel.id = "sid-panel";
    panel.innerHTML = `
      <header>SAP Invoice Downloader</header>
      <div class="sid-body">
        <button id="sid-detect">Tester detection</button>
        <button id="sid-attachment">1. Attachment List</button>
        <button id="sid-display">2. France + Display</button>
        <button id="sid-download">3. Download</button>
        <button id="sid-test-one" class="secondary">Test facture courante</button>
        <pre id="sid-log"></pre>
      </div>
    `;

    document.documentElement.appendChild(panel);

    document.getElementById("sid-detect").onclick = detect;
    document.getElementById("sid-attachment").onclick = openAttachmentList;
    document.getElementById("sid-display").onclick = openFranceAndDisplay;
    document.getElementById("sid-download").onclick = clickDownload;
    document.getElementById("sid-test-one").onclick = testOneInvoice;

    log("Panneau chargé.");
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "SID_DETECT") {
      sendResponse({ ok: true, data: detect() });
      return true;
    }

    if (message?.type === "SID_SHOW_PANEL") {
      ensurePanel();
      sendResponse({ ok: true });
      return true;
    }
  });

  ensurePanel();
})();

(() => {
  const STATE = {
    targetAttachmentText: "France - Supplier Invoices",
    iframeId: "application-VIMAnalytics-display-iframe",
    delay: 900
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function frameDoc() {
    const f = document.getElementById(STATE.iframeId);
    if (!f || !f.contentWindow || !f.contentWindow.document) {
      throw new Error("iframe SAP introuvable");
    }
    return f.contentWindow.document;
  }

  function textOf(el) {
    return (el?.innerText || el?.textContent || el?.getAttribute?.("title") || el?.getAttribute?.("aria-label") || "").trim();
  }

  function norm(x) {
    return String(x || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = el.ownerDocument.defaultView.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
  }

  function log(msg) {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log("SAP Invoice Downloader:", msg);
    const box = document.getElementById("sid-log");
    if (box) {
      box.textContent += line + "\n";
      box.scrollTop = box.scrollHeight;
    }
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

  function all(scope, selector) {
    return [...scope.querySelectorAll(selector)].filter(visible);
  }

  function findText(scope, txt) {
    const wanted = norm(txt);
    return all(scope, "button,[role='button'],a,span,div,td,tr")
      .find(e => norm(textOf(e)).includes(wanted));
  }

  function findButton(scope, txt) {
    const el = findText(scope, txt);
    return el?.closest("button,[role='button'],.sapMBtn,.sapUiBtn") || el;
  }

  function findAttachmentRow(doc) {
    const wanted = norm(STATE.targetAttachmentText);
    const rows = all(doc, "tr,[role='row'],.sapMListTblRow,.sapMLIB,.sapUiTableRow");
    return rows.find(r => norm(textOf(r)).includes(wanted));
  }

  function findDisplayButton(doc) {
  const buttons = [...doc.querySelectorAll("button,[role='button'],div,span")]
    .filter(visible);

  return buttons.find(b => {
    const txt = norm([
      b.innerText,
      b.textContent,
      b.getAttribute("title"),
      b.getAttribute("aria-label"),
      b.id,
      b.getAttribute("data-sap-ui")
    ].filter(Boolean).join(" "));

    return (
      txt.includes("display") ||
      txt.includes("atta_display") ||
      txt.includes("display attachment")
    );
  });
}

  function findDownloadButton(doc) {
    const buttons = all(doc, "button,[role='button'],div,span");
    return findButton(doc, "Download") || findButton(doc, "Télécharger") || findButton(doc, "Telecharger") || buttons.find(b => {
      const t = norm([
        textOf(b),
        b.getAttribute("title"),
        b.getAttribute("aria-label"),
        b.id
      ].filter(Boolean).join(" "));
      return t.includes("download") || t.includes("télécharger") || t.includes("telecharger");
    });
  }

  function detect() {
    const doc = frameDoc();
    const rows = all(doc, "tr,[role='row'],.sapMListTblRow,.sapMLIB,.sapUiTableRow");
    const result = {
      iframe: true,
      rows: rows.length,
      attachmentList: !!findButton(doc, "Attachment List"),
      franceSupplierInvoices: !!findAttachmentRow(doc),
      display: !!findDisplayButton(doc),
      download: !!findDownloadButton(doc),
      bodyHasFrance: doc.body.innerText.includes(STATE.targetAttachmentText)
    };
    log("Detection: " + JSON.stringify(result));
    return result;
  }

  async function openAttachmentList() {
    const doc = frameDoc();
    const btn = await waitFor(() => findButton(doc, "Attachment List"), "Attachment List");
    click(btn, "Attachment List");
    await sleep(STATE.delay);
    detect();
  }

  async function openFranceSupplierInvoice() {
    const doc = frameDoc();

    // Trouve le texte
    const el = await waitFor(() =>
        [...doc.querySelectorAll("td,span,div")]
            .find(e => e.innerText?.trim() === STATE.targetAttachmentText),
        "France - Supplier Invoices"
    );

    // Clique au bon endroit sur la ligne
    const r = el.getBoundingClientRect();

    const target =
        doc.elementFromPoint(r.left + 40, r.top + r.height / 2) ||
        doc.elementFromPoint(r.left + 20, r.top + r.height / 2) ||
        el;

    click(target, "Sélection ligne France - Supplier Invoices");

    await sleep(700);

    // Puis Display
    const display = await waitFor(
        () => findDisplayButton(doc),
        "Display"
    );

    const d = display.getBoundingClientRect();
const realDisplay =
  doc.elementFromPoint(d.left + d.width / 2, d.top + d.height / 2) || display;

click(realDisplay, "Display");

    await sleep(1200);

const display = doc.getElementById("C188_toolbar_btn2");
click(display, "Display");
}

  async function clickDownload() {
    const doc = frameDoc();
    const btn = await waitFor(() => findDownloadButton(doc), "Download");
    click(btn, "Download");
    await sleep(STATE.delay);
    detect();
  }

  async function testOneInvoice() {
    try {
      log("Test facture courante lancé.");
      await openAttachmentList();
      await openFranceSupplierInvoice();
      log("PDF ouvert. Teste maintenant Cliquer Download.");
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
        <button id="sid-detect">Tester la detection iframe</button>
        <button id="sid-attachment">Cliquer Attachment List</button>
        <button id="sid-display">France + Display</button>
        <button id="sid-download">Cliquer Download</button>
        <button id="sid-test-one" class="secondary">Test facture courante</button>
        <pre id="sid-log"></pre>
      </div>
    `;
    document.documentElement.appendChild(panel);

    document.getElementById("sid-detect").onclick = detect;
    document.getElementById("sid-attachment").onclick = openAttachmentList;
    document.getElementById("sid-display").onclick = openFranceSupplierInvoice;
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

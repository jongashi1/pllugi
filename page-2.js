const journalPassword = "Kevpatty";
const passwordForm = document.querySelector("#journalPasswordForm");
const passwordInput = document.querySelector("#journalPassword");
const journalError = document.querySelector("#journalError");
const journalApp = document.querySelector("#journalApp");
const entriesList = document.querySelector("#entriesList");
const newEntryButton = document.querySelector("#newEntryButton");
const saveEntryButton = document.querySelector("#saveEntryButton");
const deleteEntryButton = document.querySelector("#deleteEntryButton");
const entryTitle = document.querySelector("#entryTitle");
const entryBody = document.querySelector("#entryBody");
const saveStatus = document.querySelector("#saveStatus");
const journalApiBase = window.JOURNAL_API_BASE || "";

let entries = [];
let activeEntryId = null;

function getPassword() {
  return sessionStorage.getItem("journalPassword") || "";
}

function setStatus(message, isError = false) {
  if (!saveStatus) return;

  saveStatus.textContent = message;
  saveStatus.classList.toggle("is-error", isError);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getEntryLabel(entry) {
  if (entry.title.trim()) return entry.title.trim();
  const firstLine = entry.body.split("\n").find((line) => line.trim());
  return firstLine ? firstLine.trim().slice(0, 48) : "Untitled entry";
}

function getPhpApiPath(path) {
  if (path.startsWith("/api/journal/")) {
    const entryId = path.slice("/api/journal/".length);
    return `/api/journal.php?id=${entryId}`;
  }

  return "/api/journal.php";
}

async function fetchJournal(path, options = {}) {
  return fetch(`${journalApiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Journal-Password": getPassword(),
      ...(options.headers || {})
    }
  });
}

async function requestJournal(path, options = {}) {
  let response;

  try {
    response = await fetchJournal(path, options);

    if (response.status === 404 || response.status === 503) {
      response = await fetchJournal(getPhpApiPath(path), options);
    }
  } catch (error) {
    throw new Error("The journal server is unavailable. The site needs either the Node server or api/journal.php on a PHP host.");
  }

  if (!response.ok) {
    let message = `The journal server is unavailable. /api/journal returned ${response.status}.`;

    if (response.status === 401) {
      message = "The journal password was rejected.";
    }

    if (response.status === 503) {
      message = "The journal server is unavailable. Your host returned 503, which usually means the Node app is not running or crashed.";
    }

    if (response.status === 404) {
      message = "The journal server is unavailable. Neither /api/journal nor /api/journal.php was found.";
    }

    throw new Error(message);
  }

  return response.json();
}

function renderEntries() {
  entriesList.innerHTML = "";

  if (!entries.length) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "entries-empty";
    emptyMessage.textContent = "No entries yet.";
    entriesList.append(emptyMessage);
    return;
  }

  entries.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "entry-button";
    button.classList.toggle("is-active", entry.id === activeEntryId);
    button.innerHTML = `
      <span>${getEntryLabel(entry)}</span>
      <small>${formatDate(entry.updatedAt)}</small>
    `;
    button.addEventListener("click", () => selectEntry(entry.id));
    entriesList.append(button);
  });
}

function selectEntry(entryId) {
  const entry = entries.find((item) => item.id === entryId);
  if (!entry) return;

  activeEntryId = entry.id;
  entryTitle.value = entry.title;
  entryBody.value = entry.body;
  deleteEntryButton.disabled = false;
  setStatus(`Editing ${getEntryLabel(entry)}.`);
  renderEntries();
}

function createNewEntry() {
  activeEntryId = null;
  entryTitle.value = "";
  entryBody.value = "";
  deleteEntryButton.disabled = true;
  entryTitle.focus();
  setStatus("New entry ready.");
  renderEntries();
}

async function loadEntries() {
  setStatus("Loading entries...");
  const data = await requestJournal("/api/journal");
  entries = data.entries || [];
  renderEntries();

  if (entries.length) {
    selectEntry(entries[0].id);
  } else {
    createNewEntry();
  }
}

async function saveEntry() {
  const title = entryTitle.value.trim();
  const body = entryBody.value;

  if (!title && !body.trim()) {
    setStatus("Write something before saving.", true);
    entryBody.focus();
    return;
  }

  setStatus("Saving...");
  const data = await requestJournal("/api/journal", {
    method: "POST",
    body: JSON.stringify({
      id: activeEntryId,
      title,
      body
    })
  });

  entries = data.entries || [];
  activeEntryId = data.entry.id;
  renderEntries();
  selectEntry(activeEntryId);
  setStatus("Saved.");
}

async function deleteEntry() {
  if (!activeEntryId) {
    setStatus("Choose an entry to delete.", true);
    return;
  }

  const entry = entries.find((item) => item.id === activeEntryId);
  const label = entry ? getEntryLabel(entry) : "this entry";

  if (!window.confirm(`Delete "${label}"?`)) {
    return;
  }

  setStatus("Deleting...");
  const data = await requestJournal(`/api/journal/${encodeURIComponent(activeEntryId)}`, {
    method: "DELETE"
  });

  entries = data.entries || [];
  activeEntryId = null;
  renderEntries();

  if (entries.length) {
    selectEntry(entries[0].id);
    setStatus("Deleted.");
  } else {
    createNewEntry();
    setStatus("Deleted.");
  }
}

function unlockJournal(password) {
  sessionStorage.setItem("journalPassword", password);
  window.location.href = "page-2-1.html";
}

if (passwordForm) {
  passwordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    journalError.textContent = "";

    if (passwordInput.value !== journalPassword) {
      journalError.textContent = "Incorrect password.";
      passwordInput.value = "";
      passwordInput.focus();
      return;
    }

    unlockJournal(passwordInput.value);
  });
}

if (journalApp) {
  if (getPassword() !== journalPassword) {
    window.location.href = "page-2.html";
  } else {
    loadEntries().catch((error) => {
      setStatus(error.message, true);
    });
  }
}

if (newEntryButton) {
  newEntryButton.addEventListener("click", createNewEntry);
}

if (saveEntryButton) {
  saveEntryButton.addEventListener("click", async () => {
    try {
      await saveEntry();
    } catch (error) {
      setStatus(error.message, true);
    }
  });
}

if (deleteEntryButton) {
  deleteEntryButton.addEventListener("click", async () => {
    try {
      await deleteEntry();
    } catch (error) {
      setStatus(error.message, true);
    }
  });
}

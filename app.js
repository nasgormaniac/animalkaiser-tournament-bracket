const ROUND_NAMES = ["Ronde awal", "32 besar", "16 besar", "Perempat final", "Semifinal", "Final"];
const ROUND_COUNTS = [16, 16, 8, 4, 2, 1];
const STORAGE_PREFIX = "animal-kaiser-tournament-v2:";
const SAMPLE_NAMES = [
  "Singa Emas", "Macan Putih", "Elang Jawa", "Serigala Abu", "Gorila Perak", "Komodo Raja", "Beruang Kutub", "Hiu Martil",
  "Harimau Sumatra", "Banteng Merah", "Buaya Nil", "Rajawali Hitam", "Badak Jawa", "Panther Hitam", "Kobra Emas", "Kerbau Baja",
  "Kuda Liar", "Rusa Tanduk", "Gajah Afrika", "Macan Tutul", "Paus Biru", "Kanguru Petarung", "Elang Laut", "Singa Gunung",
  "Serigala Salju", "Beruang Madu", "Komodo Api", "Hiu Putih", "Harimau Bengal", "Banteng Liar", "Buaya Muara", "Rajawali Emas",
  "Badak Putih", "Panther Salju", "Kobra Raja", "Kerbau Hitam", "Kuda Petir", "Rusa Merah", "Gajah Asia", "Macan Dahan",
  "Paus Orca", "Kanguru Merah", "Elang Gurun", "Singa Batu", "Serigala Hutan", "Beruang Cokelat", "Komodo Baja", "Hiu Macan"
];

let tournament;
let library = [];
let saveQueue = Promise.resolve();
let activeModal = null;
let activeMatch = null;
let activeDeleteId = null;
let toastTimer;

const tournamentStore = {
  async list() {
    const summaries = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      try {
        const document = JSON.parse(localStorage.getItem(key));
        if (document.schemaVersion !== 2 || !document.id || !Array.isArray(document.winners)) continue;
        summaries.push({ id: document.id, name: document.name, updatedAt: document.updatedAt || document.createdAt, completed: document.winners.flat().filter(Boolean).length, champion: !!document.winners[5]?.[0] });
      } catch (_) { /* Berkas lokal yang rusak diabaikan dari daftar. */ }
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async load(id) {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (!raw) throw new Error("Turnamen tidak ditemukan di browser ini.");
    return JSON.parse(raw);
  },
  async save(document) {
    localStorage.setItem(`${STORAGE_PREFIX}${document.id}`, JSON.stringify({ ...document, updatedAt: new Date().toISOString() }));
  },
  async remove(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("ID turnamen tidak valid.");
    localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
  }
};

const $ = (id) => document.getElementById(id);
const el = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
};

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const j = random[0] % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createTournament(name, names) {
  const entrants = shuffled(names.map((entry, index) => ({ id: `p${index + 1}`, name: entry })));
  const firstRound = Array.from({ length: 16 }, (_, index) => [entrants[index * 2].id, entrants[index * 2 + 1].id]);
  const byes = entrants.slice(32).map((person) => person.id);
  return { schemaVersion: 2, id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), entrants, firstRound, byes, winners: ROUND_COUNTS.map((count) => Array(count).fill(null)) };
}

function participantsAt(round, index, data = tournament) {
  if (round === 0) return data.firstRound[index];
  if (round === 1) return [data.winners[0][index], data.byes[index]];
  return [data.winners[round - 1][index * 2], data.winners[round - 1][index * 2 + 1]];
}

function pruneInvalidWinners(data = tournament) {
  for (let round = 0; round < 6; round++) {
    for (let index = 0; index < ROUND_COUNTS[round]; index++) {
      const winner = data.winners[round][index];
      if (winner && !participantsAt(round, index, data).includes(winner)) data.winners[round][index] = null;
    }
  }
}

function clearDescendants(round, index, data = tournament) {
  if (round >= 5) return;
  const nextIndex = round === 0 ? index : Math.floor(index / 2);
  data.winners[round + 1][nextIndex] = null;
  clearDescendants(round + 1, nextIndex, data);
}

function participantName(id) {
  return tournament.entrants.find((person) => person.id === id)?.name ?? "Menunggu hasil";
}

function queueSave() {
  const snapshot = structuredClone(tournament);
  $("autosave-status").textContent = "Menyimpan…";
  $("autosave-status").classList.remove("error");
  saveQueue = saveQueue.catch(() => {}).then(() => tournamentStore.save(snapshot)).then(() => {
    $("autosave-status").textContent = "Tersimpan otomatis";
  }).catch((error) => {
    $("autosave-status").textContent = "Gagal menyimpan";
    $("autosave-status").classList.add("error");
    showToast(`Gagal menyimpan: ${error.message}`);
    throw error;
  });
  return saveQueue;
}

function validateTournament(raw) {
  if (!raw || raw.schemaVersion !== 2 || typeof raw.name !== "string" || !raw.name.trim() || !Array.isArray(raw.entrants) || raw.entrants.length !== 48 || !Array.isArray(raw.firstRound) || raw.firstRound.length !== 16 || !Array.isArray(raw.byes) || raw.byes.length !== 16 || !Array.isArray(raw.winners) || raw.winners.length !== 6) throw new Error("Format turnamen tidak valid.");
  const ids = new Set();
  const names = new Set();
  for (const person of raw.entrants) {
    if (!person || typeof person.id !== "string" || !person.id || typeof person.name !== "string" || !person.name.trim() || person.name.length > 100) throw new Error("Daftar peserta tidak valid.");
    if (ids.has(person.id) || names.has(person.name.trim().toLocaleLowerCase("id"))) throw new Error("Ada peserta atau ID yang duplikat.");
    ids.add(person.id);
    names.add(person.name.trim().toLocaleLowerCase("id"));
  }
  const placed = [...raw.firstRound.flat(), ...raw.byes];
  if (raw.firstRound.some((pair) => !Array.isArray(pair) || pair.length !== 2) || placed.length !== 48 || placed.some((id) => !ids.has(id)) || new Set(placed).size !== 48) throw new Error("Posisi undian peserta tidak valid.");
  raw.winners.forEach((list, round) => {
    if (!Array.isArray(list) || list.length !== ROUND_COUNTS[round] || list.some((id) => id !== null && !ids.has(id))) throw new Error("Hasil pertandingan tidak valid.");
  });
  const validated = { schemaVersion: 2, id: typeof raw.id === "string" && /^[0-9a-f-]{36}$/i.test(raw.id) ? raw.id : crypto.randomUUID(), name: raw.name.trim().slice(0, 100), createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(), entrants: raw.entrants.map((p) => ({ id: p.id, name: p.name.trim() })), firstRound: raw.firstRound.map((pair) => [...pair]), byes: [...raw.byes], winners: raw.winners.map((list) => [...list]) };
  for (let round = 0; round < 6; round++) for (let index = 0; index < ROUND_COUNTS[round]; index++) {
    const winner = validated.winners[round][index];
    if (winner && !participantsAt(round, index, validated).includes(winner)) throw new Error("Berkas memiliki hasil pertandingan yang tidak konsisten.");
  }
  return validated;
}

function renderSummary() {
  const complete = tournament.winners.flat().filter(Boolean).length;
  const champion = tournament.winners[5][0];
  $("page-title").textContent = tournament.name;
  $("breadcrumb-name").textContent = tournament.name;
  $("sidebar-name").textContent = tournament.name;
  $("stat-participants").textContent = tournament.entrants.length;
  $("nav-count").textContent = tournament.entrants.length;
  $("stat-complete").innerHTML = `${complete} <em>/ 47</em>`;
  $("stat-progress").textContent = `${Math.round(complete / 47 * 100)}% progres turnamen`;
  $("stat-champion").textContent = champion ? participantName(champion) : "Belum ditentukan";
  $("champion-caption").textContent = champion ? "Pemenang turnamen" : "Final menanti";
}

function cardCenter(round, index) {
  if (round <= 1) return 70 + 124 * index;
  return 70 + (Math.pow(2, round - 1) - 1) * 62 + 124 * Math.pow(2, round - 1) * index;
}

function renderBracket() {
  const strip = $("round-strip");
  const canvas = $("bracket-canvas");
  strip.replaceChildren();
  canvas.replaceChildren();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "connector-layer");
  svg.setAttribute("width", "1485");
  svg.setAttribute("height", "2050");
  svg.setAttribute("aria-hidden", "true");
  for (let round = 0; round < 6; round++) {
    const label = el("button", "round-label");
    label.type = "button";
    label.append(el("strong", "", ROUND_NAMES[round]), el("span", "", `${ROUND_COUNTS[round]} pertandingan`));
    label.addEventListener("click", () => $("bracket-scroll").scrollTo({ left: round * 238, behavior: "smooth" }));
    strip.append(label);
    const column = el("div", "round-column");
    column.style.left = `${25 + round * 238}px`;
    for (let index = 0; index < ROUND_COUNTS[round]; index++) {
      const players = participantsAt(round, index);
      const winner = tournament.winners[round][index];
      const ready = players.every(Boolean) && !winner;
      const card = el("button", `match-card ${winner ? "complete" : ready ? "ready" : "pending"}`);
      card.type = "button";
      card.style.top = `${cardCenter(round, index) - 49}px`;
      card.setAttribute("aria-label", `${ROUND_NAMES[round]}, pertandingan ${index + 1}: ${players.map(participantName).join(" melawan ")}`);
      const head = el("div", "match-head");
      head.append(el("span", "", `MATCH ${String(index + 1).padStart(2, "0")}`), el("span", "match-state", winner ? "SELESAI" : ready ? "SIAP" : "MENUNGGU"));
      card.append(head);
      players.forEach((id, slot) => {
        const row = el("div", `match-player ${!id ? "tbd" : id === winner ? "winner" : ""}`);
        row.append(el("span", "seed", id ? round === 1 && slot === 1 ? "BYE" : String(slot + 1).padStart(2, "0") : "—"), el("span", "player-name", participantName(id)));
        if (id && id === winner) row.append(el("span", "check", "✓"));
        card.append(row);
      });
      card.addEventListener("click", () => openMatch(round, index));
      column.append(card);
      if (round > 0) {
        const from = round === 1 ? [index] : [index * 2, index * 2 + 1];
        from.forEach((sourceIndex) => {
          const x1 = 25 + (round - 1) * 238 + 207;
          const x2 = 25 + round * 238;
          const y1 = cardCenter(round - 1, sourceIndex);
          const y2 = cardCenter(round, index);
          const mid = (x1 + x2) / 2;
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`);
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", "#d8dee8");
          path.setAttribute("stroke-width", "1.5");
          svg.append(path);
        });
      }
    }
    canvas.append(column);
  }
  canvas.prepend(svg);
}

function renderParticipants() {
  const grid = $("participant-grid");
  grid.replaceChildren();
  const order = [...tournament.firstRound.flat(), ...tournament.byes];
  order.forEach((id, index) => {
    const person = tournament.entrants.find((entry) => entry.id === id);
    const item = el("div", "participant-item");
    item.append(el("span", "", String(index + 1).padStart(2, "0")), el("strong", "", `${person.name}${index >= 32 ? " · Bye" : ""}`));
    grid.append(item);
  });
}

function render() { renderSummary(); renderBracket(); renderParticipants(); }

function renderHome() {
  $("home-count").textContent = `${library.length} turnamen`;
  const list = $("home-list");
  list.replaceChildren();
  if (!library.length) {
    const empty = el("div", "home-empty");
    empty.append(el("strong", "", "Belum ada turnamen"), el("span", "", "Buat turnamen pertama Anda untuk mulai bertanding."));
    list.append(empty);
    return;
  }
  library.forEach((item) => {
    const card = el("div", "home-card");
    const open = el("button", "home-card-open");
    open.type = "button";
    open.setAttribute("aria-label", `Buka turnamen ${item.name}`);
    const top = el("div", "home-card-top");
    top.append(el("span", "home-card-icon", "★"));
    open.append(top, el("strong", "", item.name), el("small", "", `${item.completed} / 47 pertandingan selesai${item.champion ? " · Juara ditentukan" : ""}`), el("span", "home-card-date", new Date(item.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })));
    open.addEventListener("click", () => loadTournament(item.id));
    const deleteButton = el("button", "home-card-delete", "Hapus");
    deleteButton.type = "button";
    deleteButton.title = "Hapus turnamen";
    deleteButton.setAttribute("aria-label", `Hapus turnamen ${item.name}`);
    deleteButton.addEventListener("click", () => openDelete(item));
    card.append(open, deleteButton);
    list.append(card);
  });
}

async function showHome() {
  try { await saveQueue; } catch (_) { return; }
  try {
    library = await tournamentStore.list();
    renderHome();
    $("app-shell").classList.add("hidden");
    $("home-screen").classList.remove("hidden");
  } catch (error) { showToast(`Gagal memuat daftar: ${error.message}`); }
}

async function loadTournament(id) {
  try {
    const document = await tournamentStore.load(id);
    tournament = validateTournament(document);
    tournament.id = id;
    render();
    showSection("bracket");
    $("home-screen").classList.add("hidden");
    $("app-shell").classList.remove("hidden");
    $("bracket-scroll").scrollTo({ left: 0, top: 0 });
  } catch (error) { showToast(`Gagal membuka turnamen: ${error.message}`); }
}

function showSection(section) {
  const participants = section === "participants";
  $("bracket-section").classList.toggle("hidden", participants);
  $("participants-section").classList.toggle("hidden", !participants);
  $("nav-bracket").classList.toggle("active", !participants);
  $("nav-participants").classList.toggle("active", participants);
  $("page-subtitle").textContent = participants ? "Semua peserta sesuai posisi hasil undian awal." : "Pantau setiap pertandingan, pilih pemenang, dan lihat jalan menuju juara.";
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3400);
}

function showModal(type) {
  activeModal = type;
  $("modal-error").classList.add("hidden");
  $("modal-backdrop").classList.remove("hidden");
  $("modal-body").replaceChildren();
  $("modal-confirm").classList.remove("danger");
  $("modal-confirm").classList.add("primary");
}
function closeModal() { $("modal-backdrop").classList.add("hidden"); activeModal = null; activeMatch = null; activeDeleteId = null; }
function modalError(message) { $("modal-error").textContent = message; $("modal-error").classList.remove("hidden"); }

function openDelete(item) {
  showModal("delete");
  activeDeleteId = item.id;
  $("modal-kicker").textContent = "HAPUS TURNAMEN";
  $("modal-title").textContent = "Hapus turnamen ini?";
  $("modal-description").textContent = `“${item.name}” akan dihapus dari browser ini. Progresnya tidak dapat dipulihkan kecuali Anda sudah mengekspor JSON.`;
  $("modal-confirm").textContent = "Ya, hapus turnamen";
  $("modal-confirm").classList.remove("primary");
  $("modal-confirm").classList.add("danger");
  $("modal-cancel").focus();
}

function openNew() {
  showModal("new");
  $("modal-kicker").textContent = "TURNAMEN BARU";
  $("modal-title").textContent = "Buat turnamen";
  $("modal-description").textContent = "Tulis satu nama peserta di setiap baris. Posisi peserta akan diacak setelah bracket dibuat.";
  $("modal-confirm").textContent = "Buat bracket";
  const nameLabel = el("label", "field-label", "Nama turnamen");
  nameLabel.htmlFor = "tournament-name";
  const name = el("input", "field-input");
  name.id = "tournament-name";
  name.maxLength = 100;
  name.value = "Piala Animal Kaiser";
  const namesLabel = el("label", "field-label", "Nama peserta (48 orang)");
  namesLabel.htmlFor = "participant-names";
  const names = el("textarea", "names-input");
  names.id = "participant-names";
  names.placeholder = "Singa Emas\nMacan Putih\nElang Jawa\n...";
  names.value = "";
  const help = el("div", "input-help");
  const hint = el("span", "", "Baris kosong akan diabaikan");
  const count = el("strong", "", "0 / 48 peserta");
  help.append(hint, count);
  names.addEventListener("input", () => { count.textContent = `${names.value.split(/\r?\n/).filter((line) => line.trim()).length} / 48 peserta`; });
  const sampleButton = el("button", "sample-fill", "Isi 48 nama contoh untuk mencoba");
  sampleButton.type = "button";
  sampleButton.addEventListener("click", () => { names.value = SAMPLE_NAMES.join("\n"); names.dispatchEvent(new Event("input")); });
  $("modal-body").append(nameLabel, name, namesLabel, names, help, sampleButton);
  name.focus();
}

function openMatch(round, index) {
  const players = participantsAt(round, index);
  if (!players.every(Boolean)) { showToast("Pertandingan ini menunggu hasil dari ronde sebelumnya."); return; }
  activeMatch = { round, index };
  showModal("match");
  $("modal-kicker").textContent = ROUND_NAMES[round].toUpperCase();
  $("modal-title").textContent = "Tentukan pemenang";
  $("modal-description").textContent = "Pilih peserta yang menang. Hasilnya langsung diteruskan ke pertandingan berikutnya.";
  $("modal-confirm").textContent = "Simpan hasil";
  const context = el("div", "match-context", `${ROUND_NAMES[round]} · Pertandingan ${String(index + 1).padStart(2, "0")}`);
  const choices = el("div", "choice-list");
  players.forEach((id) => {
    const label = el("label", "choice-option");
    const radio = el("input");
    radio.type = "radio";
    radio.name = "winner";
    radio.value = id;
    radio.checked = tournament.winners[round][index] === id;
    label.append(radio, el("span", "", participantName(id)));
    choices.append(label);
  });
  $("modal-body").append(context, choices);
}

async function confirmModal() {
  if (activeModal === "new") {
    const name = $("tournament-name").value.trim();
    const names = $("participant-names").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!name) return modalError("Masukkan nama turnamen.");
    if (names.length !== 48) return modalError(`Dibutuhkan tepat 48 peserta. Saat ini ada ${names.length}.`);
    if (names.some((entry) => entry.length > 100)) return modalError("Nama peserta maksimal 100 karakter.");
    if (new Set(names.map((entry) => entry.toLocaleLowerCase("id"))).size !== 48) return modalError("Nama peserta tidak boleh duplikat.");
    tournament = createTournament(name, names);
    closeModal();
    render();
    $("home-screen").classList.add("hidden");
    $("app-shell").classList.remove("hidden");
    showSection("bracket");
    $("bracket-scroll").scrollTo({ left: 0, top: 0 });
    try { await queueSave(); showToast("Bracket baru berhasil dibuat dan disimpan."); } catch (_) { /* Pesan gagal simpan sudah tampil. */ }
  } else if (activeModal === "match") {
    const selected = document.querySelector('input[name="winner"]:checked');
    if (!selected) return modalError("Pilih salah satu pemenang.");
    if (tournament.winners[activeMatch.round][activeMatch.index] !== selected.value) clearDescendants(activeMatch.round, activeMatch.index);
    tournament.winners[activeMatch.round][activeMatch.index] = selected.value;
    pruneInvalidWinners();
    closeModal();
    render();
    try { await queueSave(); showToast("Hasil pertandingan disimpan."); } catch (_) { /* Pesan gagal simpan sudah tampil. */ }
  } else if (activeModal === "delete") {
    try {
      await saveQueue;
      await tournamentStore.remove(activeDeleteId);
      if (tournament?.id === activeDeleteId) tournament = undefined;
      closeModal();
      await showHome();
      showToast("Turnamen berhasil dihapus.");
    } catch (error) { modalError(`Gagal menghapus turnamen: ${error.message}`); }
  }
}

async function exportTournament() {
  try { await saveQueue; } catch (_) { /* Ekspor tetap tersedia jika penyimpanan lokal gagal. */ }
  try {
    const content = new Blob([JSON.stringify(tournament, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(content);
    const link = el("a");
    link.href = url;
    link.download = `${tournament.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "turnamen"}.akt.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Berkas JSON berhasil diekspor.");
  } catch (error) { showToast(`Gagal mengekspor: ${error.message}`); }
}

async function importTournament(file) {
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error("Berkas JSON terlalu besar.");
    const raw = JSON.parse(await file.text());
    tournament = validateTournament(raw);
    tournament.id = crypto.randomUUID();
    render();
    $("home-screen").classList.add("hidden");
    $("app-shell").classList.remove("hidden");
    showSection("bracket");
    $("bracket-scroll").scrollTo({ left: 0, top: 0 });
    await queueSave();
    showToast("Turnamen berhasil diimpor dan disimpan.");
  } catch (error) { showToast(error instanceof SyntaxError ? "Berkas bukan JSON yang valid." : `Gagal mengimpor: ${error.message}`); }
  $("file-input").value = "";
}

async function migrateLegacyPreview() {
  try {
    const legacyKey = "animal-kaiser-tournament-preview-v1";
    const raw = localStorage.getItem(legacyKey);
    if (!raw) return;
    await tournamentStore.save(validateTournament(JSON.parse(raw)));
    localStorage.removeItem(legacyKey);
  } catch (_) { /* Data preview lama tetap tersedia jika migrasi gagal. */ }
}

function init() {
  migrateLegacyPreview().then(showHome);
  $("home-new-button").addEventListener("click", openNew);
  $("home-import-button").addEventListener("click", () => $("file-input").click());
  $("home-button").addEventListener("click", showHome);
  $("nav-home").addEventListener("click", showHome);
  $("new-button").addEventListener("click", openNew);
  $("load-button").addEventListener("click", () => $("file-input").click());
  $("file-input").addEventListener("change", (event) => importTournament(event.target.files[0]));
  $("save-button").addEventListener("click", exportTournament);
  $("modal-close").addEventListener("click", closeModal);
  $("modal-cancel").addEventListener("click", closeModal);
  $("modal-confirm").addEventListener("click", confirmModal);
  $("modal-backdrop").addEventListener("click", (event) => { if (event.target === $("modal-backdrop")) closeModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && activeModal) closeModal(); });
  $("nav-bracket").addEventListener("click", () => showSection("bracket"));
  $("nav-participants").addEventListener("click", () => showSection("participants"));
  $("back-to-bracket").addEventListener("click", () => showSection("bracket"));
  $("reset-view").addEventListener("click", () => $("bracket-scroll").scrollTo({ top: 0, left: 0, behavior: "smooth" }));
}

init();

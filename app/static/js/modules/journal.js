/* =======================================================
 * Time Travel - Travel Journal - Notes and community sharing
 * ======================================================= */

// ═══════════════════════════════════════════════════════════
// TRAVEL JOURNAL – Notes & community sharing
// ═══════════════════════════════════════════════════════════
let journalCache = [];
let communityCache = [];
let activeJournalTab = "mine";

function initJournal() {
  const saveBtn = document.getElementById("journalSaveBtn");
  if (!saveBtn) return;

  saveBtn.addEventListener("click", async () => {
    const dest = document.getElementById("journalDest").value;
    const title = document.getElementById("journalTitle").value.trim();
    const content = document.getElementById("journalContent").value.trim();
    const mood = document.getElementById("journalMood").value;
    const rating =
      parseInt(document.getElementById("journalRating").value) || null;
    const isPublic = document.getElementById("journalPublic").checked;

    if (!dest) return showToast("Please select a destination.", "warning");
    if (!title) return showToast("Please add a title.", "warning");
    if (!content) return showToast("Please write something.", "warning");

    try {
      const res = await fetch(`${API_BASE}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        credentials: "same-origin",
        body: JSON.stringify({
          destination: dest,
          title,
          content,
          mood,
          rating,
          is_public: isPublic,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast("Journal entry saved!", "success");
        document.getElementById("journalTitle").value = "";
        document.getElementById("journalContent").value = "";
        document.getElementById("journalMood").value = "";
        document.getElementById("journalRating").value = "";
        document.getElementById("journalPublic").checked = false;
        await loadJournalNotes();
      } else {
        showToast(data.error || "Failed to save note.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  });

  // Tab switching
  document.querySelectorAll(".journal-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".journal-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeJournalTab = tab.dataset.jtab;
      renderJournalList();
    });
  });
}

async function loadJournalNotes() {
  if (!currentUser) return;

  try {
    const [myRes, commRes] = await Promise.all([
      fetch(`${API_BASE}/api/notes`, { credentials: "same-origin" }),
      fetch(`${API_BASE}/api/notes/community`),
    ]);
    const myData = await myRes.json();
    const commData = await commRes.json();
    journalCache = myData.notes || [];
    communityCache = commData.notes || [];
    renderJournalList();
  } catch {
    journalCache = [];
    communityCache = [];
  }
}

function renderJournalList() {
  const listEl = document.getElementById("journalList");
  if (!listEl) return;

  const items = activeJournalTab === "mine" ? journalCache : communityCache;

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-book-open"></i>
        <p>${activeJournalTab === "mine" ? "No journal entries yet. Share your travel story!" : "No community notes yet. Be the first to share!"}</p>
      </div>`;
    return;
  }

  const MOOD_EMOJI = {
    excited: "🤩",
    happy: "😊",
    relaxed: "😌",
    amazed: "🤯",
    grateful: "🙏",
    adventurous: "🏔️",
  };

  listEl.innerHTML = items
    .map((n) => {
      const date = new Date(n.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const stars = n.rating ? "⭐".repeat(n.rating) : "";
      const moodText = n.mood ? (MOOD_EMOJI[n.mood] || "") + " " + n.mood : "";
      const isOwn = activeJournalTab === "mine";

      return `
      <div class="journal-entry">
        <div class="journal-entry-header">
          <div>
            <strong class="journal-entry-title">${n.title}</strong>
            <span class="journal-entry-dest"><i class="fas fa-map-marker-alt"></i> ${n.destination}</span>
          </div>
          <div class="journal-entry-meta">
            ${moodText ? `<span class="journal-mood">${moodText}</span>` : ""}
            ${stars ? `<span class="journal-stars">${stars}</span>` : ""}
          </div>
        </div>
        <p class="journal-entry-content">${n.content.length > 200 ? n.content.substring(0, 200) + "…" : n.content}</p>
        <div class="journal-entry-footer">
          <span class="journal-entry-date"><i class="fas fa-clock"></i> ${date}</span>
          ${!isOwn && n.user_name ? `<span class="journal-entry-author"><i class="fas fa-user"></i> ${n.user_name}</span>` : ""}
          ${isOwn ? `<button class="journal-del-btn" data-action="delete-journal" data-id="${n.id}"><i class="fas fa-trash-alt"></i></button>` : ""}
        </div>
      </div>`;
    })
    .join("");
}

async function deleteJournalNote(id) {
  try {
    const res = await fetch(`${API_BASE}/api/notes/${id}`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "same-origin",
    });
    if (res.ok) {
      showToast("Note deleted.", "info");
      await loadJournalNotes();
    } else {
      showToast("Could not delete note.", "error");
    }
  } catch {
    showToast("Network error.", "error");
  }
}

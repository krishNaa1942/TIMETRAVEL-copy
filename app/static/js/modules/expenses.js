/* =======================================================
 * Time Travel - Expense Tracker - Log and visualize trip spending
 * ======================================================= */

// ═══════════════════════════════════════════════════════════
// EXPENSE TRACKER – Log & visualise trip spending
// ═══════════════════════════════════════════════════════════
let expenseCache = [];

function initExpenseTracker() {
  const addBtn = document.getElementById("expAddBtn");
  if (!addBtn) return;

  // Default date to today
  const dateEl = document.getElementById("expDate");
  if (dateEl && !dateEl.value)
    dateEl.value = new Date().toISOString().split("T")[0];

  addBtn.addEventListener("click", async () => {
    const dest = document.getElementById("expDest").value;
    const category = document.getElementById("expCategory").value;
    const description = document.getElementById("expDesc").value.trim();
    const amount = parseFloat(document.getElementById("expAmount").value);
    const date = document.getElementById("expDate").value;

    if (!dest) return showToast("Please select a destination.", "warning");
    if (!description) return showToast("Please add a description.", "warning");
    if (!amount || amount <= 0)
      return showToast("Please enter a valid amount.", "warning");

    try {
      const res = await fetch(`${API_BASE}/api/expenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        credentials: "same-origin",
        body: JSON.stringify({
          destination: dest,
          category,
          description,
          amount,
          date,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast("Expense added!", "success");
        document.getElementById("expDesc").value = "";
        document.getElementById("expAmount").value = "";
        await loadExpenses();
      } else {
        showToast(data.error || "Failed to add expense.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  });
}

async function loadExpenses() {
  if (!currentUser) return;

  try {
    const [listRes, sumRes] = await Promise.all([
      fetch(`${API_BASE}/api/expenses`, { credentials: "same-origin" }),
      fetch(`${API_BASE}/api/expenses/summary`, { credentials: "same-origin" }),
    ]);
    const listData = await listRes.json();
    const sumData = await sumRes.json();

    expenseCache = listData.expenses || [];
    renderExpenses(expenseCache, sumData);
  } catch {
    expenseCache = [];
  }
}

function renderExpenses(expenses, summary) {
  const totalEl = document.getElementById("expTotal");
  const barsEl = document.getElementById("expCategoryBars");
  const listEl = document.getElementById("expList");

  if (totalEl) totalEl.textContent = formatINR(summary.total || 0);

  // Category breakdown bars
  if (barsEl && summary.by_category) {
    const maxAmt = Math.max(...Object.values(summary.by_category), 1);
    const CAT_COLORS = {
      food: "#f97316",
      transport: "#3b82f6",
      accommodation: "#8b5cf6",
      activity: "#10b981",
      shopping: "#ec4899",
      misc: "#6b7280",
    };
    const CAT_ICONS = {
      food: "🍽️",
      transport: "🚗",
      accommodation: "🏨",
      activity: "🎭",
      shopping: "🛒",
      misc: "📦",
    };
    barsEl.innerHTML = Object.entries(summary.by_category)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([cat, amt]) => `
        <div class="exp-bar-row">
          <span class="exp-bar-label">${CAT_ICONS[cat] || ""} ${cat}</span>
          <div class="exp-bar-track"><div class="exp-bar-fill" style="width:${(amt / maxAmt) * 100}%;background:${CAT_COLORS[cat] || "#6b7280"}"></div></div>
          <span class="exp-bar-amount">${formatINR(amt)}</span>
        </div>
      `,
      )
      .join("");
  }

  // Expense list
  if (listEl) {
    if (expenses.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><i class="fas fa-receipt"></i><p>No expenses logged yet. Add your first expense!</p></div>`;
      return;
    }

    listEl.innerHTML = expenses
      .map((e) => {
        const date = new Date(e.date || e.created_at).toLocaleDateString(
          "en-IN",
          { day: "numeric", month: "short" },
        );
        const CAT_ICONS = {
          food: "🍽️",
          transport: "🚗",
          accommodation: "🏨",
          activity: "🎭",
          shopping: "🛒",
          misc: "📦",
        };
        return `
        <div class="exp-item">
          <div class="exp-item-icon">${CAT_ICONS[e.category] || "📦"}</div>
          <div class="exp-item-info">
            <strong>${e.description}</strong>
            <small>${e.destination} · ${date}</small>
          </div>
          <div class="exp-item-amount">${formatINR(e.amount)}</div>
          <button class="exp-item-del" data-action="delete-expense" data-id="${e.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
        </div>`;
      })
      .join("");
  }
}

async function deleteExpense(id) {
  try {
    const res = await fetch(`${API_BASE}/api/expenses/${id}`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "same-origin",
    });
    if (res.ok) {
      showToast("Expense deleted.", "info");
      await loadExpenses();
    } else {
      showToast("Could not delete expense.", "error");
    }
  } catch {
    showToast("Network error.", "error");
  }
}

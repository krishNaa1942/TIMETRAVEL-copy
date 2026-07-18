/* =======================================================
 * Time Travel - Core Utilities - API base, CSRF, escapeHtml, toast, loader, formatINR
 * ======================================================= */

/**
 * ═══════════════════════════════════════════════════════════
 * Time Travel – Frontend JavaScript
 * Handles all API interactions and dynamic UI rendering
 * ═══════════════════════════════════════════════════════════
 */

const API_BASE = window.location.origin;

// ── Helper: read CSRF token from <meta> tag ───────────────
function getCSRFToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute("content") : "";
}

// ── Helper: escape HTML to prevent XSS ────────────────────
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}
// Alias for legacy call sites (news section uses capital H)
const escapeHTML = escapeHtml;

// ── Helper: download PDF from API ─────────────────────────
async function downloadPDF(endpoint, payload, fallbackName) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "PDF export failed.", "error");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fallbackName || "export.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("PDF downloaded!", "success");
  } catch (e) {
    showToast("Network error – could not download PDF.", "error");
  }
}

// ── Helper: toast notifications ────────────────────────────
const TOAST_ICONS = {
  error: "fas fa-exclamation-circle",
  warning: "fas fa-exclamation-triangle",
  success: "fas fa-check-circle",
  info: "fas fa-info-circle",
};

function showToast(message, type = "error", duration = 4000) {
  const container = document.getElementById("toast-container");
  if (!container) {
    console.warn("Toast:", message);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="toast-icon ${TOAST_ICONS[type] || TOAST_ICONS.info}"></i>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Dismiss">&times;</button>
  `;

  toast
    .querySelector(".toast-close")
    .addEventListener("click", () => removeToast(toast));
  container.appendChild(toast);

  const timer = setTimeout(() => removeToast(toast), duration);
  toast._timer = timer;
}

function removeToast(toast) {
  if (toast._removed) return;
  toast._removed = true;
  clearTimeout(toast._timer);
  toast.classList.add("toast-removing");
  toast.addEventListener("transitionend", () => toast.remove());
}

// ── Helper: show / hide loader ────────────────────────────
function showLoader() {
  document.getElementById("loader").style.display = "flex";
}
function hideLoader() {
  document.getElementById("loader").style.display = "none";
}

// ── Helper: format currency ───────────────────────────────
function formatINR(amount) {
  return (
    "₹" + Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })
  );
}


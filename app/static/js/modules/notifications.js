/* =======================================================
 * Time Travel - Notifications System
 * Toast messages, progress indicators, feedback loops
 * ======================================================= */

class NotificationManager {
  constructor() {
    this.container = null;
    this.queue = [];
    this.maxVisibleToasts = 3;
    this.lastToast = null;
    this.init();
  }

  init() {
    // Create notification container if it doesn't exist
    if (!document.getElementById("notificationContainer")) {
      const container = document.createElement("div");
      container.id = "notificationContainer";
      container.className = "notification-container";
      document.body.appendChild(container);
      this.container = container;
    } else {
      this.container = document.getElementById("notificationContainer");
    }
  }

  /**
   * Show toast notification
   * @param {string} message - The message to display
   * @param {string} type - Type: 'success', 'error', 'warning', 'info'
   * @param {number} duration - Duration in ms (0 = persistent)
   */
  toast(message, type = "info", duration = 3500) {
    // Prevent noisy duplicates from stacking repeatedly in quick succession.
    if (this.isDuplicate(message, type)) {
      return null;
    }

    this.trimOverflow();

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;

    const icon = this.getIcon(type);
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Close notification">&times;</button>
    `;

    this.container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add("toast--visible");
    });

    // Close button
    toast.querySelector(".toast-close").addEventListener("click", () => {
      this.remove(toast);
    });

    // Auto-remove
    if (duration > 0) {
      setTimeout(() => this.remove(toast), duration);
    }

    this.lastToast = {
      key: this.makeToastKey(message, type),
      timestamp: Date.now(),
    };

    return toast;
  }

  /**
   * Success notification
   */
  success(message, duration = 3000) {
    return this.toast(message, "success", duration);
  }

  /**
   * Error notification
   */
  error(message, duration = 4000) {
    return this.toast(message, "error", duration);
  }

  /**
   * Warning notification
   */
  warning(message, duration = 3500) {
    return this.toast(message, "warning", duration);
  }

  /**
   * Info notification
   */
  info(message, duration = 3000) {
    return this.toast(message, "info", duration);
  }

  /**
   * Remove toast
   */
  remove(toast) {
    toast.classList.remove("toast--visible");
    setTimeout(() => toast.remove(), 300);
  }

  /**
   * Get icon for notification type
   */
  getIcon(type) {
    const icons = {
      success: '<i class="fas fa-check-circle"></i>',
      error: '<i class="fas fa-exclamation-circle"></i>',
      warning: '<i class="fas fa-exclamation-triangle"></i>',
      info: '<i class="fas fa-info-circle"></i>',
    };
    return icons[type] || icons.info;
  }

  /**
   * Show loading toast (persistent until manually closed or new notification)
   */
  loading(message = "Loading...") {
    return this.toast(
      `<div class="toast-spinner"></div> ${message}`,
      "info",
      0,
    );
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    const toasts = this.container.querySelectorAll(".toast");
    toasts.forEach((t) => this.remove(t));
  }

  makeToastKey(message, type) {
    return `${type}:${String(message).replace(/\s+/g, " ").trim()}`;
  }

  isDuplicate(message, type) {
    if (!this.lastToast) return false;
    const now = Date.now();
    const key = this.makeToastKey(message, type);
    return this.lastToast.key === key && now - this.lastToast.timestamp < 1400;
  }

  trimOverflow() {
    if (!this.container) return;
    const toasts = this.container.querySelectorAll(".toast");
    const overflowCount = toasts.length - (this.maxVisibleToasts - 1);
    if (overflowCount <= 0) return;

    for (let i = 0; i < overflowCount; i += 1) {
      this.remove(toasts[i]);
    }
  }
}

// Global notification instance
window.notify = new NotificationManager();

// ═══════════════════════════════════════════════════════════
// PROGRESS INDICATOR – For multi-step forms or uploads
// ═══════════════════════════════════════════════════════════
class ProgressBar {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    this.bar = null;
    this.percentage = 0;
    this.init();
  }

  init() {
    if (!this.container) return;
    const bar = document.createElement("div");
    bar.className = "progress-bar-container";
    bar.innerHTML = `
      <div class="progress-bar-fill"></div>
      <span class="progress-bar-text">0%</span>
    `;
    this.container.appendChild(bar);
    this.bar = bar;
  }

  /**
   * Set progress percentage
   */
  set(percentage) {
    if (!this.bar) return;
    this.percentage = Math.min(100, Math.max(0, percentage));
    const fill = this.bar.querySelector(".progress-bar-fill");
    const text = this.bar.querySelector(".progress-bar-text");
    fill.style.width = this.percentage + "%";
    text.textContent = Math.round(this.percentage) + "%";
  }

  /**
   * Increment progress
   */
  increment(amount = 10) {
    this.set(this.percentage + amount);
  }

  /**
   * Complete progress
   */
  complete() {
    this.set(100);
    setTimeout(() => {
      this.bar.classList.add("progress-bar-complete");
    }, 300);
  }

  /**
   * Reset progress
   */
  reset() {
    this.set(0);
    if (this.bar) this.bar.classList.remove("progress-bar-complete");
  }

  /**
   * Destroy progress bar
   */
  destroy() {
    if (this.bar) this.bar.remove();
  }
}

// ═══════════════════════════════════════════════════════════
// CONFIRMATION DIALOG
// ═══════════════════════════════════════════════════════════
function showConfirmation(message, onConfirm, onCancel) {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "confirmation-dialog confirmation-dialog--visible";
    dialog.innerHTML = `
      <div class="confirmation-dialog-backdrop"></div>
      <div class="confirmation-dialog-content">
        <p class="confirmation-dialog-message">${message}</p>
        <div class="confirmation-dialog-actions">
          <button class="btn btn--secondary btn-confirm-cancel">Cancel</button>
          <button class="btn btn--danger btn-confirm-ok">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const handleConfirm = () => {
      dialog.classList.remove("confirmation-dialog--visible");
      setTimeout(() => {
        dialog.remove();
        if (onConfirm) onConfirm();
        resolve(true);
      }, 300);
    };

    const handleCancel = () => {
      dialog.classList.remove("confirmation-dialog--visible");
      setTimeout(() => {
        dialog.remove();
        if (onCancel) onCancel();
        resolve(false);
      }, 300);
    };

    dialog
      .querySelector(".btn-confirm-ok")
      .addEventListener("click", handleConfirm);
    dialog
      .querySelector(".btn-confirm-cancel")
      .addEventListener("click", handleCancel);

    // ESC to cancel
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", handleEsc);
        handleCancel();
      }
    };
    document.addEventListener("keydown", handleEsc);
  });
}

// ═══════════════════════════════════════════════════════════
// INPUT FEEDBACK – Visual feedback for form inputs
// ═══════════════════════════════════════════════════════════
function initInputFeedback() {
  document.addEventListener(
    "focus",
    (e) => {
      const input = e.target.closest("input, textarea, select");
      if (!input || !input.parentElement.classList.contains("form-group"))
        return;

      // Add focused state
      input.parentElement.classList.add("form-group--focused");
    },
    true,
  );

  document.addEventListener(
    "blur",
    (e) => {
      const input = e.target.closest("input, textarea, select");
      if (!input || !input.parentElement.classList.contains("form-group"))
        return;

      input.parentElement.classList.remove("form-group--focused");

      // Validate on blur
      if (
        input.hasAttribute("required") ||
        input.hasAttribute("data-validate")
      ) {
        const isValid = input.checkValidity && input.checkValidity();
        const group = input.parentElement;
        if (!isValid && input.value) {
          group.classList.add("form-group--error");
        } else {
          group.classList.remove("form-group--error");
        }
      }
    },
    true,
  );

  // Real-time feedback on input
  document.addEventListener(
    "input",
    (e) => {
      const input = e.target.closest(
        "input[data-validate], textarea[data-validate]",
      );
      if (!input) return;

      const group = input.parentElement;
      const isValid = input.checkValidity && input.checkValidity();

      if (isValid && input.value) {
        group.classList.remove("form-group--error");
        group.classList.add("form-group--valid");
      } else if (!isValid && input.value) {
        group.classList.add("form-group--error");
        group.classList.remove("form-group--valid");
      } else {
        group.classList.remove("form-group--error", "form-group--valid");
      }
    },
    true,
  );
}

// ═══════════════════════════════════════════════════════════
// INIT – Run on page load
// ═══════════════════════════════════════════════════════════
function initNotifications() {
  // Already initialized in constructor
  initInputFeedback();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNotifications);
} else {
  initNotifications();
}

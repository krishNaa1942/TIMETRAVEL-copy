/* =======================================================
 * Time Travel - Enhanced UX Utilities
 * Improved error handling, async wrappers, form validation
 * ======================================================= */

/**
 * Enhanced async wrapper with loading state and error handling
 * Usage: await asyncWithLoading(fetch(...), 'Loading...', 'button-id')
 */
async function asyncWithLoading(promise, loadingMsg, buttonId) {
  let loadingToast = null;
  let button = null;

  try {
    // Show loading state
    if (loadingMsg) {
      loadingToast = showToast(loadingMsg, "info", 0);
    }
    if (buttonId) {
      button = document.getElementById(buttonId);
      if (button) {
        button.classList.add("loading");
        button.disabled = true;
      }
    }

    // Execute promise
    const result = await promise;

    // Hide loading toast
    if (loadingToast) removeToast(loadingToast);

    return result;
  } catch (error) {
    // Hide loading toast
    if (loadingToast) removeToast(loadingToast);

    // Show error
    const errorMsg = error.message || "Something went wrong. Please try again.";
    showToast(errorMsg, "error");

    throw error;
  } finally {
    // Reset button state
    if (button) {
      button.classList.remove("loading");
      button.disabled = false;
    }
  }
}

/**
 * Form validation helpers
 */
const FormValidator = {
  /**
   * Validate email format
   */
  isEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  /**
   * Validate required field
   */
  isRequired(value) {
    return value && value.trim().length > 0;
  },

  /**
   * Validate minimum length
   */
  minLength(value, length) {
    return value && value.length >= length;
  },

  /**
   * Validate maximum length
   */
  maxLength(value, length) {
    return value && value.length <= length;
  },

  /**
   * Validate number
   */
  isNumber(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
  },

  /**
   * Validate phone number (basic)
   */
  isPhoneNumber(value) {
    const re = /^[\d\s\-\+\(\)]+$/;
    return re.test(value) && value.length >= 10;
  },

  /**
   * Set field error state
   */
  setFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.classList.add("error");
    field.classList.remove("success");

    let errorEl = field.nextElementSibling;
    if (!errorEl || !errorEl.classList.contains("form-error")) {
      errorEl = document.createElement("span");
      errorEl.className = "form-error";
      field.parentNode.insertBefore(errorEl, field.nextSibling);
    }
    errorEl.textContent = message;
  },

  /**
   * Clear field error state
   */
  clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.classList.remove("error", "success");

    const errorEl = field.nextElementSibling;
    if (errorEl && errorEl.classList.contains("form-error")) {
      errorEl.textContent = "";
    }
  },

  /**
   * Set field success state
   */
  setFieldSuccess(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.classList.add("success");
    field.classList.remove("error");

    let successEl = field.nextElementSibling;
    if (!successEl || !successEl.classList.contains("form-success")) {
      successEl = document.createElement("span");
      successEl.className = "form-success";
      field.parentNode.insertBefore(successEl, field.nextSibling);
    }
    successEl.textContent = message;
  },
};

/**
 * Empty state helper
 */
function showEmptyState(
  containerId,
  title,
  description,
  actionText,
  actionCallback,
) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">
        <i class="fas fa-inbox"></i>
      </div>
      <h3 class="empty-state-title">${title}</h3>
      <p class="empty-state-description">${description}</p>
      ${actionText ? `<button class="empty-state-action" data-action="empty-state-action">${actionText}</button>` : ""}
    </div>
  `;

  if (actionText && actionCallback) {
    const btn = container.querySelector('[data-action="empty-state-action"]');
    btn.addEventListener("click", actionCallback);
  }
}

/**
 * Show skeleton loading state
 */
function showSkeletonLoading(containerId, count = 3) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let html = '<div class="skeleton-group">';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-item">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text" style="width: 80%;"></div>
      </div>
    `;
  }
  html += "</div>";

  container.innerHTML = html;
}

/**
 * API error handler with helpful messages
 */
function handleApiError(error, endpoint) {
  console.error(`[API Error] ${endpoint}:`, error);

  let message = "Something went wrong. Please try again.";
  let suggestion = "";

  if (error.status === 400) {
    message = "Invalid request. Please check your input.";
  } else if (error.status === 401) {
    message = "You need to log in to perform this action.";
    suggestion = "Please log in and try again.";
  } else if (error.status === 403) {
    message = "You don't have permission to perform this action.";
  } else if (error.status === 404) {
    message = "The resource was not found.";
  } else if (error.status === 409) {
    message = "This resource already exists or there was a conflict.";
  } else if (error.status === 429) {
    message = "Too many requests. Please wait a moment and try again.";
    suggestion = "Rate limited - please wait before trying again.";
  } else if (error.status === 500) {
    message = "Server error. Our team has been notified.";
    suggestion = "Please try again later.";
  } else if (error.status === 503) {
    message = "Service temporarily unavailable.";
    suggestion = "Please try again later.";
  } else if (error.message && error.message.includes("Failed to fetch")) {
    message = "Network error. Please check your connection.";
    suggestion = "Check your internet connection and try again.";
  }

  const fullMessage = suggestion ? `${message} ${suggestion}` : message;
  showToast(fullMessage, "error");

  return fullMessage;
}

/**
 * Retry logic with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, i);
      console.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Debounce function for search/input
 */
function debounce(fn, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function for scroll events
 */
function throttle(fn, delay = 300) {
  let lastRun = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastRun >= delay) {
      fn.apply(this, args);
      lastRun = now;
    }
  };
}

/**
 * Document ready utility
 */
function onReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback);
  } else {
    callback();
  }
}

/**
 * Check if element is visible in viewport
 */
function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
    rect.bottom > 0
  );
}

/**
 * Smooth scroll to element
 */
function scrollToElement(selector, offset = 100) {
  const element = document.querySelector(selector);
  if (!element) return;

  const top = element.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!", "success");
    return true;
  } catch (error) {
    showToast("Failed to copy", "error");
    return false;
  }
}

/**
 * Generate unique ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Parse ISO date
 */
function parseDate(dateString) {
  return new Date(dateString + "T00:00:00");
}

/**
 * Format date for display
 */
function formatDisplayDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Get time ago text
 */
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";

  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";

  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";

  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";

  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";

  return Math.floor(seconds) + "s ago";
}

console.log("✓ Enhanced UX Utilities loaded");

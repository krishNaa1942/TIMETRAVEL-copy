/* =======================================================
 * Time Travel - Empty States & Error Recovery
 * Helpful guidance, proper error messaging, recovery paths
 * ======================================================= */

class EmptyStateManager {
  static states = {
    noTrips: {
      icon: "🗺️",
      title: "No Trips Yet",
      description:
        "Start planning your next adventure! Create a new trip to get started with itineraries, budgets, and more.",
      action: {
        text: "Create Your First Trip",
        callback: () => {
          const btn = document.getElementById("tdNewTripBtn");
          if (btn) btn.click();
        },
      },
    },
    noExpenses: {
      icon: "💰",
      title: "No Expenses Yet",
      description:
        "Track your travel spending and stay within budget. Add your first expense to get started.",
      action: {
        text: "Add an Expense",
        callback: () => {
          scrollToElement("#expenseForm");
        },
      },
    },
    noPacking: {
      icon: "🧳",
      title: "Empty Packing List",
      description:
        "Build your packing list to ensure you don't forget anything important. Add items for your trip.",
      action: {
        text: "Start Packing List",
        callback: () => {
          scrollToElement("#packingForm");
        },
      },
    },
    noJournal: {
      icon: "📔",
      title: "No Journal Entries Yet",
      description:
        "Capture your travel memories and experiences. Write your first journal entry.",
      action: {
        text: "Write an Entry",
        callback: () => {
          scrollToElement("#journalForm");
        },
      },
    },
    noFavorites: {
      icon: "♥️",
      title: "No Favorites Yet",
      description:
        "Save destinations you love for easy access later. Explore and add to your favorites!",
      action: {
        text: "Explore Destinations",
        callback: () => {
          window.location.hash = "#/places";
        },
      },
    },
    searchEmpty: {
      icon: "🔍",
      title: "No Results Found",
      description:
        "Try adjusting your search terms or filters to find what you're looking for.",
      action: {
        text: "Clear Search",
        callback: () => {
          document.querySelectorAll('input[type="search"]').forEach((el) => {
            el.value = "";
            el.dispatchEvent(new Event("input"));
          });
        },
      },
    },
  };

  static show(containerId, stateKey) {
    const container = document.getElementById(containerId);
    if (!container || !this.states[stateKey]) return;

    const state = this.states[stateKey];
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${state.icon}</div>
        <h3 class="empty-state-title">${state.title}</h3>
        <p class="empty-state-description">${state.description}</p>
        ${state.action ? `<button class="empty-state-action">${state.action.text}</button>` : ""}
      </div>
    `;

    if (state.action) {
      container
        .querySelector(".empty-state-action")
        .addEventListener("click", state.action.callback);
    }
  }

  static custom(containerId, title, description, actionText, actionCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fas fa-inbox"></i></div>
        <h3 class="empty-state-title">${title}</h3>
        <p class="empty-state-description">${description}</p>
        ${actionText ? `<button class="empty-state-action">${actionText}</button>` : ""}
      </div>
    `;

    if (actionText && actionCallback) {
      container
        .querySelector(".empty-state-action")
        .addEventListener("click", actionCallback);
    }
  }
}

class ErrorRecoveryManager {
  static errors = {
    networkError: {
      title: "Connection Lost",
      message:
        "We couldn't connect to the server. Check your internet connection and try again.",
      suggestions: [
        "Check your internet connection",
        "Try refreshing the page",
        "Try again later",
      ],
      retry: true,
    },
    serverError: {
      title: "Server Error",
      message: "Something went wrong on our end. Our team has been notified.",
      suggestions: [
        "Try refreshing the page",
        "Contact support if the problem persists",
        "Try again later",
      ],
      retry: true,
    },
    unauthorized: {
      title: "Session Expired",
      message: "Your session has expired. Please log in again.",
      suggestions: [
        "Log in with your account",
        "Check if you have the correct permissions",
      ],
      retry: false,
      action: {
        text: "Log In",
        callback: () => {
          openAuthModal("login");
        },
      },
    },
    notFound: {
      title: "Not Found",
      message: "The resource you're looking for doesn't exist.",
      suggestions: [
        "Check the URL or search query",
        "Go back to the previous page",
      ],
      retry: false,
    },
    forbidden: {
      title: "Access Denied",
      message: "You don't have permission to access this resource.",
      suggestions: ["Check with the resource owner", "Contact us for help"],
      retry: false,
    },
    timeout: {
      title: "Request Timed Out",
      message: "The request took too long to complete. Please try again.",
      suggestions: [
        "Check your internet connection",
        "Try again with a smaller request",
        "Contact support if the problem persists",
      ],
      retry: true,
    },
  };

  static show(containerId, errorKey, onRetry) {
    const container = document.getElementById(containerId);
    if (!container || !this.errors[errorKey]) return;

    const error = this.errors[errorKey];
    let html = `
      <div class="error-container show">
        <div class="error-container-icon"><i class="fas fa-exclamation-circle"></i></div>
        <h4 class="error-container-title">${error.title}</h4>
        <p class="error-container-message">${error.message}</p>
    `;

    if (error.suggestions && error.suggestions.length > 0) {
      html += '<ul class="error-suggestions">';
      error.suggestions.forEach((suggestion) => {
        html += `<li>${suggestion}</li>`;
      });
      html += "</ul>";
    }

    if (error.retry && onRetry) {
      html += `<button class="error-container-retry" data-action="retry">Try Again</button>`;
    }

    if (error.action) {
      html += `<button class="btn btn-secondary" data-action="error-action">${error.action.text}</button>`;
    }

    html += "</div>";
    container.innerHTML = html;

    if (error.retry && onRetry) {
      container
        .querySelector('[data-action="retry"]')
        .addEventListener("click", onRetry);
    }

    if (error.action) {
      container
        .querySelector('[data-action="error-action"]')
        .addEventListener("click", error.action.callback);
    }
  }

  static showCustom(
    containerId,
    title,
    message,
    suggestions = [],
    onRetry = null,
  ) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = `
      <div class="error-container show">
        <div class="error-container-icon"><i class="fas fa-exclamation-circle"></i></div>
        <h4 class="error-container-title">${title}</h4>
        <p class="error-container-message">${message}</p>
    `;

    if (suggestions.length > 0) {
      html += '<ul class="error-suggestions">';
      suggestions.forEach((suggestion) => {
        html += `<li>${suggestion}</li>`;
      });
      html += "</ul>";
    }

    if (onRetry) {
      html += `<button class="error-container-retry" data-action="retry">Try Again</button>`;
    }

    html += "</div>";
    container.innerHTML = html;

    if (onRetry) {
      container
        .querySelector('[data-action="retry"]')
        .addEventListener("click", onRetry);
    }
  }
}

/**
 * Data load wrapper with proper error handling
 */
async function loadDataWithFallback(dataSource, fallbackValue, options = {}) {
  const {
    loadingMsg = "Loading...",
    errorContainerId = null,
    showLoader = true,
    retryable = true,
  } = options;

  let loader = null;

  try {
    if (showLoader && loadingMsg) {
      loader = showToast(loadingMsg, "info", 0);
    }

    const data = await dataSource();

    if (loader) removeToast(loader);
    return data;
  } catch (error) {
    if (loader) removeToast(loader);

    console.error("Data load error:", error);

    let errorMsg = "Failed to load data";
    let errorType = "networkError";

    if (error.status === 401) {
      errorType = "unauthorized";
    } else if (error.status === 403) {
      errorType = "forbidden";
    } else if (error.status === 404) {
      errorType = "notFound";
    } else if (error.status >= 500) {
      errorType = "serverError";
    } else if (error.message?.includes("timeout")) {
      errorType = "timeout";
    }

    if (errorContainerId) {
      const retry = retryable
        ? () => loadDataWithFallback(dataSource, fallbackValue, options)
        : null;
      ErrorRecoveryManager.show(errorContainerId, errorType, retry);
    }

    showToast(errorMsg, "error");
    return fallbackValue;
  }
}

/**
 * Offline detection and handling
 */
class OfflineManager {
  static init() {
    const offlineIndicator = document.createElement("div");
    offlineIndicator.id = "offlineIndicator";
    offlineIndicator.className = "offline-indicator";
    offlineIndicator.innerHTML = `
      <i class="fas fa-wifi-off"></i>
      <span>You're offline – some features may not work</span>
    `;
    offlineIndicator.style.display = "none";
    document.body.appendChild(offlineIndicator);

    window.addEventListener("offline", () => {
      offlineIndicator.style.display = "flex";
      showToast("You're now offline – changes may not be saved", "warning");
    });

    window.addEventListener("online", () => {
      offlineIndicator.style.display = "none";
      showToast("You're back online!", "success");
    });
  }

  static isOnline() {
    return navigator.onLine;
  }
}

/**
 * Initialize when DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
  OfflineManager.init();
});

console.log("✓ Empty States & Error Recovery loaded");

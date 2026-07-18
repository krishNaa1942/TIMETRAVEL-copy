/* =======================================================
 * Time Travel - Auth State - Login, register, logout, session management
 * ======================================================= */

// ═══════════════════════════════════════════════════════════
// AUTH STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════
let currentUser = null;

function setNavItemVisibility(linkEl, visible) {
  if (!linkEl) return;
  linkEl.style.display = visible ? "" : "none";
  const parentLi = linkEl.closest("li");
  if (parentLi) {
    parentLi.style.display = visible ? "" : "none";
  }
}

function formatAuthError(data, fallback) {
  if (!data) return fallback;
  if (Array.isArray(data.details) && data.details.length) {
    return data.details.join(". ");
  }
  return data.error || fallback;
}

function formatRetryAfter(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "Please try again shortly.";
  if (s < 60) return `Try again in ${Math.ceil(s)}s.`;
  const m = Math.ceil(s / 60);
  return `Try again in ${m} min.`;
}

function updateAuthUI() {
  const authBtns = document.getElementById("authBtns");
  const userMenu = document.getElementById("userMenu");
  const nameEl = document.getElementById("userName");
  const histNav = document.getElementById("navHistory");
  const wlNav = document.getElementById("navWishlist");
  const journalNav = document.getElementById("navJournal");
  const expensesNav = document.getElementById("navExpenses");
  const packingNav = document.getElementById("navPacking");
  const tripDashNav = document.getElementById("navTripDashboard");
  const mobileLoginBtn = document.getElementById("navMobileLoginBtn");
  const mobileAccountBtn = document.getElementById("navMobileAccountBtn");

  if (currentUser) {
    authBtns.style.display = "none";
    userMenu.style.display = "flex";
    nameEl.textContent = currentUser.name;
    setNavItemVisibility(histNav, true);
    setNavItemVisibility(wlNav, true);
    setNavItemVisibility(journalNav, true);
    setNavItemVisibility(expensesNav, true);
    setNavItemVisibility(packingNav, true);
    setNavItemVisibility(tripDashNav, true);
    if (mobileLoginBtn) mobileLoginBtn.style.display = "none";
    if (mobileAccountBtn) mobileAccountBtn.style.display = "inline-flex";
    loadTrips();
    loadFavorites();
    loadExpenses();
    loadPackingItems();
    loadJournalNotes();
    if (typeof initTripDashboard === "function") initTripDashboard();
  } else {
    authBtns.style.display = "flex";
    userMenu.style.display = "none";
    nameEl.textContent = "";
    setNavItemVisibility(histNav, false);
    setNavItemVisibility(wlNav, false);
    setNavItemVisibility(journalNav, false);
    setNavItemVisibility(expensesNav, false);
    setNavItemVisibility(packingNav, false);
    setNavItemVisibility(tripDashNav, false);
    if (mobileLoginBtn) mobileLoginBtn.style.display = "inline-flex";
    if (mobileAccountBtn) mobileAccountBtn.style.display = "none";
  }
}

async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: "same-origin",
    });
    const data = await res.json();
    if (data.authenticated) {
      currentUser = data.user;
    } else {
      currentUser = null;
    }
  } catch {
    currentUser = null;
  }
  updateAuthUI();
}

// ── Auth Modal ────────────────────────────────────────────
function openAuthModal(form) {
  document.getElementById("authModal").style.display = "flex";
  switchAuthForm(form || "login");
  document.getElementById("loginError").style.display = "none";
  document.getElementById("registerError").style.display = "none";
}

function closeAuthModal(event) {
  if (event && event.target !== document.getElementById("authModal")) return;
  document.getElementById("authModal").style.display = "none";
}

function switchAuthForm(form) {
  document.getElementById("loginForm").style.display =
    form === "login" ? "block" : "none";
  document.getElementById("registerForm").style.display =
    form === "register" ? "block" : "none";
  document.getElementById("loginError").style.display = "none";
  document.getElementById("registerError").style.display = "none";
}

// ── Login ─────────────────────────────────────────────────
async function handleLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");
  const loginBtn = document.getElementById("loginSubmitBtn");

  if (!email || !password) {
    const msg = "Please fill in all fields.";
    errEl.textContent = msg;
    errEl.style.display = "block";
    if (window.notify) window.notify.error(msg);
    return;
  }

  try {
    // Show loading state
    if (loginBtn) {
      loginBtn.classList.add("btn--loading");
      loginBtn.disabled = true;
      const span = loginBtn.querySelector(".btn-text") || loginBtn;
      const originalText = span.textContent;
      span.innerHTML =
        '<span class="btn-loading-spinner"></span> Signing in...';
    }

    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      credentials: "same-origin",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    // Reset button state
    if (loginBtn) {
      loginBtn.classList.remove("btn--loading");
      loginBtn.disabled = false;
      const span = loginBtn.querySelector(".btn-text") || loginBtn;
      span.innerHTML = originalText || "Sign In";
    }

    if (res.ok) {
      currentUser = data.user;
      updateAuthUI();
      if (window.notify) {
        window.notify.success(`Welcome back, ${data.user.name}!`);
      }
      closeAuthModal();
      document.getElementById("loginEmail").value = "";
      document.getElementById("loginPassword").value = "";
    } else if (res.status === 503) {
      const msg =
        "Sign-in is temporarily unavailable. Please try again shortly.";
      errEl.textContent = msg;
      errEl.style.display = "block";
      if (window.notify) window.notify.error(msg, 5000);
    } else if (res.status === 429) {
      const retryHeader = res.headers.get("Retry-After");
      const retryAfter = data.retry_after ?? retryHeader;
      const msg = `Too many login attempts. ${formatRetryAfter(retryAfter)}`;
      errEl.textContent = msg;
      errEl.style.display = "block";
      if (window.notify) window.notify.warning(msg, 5000);
    } else {
      const msg = formatAuthError(data, "Login failed.");
      errEl.textContent = msg;
      errEl.style.display = "block";
      if (window.notify) window.notify.error(msg, 4000);
    }
  } catch {
    const msg = "Network error – please try again.";
    errEl.textContent = msg;
    errEl.style.display = "block";
    if (window.notify) window.notify.error(msg);
    if (loginBtn) {
      loginBtn.classList.remove("btn--loading");
      loginBtn.disabled = false;
    }
  }
}

// ── Register ──────────────────────────────────────────────
async function handleRegister() {
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const errEl = document.getElementById("registerError");
  const registerBtn = document.getElementById("registerSubmitBtn");

  if (!name || !email || !password) {
    const msg = "Please fill in all fields.";
    errEl.textContent = msg;
    errEl.style.display = "block";
    if (window.notify) window.notify.error(msg);
    return;
  }

  if (password.length < 8) {
    const msg = "Password must be at least 8 characters.";
    errEl.textContent = msg;
    errEl.style.display = "block";
    if (window.notify) window.notify.error(msg);
    return;
  }

  if (!/[A-Z]/.test(password)) {
    const msg = "Password must contain at least one uppercase letter.";
    errEl.textContent = msg;
    errEl.style.display = "block";
    if (window.notify) window.notify.error(msg);
    return;
  }

  if (!/[a-z]/.test(password)) {
    const msg = "Password must contain at least one lowercase letter.";
    errEl.textContent = msg;
    errEl.style.display = "block";
    if (window.notify) window.notify.error(msg);
    return;
  }

  if (!/[0-9]/.test(password)) {
    const msg = "Password must contain at least one digit.";
    errEl.textContent = msg;
    errEl.style.display = "block";
    if (window.notify) window.notify.error(msg);
    return;
  }

  try {
    // Show loading state
    if (registerBtn) {
      registerBtn.classList.add("btn--loading");
      registerBtn.disabled = true;
      const span = registerBtn.querySelector(".btn-text") || registerBtn;
      const originalText = span.textContent;
      span.innerHTML =
        '<span class="btn-loading-spinner"></span> Signing up...';
    }

    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      credentials: "same-origin",
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    // Reset button state
    if (registerBtn) {
      registerBtn.classList.remove("btn--loading");
      registerBtn.disabled = false;
      const span = registerBtn.querySelector(".btn-text") || registerBtn;
      span.innerHTML = originalText || "Sign Up";
    }

    if (res.ok) {
      currentUser = data.user;
      updateAuthUI();
      if (window.notify) {
        window.notify.success(`Welcome, ${data.user.name}! Account created.`);
      }
      closeAuthModal();
      document.getElementById("regName").value = "";
      document.getElementById("regEmail").value = "";
      document.getElementById("regPassword").value = "";
    } else if (res.status === 503) {
      const msg =
        "Sign-up is temporarily unavailable. Please try again shortly.";
      errEl.textContent = msg;
      errEl.style.display = "block";
      if (window.notify) window.notify.error(msg, 5000);
    } else if (res.status === 429) {
      const retryHeader = res.headers.get("Retry-After");
      const retryAfter = data.retry_after ?? retryHeader;
      const msg = `Too many sign-up attempts. ${formatRetryAfter(retryAfter)}`;
      errEl.textContent = msg;
      errEl.style.display = "block";
      if (window.notify) window.notify.warning(msg, 5000);
    } else {
      const msg = formatAuthError(data, "Registration failed.");
      errEl.textContent = msg;
      errEl.style.display = "block";
      if (window.notify) window.notify.error(msg, 4000);
    }
  } catch {
    const msg = "Network error – please try again.";
    errEl.textContent = msg;
    errEl.style.display = "block";
    if (window.notify) window.notify.error(msg);
    if (registerBtn) {
      registerBtn.classList.remove("btn--loading");
      registerBtn.disabled = false;
    }
  }
}

// ── Logout ────────────────────────────────────────────────
async function handleLogout() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "same-origin",
    });
  } catch {
    /* no-op */
  }
  currentUser = null;
  updateAuthUI();
  if (window.notify) {
    window.notify.info("Signed out successfully.");
  }
}

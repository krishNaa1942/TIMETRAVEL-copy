/* =======================================================
 * Time Travel - Nav Widgets - Command palette, mega menu, user dropdown
 * ======================================================= */

// Idempotency flags to prevent duplicate listeners/observers on re-init.
const TT_NAV_INIT = (window.__ttNavInit = window.__ttNavInit || {});

/* ── Command Palette (Quick Search) ── */
function initCommandPalette() {
  if (TT_NAV_INIT.commandPalette) return;
  const overlay = document.getElementById("navSearchOverlay");
  const input = document.getElementById("navSearchInput");
  const resultsList = document.getElementById("navSearchResults");
  const triggerBtn = document.getElementById("navSearchBtn");
  if (!overlay) return;
  TT_NAV_INIT.commandPalette = true;

  // Build section list from ALL nav links (including mega-menu)
  const navItems = [];
  document
    .querySelectorAll("#navLinks a[href^='#'], .nav-mega-menu a[href^='#']")
    .forEach((a) => {
      const href = a.getAttribute("href");
      const icon = a.querySelector("i");
      const iconClass = icon ? icon.className : "fas fa-link";
      const labelEl =
        a.querySelector(".nav-mega-label") || a.querySelector("span") || a;
      const label = labelEl.textContent.trim();
      if (label && href && !navItems.some((i) => i.href === href)) {
        navItems.push({ href, label, iconClass });
      }
    });

  let highlighted = -1;

  function renderResults(filter) {
    const q = (filter || "").toLowerCase();
    const matches = q
      ? navItems.filter((i) => i.label.toLowerCase().includes(q))
      : navItems;
    if (!matches.length) {
      resultsList.innerHTML =
        '<li class="nav-search-empty">No sections found</li>';
      highlighted = -1;
      return;
    }
    resultsList.innerHTML = matches
      .map(
        (item, idx) =>
          `<li><a href="${item.href}" data-idx="${idx}"><i class="${item.iconClass}"></i>${item.label}</a></li>`,
      )
      .join("");
    highlighted = -1;
  }

  function highlightItem(idx) {
    const items = resultsList.querySelectorAll("a");
    items.forEach((a) => a.classList.remove("highlighted"));
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add("highlighted");
      items[idx].scrollIntoView({ block: "nearest" });
    }
    highlighted = idx;
  }

  function openSearch() {
    overlay.classList.add("open");
    renderResults("");
    setTimeout(() => input.focus(), 80);
  }

  function closeSearch() {
    overlay.classList.remove("open");
    input.value = "";
    highlighted = -1;
  }

  if (triggerBtn) {
    triggerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openSearch();
    });
  }

  input.addEventListener("input", () => renderResults(input.value));

  input.addEventListener("keydown", (e) => {
    const items = resultsList.querySelectorAll("a");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightItem(Math.min(highlighted + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightItem(Math.max(highlighted - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && items[highlighted]) {
        items[highlighted].click();
      }
    } else if (e.key === "Escape") {
      closeSearch();
    }
  });

  resultsList.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) closeSearch();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSearch();
  });

  // Global ⌘K / Ctrl+K
  if (!TT_NAV_INIT.commandPaletteKeydownBound) {
    TT_NAV_INIT.commandPaletteKeydownBound = true;
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        overlay.classList.contains("open") ? closeSearch() : openSearch();
      }
      if (e.key === "Escape" && overlay.classList.contains("open")) {
        closeSearch();
      }
    });
  }
}

/* ── Mega Dropdown with keyboard navigation ── */
function initMegaDropdown() {
  if (TT_NAV_INIT.megaDropdown) return;
  const dropdown = document.querySelector(".nav-dropdown");
  const dropdownTrigger = document.querySelector(".nav-dropdown-trigger");
  if (!dropdown || !dropdownTrigger) return;
  TT_NAV_INIT.megaDropdown = true;

  function openDropdown() {
    const userDropdown = document.getElementById("navUserDropdown");
    const userTrigger = document.getElementById("navUserTrigger");
    if (userDropdown) userDropdown.classList.remove("open");
    if (userTrigger) userTrigger.setAttribute("aria-expanded", "false");
    dropdown.classList.add("open");
    dropdownTrigger.setAttribute("aria-expanded", "true");
  }
  function closeDropdown() {
    dropdown.classList.remove("open");
    dropdownTrigger.setAttribute("aria-expanded", "false");
  }

  dropdownTrigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdown.classList.contains("open") ? closeDropdown() : openDropdown();
  });

  // Keyboard navigation inside mega-menu
  dropdownTrigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      openDropdown();
      // Focus first item
      const firstItem = dropdown.querySelector(".nav-mega-item");
      if (firstItem) setTimeout(() => firstItem.focus(), 60);
    }
  });

  dropdown.addEventListener("keydown", (e) => {
    const items = [...dropdown.querySelectorAll(".nav-mega-item")];
    const idx = items.indexOf(document.activeElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = idx < items.length - 1 ? idx + 1 : 0;
      items[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = idx > 0 ? idx - 1 : items.length - 1;
      items[prev]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      closeDropdown();
      dropdownTrigger.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  });

  dropdown.querySelectorAll(".nav-mega-menu a").forEach((a) => {
    a.addEventListener("click", () => {
      closeDropdown();
      const links = document.getElementById("navLinks");
      const toggle = document.getElementById("navToggle");
      if (links) links.classList.remove("open");
      if (toggle) toggle.classList.remove("open");
      document.body.classList.remove("nav-menu-open");
    });
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) closeDropdown();
  });
}

/* ── User Profile Dropdown with keyboard nav ── */
function initUserDropdown() {
  if (TT_NAV_INIT.userDropdown) return;
  const userTrigger = document.getElementById("navUserTrigger");
  const userDropdown = document.getElementById("navUserDropdown");
  if (!userTrigger || !userDropdown) return;
  TT_NAV_INIT.userDropdown = true;

  function openDropdown() {
    const megaDropdown = document.querySelector(".nav-dropdown");
    const megaTrigger = document.querySelector(".nav-dropdown-trigger");
    if (megaDropdown) megaDropdown.classList.remove("open");
    if (megaTrigger) megaTrigger.setAttribute("aria-expanded", "false");
    userDropdown.classList.add("open");
    userTrigger.setAttribute("aria-expanded", "true");
  }
  function closeDropdown() {
    userDropdown.classList.remove("open");
    userTrigger.setAttribute("aria-expanded", "false");
  }

  userTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    userDropdown.classList.contains("open") ? closeDropdown() : openDropdown();
  });

  // Keyboard navigation
  userTrigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      openDropdown();
      const firstLink = userDropdown.querySelector(".nav-user-links a");
      if (firstLink) setTimeout(() => firstLink.focus(), 60);
    }
  });

  userDropdown.addEventListener("keydown", (e) => {
    const items = [
      ...userDropdown.querySelectorAll(".nav-user-links a, .nav-logout-btn"),
    ];
    const idx = items.indexOf(document.activeElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = idx < items.length - 1 ? idx + 1 : 0;
      items[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = idx > 0 ? idx - 1 : items.length - 1;
      items[prev]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      closeDropdown();
      userTrigger.focus();
    }
  });

  document.addEventListener("click", (e) => {
    if (
      !userDropdown.contains(e.target) &&
      e.target !== userTrigger &&
      !userTrigger.contains(e.target)
    ) {
      closeDropdown();
    }
  });

  userDropdown.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => closeDropdown());
  });
}

/* ── Nav Search orchestrator (calls separate init functions) ── */
function initNavSearch() {
  if (TT_NAV_INIT.navSearch) return;
  TT_NAV_INIT.navSearch = true;
  initCommandPalette();
  initMegaDropdown();
  initUserDropdown();
  initNavIndicator();
  // Breadcrumb now handled inside onScroll() — no separate listener needed
}

// Sliding indicator that moves between nav links
function initNavIndicator() {
  if (TT_NAV_INIT.navIndicator) return;
  const indicator = document.getElementById("navIndicator");
  const navLinks = document.querySelector(".nav-links");
  if (!indicator || !navLinks) return;
  TT_NAV_INIT.navIndicator = true;

  function moveIndicator(el) {
    if (!el || window.innerWidth <= 640) {
      indicator.classList.remove("visible");
      return;
    }
    const navRect = navLinks.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    indicator.style.left = elRect.left - navRect.left + "px";
    indicator.style.width = elRect.width + "px";
    indicator.classList.add("visible");
  }

  function updateIndicator() {
    const active = navLinks.querySelector("a.active[data-nav-link]");
    moveIndicator(active);
  }

  // Watch for active class changes
  const observer = new MutationObserver(updateIndicator);
  navLinks.querySelectorAll("a[data-nav-link]").forEach((a) => {
    observer.observe(a, { attributes: true, attributeFilter: ["class"] });
  });

  // Hover: temporarily move indicator
  navLinks.querySelectorAll("[data-nav-link]").forEach((el) => {
    el.addEventListener("mouseenter", () => moveIndicator(el));
    el.addEventListener("mouseleave", updateIndicator);
  });

  setTimeout(updateIndicator, 200);
  window.addEventListener("resize", updateIndicator);
}

// ═══════════════════════════════════════════════════════════
// USER AVATAR – show first letter of name
// ═══════════════════════════════════════════════════════════
function initUserAvatar() {
  if (TT_NAV_INIT.userAvatar) return;
  // Will be called after login sets userName text
  const observer = new MutationObserver(() => {
    const nameEl = document.getElementById("userName");
    const avatarEl = document.getElementById("userAvatar");
    if (nameEl && avatarEl) {
      const name = nameEl.textContent.trim();
      if (name) {
        avatarEl.textContent = name.charAt(0).toUpperCase();
      }
    }
  });
  const nameEl = document.getElementById("userName");
  if (nameEl) {
    TT_NAV_INIT.userAvatar = true;
    observer.observe(nameEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
}

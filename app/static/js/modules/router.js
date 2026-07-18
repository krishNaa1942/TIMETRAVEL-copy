/* =======================================================
 * Time Travel – Client-Side Router (History API)
 * Page transitions + scroll-reveal aware routing
 * ======================================================= */

(function () {
  "use strict";

  // ── Route Map: hash → { route, title, scrollTo } ──
  const ROUTE_MAP = {
    hero: { route: "home", title: "Home" },
    features: { route: "home", title: "Features", scrollTo: "features" },
    destinations: {
      route: "home",
      title: "Destinations",
      scrollTo: "destinations",
    },
    howItWorks: {
      route: "home",
      title: "How It Works",
      scrollTo: "howItWorks",
    },
    testimonials: {
      route: "home",
      title: "Testimonials",
      scrollTo: "testimonials",
    },
    planningDashboard: { route: "planner", title: "Planning Dashboard" },
    tripDashboard: { route: "trips", title: "My Trips" },
    chatbot: { route: "chat", title: "AI Chat" },
    compare: { route: "compare", title: "Compare" },
    budget: { route: "budget", title: "Budget" },
    safety: { route: "budget", title: "Safety", scrollTo: "safety" },
    weather: { route: "budget", title: "Weather", scrollTo: "weather" },
    itinerary: { route: "itinerary", title: "Itinerary" },
    maps: { route: "maps", title: "Maps" },
    places: { route: "places", title: "Places" },
    news: { route: "news", title: "News" },
    booking: { route: "booking", title: "Booking" },
    currency: { route: "currency", title: "Currency" },
    language: { route: "language", title: "Phrases" },
    expenses: { route: "expenses", title: "Expenses" },
    packingChecklist: { route: "packing", title: "Packing" },
    journal: { route: "journal", title: "Journal" },
    wishlist: { route: "wishlist", title: "Wishlist" },
    history: { route: "history", title: "Trip History" },
  };

  // ── URL path ↔ route mapping ──
  const PATH_MAP = {
    "/": "home",
    "/planner": "planner",
    "/trips": "trips",
    "/chat": "chat",
    "/compare": "compare",
    "/budget": "budget",
    "/itinerary": "itinerary",
    "/maps": "maps",
    "/places": "places",
    "/news": "news",
    "/booking": "booking",
    "/currency": "currency",
    "/language": "language",
    "/expenses": "expenses",
    "/packing": "packing",
    "/journal": "journal",
    "/wishlist": "wishlist",
    "/history": "history",
  };

  const ROUTE_TO_PATH = {};
  for (const [path, route] of Object.entries(PATH_MAP)) {
    ROUTE_TO_PATH[route] = path;
  }

  // ── Page title map ──
  const ROUTE_TITLES = {
    home: "Time To Travel – AI Smart Tourism Assistant",
    planner: "Planning Dashboard – Time To Travel",
    trips: "My Trips – Time To Travel",
    chat: "AI Chat – Time To Travel",
    compare: "Compare – Time To Travel",
    budget: "Budget & Tools – Time To Travel",
    itinerary: "Itinerary – Time To Travel",
    maps: "Maps – Time To Travel",
    places: "Places – Time To Travel",
    news: "Travel News – Time To Travel",
    booking: "Booking – Time To Travel",
    currency: "Currency – Time To Travel",
    language: "Phrases – Time To Travel",
    expenses: "Expenses – Time To Travel",
    packing: "Packing – Time To Travel",
    journal: "Journal – Time To Travel",
    wishlist: "Wishlist – Time To Travel",
    history: "Trip History – Time To Travel",
  };

  // ── Domain map: use route context to theme the UI ──
  const ROUTE_DOMAIN = {
    home: "explore",
    planner: "plan",
    places: "explore",
    maps: "mobility",
    booking: "plan",
    trips: "plan",
    itinerary: "plan",
    packing: "plan",
    wishlist: "plan",
    history: "plan",
    compare: "finance",
    budget: "finance",
    currency: "finance",
    expenses: "finance",
    news: "insights",
    journal: "insights",
    chat: "assistant",
    language: "assistant",
  };

  const DOMAIN_THEME_COLOR = {
    explore: "#4DA8DA",
    plan: "#1B263B",
    mobility: "#4DA8DA",
    finance: "#FF7E5F",
    insights: "#1B263B",
    assistant: "#4DA8DA",
  };

  // ── State ──
  let _currentRoute = "home";
  let _isTransitioning = false;

  function _applyDomainTheme(route) {
    const domain = ROUTE_DOMAIN[route] || "explore";
    document.body.setAttribute("data-domain", domain);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        "content",
        DOMAIN_THEME_COLOR[domain] || "#4DA8DA",
      );
    }
  }

  // ── Core: Navigate to a route ──
  function navigateTo(route, opts = {}) {
    if (_isTransitioning && !opts.force) return;
    const { scrollTo, pushState = true, replace = false } = opts;

    if (route === _currentRoute && !scrollTo) return;

    // Same route, just scroll to element
    if (route === _currentRoute && scrollTo) {
      const el = document.getElementById(scrollTo);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    _isTransitioning = true;

    const outgoing = document.querySelector(".route-page--active");
    const incoming = document.querySelector(
      `.route-page[data-route="${route}"]`,
    );

    if (!incoming) {
      _isTransitioning = false;
      return;
    }

    // Animate the swap
    if (outgoing && outgoing !== incoming) {
      outgoing.classList.add("route-page--exit");
      outgoing.classList.remove("route-page--active");
    }
    incoming.classList.add("route-page--enter", "route-page--active");
    _updateURL(route, scrollTo, pushState, replace);
    _applyDomainTheme(route);

    document.title = ROUTE_TITLES[route] || ROUTE_TITLES.home;
    _revealSections(incoming);

    // Trigger scroll-reveal observer on the incoming route
    if (window._ttRevealObserver) {
      incoming
        .querySelectorAll(".reveal-on-scroll")
        .forEach((el) => window._ttRevealObserver.observe(el));
    }

    // Scroll
    requestAnimationFrame(() => {
      if (scrollTo) {
        const el = document.getElementById(scrollTo);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    // Cleanup after transition
    setTimeout(() => {
      _cleanupTransition();
      _currentRoute = route;
      _updateNavActive(route);
      window.dispatchEvent(
        new CustomEvent("routechange", { detail: { route, scrollTo } }),
      );
    }, 380);
  }

  function _updateURL(route, scrollTo, pushState, replace) {
    const path = ROUTE_TO_PATH[route] || "/";
    if (pushState && !replace) {
      history.pushState({ route, scrollTo }, "", path);
    } else if (replace) {
      history.replaceState({ route, scrollTo }, "", path);
    }
  }

  function _cleanupTransition() {
    document.querySelectorAll(".route-page").forEach((p) => {
      p.classList.remove("route-page--exit", "route-page--enter");
    });
    _isTransitioning = false;
  }

  function _revealSections(container) {
    container
      .querySelectorAll('section[style*="display: none"]')
      .forEach((s) => (s.style.display = ""));
  }

  // ── Update navbar active link ──
  function _updateNavActive(route) {
    document.querySelectorAll(".nav-links a.active").forEach((a) => {
      a.classList.remove("active");
    });
    const hashMap = {};
    for (const [hash, info] of Object.entries(ROUTE_MAP)) {
      if (info.route === route) hashMap[hash] = true;
    }
    document.querySelectorAll('.nav-links a[href^="#"]').forEach((a) => {
      const hash = a.getAttribute("href").slice(1);
      if (hashMap[hash]) a.classList.add("active");
    });
    if (route === "home") {
      const homeLink = document.querySelector('.nav-links a[href="#hero"]');
      if (homeLink) homeLink.classList.add("active");
    }
  }

  // ── Intercept hash link clicks ──
  function _interceptLinks() {
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute("href").slice(1);
      if (!hash) return;
      const routeInfo = ROUTE_MAP[hash];
      if (!routeInfo) return;

      e.preventDefault();

      // Close mobile menu
      const navLinks = document.getElementById("navLinks");
      const navToggle = document.getElementById("navToggle");
      if (navLinks) navLinks.classList.remove("open");
      if (navToggle) navToggle.classList.remove("open");
      document.body.classList.remove("nav-menu-open");

      // Close mega menu
      const megaMenu = document.querySelector(".nav-mega-menu");
      if (megaMenu) {
        const trigger = document.querySelector(".nav-dropdown-trigger");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      }

      navigateTo(routeInfo.route, { scrollTo: routeInfo.scrollTo });
    });
  }

  // ── Handle browser back/forward ──
  function _handlePopState() {
    window.addEventListener("popstate", (e) => {
      if (e.state && e.state.route) {
        navigateTo(e.state.route, {
          scrollTo: e.state.scrollTo,
          pushState: false,
        });
      } else {
        const route = PATH_MAP[window.location.pathname] || "home";
        navigateTo(route, { pushState: false });
      }
    });
  }

  // ── Initialize ──
  function _initRouter() {
    const path = window.location.pathname;
    const hash = window.location.hash.slice(1);
    let initialRoute = "home";
    let initialScroll = null;

    if (path !== "/" && PATH_MAP[path]) {
      initialRoute = PATH_MAP[path];
    } else if (hash && ROUTE_MAP[hash]) {
      initialRoute = ROUTE_MAP[hash].route;
      initialScroll = ROUTE_MAP[hash].scrollTo;
    }

    history.replaceState(
      { route: initialRoute, scrollTo: initialScroll },
      "",
      ROUTE_TO_PATH[initialRoute] || "/",
    );

    // If landing on a non-home route, activate it
    if (initialRoute !== "home") {
      const pages = document.querySelectorAll(".route-page");
      pages.forEach((p) => p.classList.remove("route-page--active"));
      const target = document.querySelector(
        `.route-page[data-route="${initialRoute}"]`,
      );
      if (target) {
        target.classList.add("route-page--active");
        _revealSections(target);
        if (initialScroll) {
          const el = document.getElementById(initialScroll);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
      _currentRoute = initialRoute;
      document.title = ROUTE_TITLES[initialRoute] || ROUTE_TITLES.home;
      _updateNavActive(initialRoute);
    }

    _applyDomainTheme(initialRoute);

    _interceptLinks();
    _handlePopState();
  }

  // Expose for other modules
  window.appRouter = {
    navigateTo: navigateTo,
    getCurrentRoute: () => _currentRoute,
    getCurrentDomain: () =>
      document.body.getAttribute("data-domain") || "explore",
    ROUTE_MAP: ROUTE_MAP,
    isLoaded: () => true,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _initRouter);
  } else {
    _initRouter();
  }
})();

/* =======================================================
 * Time Travel - How It Works - Interactive step cards with navigation
 * ======================================================= */

// ═══════════════════════════════════════════════════════════
// HOW IT WORKS – Interactive step cards with navigation
// ═══════════════════════════════════════════════════════════
function initHowItWorks() {
  const section = document.getElementById("howItWorks");
  const timeline = document.getElementById("hiwTimeline");
  const connectorFill = document.getElementById("hiwConnectorFill");
  const getStartedBtn = document.getElementById("hiwGetStarted");
  if (!section || !timeline) return;

  const steps = timeline.querySelectorAll(".hiw-step");
  const stepCTAs = timeline.querySelectorAll(".hiw-step-cta");
  let activeStep = -1;

  function navigateToTarget(target) {
    if (!target) return;

    if (target === "planningDashboard") {
      if (window.appRouter && typeof window.appRouter.navigateTo === "function") {
        window.appRouter.navigateTo("planner");
      } else {
        window.location.hash = "planningDashboard";
      }
      return;
    }

    if (target === "destinations" && typeof openSmartHub === "function") {
      openSmartHub();
      return;
    }

    if (window.appRouter && typeof window.appRouter.navigateTo === "function") {
      window.appRouter.navigateTo("home", { scrollTo: target });
      return;
    }

    if (typeof scrollToSection === "function") {
      scrollToSection(target);
    }
  }

  // ── Connector fill animation on scroll ──
  function updateConnector() {
    if (!connectorFill) return;
    const rect = section.getBoundingClientRect();
    const sectionH = rect.height;
    const viewH = window.innerHeight;
    // Progress: 0 when section top enters viewport, 1 when section bottom exits
    const progress = Math.min(
      1,
      Math.max(0, (viewH - rect.top) / (sectionH + viewH * 0.3)),
    );
    connectorFill.style.width = progress * 100 + "%";
  }

  // ── Active step highlight based on scroll ──
  function updateActiveStep() {
    const rect = section.getBoundingClientRect();
    const viewH = window.innerHeight;
    if (rect.top > viewH || rect.bottom < 0) return;

    // Calculate which step should be active based on section scroll progress
    const progress = Math.min(
      1,
      Math.max(0, (viewH - rect.top) / (rect.height + viewH * 0.2)),
    );
    const newActive = Math.min(
      steps.length - 1,
      Math.floor(progress * steps.length * 1.2),
    );

    if (newActive !== activeStep) {
      steps.forEach((s) => s.classList.remove("hiw-active"));
      if (newActive >= 0 && newActive < steps.length) {
        steps[newActive].classList.add("hiw-active");
      }
      activeStep = newActive;
    }
  }

  // Scroll listener (throttled with rAF)
  let hiwTicking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (!hiwTicking) {
        requestAnimationFrame(() => {
          updateConnector();
          updateActiveStep();
          hiwTicking = false;
        });
        hiwTicking = true;
      }
    },
    { passive: true },
  );

  // ── Step CTA click → navigate to target section ──
  stepCTAs.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const target = btn.dataset.hiwTarget;
      navigateToTarget(target);
    });
  });

  // ── Clickable step cards → navigate to target ──
  steps.forEach((step) => {
    step.addEventListener("click", (e) => {
      // Don't navigate if they clicked the CTA button (it handles itself)
      if (e.target.closest(".hiw-step-cta")) return;
      const target = step.dataset.target;
      navigateToTarget(target);
    });
  });

  // ── "Start Exploring Now" CTA ──
  if (getStartedBtn) {
    getStartedBtn.addEventListener("click", () => {
      navigateToTarget("destinations");
    });
  }

  // Initial state
  updateConnector();
}

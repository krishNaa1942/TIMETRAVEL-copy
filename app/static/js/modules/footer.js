/* ═══════════════════════════════════════════════════════════
   Footer – Newsletter subscription
   ═══════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("newsletterForm");
    if (!form) return;

    const emailInput = document.getElementById("newsletterEmail");
    const btn = document.getElementById("newsletterBtn");
    const msg = document.getElementById("newsletterMsg");

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const email = (emailInput.value || "").trim();
      if (!email) return;

      // Disable while submitting
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      msg.style.display = "none";

      try {
        const res = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email }),
        });

        const data = await res.json();

        msg.textContent = data.message || data.error || "Something went wrong.";
        msg.style.color = res.ok ? "#4ade80" : "#f87171";
        msg.style.display = "block";

        if (res.ok) {
          emailInput.value = "";
        }
      } catch (err) {
        msg.textContent = "Network error. Please try again.";
        msg.style.color = "#f87171";
        msg.style.display = "block";
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i>';
      }
    });
  });
})();

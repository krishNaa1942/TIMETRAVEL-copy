/* =======================================================
 * Time Travel – Centralized Event Delegation
 * Replaces inline onclick="" handlers for CSP compliance.
 * All actions use data-action attributes on HTML elements.
 * ======================================================= */

(function () {
  "use strict";

  /**
   * Map of data-action values to handler functions.
   * Each handler receives the clicked element and the original event.
   */
  var ACTION_MAP = {
    /* ── Trip Dashboard modal close buttons ── */
    "close-td-modal": function (el) {
      var modalId = el.getAttribute("data-modal");
      if (modalId && typeof closeTdModal === "function") closeTdModal(modalId);
    },

    /* ── Create trip from empty state ── */
    "click-create-trip": function () {
      var btn = document.getElementById("tdNewTripBtn");
      if (btn) btn.click();
    },

    /* ── Scroll to section ── */
    "scroll-to": function (el, e) {
      e.preventDefault();
      var target = el.getAttribute("data-target");
      if (target && typeof scrollToSection === "function") {
        scrollToSection(target);
      }
    },

    /* ── Destination search clear ── */
    "clear-dest-search": function () {
      var input = document.getElementById("destSearchInput");
      if (input) input.value = "";
      if (typeof filterDestinations === "function") filterDestinations();
    },

    /* ── Auth modal ── */
    "close-auth-modal-overlay": function (el, e) {
      if (e.target === el && typeof closeAuthModal === "function") {
        closeAuthModal(e);
      }
    },
    "close-auth-modal": function () {
      if (typeof closeAuthModal === "function") closeAuthModal();
    },
    "handle-login": function () {
      if (typeof handleLogin === "function") handleLogin();
    },
    "handle-register": function () {
      if (typeof handleRegister === "function") handleRegister();
    },
    "switch-auth": function (el, e) {
      e.preventDefault();
      var form = el.getAttribute("data-form");
      if (form && typeof switchAuthForm === "function") switchAuthForm(form);
    },

    /* ── Place modal ── */
    "close-place-modal-overlay": function (el, e) {
      if (e.target === el && typeof closePlaceModal === "function") {
        closePlaceModal(e);
      }
    },
    "close-place-modal": function () {
      if (typeof closePlaceModal === "function") closePlaceModal();
    },
    "open-place-detail": function (el) {
      var fsqId = el.getAttribute("data-fsq-id");
      if (fsqId && typeof openPlaceDetail === "function")
        openPlaceDetail(fsqId);
    },
    "fly-to-poi": function (el) {
      var lat = parseFloat(el.getAttribute("data-lat"));
      var lon = parseFloat(el.getAttribute("data-lon"));
      if (typeof flyToPOI === "function") flyToPOI(lat, lon);
    },
    "open-lightbox": function (el) {
      var url = el.getAttribute("data-url");
      if (url) window.open(url, "_blank", "noopener");
    },
    "toggle-place-fav": function (el) {
      if (typeof _togglePlaceFav === "function") {
        var fsqId = el.getAttribute("data-fsq-id");
        var name = el.getAttribute("data-name");
        if (fsqId) _togglePlaceFav(fsqId, name);
      }
    },
    "close-and-fly": function (el) {
      if (typeof closePlaceModal === "function") closePlaceModal();
      var lat = parseFloat(el.getAttribute("data-lat"));
      var lon = parseFloat(el.getAttribute("data-lon"));
      if (typeof flyToPOI === "function") flyToPOI(lat, lon);
    },

    /* ── Smart Hub ── */
    "open-smart-hub": function (el, e) {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      if (typeof openSmartHub === "function") openSmartHub();
    },
    "open-smart-hub-dest": function (el, e) {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      var dest = el.getAttribute("data-dest");
      if (typeof openSmartHub === "function") openSmartHub(dest);
    },
    "close-smart-hub": function () {
      if (typeof closeSmartHub === "function") closeSmartHub();
    },

    /* ── Trip Dashboard actions ── */
    "open-td-trip": function (el) {
      var id = parseInt(el.getAttribute("data-id"), 10);
      if (typeof openTdTrip === "function") openTdTrip(id);
    },
    "select-td-day": function (el) {
      var id = parseInt(el.getAttribute("data-id"), 10);
      if (typeof selectTdDay === "function") selectTdDay(id);
    },
    "delete-td-place": function (el) {
      var id = parseInt(el.getAttribute("data-id"), 10);
      if (typeof deleteTdPlace === "function") deleteTdPlace(id);
    },
    "assign-td-place": function (el) {
      var id = parseInt(el.getAttribute("data-id"), 10);
      var dayId = parseInt(el.getAttribute("data-day-id"), 10);
      if (typeof assignTdPlace === "function") assignTdPlace(id, dayId);
    },
    "delete-td-reservation": function (el) {
      var id = parseInt(el.getAttribute("data-id"), 10);
      if (typeof deleteTdReservation === "function") deleteTdReservation(id);
    },
    "open-td-lightbox": function (el) {
      var url = el.getAttribute("data-url");
      if (url && typeof openTdLightbox === "function") openTdLightbox(url);
    },
    "delete-td-photo": function (el) {
      var id = parseInt(el.getAttribute("data-id"), 10);
      if (typeof deleteTdPhoto === "function") deleteTdPhoto(id);
    },
    "delete-td-doc": function (el) {
      var id = parseInt(el.getAttribute("data-id"), 10);
      if (typeof deleteTdDoc === "function") deleteTdDoc(id);
    },
    "delete-td-companion": function (el) {
      var id = parseInt(el.getAttribute("data-id"), 10);
      if (typeof deleteTdCompanion === "function") deleteTdCompanion(id);
    },
    "clone-td-template": function (el) {
      var id = el.getAttribute("data-id");
      if (typeof cloneTdTemplate === "function") cloneTdTemplate(id);
    },

    /* ── Gallery / Destination actions ── */
    "toggle-fav": function (el) {
      var name = el.getAttribute("data-name");
      var type = el.getAttribute("data-type");
      if (typeof toggleFavorite === "function") toggleFavorite(name, type);
    },
    "plan-trip-dest": function (el) {
      var dest = el.getAttribute("data-dest");
      if (dest) {
        try {
          sessionStorage.setItem("tt_planner_dest", dest);
        } catch (_e) {
          // optional
        }
        if (typeof setSharedDestinationContext === "function") {
          setSharedDestinationContext(dest, {
            autoRun: false,
            source: "dest-gallery",
          });
        }
      }
      if (window.appRouter && typeof window.appRouter.navigateTo === "function") {
        window.appRouter.navigateTo("planner");
      } else {
        window.location.hash = "planningDashboard";
      }
    },
    "scroll-to-weather": function (el) {
      var dest = el.getAttribute("data-dest");
      if (typeof scrollToWeather === "function") scrollToWeather(dest);
    },
    "open-dest-photos": function (el) {
      var key = el.getAttribute("data-key");
      if (typeof openDestPhotos === "function") openDestPhotos(key);
    },
    "close-dest-photos": function (el) {
      var overlay = el.closest(".dest-photos-overlay");
      if (overlay) overlay.remove();
    },
    "open-lightbox": function (el) {
      var url = el.getAttribute("data-url");
      var alt = el.getAttribute("data-alt") || "";
      var photographer = el.getAttribute("data-photographer") || "";
      var photographerUrl = el.getAttribute("data-photographer-url") || "";
      if (typeof openLightbox === "function")
        openLightbox(url, alt, photographer, photographerUrl);
    },

    /* ── Chatbot ── */
    "copy-msg": function (el) {
      if (typeof copyMsgText === "function") copyMsgText(el);
    },

    /* ── Trip history ── */
    "delete-trip": function (el) {
      var id = parseInt(el.getAttribute("data-id"), 10);
      if (typeof deleteTrip === "function") deleteTrip(id);
    },

    /* ── Favorites / Wishlist ── */
    "scroll-to-budget": function (el) {
      var dest = el.getAttribute("data-dest");
      if (typeof scrollToBudget === "function") scrollToBudget(dest);
    },
    "scroll-to-safety": function (el) {
      var dest = el.getAttribute("data-dest");
      if (typeof scrollToSafety === "function") scrollToSafety(dest);
    },
    "remove-favorite": function (el) {
      var id = parseInt(el.getAttribute("data-id"), 10);
      if (typeof removeFavorite === "function") removeFavorite(id);
    },

    /* ── Expenses ── */
    "delete-expense": function (el) {
      var id = parseInt(el.getAttribute("data-id"), 10);
      if (typeof deleteExpense === "function") deleteExpense(id);
    },

    /* ── Packing ── */
    "delete-packing": function (el) {
      var id = parseInt(el.getAttribute("data-id"), 10);
      if (typeof deletePackingItem === "function") deletePackingItem(id);
    },

    /* ── Journal ── */
    "delete-journal": function (el) {
      var id = parseInt(el.getAttribute("data-id"), 10);
      if (typeof deleteJournalNote === "function") deleteJournalNote(id);
    },

    /* ── Maps / POI ── */
    "fly-to-poi": function (el) {
      var lat = parseFloat(el.getAttribute("data-lat"));
      var lon = parseFloat(el.getAttribute("data-lon"));
      if (typeof flyToPOI === "function") flyToPOI(lat, lon);
    },

    /* ── Itinerary share ── */
    "copy-share-link": function () {
      if (typeof copyShareLink === "function") copyShareLink();
    },
  };

  /* ── Single document-level click listener ── */
  document.addEventListener("click", function (e) {
    var el = e.target;
    while (el && el !== document) {
      // Stop propagation for elements marked with data-stop-propagation
      if (el.hasAttribute && el.hasAttribute("data-stop-propagation")) {
        e.stopPropagation();
        // Still process the action if present
        var stopAction = el.getAttribute("data-action");
        if (stopAction && ACTION_MAP[stopAction]) {
          ACTION_MAP[stopAction](el, e);
        }
        return;
      }
      var action = el.getAttribute && el.getAttribute("data-action");
      if (action && ACTION_MAP[action]) {
        ACTION_MAP[action](el, e);
        return;
      }
      el = el.parentElement;
    }
  });

  /* ── Change event delegation (packing checkboxes) ── */
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var action = el.getAttribute("data-action");
    if (action === "toggle-packing") {
      var id = parseInt(el.getAttribute("data-id"), 10);
      if (typeof togglePackingItem === "function") togglePackingItem(id);
    }
  });

  /* ── Drag event delegation (trip dashboard place reordering) ── */
  document.addEventListener("dragstart", function (e) {
    var el = e.target.closest && e.target.closest("[data-drag-place]");
    if (el) {
      var placeId = parseInt(el.getAttribute("data-drag-place"), 10);
      if (typeof tdDragStart === "function") tdDragStart(e, placeId);
    }
  });
  document.addEventListener("dragover", function (e) {
    if (e.target.closest && e.target.closest("[data-drag-place]")) {
      e.preventDefault();
    }
  });
  document.addEventListener("drop", function (e) {
    var el = e.target.closest && e.target.closest("[data-drag-place]");
    if (el) {
      e.preventDefault();
      var placeId = parseInt(el.getAttribute("data-drag-place"), 10);
      if (typeof tdDrop === "function") tdDrop(e, placeId);
    }
  });

  /* ── Progressive image loading (replaces inline onload) ── */
  function handleProgressiveLoad(img) {
    if (img.dataset.src && img.src !== img.dataset.src) {
      if (typeof destProgressiveLoad === "function") {
        destProgressiveLoad(img);
      }
    } else {
      img.classList.remove("dest-img-blur");
    }
  }

  // Use MutationObserver to attach load/error listeners to dynamically added images
  function handleImgFallback(img) {
    img.addEventListener(
      "error",
      function () {
        var fallback = document.createElement("div");
        fallback.className = "news-card-img placeholder";
        fallback.innerHTML = '<i class="fas fa-newspaper"></i>';
        img.replaceWith(fallback);
      },
      { once: true },
    );
  }

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;

        // Progressive image loading
        var imgs = [];
        if (node.matches && node.matches("[data-progressive-load]")) {
          imgs.push(node);
        }
        if (node.querySelectorAll) {
          imgs = imgs.concat(
            Array.from(node.querySelectorAll("[data-progressive-load]")),
          );
        }
        imgs.forEach(function (img) {
          if (img.complete) {
            handleProgressiveLoad(img);
          } else {
            img.addEventListener(
              "load",
              function () {
                handleProgressiveLoad(img);
              },
              { once: true },
            );
          }
        });

        // Image error fallback (replaces inline onerror)
        var fallbackImgs = [];
        if (node.matches && node.matches("[data-img-fallback]")) {
          fallbackImgs.push(node);
        }
        if (node.querySelectorAll) {
          fallbackImgs = fallbackImgs.concat(
            Array.from(node.querySelectorAll("[data-img-fallback]")),
          );
        }
        fallbackImgs.forEach(function (img) {
          handleImgFallback(img);
        });
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

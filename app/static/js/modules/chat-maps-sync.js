/* =======================================================
 * Chat-Maps Interactive Sync Module
 * Real-time destination highlighting, navigation, and cross-linking
 * ======================================================= */

// ═══════════════════════════════════════════════════════════
// CHAT-MAPS COMMUNICATION BRIDGE
// ═══════════════════════════════════════════════════════════

class ChatMapsSync {
  constructor() {
    this.activeDestinations = new Set();
    this.chatDestinationMarkers = new Map();
    this.isInitialized = false;
    this.init();
  }

  /**
   * Initialize the sync system
   */
  init() {
    if (this.isInitialized) return;

    // Listen for chat messages
    document.addEventListener("chat:message-sent", (e) =>
      this.onChatMessage(e),
    );
    document.addEventListener("chat:reply-received", (e) =>
      this.onChatReply(e),
    );

    // Listen for map interactions
    document.addEventListener("map:marker-clicked", (e) =>
      this.onMapMarkerClick(e),
    );

    // Watch for destination mentions in real-time as user types
    const chatInput =
      document.getElementById("chatInput") ||
      document.querySelector("[data-chat-input]");
    if (chatInput) {
      chatInput.addEventListener("input", (e) =>
        this.detectDestinationsInDraft(e.target.value),
      );
    }

    this.isInitialized = true;
    console.log("✓ Chat-Maps Sync initialized");
  }

  /**
   * Called when user sends a chat message
   */
  onChatMessage(event) {
    const { message } = event.detail;
    this.detectDestinations(message);
  }

  /**
   * Called when bot replies to chat
   */
  onChatReply(event) {
    const { reply } = event.detail;
    this.detectDestinations(reply, true);
  }

  /**
   * Detect destinations in text and highlight them on map
   */
  detectDestinations(text, isBot = false) {
    if (!text || !DEST_COORDS) return;

    const found = [];
    const textLower = text.toLowerCase();

    // Search for destination names in text
    Object.entries(DEST_COORDS).forEach(([key, dest]) => {
      const label = dest.label.toLowerCase();
      if (textLower.includes(label)) {
        found.push({ key, label: dest.label, lat: dest.lat, lon: dest.lon });
      }
    });

    if (found.length > 0) {
      this.highlightDestinations(found, isBot);

      // If bot mentioned destinations, automatically show them on map
      if (isBot) {
        this.focusOnDestinations(found);
      }
    }
  }

  /**
   * Detect destinations as user types (draft detection)
   */
  detectDestinationsInDraft(text) {
    if (!text || text.length < 3) return;

    const found = [];
    const textLower = text.toLowerCase();

    Object.entries(DEST_COORDS).forEach(([key, dest]) => {
      const label = dest.label.toLowerCase();
      if (textLower.includes(label)) {
        found.push({ key, label: dest.label, lat: dest.lat, lon: dest.lon });
      }
    });

    // Show subtle preview on map
    if (found.length > 0) {
      this.previewDestinations(found);
    }
  }

  /**
   * Highlight detected destinations on the map
   */
  highlightDestinations(destinations, isBot = false) {
    if (!ttMap) {
      console.log("Map not initialized yet");
      return;
    }

    destinations.forEach((dest) => {
      const { key, label, lat, lon } = dest;

      // Check if marker already exists
      if (!this.chatDestinationMarkers.has(key)) {
        const markerEl = document.createElement("div");
        markerEl.className = `chat-destination-marker ${isBot ? "from-bot" : "from-user"}`;
        markerEl.innerHTML = `
          <div class="chat-dest-pin">
            <div class="chat-dest-pulse"></div>
            <span class="chat-dest-label">${label}</span>
          </div>
        `;

        const marker = new tt.Marker({
          element: markerEl,
        });

        marker.setLngLat([lon, lat]).addTo(ttMap);
        this.chatDestinationMarkers.set(key, { marker, markerEl });
        this.activeDestinations.add(key);

        // Click to focus on this destination
        markerEl.addEventListener("click", () => {
          this.focusOnDestination(lat, lon, label);
          notify.info(`Viewing ${label} on map`);
        });
      } else {
        // Destination already marked; pulse it
        const { markerEl } = this.chatDestinationMarkers.get(key);
        markerEl.classList.add("pulse-active");
        setTimeout(() => markerEl.classList.remove("pulse-active"), 1000);
      }
    });
  }

  /**
   * Preview destinations (subtle, before user commits)
   */
  previewDestinations(destinations) {
    const previewBox = this.getOrCreatePreviewBox();
    previewBox.innerHTML = destinations
      .map((d) => `<span class="preview-tag">${d.label}</span>`)
      .join("");
    previewBox.style.display = "block";
  }

  /**
   * Focus map on a single destination
   */
  focusOnDestination(lat, lon, label) {
    if (!ttMap) return;

    ttMap.flyTo({
      center: [lon, lat],
      zoom: 11,
      duration: 800,
    });

    // Show info popup
    this.showDestinationInfo(lat, lon, label);
  }

  /**
   * Focus map on multiple destinations (fit bounds)
   */
  focusOnDestinations(destinations) {
    if (!ttMap || destinations.length === 0) return;

    if (destinations.length === 1) {
      const { lat, lon, label } = destinations[0];
      this.focusOnDestination(lat, lon, label);
      return;
    }

    // Fit multiple destinations in view
    const bounds = destinations.reduce((b, d) => {
      b.extend([d.lon, d.lat]);
      return b;
    }, new tt.LngLatBounds());

    ttMap.fitBounds(bounds, { padding: 100, duration: 800 });
  }

  /**
   * Show destination info popup on map
   */
  showDestinationInfo(lat, lon, label) {
    if (!ttMap) return;

    // Get metadata if available
    const destKey = Object.keys(DEST_COORDS).find(
      (k) => DEST_COORDS[k].label === label,
    );
    const meta = destKey && DEST_META[destKey];

    let html = `<div class="dest-popup">
      <strong>${label}</strong>`;

    if (meta) {
      if (meta.region) html += `<br><small>Region: ${meta.region}</small>`;
      if (meta.season) html += `<br><small>Best: ${meta.season}</small>`;
    }

    html += `<br><button class="dest-popup-btn" onclick="
      router.navigate('chat');
      notify.success('Jump back to chat!');
    ">← Back to Chat</button></div>`;

    const popup = new tt.Popup({ offset: 35 }).setHTML(html);

    new tt.Marker().setLngLat([lon, lat]).setPopup(popup).addTo(ttMap);

    popup.addTo(ttMap);
  }

  /**
   * Called when user clicks a map marker
   */
  onMapMarkerClick(event) {
    const { destLabel } = event.detail;
    if (destLabel) {
      this.insertDestinationIntoChat(destLabel);
    }
  }

  /**
   * Insert destination name into chat input
   */
  insertDestinationIntoChat(label) {
    const chatInput =
      document.getElementById("chatInput") ||
      document.querySelector("[data-chat-input]");
    if (chatInput) {
      const currentText = chatInput.value;
      const newText = currentText
        ? `${currentText} ${label}`
        : `Tell me about ${label}`;
      chatInput.value = newText;
      chatInput.focus();
      notify.info(`"${label}" added to chat - press Enter to ask!`);
    }
  }

  /**
   * Clear all chat-sourced markers from map
   */
  clearChatMarkers() {
    this.chatDestinationMarkers.forEach(({ marker }) => {
      marker.remove();
    });
    this.chatDestinationMarkers.clear();
    this.activeDestinations.clear();

    const previewBox = document.querySelector(".chat-preview-box");
    if (previewBox) previewBox.style.display = "none";
  }

  /**
   * Get or create preview tag box
   */
  getOrCreatePreviewBox() {
    let box = document.querySelector(".chat-preview-box");
    if (!box) {
      box = document.createElement("div");
      box.className = "chat-preview-box";
      document.body.appendChild(box);
    }
    return box;
  }

  /**
   * Get active destinations
   */
  getActiveDestinations() {
    return Array.from(this.activeDestinations);
  }
}

// ═══════════════════════════════════════════════════════════
// GLOBAL INSTANCE
// ═══════════════════════════════════════════════════════════
window.chatMapsSync = new ChatMapsSync();

/**
 * Emit chat event (call from chatbot module)
 */
function emitChatMessage(message) {
  document.dispatchEvent(
    new CustomEvent("chat:message-sent", {
      detail: { message },
    }),
  );
}

function emitChatReply(reply) {
  document.dispatchEvent(
    new CustomEvent("chat:reply-received", {
      detail: { reply },
    }),
  );
}

/**
 * Emit map event (call from maps module)
 */
function emitMapMarkerClick(destLabel) {
  document.dispatchEvent(
    new CustomEvent("map:marker-clicked", {
      detail: { destLabel },
    }),
  );
}

/* =======================================================
 * Time Travel - AI Chatbot - Gemini/ML chat, message rendering, history
 * ======================================================= */

// ═══════════════════════════════════════════════════════════
// CHATBOT — Premium AI Assistant (Gemini AI + Classic ML auto-fallback)
// ═══════════════════════════════════════════════════════════
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
let sessionId = null;
let chatMode = "ai"; // auto-detected; "ai" or "classic"
let chatMsgCount = 0;
let chatSending = false; // send-lock to prevent spam
let chatDestContext = null; // current destination context for AI
let chatWorkflowRunning = false;
let chatWorkflowPaused = false;
let chatPlanAutoTimer = null;
let chatAgentPlan = {
  destination: "",
  steps: [],
};

const AGENT_ACTION_RULES = [
  {
    id: "itinerary",
    sectionId: "itinerary",
    icon: "fa-route",
    label: "Build Itinerary",
    keywords: ["itinerary", "plan", "schedule", "daywise", "day-by-day"],
  },
  {
    id: "budget",
    sectionId: "budget",
    icon: "fa-wallet",
    label: "Estimate Budget",
    keywords: ["budget", "cost", "cheap", "price", "afford"],
  },
  {
    id: "safety",
    sectionId: "safety",
    icon: "fa-shield-alt",
    label: "Run Safety Check",
    keywords: ["safety", "safe", "risk", "scam", "secure"],
  },
  {
    id: "weather",
    sectionId: "weather",
    icon: "fa-cloud-sun",
    label: "Check Weather",
    keywords: ["weather", "forecast", "rain", "temperature", "climate"],
  },
  {
    id: "compare",
    sectionId: "compare",
    icon: "fa-columns",
    label: "Compare Destinations",
    keywords: ["compare", "vs", "versus", "better than"],
  },
  {
    id: "maps",
    sectionId: "maps",
    icon: "fa-map-marked-alt",
    label: "Open Maps",
    keywords: ["map", "route", "distance", "nearby"],
  },
  {
    id: "places",
    sectionId: "places",
    icon: "fa-map-pin",
    label: "Find Nearby Places",
    keywords: ["places", "attractions", "things to do", "spots", "visit"],
  },
  {
    id: "news",
    sectionId: "news",
    icon: "fa-newspaper",
    label: "Travel Updates",
    keywords: ["news", "alerts", "advisory", "updates"],
  },
  {
    id: "booking",
    sectionId: "booking",
    icon: "fa-ticket-alt",
    label: "Open Booking",
    keywords: ["book", "booking", "hotel", "flight", "stay"],
  },
  {
    id: "currency",
    sectionId: "currency",
    icon: "fa-exchange-alt",
    label: "Currency Converter",
    keywords: ["currency", "exchange", "forex", "rupee", "usd", "eur"],
  },
  {
    id: "language",
    sectionId: "language",
    icon: "fa-language",
    label: "Phrase Assistant",
    keywords: ["language", "phrase", "speak", "translation", "local words"],
  },
];

function chatNormalizeText(v) {
  return (v || "").toString().toLowerCase().replace(/\s+/g, " ").trim();
}

function detectChatDestination(text) {
  const q = chatNormalizeText(text);
  if (!q || typeof DEST_COORDS === "undefined") return null;
  for (const d of Object.values(DEST_COORDS || {})) {
    const label = (d.label || "").trim();
    if (!label) continue;
    const norm = chatNormalizeText(label);
    if (q.includes(norm)) return label;
  }
  return null;
}

function inferAgentActions(userText, aiText) {
  const combined = `${chatNormalizeText(userText)} ${chatNormalizeText(aiText)}`;
  const actions = [];
  const seen = new Set();

  AGENT_ACTION_RULES.forEach((rule) => {
    if (
      rule.keywords.some((kw) => combined.includes(chatNormalizeText(kw))) &&
      !seen.has(rule.id)
    ) {
      seen.add(rule.id);
      actions.push(rule);
    }
  });

  if (!actions.length) {
    actions.push(
      AGENT_ACTION_RULES.find((r) => r.id === "itinerary"),
      AGENT_ACTION_RULES.find((r) => r.id === "budget"),
    );
  }

  return actions.filter(Boolean).slice(0, 3);
}

function resolveRouteForSection(sectionId) {
  if (window.appRouter && window.appRouter.ROUTE_MAP) {
    const r = window.appRouter.ROUTE_MAP[sectionId];
    if (r && r.route) return r.route;
  }
  if (sectionId === "safety" || sectionId === "weather") return "budget";
  if (sectionId === "packingChecklist") return "packing";
  return sectionId;
}

function getRuleBySection(sectionId) {
  return AGENT_ACTION_RULES.find((r) => r.sectionId === sectionId) || null;
}

function clearAgentPlanAutoTimer() {
  if (chatPlanAutoTimer) {
    clearTimeout(chatPlanAutoTimer);
    chatPlanAutoTimer = null;
  }
}

function renderAgentPlan() {
  const panel = document.getElementById("chatAgentPlan");
  const list = document.getElementById("chatAgentPlanList");
  const runBtn = document.getElementById("chatPlanRunBtn");
  const pauseBtn = document.getElementById("chatPlanPauseBtn");
  const clearBtn = document.getElementById("chatPlanClearBtn");
  const hint = document.getElementById("chatAgentPlanHint");
  if (!panel || !list) return;

  if (!chatAgentPlan.steps.length) {
    panel.style.display = "none";
    list.innerHTML = "";
    if (runBtn) runBtn.disabled = true;
    if (pauseBtn) {
      pauseBtn.disabled = true;
      pauseBtn.classList.remove("pause-active");
      pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
    }
    if (clearBtn) clearBtn.disabled = true;
    return;
  }

  panel.style.display = "block";
  if (runBtn) runBtn.disabled = chatWorkflowRunning;
  if (pauseBtn) {
    pauseBtn.disabled = !chatWorkflowRunning;
    pauseBtn.classList.toggle("pause-active", chatWorkflowPaused);
    pauseBtn.innerHTML = chatWorkflowPaused
      ? '<i class="fas fa-play"></i><span>Resume</span>'
      : '<i class="fas fa-pause"></i><span>Pause</span>';
  }
  if (clearBtn) clearBtn.disabled = chatWorkflowRunning;

  list.innerHTML = chatAgentPlan.steps
    .map((step, idx) => {
      const rule = getRuleBySection(step.sectionId);
      const icon = (rule && rule.icon) || "fa-bolt";
      const label = (rule && rule.label) || step.sectionId;
      const status = step.status || "queued";
      const statusLabel =
        status === "running"
          ? "running"
          : status === "done"
            ? "done"
            : status === "failed"
              ? "failed"
              : status === "skipped"
                ? "skipped"
                : "queued";

      const disableMoveUp = chatWorkflowRunning || idx === 0;
      const disableMoveDown =
        chatWorkflowRunning || idx === chatAgentPlan.steps.length - 1;
      const disableSkip =
        chatWorkflowRunning || status === "done" || status === "running";
      const disableRetry =
        chatWorkflowRunning ||
        (status !== "done" && status !== "skipped" && status !== "failed");

      return `<li class="chat-agent-step" data-status="${status}">
        <span class="chat-agent-step-index">${idx + 1}</span>
        <div class="chat-agent-step-main">
          <i class="fas ${icon}"></i>
          <span class="chat-agent-step-label">${label}</span>
          <span class="chat-agent-step-status">${statusLabel}</span>
        </div>
        <div class="chat-agent-step-controls">
          <button class="chat-agent-step-btn" data-plan-action="up" data-plan-index="${idx}" ${disableMoveUp ? "disabled" : ""} title="Move up">
            <i class="fas fa-arrow-up"></i>
          </button>
          <button class="chat-agent-step-btn" data-plan-action="down" data-plan-index="${idx}" ${disableMoveDown ? "disabled" : ""} title="Move down">
            <i class="fas fa-arrow-down"></i>
          </button>
          <button class="chat-agent-step-btn" data-plan-action="skip" data-plan-index="${idx}" ${disableSkip ? "disabled" : ""} title="Skip step">
            <i class="fas fa-forward"></i>
          </button>
          <button class="chat-agent-step-btn" data-plan-action="retry" data-plan-index="${idx}" ${disableRetry ? "disabled" : ""} title="Retry step">
            <i class="fas fa-rotate-right"></i>
          </button>
        </div>
      </li>`;
    })
    .join("");

  if (hint) {
    if (chatWorkflowRunning && chatWorkflowPaused) {
      hint.textContent = "Workflow paused. Press Resume to continue.";
    } else if (chatWorkflowRunning) {
      hint.textContent = "Workflow running...";
    } else {
      hint.textContent =
        "Reorder, skip, or retry steps before execution. Auto-run starts shortly.";
    }
  }
}

function resetAgentPlan() {
  clearAgentPlanAutoTimer();
  chatWorkflowPaused = false;
  chatAgentPlan = { destination: "", steps: [] };
  renderAgentPlan();
}

function queueAgentPlan(steps, destinationName, options = {}) {
  const autoRun = options.autoRun !== false;
  clearAgentPlanAutoTimer();

  chatAgentPlan = {
    destination: destinationName || chatDestContext || "",
    steps: (steps || []).map((sectionId) => ({ sectionId, status: "queued" })),
  };
  renderAgentPlan();

  if (autoRun && chatAgentPlan.steps.length) {
    chatPlanAutoTimer = setTimeout(() => {
      runQueuedAgentPlan();
    }, 2600);
  }
}

function runAgentAction(sectionId, destinationName, options = {}) {
  if (!sectionId) return;
  const navigate = options.navigate !== false;

  if (destinationName && typeof setSharedDestinationContext === "function") {
    setSharedDestinationContext(destinationName, {
      autoRun: true,
      source: "chat-agent",
    });
  }

  if (navigate) {
    const route = resolveRouteForSection(sectionId);
    if (window.appRouter && typeof window.appRouter.navigateTo === "function") {
      window.appRouter.navigateTo(route, { scrollTo: sectionId });
    } else if (typeof scrollToSection === "function") {
      scrollToSection(sectionId);
    }
  }
}

function shouldAutoRunWorkflow(userText) {
  const q = chatNormalizeText(userText);
  if (!q) return false;
  const triggers = [
    "plan",
    "itinerary",
    "trip",
    "travel plan",
    "family trip",
    "honeymoon",
    "budget",
    "safe",
    "safety",
    "weather",
  ];
  return triggers.some((k) => q.includes(k));
}

function buildAgentWorkflow(userText, inferredActions) {
  const q = chatNormalizeText(userText);
  const workflow = [];
  const addStep = (sectionId) => {
    if (!sectionId || workflow.includes(sectionId)) return;
    workflow.push(sectionId);
  };

  if (q.includes("compare") || q.includes(" vs ") || q.includes("versus")) {
    addStep("compare");
    addStep("budget");
    addStep("safety");
  } else if (
    q.includes("book") ||
    q.includes("flight") ||
    q.includes("hotel") ||
    q.includes("stay")
  ) {
    addStep("booking");
    addStep("budget");
    addStep("weather");
  } else {
    // Default planner workflow requested by user intent: itinerary + budget + safety.
    addStep("itinerary");
    addStep("budget");
    addStep("safety");
  }

  // Include one additional inferred step if relevant and space remains.
  (inferredActions || []).forEach((a) => {
    if (workflow.length >= 4) return;
    addStep(a.sectionId);
  });

  return workflow.slice(0, 4);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAgentWorkflow(steps, destinationName) {
  if (!steps || !steps.length || chatWorkflowRunning) return;
  queueAgentPlan(steps, destinationName, { autoRun: false });
  await runQueuedAgentPlan();
}

async function runQueuedAgentPlan() {
  if (!chatAgentPlan.steps.length || chatWorkflowRunning) return;
  clearAgentPlanAutoTimer();

  chatWorkflowRunning = true;
  chatWorkflowPaused = false;
  renderAgentPlan();

  try {
    const activeSteps = chatAgentPlan.steps.filter(
      (s) => s.status !== "skipped",
    );
    if (!activeSteps.length) {
      appendMessage(
        "bot",
        "Agent plan is empty after skips. Ask a new request to build another plan.",
        "agent_workflow",
        1,
        "ai",
        "gemini-agent",
      );
      return;
    }

    const readable = activeSteps
      .map((s) => {
        const rule = getRuleBySection(s.sectionId);
        return rule ? rule.label : s;
      })
      .join(" -> ");

    appendMessage(
      "bot",
      `Agent workflow started${chatAgentPlan.destination ? ` for **${chatAgentPlan.destination}**` : ""}: ${readable}`,
      "agent_workflow",
      1,
      "ai",
      "gemini-agent",
    );

    for (let i = 0; i < chatAgentPlan.steps.length; i += 1) {
      const step = chatAgentPlan.steps[i];
      const sectionId = step.sectionId;
      if (step.status === "skipped") continue;

      while (chatWorkflowPaused) {
        await sleep(180);
      }

      const rule = getRuleBySection(sectionId);
      const label = rule ? rule.label : sectionId;

      step.status = "running";
      renderAgentPlan();

      appendMessage(
        "bot",
        `Step ${i + 1}/${chatAgentPlan.steps.length}: running **${label}**...`,
        "agent_progress",
        1,
        "ai",
        "gemini-agent",
      );

      try {
        runAgentAction(sectionId, chatAgentPlan.destination, {
          navigate: true,
        });
        await sleep(720);
        step.status = "done";
      } catch (_) {
        step.status = "failed";
      }
      renderAgentPlan();
    }

    appendMessage(
      "bot",
      "Workflow completed. You can continue with follow-up requests and I will keep orchestrating the tools.",
      "agent_complete",
      1,
      "ai",
      "gemini-agent",
    );
  } finally {
    chatWorkflowRunning = false;
    renderAgentPlan();
  }
}

function retryAgentPlanStep(index) {
  if (chatWorkflowRunning) return;
  const step = chatAgentPlan.steps[index];
  if (!step) return;
  step.status = "queued";
  renderAgentPlan();
  clearAgentPlanAutoTimer();
  chatPlanAutoTimer = setTimeout(() => {
    runQueuedAgentPlan();
  }, 450);
}

function refreshChatQuickActions() {
  const chips = document.querySelectorAll(".chat-quick-chip");
  if (!chips.length) return;

  const dest = chatDestContext || "Goa";

  chips.forEach((chip) => {
    const category = chip.dataset.category || "";
    if (category === "planning") {
      chip.dataset.msg = `Plan a 5-day ${dest} trip with itinerary, budget, and safety checks`;
      chip.innerHTML = `<i class="fas fa-route"></i> Plan ${dest}`;
    } else if (category === "safety") {
      chip.dataset.msg = `Is ${dest} safe for families and solo travelers this month?`;
      chip.innerHTML = `<i class="fas fa-shield-alt"></i> ${dest} safety`;
    } else if (category === "budget") {
      chip.dataset.msg = `Create a budget split for a ${dest} trip under INR 30000`;
      chip.innerHTML = `<i class="fas fa-wallet"></i> ${dest} budget`;
    }
  });
}

// ── Destination context management ──
function setChatContext(destinationName) {
  chatDestContext = destinationName || null;
  const badge = document.getElementById("chatContextBadge");
  const label = document.getElementById("chatContextLabel");
  if (badge && label) {
    if (chatDestContext) {
      label.textContent = chatDestContext;
      badge.style.display = "inline-flex";
    } else {
      badge.style.display = "none";
    }
  }
  refreshChatQuickActions();
}

// Wire up context clear button
const chatContextClearBtn = document.getElementById("chatContextClear");
if (chatContextClearBtn) {
  chatContextClearBtn.addEventListener("click", () => {
    setChatContext(null);
    showToast("Destination context cleared", "info");
  });
}

// ── Update message counter in header ──
function updateChatMsgCounter() {
  const counter = document.getElementById("chatMsgCounter");
  if (counter) {
    // Only count user messages
    const userMsgs = chatMessages
      ? chatMessages.querySelectorAll(".user-message").length
      : 0;
    counter.textContent = `${userMsgs} msg${userMsgs !== 1 ? "s" : ""}`;
  }
}

// ── Render welcome message on load ──
function renderChatWelcome() {
  if (!chatMessages) return;
  chatMessages.innerHTML = `
    <div class="message bot-message chat-welcome-msg">
      <div class="message-avatar"><i class="fas fa-robot"></i></div>
      <div class="message-content">
        <div class="md-body">
          <p>Hello! I'm your <strong>AI Travel Assistant</strong> 🌍</p>
          <p>Powered by Google Gemini, I can help you with:</p>
          <div class="chat-feature-pills">
            <span class="chat-feat"><i class="fas fa-route"></i> Trip planning</span>
            <span class="chat-feat"><i class="fas fa-wallet"></i> Budget estimates</span>
            <span class="chat-feat"><i class="fas fa-shield-alt"></i> Safety info</span>
            <span class="chat-feat"><i class="fas fa-cloud-sun"></i> Weather tips</span>
            <span class="chat-feat"><i class="fas fa-suitcase"></i> Packing lists</span>
            <span class="chat-feat"><i class="fas fa-utensils"></i> Food & culture</span>
          </div>
          <p style="margin-top:10px;font-size:0.78rem;color:rgba(255,255,255,0.4);">
            <i class="fas fa-lightbulb" style="color:#fbbf24;margin-right:4px;"></i>
            Try the quick prompts below, or ask anything about Indian travel!
          </p>
        </div>
        <span class="model-badge ai-badge"><i class="fas fa-brain"></i> Gemini AI</span>
        <span class="msg-time">${formatMsgTime()}</span>
      </div>
    </div>
  `;
}
renderChatWelcome();

// ── Time formatting ──
function formatMsgTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Markdown rendering ──
(function initMarked() {
  if (typeof marked !== "undefined") {
    marked.setOptions({ gfm: true, breaks: true });
  }
})();

function renderMarkdown(text) {
  if (typeof marked !== "undefined") {
    const raw = marked.parse(text);
    return typeof DOMPurify !== "undefined" ? DOMPurify.sanitize(raw) : raw;
  }
  return text.replace(/</g, "&lt;").replace(/\n/g, "<br>");
}

// ── Detect destination names in AI response for action buttons ──
function detectDestinationActions(text) {
  if (typeof DEST_META === "undefined") return [];
  const found = [];
  const names = Object.keys(DEST_META);
  for (const name of names) {
    if (text.toLowerCase().includes(name.toLowerCase()) && found.length < 4) {
      found.push(name);
    }
  }
  return found;
}

// ── Append message ──
function appendMessage(
  role,
  text,
  intent,
  confidence,
  mode,
  model,
  agentActions,
) {
  const msg = document.createElement("div");
  msg.className = `message ${role}-message`;

  const avatar =
    role === "bot"
      ? '<div class="message-avatar"><i class="fas fa-robot"></i></div>'
      : '<div class="message-avatar"><i class="fas fa-user"></i></div>';

  let badge = "";
  if (role === "bot") {
    if (mode === "ai" || (model && model.includes("gemini"))) {
      badge =
        '<span class="model-badge ai-badge"><i class="fas fa-brain"></i> Gemini AI</span>';
    } else if (mode === "classic" && intent && intent !== "fallback") {
      badge = `<span class="model-badge classic-badge"><i class="fas fa-cog"></i> ${intent} · ${Math.round(confidence * 100)}%</span>`;
    }
  }

  const isAI = mode === "ai" || (model && model.includes("gemini"));
  const formatted = isAI ? renderMarkdown(text) : text.replace(/\n/g, "<br>");
  const body = isAI
    ? `<div class="md-body">${formatted}</div>`
    : `<p>${formatted}</p>`;
  const time = `<span class="msg-time">${formatMsgTime()}</span>`;

  // Copy button for bot messages — targets .md-body or p for clean copy
  const copyBtn =
    role === "bot"
      ? `<button class="msg-copy-btn" title="Copy" data-action="copy-msg"><i class="far fa-copy"></i></button>`
      : "";

  // Detect destination action buttons for bot AI responses
  let actionRow = "";
  if (role === "bot" && isAI) {
    const dests = detectDestinationActions(text);
    const destinationBtns = dests
      .map(
        (d) =>
          `<button class="chat-inline-action" data-action="open-smart-hub-dest" data-dest="${d}"><i class="fas fa-compass"></i> Explore ${d}</button>`,
      )
      .join("");

    const agentBtns = (agentActions || [])
      .map(
        (a) =>
          `<button class="chat-inline-action" data-action="agent-open-section" data-section="${a.sectionId}" data-dest="${chatDestContext || ""}"><i class="fas ${a.icon}"></i> ${a.label}</button>`,
      )
      .join("");

    if (destinationBtns || agentBtns) {
      const btns = `${destinationBtns}${agentBtns}`;
      actionRow = `<div class="chat-action-row">${btns}</div>`;
    }
  }

  if (role === "bot" && !isAI && (agentActions || []).length) {
    const btns = agentActions
      .map(
        (a) =>
          `<button class="chat-inline-action" data-action="agent-open-section" data-section="${a.sectionId}" data-dest="${chatDestContext || ""}"><i class="fas ${a.icon}"></i> ${a.label}</button>`,
      )
      .join("");
    actionRow = `<div class="chat-action-row">${btns}</div>`;
  }

  msg.innerHTML = `
    ${avatar}
    <div class="message-content">
      ${body}
      ${actionRow}
      <div class="msg-meta">${badge}${time}${copyBtn}</div>
    </div>
  `;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  chatMsgCount++;

  // Hide quick actions after first user message
  if (role === "user") {
    const qa = document.getElementById("chatQuickActions");
    if (qa) qa.classList.add("hidden");
  }

  updateChatMsgCounter();

  // Persist to sessionStorage
  saveChatHistory();

  return msg;
}

// ── Copy message text — only the actual content, not badges/time ──
function copyMsgText(btn) {
  const content = btn.closest(".message-content");
  // Target only the markdown body or paragraph, not meta
  const bodyEl = content
    ? content.querySelector(".md-body") || content.querySelector("p")
    : null;
  const text = bodyEl ? bodyEl.innerText : content ? content.innerText : "";
  navigator.clipboard.writeText(text.trim()).then(() => {
    btn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => {
      btn.innerHTML = '<i class="far fa-copy"></i>';
    }, 1500);
  });
}

// ── Send lock (disable/enable input during send) ──
function setChatSending(sending) {
  chatSending = sending;
  if (chatInput) chatInput.disabled = sending;
  if (chatSend) {
    chatSend.disabled = sending;
    chatSend.classList.toggle("sending", sending);
  }
}

// ── Send message ──
async function sendChat() {
  if (chatSending) return; // prevent duplicate sends
  const text = chatInput.value.trim();
  if (!text) return;

  appendMessage("user", text);

  const detectedDest = detectChatDestination(text);
  if (detectedDest && detectedDest !== chatDestContext) {
    setChatContext(detectedDest);
  }

  if (detectedDest && typeof setSharedDestinationContext === "function") {
    setSharedDestinationContext(detectedDest, {
      autoRun: false,
      source: "chat-agent",
    });
  }

  // ✨ Emit event for chat-maps sync
  if (typeof emitChatMessage === "function") {
    emitChatMessage(text);
  }

  chatInput.value = "";
  autoResizeInput();
  updateCharCount();

  setChatSending(true);

  // Show typing indicator
  const typing = document.createElement("div");
  typing.className = "message bot-message typing-message";
  typing.innerHTML = `
    <div class="message-avatar"><i class="fas fa-robot"></i></div>
    <div class="message-content">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <span class="typing-label">Thinking…</span>
    </div>
  `;
  chatMessages.appendChild(typing);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const body = { message: text, mode: chatMode };
    if (sessionId) body.session_id = sessionId;
    if (chatDestContext) body.destination = chatDestContext;
    body.agent_mode = true;
    body.route_context =
      window.appRouter && typeof window.appRouter.getCurrentRoute === "function"
        ? window.appRouter.getCurrentRoute()
        : "chat";
    body.tools_context = AGENT_ACTION_RULES.map((r) => r.sectionId);

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFToken(),
      },
      body: JSON.stringify(body),
    });
    typing.remove();

    if (res.ok) {
      const data = await res.json();
      sessionId = data.session_id;
      const agentActions = inferAgentActions(text, data.reply);
      appendMessage(
        "bot",
        data.reply,
        data.intent,
        data.confidence,
        data.mode,
        data.model,
        agentActions,
      );

      if (shouldAutoRunWorkflow(text)) {
        const workflow = buildAgentWorkflow(text, agentActions);
        if (workflow.length) {
          runAgentWorkflow(workflow, chatDestContext || detectedDest || "");
        }
      }

      // ✨ Emit event for chat-maps sync
      if (typeof emitChatReply === "function") {
        emitChatReply(data.reply);
      }
    } else if (res.status === 429) {
      // Rate limit — show specific feedback
      const warning = document.createElement("div");
      warning.className = "chat-rate-warning";
      warning.innerHTML =
        '<i class="fas fa-clock"></i> Rate limit reached — please wait a moment before sending another message.';
      chatMessages.appendChild(warning);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      setTimeout(() => warning.remove(), 8000);
    } else {
      const data = await res.json().catch(() => ({}));
      appendMessage(
        "bot",
        data.error || "Something went wrong. Please try again.",
        null,
        null,
        "classic",
      );
    }
  } catch (err) {
    typing.remove();
    appendMessage(
      "bot",
      "Network error — please check your connection and try again.",
      null,
      null,
      "classic",
    );
  } finally {
    setChatSending(false);
    if (chatInput) chatInput.focus();
  }
}

if (chatMessages) {
  chatMessages.addEventListener("click", (e) => {
    const btn = e.target.closest(".chat-inline-action");
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === "open-smart-hub-dest") {
      const dest = btn.dataset.dest || "";
      if (dest && typeof openSmartHub === "function") {
        openSmartHub(dest);
      }
      return;
    }

    if (action === "agent-open-section") {
      const sectionId = btn.dataset.section;
      const dest = btn.dataset.dest || chatDestContext || "";
      runAgentAction(sectionId, dest);
      if (dest) setChatContext(dest);
    }
  });
}

const chatAgentPlanList = document.getElementById("chatAgentPlanList");
if (chatAgentPlanList) {
  chatAgentPlanList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-plan-action]");
    if (!btn) return;
    if (chatWorkflowRunning) return;

    const action = btn.dataset.planAction;
    const idx = Number(btn.dataset.planIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= chatAgentPlan.steps.length)
      return;

    clearAgentPlanAutoTimer();

    if (action === "up" && idx > 0) {
      const tmp = chatAgentPlan.steps[idx - 1];
      chatAgentPlan.steps[idx - 1] = chatAgentPlan.steps[idx];
      chatAgentPlan.steps[idx] = tmp;
      renderAgentPlan();
      return;
    }

    if (action === "down" && idx < chatAgentPlan.steps.length - 1) {
      const tmp = chatAgentPlan.steps[idx + 1];
      chatAgentPlan.steps[idx + 1] = chatAgentPlan.steps[idx];
      chatAgentPlan.steps[idx] = tmp;
      renderAgentPlan();
      return;
    }

    if (action === "skip") {
      chatAgentPlan.steps[idx].status = "skipped";
      renderAgentPlan();
      return;
    }

    if (action === "retry") {
      retryAgentPlanStep(idx);
    }
  });
}

const chatPlanRunBtn = document.getElementById("chatPlanRunBtn");
if (chatPlanRunBtn) {
  chatPlanRunBtn.addEventListener("click", () => {
    runQueuedAgentPlan();
  });
}

const chatPlanPauseBtn = document.getElementById("chatPlanPauseBtn");
if (chatPlanPauseBtn) {
  chatPlanPauseBtn.addEventListener("click", () => {
    if (!chatWorkflowRunning) return;
    chatWorkflowPaused = !chatWorkflowPaused;
    renderAgentPlan();
  });
}

const chatPlanClearBtn = document.getElementById("chatPlanClearBtn");
if (chatPlanClearBtn) {
  chatPlanClearBtn.addEventListener("click", () => {
    if (chatWorkflowRunning) return;
    resetAgentPlan();
  });
}

// ── Chat history persistence (sessionStorage) ──
function saveChatHistory() {
  if (!chatMessages) return;
  try {
    const msgs = [];
    chatMessages.querySelectorAll(".message").forEach((m) => {
      if (m.classList.contains("typing-message")) return;
      if (m.classList.contains("chat-welcome-msg")) return;
      const role = m.classList.contains("user-message") ? "user" : "bot";
      const bodyEl =
        m.querySelector(".md-body") || m.querySelector("p") || null;
      const text = bodyEl ? bodyEl.innerHTML : "";
      const badge = m.querySelector(".model-badge");
      const isAI = badge ? badge.classList.contains("ai-badge") : false;
      const timeEl = m.querySelector(".msg-time");
      const time = timeEl ? timeEl.textContent : "";
      msgs.push({ role, html: text, isAI, time });
    });
    const data = {
      msgs,
      sessionId,
      chatMode,
      chatDestContext,
      ts: Date.now(),
    };
    sessionStorage.setItem("tt_chat_history", JSON.stringify(data));
  } catch (e) {
    /* storage full — silently ignore */
  }
}

function restoreChatHistory() {
  try {
    const raw = sessionStorage.getItem("tt_chat_history");
    if (!raw) return false;
    const data = JSON.parse(raw);
    // Only restore if less than 30 min old
    if (Date.now() - data.ts > 30 * 60 * 1000) {
      sessionStorage.removeItem("tt_chat_history");
      return false;
    }
    if (!data.msgs || data.msgs.length === 0) return false;

    sessionId = data.sessionId || null;
    if (data.chatDestContext) setChatContext(data.chatDestContext);

    // Clear welcome and restore messages
    chatMessages.innerHTML = "";
    renderChatWelcome();

    data.msgs.forEach((m) => {
      const msg = document.createElement("div");
      msg.className = `message ${m.role}-message`;
      const avatarIcon = m.role === "bot" ? "fa-robot" : "fa-user";
      const avatarClass = m.role === "bot" ? "" : "";
      let badge = "";
      if (m.role === "bot" && m.isAI) {
        badge =
          '<span class="model-badge ai-badge"><i class="fas fa-brain"></i> Gemini AI</span>';
      }
      const copyBtn =
        m.role === "bot"
          ? `<button class="msg-copy-btn" title="Copy" data-action="copy-msg"><i class="far fa-copy"></i></button>`
          : "";

      msg.innerHTML = `
        <div class="message-avatar"><i class="fas ${avatarIcon}"></i></div>
        <div class="message-content">
          ${m.isAI ? `<div class="md-body">${m.html}</div>` : `<p>${m.html}</p>`}
          <div class="msg-meta">${badge}<span class="msg-time">${m.time}</span>${copyBtn}</div>
        </div>
      `;
      msg.style.animation = "none"; // no animation on restore
      chatMessages.appendChild(msg);
      chatMsgCount++;
    });

    // Hide quick actions if we have restored messages
    const qa = document.getElementById("chatQuickActions");
    if (qa && data.msgs.length > 0) qa.classList.add("hidden");

    chatMessages.scrollTop = chatMessages.scrollHeight;
    updateChatMsgCounter();
    return true;
  } catch (e) {
    return false;
  }
}

// Try to restore on load — if no history, welcome is already rendered
restoreChatHistory();
refreshChatQuickActions();

window.addEventListener("routechange", (e) => {
  if (!e || !e.detail || e.detail.route !== "chat") return;
  setTimeout(() => {
    if (chatInput) chatInput.focus();
    if (chatDestContext && typeof setSharedDestinationContext === "function") {
      setSharedDestinationContext(chatDestContext, {
        autoRun: false,
        source: "chat-agent",
      });
    }
  }, 120);
});

// ── Input handling: auto-resize textarea + char count ──
function autoResizeInput() {
  if (!chatInput) return;
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
}

function updateCharCount() {
  const counter = document.getElementById("chatCharCount");
  if (counter && chatInput) {
    const len = chatInput.value.length;
    counter.textContent = `${len} / 500`;
    counter.classList.toggle("near-limit", len > 400);
  }
}

if (chatInput) {
  chatInput.addEventListener("input", () => {
    autoResizeInput();
    updateCharCount();
  });
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
}
if (chatSend) chatSend.addEventListener("click", sendChat);

// ── Quick action chips ──
document.querySelectorAll(".chat-quick-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chatSending) return;
    chatInput.value = chip.dataset.msg;
    autoResizeInput();
    sendChat();
  });
});

// ── Clear chat ──
const chatClearBtn = document.getElementById("chatClearBtn");
if (chatClearBtn) {
  chatClearBtn.addEventListener("click", () => {
    sessionId = null;
    chatMsgCount = 0;
    chatDestContext = null;
    setChatContext(null);
    renderChatWelcome();
    const qa = document.getElementById("chatQuickActions");
    if (qa) qa.classList.remove("hidden");
    sessionStorage.removeItem("tt_chat_history");
    resetAgentPlan();
    updateChatMsgCounter();
    showToast("Chat cleared", "info");
  });
}

// ── Export chat (clean — skips welcome, excludes metadata) ──
const chatExportBtn = document.getElementById("chatExportBtn");
if (chatExportBtn) {
  chatExportBtn.addEventListener("click", () => {
    const msgs = chatMessages.querySelectorAll(
      ".message:not(.chat-welcome-msg):not(.typing-message)",
    );
    if (msgs.length === 0) {
      showToast("Nothing to export yet", "warning");
      return;
    }
    let txt = "=== Time Travel AI — Chat Export ===\n";
    txt += `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
    if (chatDestContext) txt += `Context: ${chatDestContext}\n`;
    txt += "\n";
    msgs.forEach((m) => {
      const role = m.classList.contains("user-message") ? "You" : "AI";
      const bodyEl =
        m.querySelector(".md-body") || m.querySelector("p") || null;
      const content = bodyEl ? bodyEl.innerText : "";
      const time = m.querySelector(".msg-time")?.textContent || "";
      txt += `[${role}] (${time}) ${content.trim()}\n\n`;
    });
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `travel-chat-${Date.now()}.txt`;
    a.click();
    showToast("Chat exported!", "success");
  });
}

// ── Scroll-to-bottom button ──
const chatScrollBtn = document.getElementById("chatScrollBottomBtn");
if (chatMessages && chatScrollBtn) {
  chatMessages.addEventListener("scroll", () => {
    const gap =
      chatMessages.scrollHeight -
      chatMessages.scrollTop -
      chatMessages.clientHeight;
    chatScrollBtn.style.display = gap > 150 ? "flex" : "none";
  });
  chatScrollBtn.addEventListener("click", () => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

// ── Check AI availability (with retry) ──
async function checkChatStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/chat/status`);
    const data = await res.json();
    const dot = document.getElementById("chatStatusDot");
    const statusLabel = document.getElementById("chatHeaderStatus");
    if (data.engines && data.engines.ai && data.engines.ai.available) {
      chatMode = "ai";
      if (dot) dot.classList.add("online");
      if (statusLabel) statusLabel.textContent = "Gemini AI · Online";
    } else {
      chatMode = "classic";
      if (dot) dot.classList.add("offline");
      if (statusLabel) statusLabel.textContent = "Classic ML · Fallback";
    }
  } catch {
    chatMode = "classic";
    const dot = document.getElementById("chatStatusDot");
    const statusLabel = document.getElementById("chatHeaderStatus");
    if (dot) dot.classList.add("offline");
    if (statusLabel) statusLabel.textContent = "Offline — retrying…";
    // Retry after 10s
    setTimeout(checkChatStatus, 10000);
  }
}

// ═══════════════════════════════════════════════════════════

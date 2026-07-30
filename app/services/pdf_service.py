"""
PDF Export Service
=====================
Generates downloadable PDF reports for trip plans:
  - Itinerary  (day-by-day schedule)
  - Budget     (cost breakdown)
  - Comparison (side-by-side destination comparison)

Uses fpdf2 for lightweight, pure-Python PDF generation.
"""

import io
import logging
from datetime import date
from typing import Any, Dict

from fpdf import FPDF

logger = logging.getLogger(__name__)

# ── Brand colours (RGB) ────────────────────────────────────────────────────
PRIMARY = (67, 56, 202)  # indigo-600
PRIMARY_LIGHT = (99, 102, 241)
ACCENT = (236, 72, 153)  # pink-500
DARK = (30, 27, 75)
MUTED = (120, 120, 140)
WHITE = (255, 255, 255)
LIGHT_BG = (243, 244, 246)  # gray-100
SUCCESS = (16, 185, 129)
WARNING = (245, 158, 11)
DANGER = (239, 68, 68)


class TripPDF(FPDF):
    """Custom FPDF subclass with shared header / footer styling."""

    _title_text: str = "Time Travel - Smart Tourism"

    def header(self):
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(*PRIMARY)
        self.cell(0, 8, self._title_text, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*PRIMARY)
        self.set_line_width(0.5)
        self.line(10, self.get_y(), self.w - 10, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*MUTED)
        self.cell(
            0,
            10,
            f"Generated on {date.today().strftime('%d %B %Y')}  |  Page {self.page_no()}/{{nb}}",
            align="C",
        )

    @staticmethod
    def _safe(text: str) -> str:
        """Normalize typographic characters while preserving UTF-8 for Indic scripts."""
        if not text:
            return ""
        return (
            text.replace("\u2013", "-")  # en-dash
            .replace("\u2014", "--")  # em-dash
            .replace("\u2018", "'")  # left single quote
            .replace("\u2019", "'")  # right single quote
            .replace("\u201c", '"')  # left double quote
            .replace("\u201d", '"')  # right double quote
            .replace("\u2026", "...")  # ellipsis
            .replace("\u20b9", "\u20b9")  # rupee sign preserved
        )

    def normalize_text(self, text):
        """Override fpdf2's normalize_text to sanitize unicode first."""
        return super().normalize_text(self._safe(str(text)))

    # ── Helpers ─────────────────────────────────────────────
    def section_title(self, text: str, icon: str = ""):
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(*DARK)
        label = f"{icon}  {text}" if icon else text
        self.cell(0, 10, label, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def sub_heading(self, text: str):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*PRIMARY)
        self.cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")

    def body_text(self, text: str, bold: bool = False):
        self.set_font("Helvetica", "B" if bold else "", 9)
        self.set_text_color(*DARK)
        self.multi_cell(0, 5, text)

    def muted_text(self, text: str):
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.multi_cell(0, 4, text)

    def chip(self, label: str, value: str, bg=LIGHT_BG, fg=DARK):
        """Render a label: value row with a light background band."""
        self.set_fill_color(*bg)
        self.set_text_color(*fg)
        self.set_font("Helvetica", "", 9)
        self.cell(55, 6, f"  {label}", fill=True)
        self.set_font("Helvetica", "B", 9)
        self.cell(0, 6, value, fill=True, new_x="LMARGIN", new_y="NEXT")

    def spacer(self, h: float = 4):
        self.ln(h)

    def hr(self):
        self.set_draw_color(*LIGHT_BG)
        self.set_line_width(0.3)
        y = self.get_y()
        self.line(10, y, self.w - 10, y)
        self.ln(3)


# ═══════════════════════════════════════════════════════════════════════════
# 1.  ITINERARY PDF
# ═══════════════════════════════════════════════════════════════════════════


def generate_itinerary_pdf(data: Dict[str, Any]) -> bytes:
    """
    Generate a day-by-day itinerary PDF.

    Parameters
    ----------
    data : dict
        A dict with keys: destination, num_days, family_size, travel_class,
        interests, itinerary (list of day dicts).

    Returns
    -------
    bytes   PDF file content
    """
    pdf = TripPDF()
    pdf._title_text = f"Trip Itinerary – {data.get('destination', 'Unknown')}"
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # ── Trip overview box ──
    pdf.set_fill_color(*LIGHT_BG)
    pdf.set_draw_color(*PRIMARY_LIGHT)
    y_start = pdf.get_y()
    pdf.rect(10, y_start, pdf.w - 20, 22, style="FD")

    pdf.set_xy(14, y_start + 3)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*PRIMARY)
    pdf.cell(0, 6, data.get("destination", ""), new_x="LMARGIN", new_y="NEXT")

    pdf.set_x(14)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*MUTED)
    meta_parts = [
        f"{data.get('num_days', '?')} days",
        f"{data.get('family_size', '?')} people",
        data.get("travel_class", "economy").capitalize(),
    ]
    if data.get("interests"):
        meta_parts.append(f"Interests: {data['interests']}")
    pdf.cell(0, 5, "  |  ".join(meta_parts))

    pdf.set_y(y_start + 26)

    # ── Day-by-day cards ──
    SLOT_LABELS = {"morning": "Morning", "afternoon": "Afternoon", "evening": "Evening"}

    for day in data.get("itinerary", []):
        # Check remaining space — start new page if < 60mm
        if pdf.get_y() > pdf.h - 65:
            pdf.add_page()

        # Day header band
        pdf.set_fill_color(*PRIMARY)
        pdf.set_text_color(*WHITE)
        pdf.set_font("Helvetica", "B", 10)
        day_num = day.get("day", "?")
        title = day.get("title", f"Day {day_num}")
        pdf.cell(
            0,
            8,
            f"  Day {day_num}  –  {title}",
            fill=True,
            new_x="LMARGIN",
            new_y="NEXT",
        )
        pdf.spacer(2)

        for period in ("morning", "afternoon", "evening"):
            slot = day.get(period)
            if not slot:
                continue

            pdf.set_text_color(*PRIMARY_LIGHT)
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(30, 5, f"  {SLOT_LABELS[period]}")

            pdf.set_text_color(*DARK)
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(0, 5, slot.get("activity", ""), new_x="LMARGIN", new_y="NEXT")

            if slot.get("description"):
                pdf.set_x(40)
                pdf.set_font("Helvetica", "", 8)
                pdf.set_text_color(*MUTED)
                pdf.multi_cell(pdf.w - 50, 4, slot["description"])

            meta_bits = []
            if slot.get("duration"):
                meta_bits.append(f"Duration: {slot['duration']}")
            if slot.get("cost"):
                meta_bits.append(f"Cost: {slot['cost']}")
            if meta_bits:
                pdf.set_x(40)
                pdf.set_font("Helvetica", "I", 8)
                pdf.set_text_color(*MUTED)
                pdf.cell(0, 4, "  |  ".join(meta_bits), new_x="LMARGIN", new_y="NEXT")

            pdf.spacer(1)

        # Tip
        if day.get("tip"):
            pdf.set_fill_color(255, 251, 235)  # amber-50
            pdf.set_font("Helvetica", "I", 8)
            pdf.set_text_color(146, 64, 14)  # amber-800
            pdf.cell(
                0, 5, f"  Tip: {day['tip']}", fill=True, new_x="LMARGIN", new_y="NEXT"
            )

        pdf.spacer(4)

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════
# 2.  BUDGET PDF
# ═══════════════════════════════════════════════════════════════════════════


def generate_budget_pdf(data: Dict[str, Any]) -> bytes:
    """
    Generate a budget-breakdown PDF.

    Parameters
    ----------
    data : dict
        Keys: destination, num_days, family_size, travel_class,
        accommodation, food, transport, activities, miscellaneous, total, currency

    Returns
    -------
    bytes   PDF file content
    """
    pdf = TripPDF()
    pdf._title_text = f"Budget Estimate – {data.get('destination', 'Unknown')}"
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Trip info
    pdf.section_title(f"Budget Estimate for {data.get('destination', 'Unknown')}")
    pdf.muted_text(
        f"{data.get('num_days', '?')} days  |  {data.get('family_size', '?')} people  |  "
        f"{(data.get('travel_class') or 'economy').capitalize()} class"
    )
    pdf.spacer(6)

    # Line items table
    ITEMS = [
        ("Accommodation", "accommodation"),
        ("Food & Dining", "food"),
        ("Transport", "transport"),
        ("Activities", "activities"),
        ("Miscellaneous", "miscellaneous"),
    ]

    currency = data.get("currency", "INR")

    # Table header
    pdf.set_fill_color(*PRIMARY)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(100, 8, "  Category", fill=True)
    pdf.cell(
        0,
        8,
        f"Amount ({currency})",
        fill=True,
        align="R",
        new_x="LMARGIN",
        new_y="NEXT",
    )

    alt = False
    for label, key in ITEMS:
        bg = LIGHT_BG if alt else WHITE
        pdf.set_fill_color(*bg)
        pdf.set_text_color(*DARK)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(100, 7, f"  {label}", fill=True)
        pdf.set_font("Helvetica", "", 9)
        val = data.get(key, 0)
        pdf.cell(
            0, 7, _fmt_inr(val), fill=True, align="R", new_x="LMARGIN", new_y="NEXT"
        )
        alt = not alt

    # Total row
    pdf.set_fill_color(*DARK)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(100, 9, "  TOTAL", fill=True)
    pdf.cell(
        0,
        9,
        _fmt_inr(data.get("total", 0)),
        fill=True,
        align="R",
        new_x="LMARGIN",
        new_y="NEXT",
    )

    pdf.spacer(10)
    pdf.muted_text(
        "Note: These are approximate estimates based on average costs. "
        "Actual expenses may vary depending on season, availability, and personal choices."
    )

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════
# 3.  COMPARISON PDF
# ═══════════════════════════════════════════════════════════════════════════


def generate_comparison_pdf(data: Dict[str, Any]) -> bytes:
    """
    Generate a side-by-side destination comparison PDF.

    Parameters
    ----------
    data : dict
        Keys: dest1 (profile), dest2 (profile), params.
        Each profile: destination, budget, safety, weather.

    Returns
    -------
    bytes   PDF file content
    """
    p1 = data.get("dest1", {})
    p2 = data.get("dest2", {})
    params = data.get("params", {})

    pdf = TripPDF()
    pdf._title_text = (
        f"Comparison – {p1.get('destination', '?')} vs {p2.get('destination', '?')}"
    )
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Title
    pdf.section_title(f"{p1.get('destination', '?')}  vs  {p2.get('destination', '?')}")
    pdf.muted_text(
        f"{params.get('num_days', '?')} days  |  {params.get('family_size', '?')} people  |  "
        f"{(params.get('travel_class') or 'economy').capitalize()} class"
    )
    pdf.spacer(6)

    col_w = (pdf.w - 20 - 2) / 2  # two columns with 2mm gap

    # ── Budget comparison ──────────────────────────────────────
    pdf.section_title("Budget Comparison")
    _comparison_budget_table(pdf, p1, p2, col_w)
    pdf.spacer(6)

    # ── Safety comparison ──────────────────────────────────────
    pdf.section_title("Safety Comparison")
    _comparison_safety_table(pdf, p1, p2, col_w)
    pdf.spacer(6)

    # ── Weather comparison ─────────────────────────────────────
    pdf.section_title("Weather Comparison")
    _comparison_weather_table(pdf, p1, p2, col_w)

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()


def _comparison_budget_table(pdf: TripPDF, p1: dict, p2: dict, col_w: float):
    """Render side-by-side budget table."""
    b1 = p1.get("budget", {})
    b2 = p2.get("budget", {})

    ITEMS = [
        ("Accommodation", "accommodation"),
        ("Food", "food"),
        ("Transport", "transport"),
        ("Activities", "activities"),
        ("Misc", "miscellaneous"),
    ]

    # Header
    pdf.set_fill_color(*PRIMARY)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(60, 7, "  Category", fill=True)
    pdf.cell(col_w - 30, 7, p1.get("destination", "Dest 1"), fill=True, align="R")
    pdf.cell(
        col_w - 30,
        7,
        p2.get("destination", "Dest 2"),
        fill=True,
        align="R",
        new_x="LMARGIN",
        new_y="NEXT",
    )

    alt = False
    for label, key in ITEMS:
        bg = LIGHT_BG if alt else WHITE
        pdf.set_fill_color(*bg)
        pdf.set_text_color(*DARK)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(60, 6, f"  {label}", fill=True)
        v1 = b1.get(key, 0)
        v2 = b2.get(key, 0)
        pdf.cell(col_w - 30, 6, _fmt_inr(v1), fill=True, align="R")
        pdf.cell(
            col_w - 30,
            6,
            _fmt_inr(v2),
            fill=True,
            align="R",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        alt = not alt

    # Totals
    t1 = b1.get("total", 0)
    t2 = b2.get("total", 0)
    pdf.set_fill_color(*DARK)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(60, 7, "  TOTAL", fill=True)

    # Highlight winner in green
    if t1 <= t2:
        pdf.set_text_color(*SUCCESS)
    else:
        pdf.set_text_color(*WHITE)
    pdf.cell(col_w - 30, 7, _fmt_inr(t1), fill=True, align="R")

    if t2 <= t1:
        pdf.set_text_color(*SUCCESS)
    else:
        pdf.set_text_color(*WHITE)
    pdf.cell(
        col_w - 30, 7, _fmt_inr(t2), fill=True, align="R", new_x="LMARGIN", new_y="NEXT"
    )


def _comparison_safety_table(pdf: TripPDF, p1: dict, p2: dict, col_w: float):
    """Render side-by-side safety scores."""
    s1 = p1.get("safety", {})
    s2 = p2.get("safety", {})

    SCORES = [
        ("Overall", "overall_score"),
        ("Crime Safety", "crime_score"),
        ("Health", "health_score"),
        ("Infrastructure", "infrastructure_score"),
        ("Tourist Friendly", "tourist_friendliness"),
    ]

    # Header
    pdf.set_fill_color(*PRIMARY)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(60, 7, "  Metric", fill=True)
    pdf.cell(col_w - 30, 7, p1.get("destination", "Dest 1"), fill=True, align="R")
    pdf.cell(
        col_w - 30,
        7,
        p2.get("destination", "Dest 2"),
        fill=True,
        align="R",
        new_x="LMARGIN",
        new_y="NEXT",
    )

    alt = False
    for label, key in SCORES:
        bg = LIGHT_BG if alt else WHITE
        pdf.set_fill_color(*bg)
        pdf.set_font("Helvetica", "B" if key == "overall_score" else "", 9)
        pdf.set_text_color(*DARK)
        pdf.cell(60, 6, f"  {label}", fill=True)
        v1 = s1.get(key, 0)
        v2 = s2.get(key, 0)
        pdf.set_text_color(*_score_color(v1))
        pdf.cell(col_w - 30, 6, f"{v1}/10", fill=True, align="R")
        pdf.set_text_color(*_score_color(v2))
        pdf.cell(
            col_w - 30,
            6,
            f"{v2}/10",
            fill=True,
            align="R",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        alt = not alt

    # Advisory lines
    for profile in (p1, p2):
        adv = (profile.get("safety") or {}).get("advisory")
        if adv:
            pdf.spacer(2)
            pdf.set_font("Helvetica", "I", 8)
            pdf.set_text_color(*MUTED)
            pdf.multi_cell(0, 4, f"{profile.get('destination', '?')}: {adv}")


def _comparison_weather_table(pdf: TripPDF, p1: dict, p2: dict, col_w: float):
    """Render side-by-side weather data."""
    w1 = p1.get("weather")
    w2 = p2.get("weather")

    if not w1 and not w2:
        pdf.muted_text("Weather data not available.")
        return

    METRICS = [
        ("Temperature", "temperature_c", "°C"),
        ("Feels Like", "feels_like_c", "°C"),
        ("Humidity", "humidity", "%"),
        ("Wind Speed", "wind_speed_kmh", " km/h"),
        ("Conditions", "description", ""),
    ]

    # Header
    pdf.set_fill_color(*PRIMARY)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(60, 7, "  Metric", fill=True)
    pdf.cell(col_w - 30, 7, p1.get("destination", "Dest 1"), fill=True, align="R")
    pdf.cell(
        col_w - 30,
        7,
        p2.get("destination", "Dest 2"),
        fill=True,
        align="R",
        new_x="LMARGIN",
        new_y="NEXT",
    )

    alt = False
    for label, key, suffix in METRICS:
        bg = LIGHT_BG if alt else WHITE
        pdf.set_fill_color(*bg)
        pdf.set_text_color(*DARK)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(60, 6, f"  {label}", fill=True)

        for w in (w1, w2):
            if w:
                val = w.get(key, "N/A")
                pdf.cell(col_w - 30, 6, f"{val}{suffix}", fill=True, align="R")
            else:
                pdf.set_text_color(*MUTED)
                pdf.cell(col_w - 30, 6, "N/A", fill=True, align="R")
                pdf.set_text_color(*DARK)
        pdf.ln()
        alt = not alt


# ═══════════════════════════════════════════════════════════════════════════
# Utilities
# ═══════════════════════════════════════════════════════════════════════════


def _fmt_inr(val) -> str:
    """Format a number as ₹ Indian Rupees with commas."""
    try:
        n = float(val)
        return f"Rs {n:,.0f}"
    except (TypeError, ValueError):
        return "Rs 0"


def _score_color(val) -> tuple:
    """Return RGB tuple based on safety score (0-10)."""
    try:
        v = float(val)
    except (TypeError, ValueError):
        return MUTED
    if v >= 7:
        return SUCCESS
    if v >= 4:
        return WARNING
    return DANGER

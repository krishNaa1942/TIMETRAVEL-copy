"""
Language Phrases Service
=========================
Generates helpful local language phrases for Indian destinations using
Gemini AI, with a fallback static phrase book for common phrases.

Usage:
    get_phrases("Jaipur")  →  [{"phrase": "Namaste", "meaning": "Hello", ...}, ...]
"""

import logging
import time

from app.utils.constants import DESTINATIONS

logger = logging.getLogger(__name__)

# ── In-memory cache (24-hour TTL) ──────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 86400

# ── Map language names to scripts ──────────────────────────────────────
_LANG_SCRIPTS = {
    "Hindi": "Devanagari",
    "Marathi": "Devanagari",
    "Nepali": "Devanagari",
    "Konkani": "Devanagari",
    "Sanskrit": "Devanagari",
    "Dogri": "Devanagari",
    "Maithili": "Devanagari",
    "Bodo": "Devanagari",
    "Rajasthani": "Devanagari",
    "Malayalam": "Malayalam",
    "Tamil": "Tamil",
    "Kannada": "Kannada",
    "Telugu": "Telugu",
    "Punjabi": "Gurmukhi",
    "Bengali": "Bengali",
    "Assamese": "Assamese",
    "Odia": "Odia",
    "Gujarati": "Gujarati",
    "Urdu": "Nastaliq",
    "Kashmiri": "Nastaliq",
    "Mizo": "Latin",
    "Khasi": "Latin",
    "Garo": "Latin",
    "English": "Latin",
    "Ladakhi": "Tibetan",
    "Kokborok": "Bengali",
    "Manipuri": "Meetei Mayek",
    "Sikkimese": "Tibetan",
    "Bhutia": "Tibetan",
    "Kodava": "Kannada",
    "Tulu": "Kannada",
    "Badaga": "Kannada",
}


def _build_dest_languages() -> dict:
    """Build destination → language info from DESTINATIONS registry."""
    result = {}
    for key, d in DESTINATIONS.items():
        langs = d.get("languages", ["Hindi"])
        primary = langs[0] if langs else "Hindi"
        secondary = langs[1] if len(langs) > 1 else None
        result[key] = {
            "language": primary,
            "script": _LANG_SCRIPTS.get(primary, "Devanagari"),
            "secondary": secondary,
        }
    return result


DEST_LANGUAGES = _build_dest_languages()

# ── Static fallback phrase book (common travel phrases) ─────────────────
_FALLBACK_PHRASES = {
    "Hindi": [
        {
            "phrase": "Namaste",
            "transliteration": "Namaste",
            "meaning": "Hello / Greetings",
            "usage": "Universal greeting, fold hands together",
        },
        {
            "phrase": "Dhanyavaad",
            "transliteration": "Dhanyavaad",
            "meaning": "Thank you",
            "usage": "Formal thanks",
        },
        {
            "phrase": "Haan / Nahi",
            "transliteration": "Haan / Nahi",
            "meaning": "Yes / No",
            "usage": "Basic affirmation/negation",
        },
        {
            "phrase": "Kitna hai?",
            "transliteration": "Kitna hai?",
            "meaning": "How much does it cost?",
            "usage": "Shopping, auto-rickshaw negotiations",
        },
        {
            "phrase": "Kahan hai?",
            "transliteration": "Kahan hai?",
            "meaning": "Where is it?",
            "usage": "Asking for directions",
        },
        {
            "phrase": "Paani chahiye",
            "transliteration": "Paani chahiye",
            "meaning": "I need water",
            "usage": "Restaurants, hotels",
        },
        {
            "phrase": "Madad kijiye",
            "transliteration": "Madad kijiye",
            "meaning": "Please help",
            "usage": "Asking for assistance",
        },
        {
            "phrase": "Bahut accha!",
            "transliteration": "Bahut accha!",
            "meaning": "Very good!",
            "usage": "Expressing appreciation",
        },
        {
            "phrase": "Station kahan hai?",
            "transliteration": "Station kahan hai?",
            "meaning": "Where is the station?",
            "usage": "Finding transport",
        },
        {
            "phrase": "Bill de dijiye",
            "transliteration": "Bill de dijiye",
            "meaning": "Please give the bill",
            "usage": "At restaurants",
        },
    ],
    "Malayalam": [
        {
            "phrase": "Namaskaaram",
            "transliteration": "Namaskaaram",
            "meaning": "Hello",
            "usage": "Formal greeting",
        },
        {
            "phrase": "Nanni",
            "transliteration": "Nanni",
            "meaning": "Thank you",
            "usage": "Expressing gratitude",
        },
        {
            "phrase": "Athe / Alla",
            "transliteration": "Athe / Alla",
            "meaning": "Yes / No",
            "usage": "Basic responses",
        },
        {
            "phrase": "Ithenthaanu vila?",
            "transliteration": "Ithenthaanu vila?",
            "meaning": "How much?",
            "usage": "Shopping",
        },
        {
            "phrase": "Evide aanu?",
            "transliteration": "Evide aanu?",
            "meaning": "Where is it?",
            "usage": "Directions",
        },
        {
            "phrase": "Vellam venam",
            "transliteration": "Vellam venam",
            "meaning": "I need water",
            "usage": "Restaurants",
        },
        {
            "phrase": "Sahayikkoo",
            "transliteration": "Sahayikkoo",
            "meaning": "Please help",
            "usage": "Emergencies",
        },
        {
            "phrase": "Kollaam!",
            "transliteration": "Kollaam!",
            "meaning": "Great / Nice!",
            "usage": "Appreciation",
        },
    ],
    "Tamil": [
        {
            "phrase": "Vanakkam",
            "transliteration": "Vanakkam",
            "meaning": "Hello",
            "usage": "Universal greeting",
        },
        {
            "phrase": "Nandri",
            "transliteration": "Nandri",
            "meaning": "Thank you",
            "usage": "Expressing thanks",
        },
        {
            "phrase": "Aamaa / Illai",
            "transliteration": "Aamaa / Illai",
            "meaning": "Yes / No",
            "usage": "Basic responses",
        },
        {
            "phrase": "Evvalavu?",
            "transliteration": "Evvalavu?",
            "meaning": "How much?",
            "usage": "Shopping, bargaining",
        },
        {
            "phrase": "Enga irukku?",
            "transliteration": "Enga irukku?",
            "meaning": "Where is it?",
            "usage": "Asking directions",
        },
        {
            "phrase": "Thanni venum",
            "transliteration": "Thanni venum",
            "meaning": "I need water",
            "usage": "Restaurants",
        },
        {
            "phrase": "Udavi seiyu",
            "transliteration": "Udavi seiyu",
            "meaning": "Please help",
            "usage": "Emergencies",
        },
        {
            "phrase": "Romba nallaa irukku!",
            "transliteration": "Romba nallaa irukku!",
            "meaning": "Very nice!",
            "usage": "Appreciation",
        },
    ],
    "Kannada": [
        {
            "phrase": "Namaskara",
            "transliteration": "Namaskara",
            "meaning": "Hello",
            "usage": "Formal greeting",
        },
        {
            "phrase": "Dhanyavaadagalu",
            "transliteration": "Dhanyavaadagalu",
            "meaning": "Thank you",
            "usage": "Expressing gratitude",
        },
        {
            "phrase": "Howdu / Illa",
            "transliteration": "Howdu / Illa",
            "meaning": "Yes / No",
            "usage": "Basic responses",
        },
        {
            "phrase": "Eshtu?",
            "transliteration": "Eshtu?",
            "meaning": "How much?",
            "usage": "Shopping",
        },
        {
            "phrase": "Elli ide?",
            "transliteration": "Elli ide?",
            "meaning": "Where is it?",
            "usage": "Directions",
        },
        {
            "phrase": "Neeru beku",
            "transliteration": "Neeru beku",
            "meaning": "I need water",
            "usage": "Restaurants",
        },
        {
            "phrase": "Sahaya maadi",
            "transliteration": "Sahaya maadi",
            "meaning": "Please help",
            "usage": "Emergencies",
        },
        {
            "phrase": "Tumba chennagide!",
            "transliteration": "Tumba chennagide!",
            "meaning": "Very nice!",
            "usage": "Appreciation",
        },
    ],
    "Punjabi": [
        {
            "phrase": "Sat Sri Akaal",
            "transliteration": "Sat Sri Akaal",
            "meaning": "Hello (Sikh greeting)",
            "usage": "Universal greeting in Punjab",
        },
        {
            "phrase": "Dhannvaad",
            "transliteration": "Dhannvaad",
            "meaning": "Thank you",
            "usage": "Expressing gratitude",
        },
        {
            "phrase": "Haanji / Nahi",
            "transliteration": "Haanji / Nahi",
            "meaning": "Yes / No",
            "usage": "Basic responses",
        },
        {
            "phrase": "Kinne da?",
            "transliteration": "Kinne da?",
            "meaning": "How much?",
            "usage": "Shopping",
        },
        {
            "phrase": "Kithe hai?",
            "transliteration": "Kithe hai?",
            "meaning": "Where is it?",
            "usage": "Directions",
        },
        {
            "phrase": "Paani chahida",
            "transliteration": "Paani chahida",
            "meaning": "I need water",
            "usage": "Restaurants",
        },
        {
            "phrase": "Madad karo ji",
            "transliteration": "Madad karo ji",
            "meaning": "Please help",
            "usage": "Emergencies",
        },
        {
            "phrase": "Bahut vadiya!",
            "transliteration": "Bahut vadiya!",
            "meaning": "Very nice!",
            "usage": "Appreciation",
        },
    ],
    "Nepali": [
        {
            "phrase": "Namaste",
            "transliteration": "Namaste",
            "meaning": "Hello",
            "usage": "Universal greeting",
        },
        {
            "phrase": "Dhanyabaad",
            "transliteration": "Dhanyabaad",
            "meaning": "Thank you",
            "usage": "Expressing thanks",
        },
        {
            "phrase": "Ho / Hoina",
            "transliteration": "Ho / Hoina",
            "meaning": "Yes / No",
            "usage": "Basic responses",
        },
        {
            "phrase": "Kati ho?",
            "transliteration": "Kati ho?",
            "meaning": "How much?",
            "usage": "Shopping",
        },
        {
            "phrase": "Kaha chha?",
            "transliteration": "Kaha chha?",
            "meaning": "Where is it?",
            "usage": "Directions",
        },
        {
            "phrase": "Paani dinus",
            "transliteration": "Paani dinus",
            "meaning": "Please give water",
            "usage": "Restaurants",
        },
        {
            "phrase": "Sahayog garnus",
            "transliteration": "Sahayog garnus",
            "meaning": "Please help",
            "usage": "Emergencies",
        },
        {
            "phrase": "Ramro chha!",
            "transliteration": "Ramro chha!",
            "meaning": "It's nice!",
            "usage": "Appreciation",
        },
    ],
    "Konkani": [
        {
            "phrase": "Dev bare korum",
            "transliteration": "Dev bare korum",
            "meaning": "God bless (greeting)",
            "usage": "Traditional Goan greeting",
        },
        {
            "phrase": "Dev borem korum",
            "transliteration": "Dev borem korum",
            "meaning": "Thank you / God bless",
            "usage": "Expressing gratitude",
        },
        {
            "phrase": "Hoy / Na",
            "transliteration": "Hoy / Na",
            "meaning": "Yes / No",
            "usage": "Basic responses",
        },
        {
            "phrase": "Kitlem?",
            "transliteration": "Kitlem?",
            "meaning": "How much?",
            "usage": "Shopping",
        },
        {
            "phrase": "Khuim asa?",
            "transliteration": "Khuim asa?",
            "meaning": "Where is it?",
            "usage": "Directions",
        },
        {
            "phrase": "Udok zai",
            "transliteration": "Udok zai",
            "meaning": "I need water",
            "usage": "Restaurants",
        },
        {
            "phrase": "Bore disa!",
            "transliteration": "Bore disa!",
            "meaning": "Good day!",
            "usage": "Friendly farewell",
        },
    ],
    "Marathi": [
        {
            "phrase": "Namaskar",
            "transliteration": "Namaskar",
            "meaning": "Hello",
            "usage": "Formal greeting",
        },
        {
            "phrase": "Dhanyavaad",
            "transliteration": "Dhanyavaad",
            "meaning": "Thank you",
            "usage": "Expressing gratitude",
        },
        {
            "phrase": "Ho / Nahi",
            "transliteration": "Ho / Nahi",
            "meaning": "Yes / No",
            "usage": "Basic responses",
        },
        {
            "phrase": "Kiti?",
            "transliteration": "Kiti?",
            "meaning": "How much?",
            "usage": "Shopping",
        },
        {
            "phrase": "Kuthe aahe?",
            "transliteration": "Kuthe aahe?",
            "meaning": "Where is it?",
            "usage": "Directions",
        },
        {
            "phrase": "Paani hava",
            "transliteration": "Paani hava",
            "meaning": "I need water",
            "usage": "Restaurants",
        },
        {
            "phrase": "Khup chhan!",
            "transliteration": "Khup chhan!",
            "meaning": "Very nice!",
            "usage": "Appreciation",
        },
    ],
    "Ladakhi": [
        {
            "phrase": "Julley",
            "transliteration": "Julley",
            "meaning": "Hello / Goodbye / Thank you",
            "usage": "Universal Ladakhi greeting — works for everything",
        },
        {
            "phrase": "Jule-jule",
            "transliteration": "Jule-jule",
            "meaning": "Thank you very much",
            "usage": "Expressing deep gratitude",
        },
        {
            "phrase": "Yin / Man",
            "transliteration": "Yin / Man",
            "meaning": "Yes / No",
            "usage": "Basic responses",
        },
        {
            "phrase": "Tsam-mo in-nok?",
            "transliteration": "Tsam-mo in-nok?",
            "meaning": "How much?",
            "usage": "Shopping",
        },
        {
            "phrase": "Ka-ru in-nok?",
            "transliteration": "Ka-ru in-nok?",
            "meaning": "Where is it?",
            "usage": "Directions",
        },
        {
            "phrase": "Chu tong",
            "transliteration": "Chu tong",
            "meaning": "Give water",
            "usage": "Requesting water",
        },
    ],
    "Kodava": [
        {
            "phrase": "Namaskara",
            "transliteration": "Namaskara",
            "meaning": "Hello",
            "usage": "Formal greeting",
        },
        {
            "phrase": "Nanni",
            "transliteration": "Nanni",
            "meaning": "Thank you",
            "usage": "Expressing thanks",
        },
        {
            "phrase": "Howdu / Alla",
            "transliteration": "Howdu / Alla",
            "meaning": "Yes / No",
            "usage": "Basic responses",
        },
        {
            "phrase": "Eshtu?",
            "transliteration": "Eshtu?",
            "meaning": "How much?",
            "usage": "Shopping",
        },
    ],
}


def get_phrases(destination: str) -> dict:
    """
    Get useful local language phrases for a destination.

    Returns:
        {
            "destination": "Jaipur",
            "language": "Hindi",
            "script": "Devanagari",
            "secondary": "Rajasthani",
            "phrases": [ { "phrase", "transliteration", "meaning", "usage" }, ... ],
            "travel_tips": [ "..." ]
        }
    """
    key = destination.lower().strip().replace(" ", "_").replace("-", "_")

    # Check cache
    if key in _cache and (time.time() - _cache[key]["ts"]) < CACHE_TTL:
        return _cache[key]["data"]

    lang_info = DEST_LANGUAGES.get(
        key, {"language": "Hindi", "script": "Devanagari", "secondary": None}
    )
    language = lang_info["language"]

    phrases = _FALLBACK_PHRASES.get(language, _FALLBACK_PHRASES["Hindi"])

    travel_tips = _get_language_tips(language, key)

    result = {
        "destination": destination,
        "language": language,
        "script": lang_info["script"],
        "secondary": lang_info["secondary"],
        "phrases": phrases,
        "travel_tips": travel_tips,
    }

    _cache[key] = {"ts": time.time(), "data": result}
    return result


def _get_language_tips(language: str, dest_key: str) -> list:
    """Return contextual language tips for the destination."""
    tips = []

    if language == "Hindi":
        tips.append(
            "Hindi is widely understood across North India. Speaking even basic phrases earns warmth from locals."
        )
        tips.append(
            "'Ji' added after words shows respect (e.g., 'Haanji' = Yes sir/ma'am)."
        )
    elif language == "Malayalam":
        tips.append(
            "Malayalam is one of the most complex Indian languages. Locals deeply appreciate any attempt to speak it."
        )
        tips.append("English is widely spoken in Kerala's tourist areas.")
    elif language == "Tamil":
        tips.append(
            "Tamil is one of the world's oldest living languages. Locals take great pride in it."
        )
        tips.append("Adding 'ga' at the end makes phrases more polite.")
    elif language == "Kannada":
        tips.append(
            "Kannada has its own unique script. Locals are very friendly to tourists who try basic phrases."
        )
    elif language == "Punjabi":
        tips.append(
            "Punjabis are known for their warmth and hospitality. 'Sat Sri Akaal' opens all doors."
        )
        tips.append("'Paaji' (brother) is a common friendly term of address.")
    elif language == "Nepali":
        tips.append("Nepali is the lingua franca in Darjeeling and surrounding hills.")
        tips.append(
            "'Dai' (elder brother) and 'Didi' (elder sister) are respectful terms of address."
        )
    elif language == "Konkani":
        tips.append(
            "Goa is multilingual — Konkani, Hindi, English, and Portuguese influences blend together."
        )
        tips.append("Many Goans speak excellent English, especially in tourist areas.")
    elif language == "Ladakhi":
        tips.append(
            "'Julley' is the magic word in Ladakh — it means hello, goodbye, and thank you all at once!"
        )
        tips.append(
            "Many young Ladakhis speak Hindi and English. Older locals may prefer Ladakhi."
        )
    elif language == "Marathi":
        tips.append(
            "Marathi is the state language of Maharashtra. 'Namaskar' is more formal than 'Namaste'."
        )

    tips.append(
        "Google Translate can help in real-time — download the language pack offline before your trip."
    )
    tips.append(
        "A smile and polite body language work universally, even without shared language."
    )

    return tips


def get_supported_destinations() -> list:
    """Return all destinations that have language phrase support."""
    return sorted(
        [
            {
                "key": k,
                "label": DESTINATIONS[k]["label"],
                "language": v["language"],
                "script": v["script"],
            }
            for k, v in DEST_LANGUAGES.items()
        ],
        key=lambda x: x["label"],
    )

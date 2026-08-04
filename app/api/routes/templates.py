"""
Trip Templates API – Pre-built itinerary templates users can browse and clone.
"""

import json
from datetime import date, timedelta

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from app.models.database import db
from app.models.entities import Trip, TripDay, TripTemplate

templates_bp = Blueprint("templates", __name__, url_prefix="/api/templates")


# ── Pre-built template data ─────────────────────────────────────────────

BUILTIN_TEMPLATES = [
    {
        "title": "Romantic Goa Getaway",
        "destination": "Goa",
        "num_days": 4,
        "category": "honeymoon",
        "description": "Sun-kissed beaches, candlelit dinners & water sports — the perfect romantic escape for couples.",
        "template_json": json.dumps(
            {
                "days": [
                    {
                        "day": 1,
                        "title": "Beach & Sunset",
                        "places": [
                            {
                                "name": "Baga Beach",
                                "category": "beach",
                                "start_time": "09:00",
                                "duration_minutes": 180,
                                "notes": "Morning swim & sunbathing",
                            },
                            {
                                "name": "Thalassa Restaurant",
                                "category": "restaurant",
                                "start_time": "13:00",
                                "duration_minutes": 90,
                                "notes": "Greek cuisine with sea views",
                            },
                            {
                                "name": "Chapora Fort",
                                "category": "attraction",
                                "start_time": "16:30",
                                "duration_minutes": 90,
                                "notes": "Sunset viewpoint — iconic 'Dil Chahta Hai' spot",
                            },
                        ],
                    },
                    {
                        "day": 2,
                        "title": "Old Goa Heritage",
                        "places": [
                            {
                                "name": "Basilica of Bom Jesus",
                                "category": "attraction",
                                "start_time": "09:30",
                                "duration_minutes": 60,
                                "notes": "UNESCO World Heritage Site",
                            },
                            {
                                "name": "Se Cathedral",
                                "category": "attraction",
                                "start_time": "11:00",
                                "duration_minutes": 45,
                            },
                            {
                                "name": "Fontainhas Latin Quarter",
                                "category": "attraction",
                                "start_time": "14:00",
                                "duration_minutes": 120,
                                "notes": "Colorful Portuguese quarter walk",
                            },
                            {
                                "name": "Mango Tree Restaurant",
                                "category": "restaurant",
                                "start_time": "19:00",
                                "duration_minutes": 90,
                            },
                        ],
                    },
                    {
                        "day": 3,
                        "title": "Water Sports & Spice",
                        "places": [
                            {
                                "name": "Calangute Water Sports",
                                "category": "activity",
                                "start_time": "09:00",
                                "duration_minutes": 180,
                                "notes": "Parasailing, jet ski, banana boat",
                            },
                            {
                                "name": "Sahakari Spice Farm",
                                "category": "attraction",
                                "start_time": "14:30",
                                "duration_minutes": 120,
                                "notes": "Spice farm tour with traditional lunch",
                            },
                        ],
                    },
                    {
                        "day": 4,
                        "title": "South Goa Chill",
                        "places": [
                            {
                                "name": "Palolem Beach",
                                "category": "beach",
                                "start_time": "09:00",
                                "duration_minutes": 240,
                                "notes": "Crescent-shaped beach — swim, kayak, relax",
                            },
                            {
                                "name": "Cabo de Rama Fort",
                                "category": "attraction",
                                "start_time": "15:00",
                                "duration_minutes": 90,
                            },
                        ],
                    },
                ]
            }
        ),
    },
    {
        "title": "Golden Triangle Classic",
        "destination": "Delhi",
        "num_days": 5,
        "category": "family",
        "description": "Delhi → Agra → Jaipur circuit — perfect first-time India tour for families.",
        "template_json": json.dumps(
            {
                "days": [
                    {
                        "day": 1,
                        "title": "Delhi Highlights",
                        "places": [
                            {
                                "name": "Red Fort",
                                "category": "attraction",
                                "start_time": "09:00",
                                "duration_minutes": 120,
                            },
                            {
                                "name": "Jama Masjid",
                                "category": "attraction",
                                "start_time": "12:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Chandni Chowk",
                                "category": "shopping",
                                "start_time": "13:30",
                                "duration_minutes": 120,
                                "notes": "Street food walk — paranthe wali gali",
                            },
                            {
                                "name": "India Gate",
                                "category": "attraction",
                                "start_time": "17:00",
                                "duration_minutes": 60,
                            },
                        ],
                    },
                    {
                        "day": 2,
                        "title": "Delhi Museums & Markets",
                        "places": [
                            {
                                "name": "Humayun's Tomb",
                                "category": "attraction",
                                "start_time": "09:00",
                                "duration_minutes": 90,
                            },
                            {
                                "name": "Lotus Temple",
                                "category": "attraction",
                                "start_time": "11:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Qutub Minar",
                                "category": "attraction",
                                "start_time": "14:00",
                                "duration_minutes": 90,
                            },
                            {
                                "name": "Dilli Haat",
                                "category": "shopping",
                                "start_time": "17:00",
                                "duration_minutes": 120,
                            },
                        ],
                    },
                    {
                        "day": 3,
                        "title": "Agra – Taj Mahal",
                        "places": [
                            {
                                "name": "Drive to Agra",
                                "category": "transport",
                                "start_time": "06:00",
                                "duration_minutes": 240,
                            },
                            {
                                "name": "Taj Mahal",
                                "category": "attraction",
                                "start_time": "11:00",
                                "duration_minutes": 180,
                                "notes": "The crown jewel — arrive early for best photos",
                            },
                            {
                                "name": "Agra Fort",
                                "category": "attraction",
                                "start_time": "15:00",
                                "duration_minutes": 120,
                            },
                            {
                                "name": "Mehtab Bagh",
                                "category": "attraction",
                                "start_time": "17:30",
                                "duration_minutes": 60,
                                "notes": "Sunset view of Taj Mahal",
                            },
                        ],
                    },
                    {
                        "day": 4,
                        "title": "Jaipur – Pink City",
                        "places": [
                            {
                                "name": "Drive to Jaipur",
                                "category": "transport",
                                "start_time": "07:00",
                                "duration_minutes": 300,
                            },
                            {
                                "name": "Amber Fort",
                                "category": "attraction",
                                "start_time": "14:00",
                                "duration_minutes": 150,
                            },
                            {
                                "name": "Jal Mahal",
                                "category": "attraction",
                                "start_time": "17:00",
                                "duration_minutes": 30,
                            },
                        ],
                    },
                    {
                        "day": 5,
                        "title": "Jaipur City Tour",
                        "places": [
                            {
                                "name": "Hawa Mahal",
                                "category": "attraction",
                                "start_time": "09:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "City Palace",
                                "category": "attraction",
                                "start_time": "10:30",
                                "duration_minutes": 120,
                            },
                            {
                                "name": "Jantar Mantar",
                                "category": "attraction",
                                "start_time": "13:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Johari Bazaar",
                                "category": "shopping",
                                "start_time": "15:00",
                                "duration_minutes": 120,
                                "notes": "Famous for jewellery and textiles",
                            },
                        ],
                    },
                ]
            }
        ),
    },
    {
        "title": "Kerala Backwaters Bliss",
        "destination": "Kerala",
        "num_days": 5,
        "category": "honeymoon",
        "description": "Houseboat cruises, tea plantations & Ayurvedic spa — God's Own Country at its finest.",
        "template_json": json.dumps(
            {
                "days": [
                    {
                        "day": 1,
                        "title": "Kochi Heritage",
                        "places": [
                            {
                                "name": "Fort Kochi",
                                "category": "attraction",
                                "start_time": "09:00",
                                "duration_minutes": 180,
                            },
                            {
                                "name": "Chinese Fishing Nets",
                                "category": "attraction",
                                "start_time": "13:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Kathakali Show",
                                "category": "activity",
                                "start_time": "18:00",
                                "duration_minutes": 120,
                            },
                        ],
                    },
                    {
                        "day": 2,
                        "title": "Munnar Tea Gardens",
                        "places": [
                            {
                                "name": "Drive to Munnar",
                                "category": "transport",
                                "start_time": "07:00",
                                "duration_minutes": 240,
                            },
                            {
                                "name": "Tea Museum",
                                "category": "attraction",
                                "start_time": "13:00",
                                "duration_minutes": 90,
                            },
                            {
                                "name": "Mattupetty Dam",
                                "category": "attraction",
                                "start_time": "15:30",
                                "duration_minutes": 90,
                            },
                        ],
                    },
                    {
                        "day": 3,
                        "title": "Munnar Nature",
                        "places": [
                            {
                                "name": "Eravikulam National Park",
                                "category": "attraction",
                                "start_time": "08:00",
                                "duration_minutes": 180,
                            },
                            {
                                "name": "Top Station",
                                "category": "attraction",
                                "start_time": "13:00",
                                "duration_minutes": 120,
                            },
                        ],
                    },
                    {
                        "day": 4,
                        "title": "Alleppey Houseboat",
                        "places": [
                            {
                                "name": "Drive to Alleppey",
                                "category": "transport",
                                "start_time": "08:00",
                                "duration_minutes": 240,
                            },
                            {
                                "name": "Houseboat Check-in",
                                "category": "activity",
                                "start_time": "13:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Backwater Cruise",
                                "category": "activity",
                                "start_time": "14:00",
                                "duration_minutes": 300,
                                "notes": "Overnight on the houseboat — watch sunset from deck",
                            },
                        ],
                    },
                    {
                        "day": 5,
                        "title": "Kovalam Beach",
                        "places": [
                            {
                                "name": "Drive to Kovalam",
                                "category": "transport",
                                "start_time": "08:00",
                                "duration_minutes": 240,
                            },
                            {
                                "name": "Lighthouse Beach",
                                "category": "beach",
                                "start_time": "14:00",
                                "duration_minutes": 180,
                            },
                            {
                                "name": "Ayurvedic Spa",
                                "category": "activity",
                                "start_time": "17:30",
                                "duration_minutes": 120,
                            },
                        ],
                    },
                ]
            }
        ),
    },
    {
        "title": "Adventure in Manali",
        "destination": "Manali",
        "num_days": 4,
        "category": "adventure",
        "description": "River rafting, trekking, paragliding & snow — adrenaline rush in the Himalayas.",
        "template_json": json.dumps(
            {
                "days": [
                    {
                        "day": 1,
                        "title": "Arrival & Old Manali",
                        "places": [
                            {
                                "name": "Hadimba Temple",
                                "category": "attraction",
                                "start_time": "10:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Old Manali Walk",
                                "category": "activity",
                                "start_time": "14:00",
                                "duration_minutes": 180,
                                "notes": "Explore cafes, shops & Manu Temple",
                            },
                            {
                                "name": "Mall Road",
                                "category": "shopping",
                                "start_time": "18:00",
                                "duration_minutes": 120,
                            },
                        ],
                    },
                    {
                        "day": 2,
                        "title": "Solang Valley Adventure",
                        "places": [
                            {
                                "name": "Solang Valley",
                                "category": "activity",
                                "start_time": "08:00",
                                "duration_minutes": 300,
                                "notes": "Paragliding, zorbing, rope-way, snow activities",
                            },
                            {
                                "name": "Atal Tunnel",
                                "category": "attraction",
                                "start_time": "15:00",
                                "duration_minutes": 60,
                            },
                        ],
                    },
                    {
                        "day": 3,
                        "title": "River Rafting & Rohtang",
                        "places": [
                            {
                                "name": "Beas River Rafting",
                                "category": "activity",
                                "start_time": "08:00",
                                "duration_minutes": 180,
                                "notes": "Grade 2–3 rapids — exhilarating!",
                            },
                            {
                                "name": "Rohtang Pass",
                                "category": "attraction",
                                "start_time": "13:00",
                                "duration_minutes": 240,
                                "notes": "Permit required — snow play & stunning views",
                            },
                        ],
                    },
                    {
                        "day": 4,
                        "title": "Naggar & Departure",
                        "places": [
                            {
                                "name": "Naggar Castle",
                                "category": "attraction",
                                "start_time": "09:00",
                                "duration_minutes": 90,
                            },
                            {
                                "name": "Roerich Art Gallery",
                                "category": "attraction",
                                "start_time": "11:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Jana Waterfalls",
                                "category": "attraction",
                                "start_time": "13:00",
                                "duration_minutes": 60,
                            },
                        ],
                    },
                ]
            }
        ),
    },
    {
        "title": "Spiritual Varanasi",
        "destination": "Varanasi",
        "num_days": 3,
        "category": "cultural",
        "description": "Ancient ghats, Ganga aarti & spiritual awakening in India's holiest city.",
        "template_json": json.dumps(
            {
                "days": [
                    {
                        "day": 1,
                        "title": "Ghats & Temples",
                        "places": [
                            {
                                "name": "Kashi Vishwanath Temple",
                                "category": "attraction",
                                "start_time": "06:00",
                                "duration_minutes": 90,
                            },
                            {
                                "name": "Dashashwamedh Ghat",
                                "category": "attraction",
                                "start_time": "08:00",
                                "duration_minutes": 120,
                                "notes": "Boat ride along the ghats",
                            },
                            {
                                "name": "Manikarnika Ghat",
                                "category": "attraction",
                                "start_time": "11:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Ganga Aarti",
                                "category": "activity",
                                "start_time": "18:30",
                                "duration_minutes": 60,
                                "notes": "Mesmerizing evening ceremony — arrive early for best view",
                            },
                        ],
                    },
                    {
                        "day": 2,
                        "title": "Sarnath & Culture",
                        "places": [
                            {
                                "name": "Sarnath",
                                "category": "attraction",
                                "start_time": "08:00",
                                "duration_minutes": 180,
                                "notes": "Where Buddha gave his first sermon",
                            },
                            {
                                "name": "BHU & Bharat Kala Bhavan",
                                "category": "attraction",
                                "start_time": "14:00",
                                "duration_minutes": 120,
                            },
                            {
                                "name": "Assi Ghat",
                                "category": "attraction",
                                "start_time": "17:00",
                                "duration_minutes": 90,
                            },
                        ],
                    },
                    {
                        "day": 3,
                        "title": "Sunrise & Streets",
                        "places": [
                            {
                                "name": "Sunrise Boat Ride",
                                "category": "activity",
                                "start_time": "05:30",
                                "duration_minutes": 90,
                                "notes": "Magical sunrise over the Ganges",
                            },
                            {
                                "name": "Vishwanath Gali",
                                "category": "shopping",
                                "start_time": "10:00",
                                "duration_minutes": 120,
                                "notes": "Silk sarees, silver jewellery & street food",
                            },
                            {
                                "name": "Ramnagar Fort",
                                "category": "attraction",
                                "start_time": "14:00",
                                "duration_minutes": 120,
                            },
                        ],
                    },
                ]
            }
        ),
    },
    {
        "title": "Royal Rajasthan Circuit",
        "destination": "Udaipur",
        "num_days": 5,
        "category": "luxury",
        "description": "Palace stays, desert safaris & lake sunsets — experience the grandeur of royal Rajasthan.",
        "template_json": json.dumps(
            {
                "days": [
                    {
                        "day": 1,
                        "title": "City of Lakes",
                        "places": [
                            {
                                "name": "City Palace",
                                "category": "attraction",
                                "start_time": "09:00",
                                "duration_minutes": 150,
                            },
                            {
                                "name": "Lake Pichola Boat Ride",
                                "category": "activity",
                                "start_time": "12:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Jag Mandir",
                                "category": "attraction",
                                "start_time": "14:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Ambrai Ghat Sunset",
                                "category": "attraction",
                                "start_time": "17:30",
                                "duration_minutes": 60,
                            },
                        ],
                    },
                    {
                        "day": 2,
                        "title": "Temples & Gardens",
                        "places": [
                            {
                                "name": "Saheliyon Ki Bari",
                                "category": "attraction",
                                "start_time": "09:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Jagdish Temple",
                                "category": "attraction",
                                "start_time": "10:30",
                                "duration_minutes": 45,
                            },
                            {
                                "name": "Fateh Sagar Lake",
                                "category": "attraction",
                                "start_time": "14:00",
                                "duration_minutes": 90,
                            },
                            {
                                "name": "Bagore Ki Haveli",
                                "category": "activity",
                                "start_time": "19:00",
                                "duration_minutes": 90,
                                "notes": "Evening Rajasthani dance show",
                            },
                        ],
                    },
                    {
                        "day": 3,
                        "title": "Kumbhalgarh Excursion",
                        "places": [
                            {
                                "name": "Drive to Kumbhalgarh",
                                "category": "transport",
                                "start_time": "08:00",
                                "duration_minutes": 120,
                            },
                            {
                                "name": "Kumbhalgarh Fort",
                                "category": "attraction",
                                "start_time": "10:30",
                                "duration_minutes": 180,
                                "notes": "Second longest wall in the world after Great Wall of China",
                            },
                            {
                                "name": "Ranakpur Jain Temple",
                                "category": "attraction",
                                "start_time": "15:00",
                                "duration_minutes": 90,
                            },
                        ],
                    },
                    {
                        "day": 4,
                        "title": "Chittorgarh",
                        "places": [
                            {
                                "name": "Drive to Chittorgarh",
                                "category": "transport",
                                "start_time": "08:00",
                                "duration_minutes": 150,
                            },
                            {
                                "name": "Chittorgarh Fort",
                                "category": "attraction",
                                "start_time": "11:00",
                                "duration_minutes": 240,
                                "notes": "Largest fort in India — Padmavati legend",
                            },
                        ],
                    },
                    {
                        "day": 5,
                        "title": "Markets & Departure",
                        "places": [
                            {
                                "name": "Hathi Pol Bazaar",
                                "category": "shopping",
                                "start_time": "10:00",
                                "duration_minutes": 120,
                                "notes": "Miniature paintings, handicrafts, textiles",
                            },
                            {
                                "name": "Vintage Car Museum",
                                "category": "attraction",
                                "start_time": "13:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Monsoon Palace (Sajjangarh)",
                                "category": "attraction",
                                "start_time": "16:00",
                                "duration_minutes": 90,
                            },
                        ],
                    },
                ]
            }
        ),
    },
    {
        "title": "Budget Backpacker Shimla-Manali",
        "destination": "Shimla",
        "num_days": 5,
        "category": "budget",
        "description": "Hill stations on a shoestring — hostels, local food & mountain vibes.",
        "template_json": json.dumps(
            {
                "days": [
                    {
                        "day": 1,
                        "title": "Shimla Arrival",
                        "places": [
                            {
                                "name": "The Ridge",
                                "category": "attraction",
                                "start_time": "14:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Christ Church",
                                "category": "attraction",
                                "start_time": "15:30",
                                "duration_minutes": 30,
                            },
                            {
                                "name": "Mall Road Walk",
                                "category": "activity",
                                "start_time": "17:00",
                                "duration_minutes": 120,
                            },
                        ],
                    },
                    {
                        "day": 2,
                        "title": "Shimla Explore",
                        "places": [
                            {
                                "name": "Jakhoo Temple",
                                "category": "attraction",
                                "start_time": "08:00",
                                "duration_minutes": 120,
                                "notes": "Trek up for panoramic views",
                            },
                            {
                                "name": "Kufri",
                                "category": "attraction",
                                "start_time": "12:00",
                                "duration_minutes": 180,
                            },
                            {
                                "name": "Indian Coffee House",
                                "category": "restaurant",
                                "start_time": "17:00",
                                "duration_minutes": 60,
                                "notes": "Iconic heritage cafe",
                            },
                        ],
                    },
                    {
                        "day": 3,
                        "title": "Shimla to Manali",
                        "places": [
                            {
                                "name": "Toy Train to Barog",
                                "category": "transport",
                                "start_time": "08:00",
                                "duration_minutes": 120,
                                "notes": "UNESCO heritage railway",
                            },
                            {
                                "name": "Drive to Manali",
                                "category": "transport",
                                "start_time": "11:00",
                                "duration_minutes": 360,
                            },
                        ],
                    },
                    {
                        "day": 4,
                        "title": "Manali Adventures",
                        "places": [
                            {
                                "name": "Hadimba Temple",
                                "category": "attraction",
                                "start_time": "08:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Vashisht Hot Springs",
                                "category": "activity",
                                "start_time": "10:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Old Manali Cafes",
                                "category": "restaurant",
                                "start_time": "13:00",
                                "duration_minutes": 120,
                            },
                            {
                                "name": "Solang Valley",
                                "category": "activity",
                                "start_time": "16:00",
                                "duration_minutes": 120,
                            },
                        ],
                    },
                    {
                        "day": 5,
                        "title": "Kasol Day Trip",
                        "places": [
                            {
                                "name": "Drive to Kasol",
                                "category": "transport",
                                "start_time": "07:00",
                                "duration_minutes": 180,
                            },
                            {
                                "name": "Parvati Valley Trek",
                                "category": "activity",
                                "start_time": "11:00",
                                "duration_minutes": 240,
                                "notes": "Easy 4km trek to Chalal village",
                            },
                        ],
                    },
                ]
            }
        ),
    },
    {
        "title": "Leh Ladakh Explorer",
        "destination": "Leh Ladakh",
        "num_days": 5,
        "category": "adventure",
        "description": "High-altitude passes, ancient monasteries & the stunning Pangong Lake.",
        "template_json": json.dumps(
            {
                "days": [
                    {
                        "day": 1,
                        "title": "Acclimatize in Leh",
                        "places": [
                            {
                                "name": "Leh Palace",
                                "category": "attraction",
                                "start_time": "10:00",
                                "duration_minutes": 90,
                                "notes": "Go slow — acclimatize to altitude",
                            },
                            {
                                "name": "Shanti Stupa",
                                "category": "attraction",
                                "start_time": "16:00",
                                "duration_minutes": 60,
                                "notes": "Stunning sunset views",
                            },
                            {
                                "name": "Main Bazaar Walk",
                                "category": "shopping",
                                "start_time": "18:00",
                                "duration_minutes": 60,
                            },
                        ],
                    },
                    {
                        "day": 2,
                        "title": "Monastery Circuit",
                        "places": [
                            {
                                "name": "Thiksey Monastery",
                                "category": "attraction",
                                "start_time": "07:00",
                                "duration_minutes": 120,
                                "notes": "Morning prayer ceremony at sunrise",
                            },
                            {
                                "name": "Hemis Monastery",
                                "category": "attraction",
                                "start_time": "10:00",
                                "duration_minutes": 90,
                            },
                            {
                                "name": "Shey Palace",
                                "category": "attraction",
                                "start_time": "13:00",
                                "duration_minutes": 60,
                            },
                            {
                                "name": "Stok Palace Museum",
                                "category": "attraction",
                                "start_time": "15:00",
                                "duration_minutes": 60,
                            },
                        ],
                    },
                    {
                        "day": 3,
                        "title": "Pangong Lake",
                        "places": [
                            {
                                "name": "Drive to Pangong via Chang La",
                                "category": "transport",
                                "start_time": "06:00",
                                "duration_minutes": 300,
                                "notes": "17,590ft pass — dress warm!",
                            },
                            {
                                "name": "Pangong Tso Lake",
                                "category": "attraction",
                                "start_time": "13:00",
                                "duration_minutes": 240,
                                "notes": "The iconic blue lake — camp overnight",
                            },
                        ],
                    },
                    {
                        "day": 4,
                        "title": "Nubra Valley",
                        "places": [
                            {
                                "name": "Drive to Nubra via Khardung La",
                                "category": "transport",
                                "start_time": "07:00",
                                "duration_minutes": 300,
                                "notes": "One of world's highest motorable passes",
                            },
                            {
                                "name": "Diskit Monastery",
                                "category": "attraction",
                                "start_time": "14:00",
                                "duration_minutes": 90,
                            },
                            {
                                "name": "Hunder Sand Dunes",
                                "category": "activity",
                                "start_time": "16:00",
                                "duration_minutes": 120,
                                "notes": "Double-humped camel ride",
                            },
                        ],
                    },
                    {
                        "day": 5,
                        "title": "Return & Confluence",
                        "places": [
                            {
                                "name": "Drive back to Leh",
                                "category": "transport",
                                "start_time": "07:00",
                                "duration_minutes": 300,
                            },
                            {
                                "name": "Sangam (Indus-Zanskar)",
                                "category": "attraction",
                                "start_time": "14:00",
                                "duration_minutes": 60,
                                "notes": "Two rivers meet — distinct colours visible",
                            },
                            {
                                "name": "Hall of Fame Museum",
                                "category": "attraction",
                                "start_time": "15:30",
                                "duration_minutes": 60,
                            },
                        ],
                    },
                ]
            }
        ),
    },
]


# DEPRECATED (Phase D4): no mobile consumer; TripWorkspaceScreen uses its
# local TRIP_TEMPLATES constant. See FRONTEND_AUDIT.md Phase D.
@templates_bp.route("", methods=["GET"])
def list_templates():
    """List all available trip templates."""
    category = request.args.get("category")
    destination = request.args.get("destination")

    # Check DB for user-created templates first
    q = TripTemplate.query
    if category:
        q = q.filter_by(category=category)
    if destination:
        q = q.filter(TripTemplate.destination.ilike(f"%{destination}%"))
    db_templates = q.order_by(TripTemplate.popularity.desc()).all()

    # Merge with built-in templates
    result = [t.to_dict() for t in db_templates]

    for bt in BUILTIN_TEMPLATES:
        if category and bt.get("category") != category:
            continue
        if destination and destination.lower() not in bt["destination"].lower():
            continue
        result.append(
            {
                "id": f"builtin_{BUILTIN_TEMPLATES.index(bt)}",
                "title": bt["title"],
                "destination": bt["destination"],
                "num_days": bt["num_days"],
                "description": bt["description"],
                "category": bt.get("category", "general"),
                "template_json": bt["template_json"],
                "cover_image_url": bt.get("cover_image_url"),
                "popularity": 100 - BUILTIN_TEMPLATES.index(bt),
                "is_builtin": True,
            }
        )

    return jsonify({"templates": result})


# DEPRECATED (Phase D4): no mobile consumer; kept for API compatibility.
# Disposition: superseded by the local TRIP_TEMPLATES constant in TripWorkspaceScreen. See FRONTEND_AUDIT.md Phase D.
@templates_bp.route("/<template_id>/clone", methods=["POST"])
@login_required
def clone_template(template_id):
    """Clone a template into a new trip."""
    data = request.get_json(silent=True) or {}

    # Find template (DB or built-in)
    template_data = None
    if str(template_id).startswith("builtin_"):
        idx = int(template_id.replace("builtin_", ""))
        if 0 <= idx < len(BUILTIN_TEMPLATES):
            template_data = BUILTIN_TEMPLATES[idx]
    else:
        tpl = db.session.get(TripTemplate, int(template_id))
        if tpl:
            template_data = {
                "title": tpl.title,
                "destination": tpl.destination,
                "num_days": tpl.num_days,
                "template_json": tpl.template_json,
            }
            tpl.popularity += 1
            db.session.commit()

    if not template_data:
        return jsonify({"error": "Template not found."}), 404

    title = data.get("title", template_data["title"])
    start_date = None
    if data.get("start_date"):
        try:
            start_date = date.fromisoformat(data["start_date"])
        except ValueError:
            pass

    # Create the trip
    trip = Trip(
        user_id=current_user.id,
        title=title,
        destination=template_data["destination"],
        start_date=start_date,
        num_days=template_data["num_days"],
        status="planning",
    )
    if start_date:
        trip.end_date = start_date + timedelta(days=template_data["num_days"] - 1)

    db.session.add(trip)
    db.session.flush()

    # Parse template JSON and create days + places
    tpl_content = json.loads(template_data["template_json"])
    for day_data in tpl_content.get("days", []):
        day_num = day_data.get("day", 1)
        day_date = start_date + timedelta(days=day_num - 1) if start_date else None

        trip_day = TripDay(
            trip_id=trip.id,
            day_number=day_num,
            date=day_date,
            title=day_data.get("title", f"Day {day_num}"),
        )
        db.session.add(trip_day)
        db.session.flush()

        for i, place_data in enumerate(day_data.get("places", [])):
            from app.models.entities import TripPlace

            place = TripPlace(
                trip_id=trip.id,
                day_id=trip_day.id,
                name=place_data["name"],
                category=place_data.get("category"),
                start_time=place_data.get("start_time"),
                duration_minutes=place_data.get("duration_minutes"),
                notes=place_data.get("notes"),
                position_order=i,
            )
            db.session.add(place)

    db.session.commit()
    return jsonify({"trip": trip.to_dict(include_days=True)}), 201

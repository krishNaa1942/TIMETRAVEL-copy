"""
Booking Links Service
======================
Generates affiliate-style booking links to major Indian travel
platforms.  No API key required — these are direct search URLs.

Supported platforms:
  - MakeMyTrip (flights + hotels)
  - Booking.com (hotels)
  - IRCTC (trains)
  - Goibibo (flights + hotels)
  - OYO (budget hotels)
  - Airbnb (stays)
"""

import logging
from urllib.parse import quote

logger = logging.getLogger(__name__)


def get_booking_links(destination: str, checkin: str = "", checkout: str = "", guests: int = 2) -> dict:
    """
    Generate search/booking URLs for a destination.

    Args:
        destination: Destination name (e.g. "Goa").
        checkin:     Check-in date string (YYYY-MM-DD), optional.
        checkout:    Check-out date string (YYYY-MM-DD), optional.
        guests:      Number of guests.

    Returns:
        {
            "destination": "Goa",
            "flights": [ { "platform", "url", "icon", "color" }, ... ],
            "hotels":  [ ... ],
            "trains":  [ ... ],
            "buses":   [ ... ],
        }
    """
    dest_enc = quote(destination)
    dest_lower = destination.lower()

    # Build date params if provided
    mmt_dates = ""
    if checkin and checkout:
        mmt_dates = f"&checkin={checkin}&checkout={checkout}"

    result = {
        "destination": destination,
        "flights": [
            {
                "platform": "MakeMyTrip",
                "url": f"https://www.makemytrip.com/flights/search?dest={dest_enc}",
                "icon": "fas fa-plane",
                "color": "#0052CC",
                "description": "India's largest travel platform",
            },
            {
                "platform": "Goibibo",
                "url": f"https://www.goibibo.com/flights/search/?dest={dest_enc}",
                "icon": "fas fa-plane-departure",
                "color": "#EE5535",
                "description": "Compare & book cheap flights",
            },
            {
                "platform": "IndiGo",
                "url": f"https://www.goindigo.in/booking/select-flight.html?dest={dest_enc}",
                "icon": "fas fa-plane",
                "color": "#002D62",
                "description": "India's largest airline",
            },
        ],
        "hotels": [
            {
                "platform": "Booking.com",
                "url": f"https://www.booking.com/searchresults.html?ss={dest_enc}+India{mmt_dates}",
                "icon": "fas fa-hotel",
                "color": "#003580",
                "description": "World's largest hotel booking site",
            },
            {
                "platform": "MakeMyTrip Hotels",
                "url": f"https://www.makemytrip.com/hotels/hotel-listing/?city={dest_enc}{mmt_dates}",
                "icon": "fas fa-bed",
                "color": "#0052CC",
                "description": "Hotels, resorts & homestays",
            },
            {
                "platform": "OYO Rooms",
                "url": f"https://www.oyorooms.com/search?location={dest_enc}",
                "icon": "fas fa-building",
                "color": "#EE2E24",
                "description": "Budget-friendly hotel chain",
            },
            {
                "platform": "Airbnb",
                "url": f"https://www.airbnb.co.in/s/{dest_enc}--India/homes",
                "icon": "fas fa-home",
                "color": "#FF5A5F",
                "description": "Unique stays & experiences",
            },
        ],
        "trains": [
            {
                "platform": "IRCTC",
                "url": f"https://www.irctc.co.in/nget/train-search",
                "icon": "fas fa-train",
                "color": "#1A237E",
                "description": "Indian Railways official booking",
            },
            {
                "platform": "ConfirmTkt",
                "url": f"https://www.confirmtkt.com/train-between-stations?to={dest_enc}",
                "icon": "fas fa-ticket-alt",
                "color": "#FF6F00",
                "description": "Train availability & predictions",
            },
        ],
        "buses": [
            {
                "platform": "RedBus",
                "url": f"https://www.redbus.in/search?dst={dest_enc}",
                "icon": "fas fa-bus",
                "color": "#D13239",
                "description": "India's largest bus booking",
            },
            {
                "platform": "AbhiBus",
                "url": f"https://www.abhibus.com/bus-tickets/to-{dest_lower}",
                "icon": "fas fa-bus-alt",
                "color": "#E53935",
                "description": "Online bus tickets",
            },
        ],
    }

    return result

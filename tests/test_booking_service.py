"""
Tests for booking links service.
"""

from app.services.booking_service import get_booking_links


class TestGetBookingLinks:
    def test_returns_all_categories(self):
        result = get_booking_links("Goa")
        assert result["destination"] == "Goa"
        assert "flights" in result
        assert "hotels" in result
        assert "trains" in result
        assert "buses" in result

    def test_flights_count(self):
        result = get_booking_links("Mumbai")
        assert len(result["flights"]) == 3

    def test_hotels_count(self):
        result = get_booking_links("Delhi")
        assert len(result["hotels"]) == 4

    def test_trains_count(self):
        result = get_booking_links("Jaipur")
        assert len(result["trains"]) == 2

    def test_buses_count(self):
        result = get_booking_links("Manali")
        assert len(result["buses"]) == 2

    def test_destination_encoded_in_urls(self):
        result = get_booking_links("New Delhi")
        for flight in result["flights"]:
            assert "New%20Delhi" in flight["url"] or "New+Delhi" in flight["url"]

    def test_each_entry_has_required_fields(self):
        result = get_booking_links("Goa")
        for category in ["flights", "hotels", "trains", "buses"]:
            for entry in result[category]:
                assert "platform" in entry
                assert "url" in entry
                assert "icon" in entry
                assert "color" in entry

    def test_dates_included_when_provided(self):
        result = get_booking_links("Goa", checkin="2026-04-01", checkout="2026-04-05")
        # Check that at least some hotel URLs include dates
        booking_url = result["hotels"][0]["url"]
        assert "2026-04-01" in booking_url

    def test_special_characters_safe(self):
        result = get_booking_links("Ooty & Coonoor")
        for flight in result["flights"]:
            assert "url" in flight
            # URL should be properly encoded
            assert "Ooty" in flight["url"]

    def test_lowercase_destination_in_buses(self):
        result = get_booking_links("Goa")
        abhibus = result["buses"][1]
        assert "goa" in abhibus["url"]

"""
Tests for language phrases service.
"""

from app.services.language_service import (
    get_phrases,
    get_supported_destinations,
    _get_language_tips,
    _cache,
    DEST_LANGUAGES,
)


class TestGetPhrases:
    def setup_method(self):
        _cache.clear()

    def test_known_destination_jaipur(self):
        result = get_phrases("Jaipur")
        assert result["destination"] == "Jaipur"
        assert result["language"] == "Hindi"
        assert result["script"] == "Devanagari"
        assert result["secondary"] == "Rajasthani"
        assert len(result["phrases"]) > 0
        assert len(result["travel_tips"]) > 0

    def test_known_destination_goa(self):
        result = get_phrases("Goa")
        assert result["language"] == "Konkani"
        assert result["script"] == "Devanagari"

    def test_known_destination_ooty(self):
        result = get_phrases("Ooty")
        assert result["language"] == "Tamil"

    def test_known_destination_munnar(self):
        result = get_phrases("Munnar")
        assert result["language"] == "Malayalam"

    def test_known_destination_hampi(self):
        result = get_phrases("Hampi")
        assert result["language"] == "Kannada"

    def test_known_destination_amritsar(self):
        result = get_phrases("Amritsar")
        assert result["language"] == "Punjabi"

    def test_known_destination_darjeeling(self):
        result = get_phrases("Darjeeling")
        assert result["language"] == "Nepali"

    def test_known_destination_leh(self):
        result = get_phrases("Leh Ladakh")
        assert result["language"] == "Ladakhi"

    def test_known_destination_coorg(self):
        result = get_phrases("Coorg")
        assert result["language"] == "Kannada"
        assert result["secondary"] == "Kodava"

    def test_known_destination_pune(self):
        result = get_phrases("Pune")
        assert result["language"] == "Marathi"

    def test_unknown_destination_defaults_to_hindi(self):
        result = get_phrases("SomeRandomPlace")
        assert result["language"] == "Hindi"
        assert len(result["phrases"]) > 0

    def test_case_insensitive_lookup(self):
        result = get_phrases("  GOA  ")
        assert result["language"] == "Konkani"

    def test_phrases_have_required_fields(self):
        result = get_phrases("Jaipur")
        for phrase in result["phrases"]:
            assert "phrase" in phrase
            assert "meaning" in phrase
            assert "usage" in phrase

    def test_result_is_cached(self):
        _cache.clear()
        get_phrases("Jaipur")
        assert "jaipur" in _cache
        # Second call should use cache
        result = get_phrases("Jaipur")
        assert result["language"] == "Hindi"


class TestGetLanguageTips:
    def test_hindi_tips(self):
        tips = _get_language_tips("Hindi", "jaipur")
        assert len(tips) >= 3  # language-specific + 2 generic
        assert any("Hindi" in t for t in tips)

    def test_malayalam_tips(self):
        tips = _get_language_tips("Malayalam", "kerala")
        assert any("Malayalam" in t for t in tips)

    def test_tamil_tips(self):
        tips = _get_language_tips("Tamil", "ooty")
        assert any("Tamil" in t for t in tips)

    def test_kannada_tips(self):
        tips = _get_language_tips("Kannada", "hampi")
        assert any("Kannada" in t for t in tips)

    def test_punjabi_tips(self):
        tips = _get_language_tips("Punjabi", "amritsar")
        assert any("Punjabi" in t or "Sat Sri Akaal" in t for t in tips)

    def test_nepali_tips(self):
        tips = _get_language_tips("Nepali", "darjeeling")
        assert any("Nepali" in t for t in tips)

    def test_konkani_tips(self):
        tips = _get_language_tips("Konkani", "goa")
        assert any("Goa" in t or "Konkani" in t for t in tips)

    def test_ladakhi_tips(self):
        tips = _get_language_tips("Ladakhi", "leh ladakh")
        assert any("Julley" in t or "Ladakh" in t for t in tips)

    def test_marathi_tips(self):
        tips = _get_language_tips("Marathi", "pune")
        assert any("Marathi" in t for t in tips)

    def test_generic_tips_always_present(self):
        tips = _get_language_tips("Hindi", "agra")
        assert any("Google Translate" in t for t in tips)
        assert any("smile" in t.lower() for t in tips)

    def test_unknown_language(self):
        tips = _get_language_tips("Swahili", "test")
        # Should still have generic tips
        assert len(tips) >= 2


class TestGetSupportedDestinations:
    def test_returns_list(self):
        result = get_supported_destinations()
        assert isinstance(result, list)

    def test_matches_dest_languages_count(self):
        result = get_supported_destinations()
        assert len(result) == len(DEST_LANGUAGES)

    def test_each_entry_has_required_fields(self):
        for entry in get_supported_destinations():
            assert "key" in entry
            assert "label" in entry
            assert "language" in entry
            assert "script" in entry

    def test_goa_in_list(self):
        keys = [d["key"] for d in get_supported_destinations()]
        assert "goa" in keys

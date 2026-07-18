"""
Tests for currency conversion service.
"""

from unittest.mock import patch, MagicMock
from app.services.currency_service import convert_currency, get_supported_currencies, _cache


class TestConvertCurrency:
    def setup_method(self):
        _cache.clear()

    @patch("app.services.currency_service._fetch_rates")
    def test_live_conversion(self, mock_fetch):
        mock_fetch.return_value = {"INR": 83.5}
        result = convert_currency(100, "USD", "INR")
        assert result["amount"] == 100
        assert result["from"] == "USD"
        assert result["to"] == "INR"
        assert result["rate"] == 83.5
        assert result["converted"] == 8350.0
        assert result["symbol"] == "₹"
        assert result["source"] == "live"

    @patch("app.services.currency_service._fetch_rates")
    def test_fallback_when_api_fails(self, mock_fetch):
        mock_fetch.return_value = None
        result = convert_currency(100, "USD", "INR")
        assert result["source"] == "fallback"
        assert result["converted"] > 0

    @patch("app.services.currency_service._fetch_rates")
    def test_fallback_inr_to_usd(self, mock_fetch):
        mock_fetch.return_value = None
        result = convert_currency(1000, "INR", "USD")
        assert result["source"] == "fallback"
        assert result["from"] == "INR"
        assert result["to"] == "USD"
        assert result["converted"] > 0

    @patch("app.services.currency_service._fetch_rates")
    def test_fallback_usd_to_inr(self, mock_fetch):
        mock_fetch.return_value = None
        result = convert_currency(100, "USD", "INR")
        assert result["source"] == "fallback"
        assert result["rate"] > 0

    @patch("app.services.currency_service._fetch_rates")
    def test_fallback_cross_rate(self, mock_fetch):
        mock_fetch.return_value = None
        result = convert_currency(100, "EUR", "GBP")
        assert result["source"] == "fallback"
        assert result["converted"] > 0

    @patch("app.services.currency_service._fetch_rates")
    def test_uppercase_normalization(self, mock_fetch):
        mock_fetch.return_value = {"EUR": 0.92}
        result = convert_currency(100, "usd", "eur")
        assert result["from"] == "USD"
        assert result["to"] == "EUR"

    @patch("app.services.currency_service._fetch_rates")
    def test_currency_not_in_live_rates(self, mock_fetch):
        mock_fetch.return_value = {"USD": 1.0}  # no GBP in result
        result = convert_currency(100, "USD", "GBP")
        assert result["source"] == "fallback"


class TestGetSupportedCurrencies:
    def test_returns_list(self):
        result = get_supported_currencies()
        assert isinstance(result, list)
        assert len(result) > 0

    def test_each_entry_has_code_and_symbol(self):
        for entry in get_supported_currencies():
            assert "code" in entry
            assert "symbol" in entry

    def test_inr_included(self):
        codes = [c["code"] for c in get_supported_currencies()]
        assert "INR" in codes

    def test_common_currencies_present(self):
        codes = [c["code"] for c in get_supported_currencies()]
        for c in ["USD", "EUR", "GBP", "INR"]:
            assert c in codes


class TestFetchRates:
    def setup_method(self):
        _cache.clear()

    @patch("app.services.currency_service.requests.get")
    def test_live_fetch_success(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "result": "success",
            "rates": {"INR": 83.5, "EUR": 0.92},
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        from app.services.currency_service import _fetch_rates
        rates = _fetch_rates("USD")
        assert rates is not None
        assert rates["INR"] == 83.5

    @patch("app.services.currency_service.requests.get")
    def test_api_error_returns_none(self, mock_get):
        import requests
        mock_get.side_effect = requests.RequestException("timeout")

        from app.services.currency_service import _fetch_rates
        rates = _fetch_rates("USD")
        assert rates is None

    @patch("app.services.currency_service.requests.get")
    def test_cache_hit(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"result": "success", "rates": {"EUR": 0.92}}
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        from app.services.currency_service import _fetch_rates
        _fetch_rates("USD")
        _fetch_rates("USD")  # should use cache
        assert mock_get.call_count == 1

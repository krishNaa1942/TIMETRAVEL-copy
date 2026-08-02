"""
Tests for app.services.push_notification_service
==================================================
Unit tests for push notification payloads, device token management,
and notification sending (firebase not installed -> disabled path).
"""

import asyncio
from datetime import datetime, timezone

import pytest

from app.services.push_notification_service import (
    PushNotification,
    PushNotificationService,
    DeviceToken,
    NotificationPriority,
    NotificationType,
)


class TestPushNotificationPayloads:
    def test_to_fcm_payload(self):
        n = PushNotification(title="Hello", body="World", data={"trip_id": "1"})
        payload = n.to_fcm_payload("token123")
        assert payload["token"] == "token123"
        assert payload["notification"]["title"] == "Hello"
        assert payload["data"]["type"] == "system"
        assert payload["data"]["trip_id"] == "1"
        assert payload["android"]["priority"] == "normal"
        assert payload["apns"]["headers"]["apns-priority"] == "5"

    def test_fcm_high_priority(self):
        n = PushNotification(title="t", body="b", priority=NotificationPriority.HIGH)
        payload = n.to_fcm_payload("tok")
        assert payload["android"]["priority"] == "high"
        assert payload["apns"]["headers"]["apns-priority"] == "10"

    def test_fcm_with_image(self):
        n = PushNotification(title="t", body="b", image="https://img/x.jpg")
        payload = n.to_fcm_payload("tok")
        assert payload["notification"]["image"] == "https://img/x.jpg"
        assert payload["apns"]["payload"]["aps"]["mutable-content"] == 1

    def test_to_apns_payload(self):
        n = PushNotification(
            title="t", body="b", badge=3, notification_type=NotificationType.PRICE_ALERT
        )
        payload = n.to_apns_payload("tok")
        assert payload["aps"]["badge"] == 3
        assert payload["data"]["type"] == "price_alert"
        assert payload["aps"]["mutable-content"] == 0

    def test_apns_payload_with_image(self):
        n = PushNotification(title="t", body="b", image="https://x/y.jpg")
        payload = n.to_apns_payload("tok")
        assert payload["aps"]["mutable-content"] == 1

    def test_ttl_default(self):
        assert PushNotification(title="t", body="b").ttl == 86400

    def test_created_at_utc(self):
        n = PushNotification(title="t", body="b")
        assert n.created_at.tzinfo == timezone.utc


class TestDeviceToken:
    def test_defaults(self):
        d = DeviceToken(user_id="u1", token="t1", platform="android")
        assert d.is_active is True
        assert d.platform == "android"


class TestPushNotificationService:
    def _service(self):
        svc = PushNotificationService()
        assert svc._fcm_available is False  # firebase not installed in CI
        return svc

    def test_register_device(self):
        svc = self._service()
        assert svc.register_device("u1", "tok1", "android", device_id="d1") is True
        assert len(svc._tokens["u1"]) == 1

    def test_register_duplicate_token_updates(self):
        svc = self._service()
        svc.register_device("u1", "tok1", "android", device_id="d1")
        svc.register_device("u1", "tok1", "android", device_id="d1")
        assert len(svc._tokens["u1"]) == 1
        assert svc._tokens["u1"][0].is_active is True

    def test_platform_lowercased(self):
        svc = self._service()
        svc.register_device("u1", "tok1", "IOS")
        assert svc._tokens["u1"][0].platform == "ios"

    def test_unregister_device(self):
        svc = self._service()
        svc.register_device("u1", "tok1", "android", device_id="d1")
        assert svc.unregister_device("u1", "tok1") is True
        assert svc._tokens["u1"][0].is_active is False

    def test_unregister_unknown(self):
        svc = self._service()
        assert svc.unregister_device("nobody", "tok") is False

    def test_send_no_devices(self):
        svc = self._service()
        result = asyncio.get_event_loop().run_until_complete(
            svc.send_notification("u1", PushNotification(title="t", body="b"))
        )
        assert result == {
            "success": False,
            "message": "No active devices",
            "sent_count": 0,
        }

    def test_send_fcm_unavailable_fails_gracefully(self):
        svc = self._service()
        svc.register_device("u1", "tok1", "android", device_id="d1")
        result = asyncio.get_event_loop().run_until_complete(
            svc.send_notification("u1", PushNotification(title="t", body="b"))
        )
        assert result["success"] is False
        assert result["sent_count"] == 0
        assert result["total_devices"] == 1
        assert result["results"][0]["success"] is False

    def test_send_batch(self):
        svc = self._service()
        svc.register_device("u1", "t1", "android")
        svc.register_device("u2", "t2", "ios")
        result = asyncio.get_event_loop().run_until_complete(
            svc.send_batch_notifications(
                ["u1", "u2"], PushNotification(title="t", body="b")
            )
        )
        assert result["total_users"] == 2
        assert result["successful_deliveries"] == 0
        assert len(result["results"]) == 2

    def test_send_trip_reminder(self):
        svc = self._service()
        svc.register_device("u1", "t1", "android")
        result = asyncio.get_event_loop().run_until_complete(
            svc.send_trip_reminder("u1", "trip1", "Goa", 3)
        )
        assert result["total_devices"] == 1

    def test_send_price_alert(self):
        svc = self._service()
        svc.register_device("u1", "t1", "android")
        result = asyncio.get_event_loop().run_until_complete(
            svc.send_price_alert("u1", "Goa", 1000.0, 750.0, "INR")
        )
        assert result["total_devices"] == 1

    def test_send_trip_invitation(self):
        svc = self._service()
        svc.register_device("u1", "t1", "android")
        result = asyncio.get_event_loop().run_until_complete(
            svc.send_trip_invitation("u1", "trip1", "Beach Trip", "Alice")
        )
        assert result["total_devices"] == 1

    def test_send_chat_message(self):
        svc = self._service()
        svc.register_device("u1", "t1", "android")
        result = asyncio.get_event_loop().run_until_complete(
            svc.send_chat_message("u1", "trip1", "Bob", "hello there" * 30)
        )
        assert result["total_devices"] == 1

    def test_get_active_devices_excludes_inactive(self):
        svc = self._service()
        svc.register_device("u1", "t1", "android")
        svc.register_device("u1", "t2", "ios")
        svc.unregister_device("u1", "t2")
        devices = svc._get_active_devices("u1")
        assert len(devices) == 1
        assert devices[0].token == "t1"

    def test_get_active_devices_unknown_user(self):
        svc = self._service()
        assert svc._get_active_devices("nobody") == []

    def test_send_to_device_deactivates_invalid_token(self):
        import sys

        import app.services.push_notification_service as module

        svc = self._service()

        class FakeMessaging:
            @staticmethod
            def Message(*a, **k):
                return object()

            @staticmethod
            def Notification(*a, **k):
                return object()

            @staticmethod
            def AndroidConfig(*a, **k):
                return object()

            @staticmethod
            def AndroidNotification(*a, **k):
                return object()

            @staticmethod
            def APNSConfig(*a, **k):
                return object()

            @staticmethod
            def APNSPayload(*a, **k):
                return object()

            @staticmethod
            def Aps(*a, **k):
                return object()

            @staticmethod
            def ApsAlert(*a, **k):
                return object()

        def fake_send(msg):
            raise Exception("invalid-registration-token")

        fake_mod = type(
            "F",
            (),
            {
                "messaging": FakeMessaging,
                "credentials": type(
                    "C", (), {"Certificate": staticmethod(lambda c: object())}
                )(),
            },
        )()
        sys.modules["firebase_admin"] = fake_mod
        device = DeviceToken(user_id="u1", token="bad", platform="android")
        svc._fcm_available = True
        svc._messaging = type("M", (), {"send": staticmethod(fake_send)})()
        try:
            result = asyncio.get_event_loop().run_until_complete(
                svc._send_to_device(device, PushNotification(title="t", body="b"))
            )
            assert result is False
            assert device.is_active is False
        finally:
            del sys.modules["firebase_admin"]

"""
Tests for app.utils.security
==============================
Unit tests for input sanitization, SQL injection prevention,
password security, and token security utilities.
"""

import re

import pytest

from app.utils.security import (
    InputSanitizer,
    SQLSanitizer,
    SafeQueryBuilder,
    PasswordSecurity,
    TokenSecurity,
    SecurityAudit,
    sanitize_inputs,
    require_strong_password,
    hash_password,
    verify_password,
)

# ── InputSanitizer ───────────────────────────────────────────────────


class TestInputSanitizer:
    def test_strips_whitespace(self):
        assert InputSanitizer.sanitize_string("  hello  ") == "hello"

    def test_escapes_html_by_default(self):
        # NOTE: strip_dangerous also removes ';' from escaped entities,
        # so pure escaping is asserted with strip_dangerous=False
        assert (
            InputSanitizer.sanitize_string(
                "<script>alert(1)</script>", strip_dangerous=False
            )
            == "&lt;script&gt;alert(1)&lt;/script&gt;"
        )

    def test_strip_dangerous_also_removes_semicolons(self):
        assert InputSanitizer.sanitize_string("<b>hi</b>") == "&ltb&gthi&lt/b&gt"

    def test_non_string_converted_to_str(self):
        assert InputSanitizer.sanitize_string(123) == "123"

    def test_max_length_truncates(self):
        assert InputSanitizer.sanitize_string("abcdefghij", max_length=3) == "abc"

    def test_allow_html_strips_script_tags(self):
        result = InputSanitizer.sanitize_string(
            "<p>hi</p><script>alert(1)</script>", allow_html=True
        )
        assert "script" not in result
        assert "hi" in result

    def test_strip_dangerous_patterns_removes_sql(self):
        assert "DROP TABLE" not in InputSanitizer.sanitize_string("x DROP TABLE users")

    def test_strip_dangerous_false_keeps_content(self):
        value = InputSanitizer.sanitize_string(
            "DROP TABLE users", strip_dangerous=False
        )
        assert value == "DROP TABLE users"

    def test_detect_injection_flags_union_select(self):
        result = InputSanitizer.detect_injection("' UNION SELECT * FROM users")
        assert result["safe"] is False
        assert result["risk_level"] in ("medium", "high")

    def test_detect_injection_clean_input(self):
        result = InputSanitizer.detect_injection("hello world")
        assert result["safe"] is True

    def test_detect_injection_non_string(self):
        assert InputSanitizer.detect_injection(42)["safe"] is True

    def test_sanitize_dict_handles_nested(self):
        data = {"name": "<b>Goa</b>", "nested": {"desc": "<script>x</script>"}}
        result = InputSanitizer.sanitize_dict(data)
        assert "&ltb&gt" in result["name"]
        assert "&ltscript&gt" in result["nested"]["desc"]

    def test_sanitize_dict_non_dict_returns_empty(self):
        assert InputSanitizer.sanitize_dict("nope") == {}

    def test_sanitize_dict_applies_schema(self):
        schema = {"name": {"max_length": 4}}
        result = InputSanitizer.sanitize_dict({"name": "abcdef"}, schema)
        assert result["name"] == "abcd"

    def test_sanitize_dict_keeps_primitives(self):
        result = InputSanitizer.sanitize_dict({"n": 5, "f": 1.5, "b": True, "z": None})
        assert result == {"n": 5, "f": 1.5, "b": True, "z": None}

    def test_sanitize_dict_unknown_type_str(self):
        result = InputSanitizer.sanitize_dict({"x": object()})
        assert isinstance(result["x"], str)

    def test_sanitize_list_recursive(self):
        result = InputSanitizer.sanitize_list(["<script>", ["<b>ok</b>"]])
        assert "&ltscript&gt" in result
        assert "&ltb&gtok&lt/b&gt" in result[1]

    def test_sanitize_list_non_list(self):
        assert InputSanitizer.sanitize_list("nope") == []

    def test_sanitize_list_primitives(self):
        assert InputSanitizer.sanitize_list([1, 2.5, True, None]) == [
            1,
            2.5,
            True,
            None,
        ]

    def test_sanitize_html_removes_onerror_attr(self):
        result = InputSanitizer._sanitize_html('<img src="x" onerror="alert(1)">')
        assert "onerror" not in result

    def test_sanitize_html_removes_javascript_url(self):
        assert "javascript:" not in InputSanitizer._sanitize_html(
            '<a href="javascript:alert(1)">x</a>'
        )

    def test_detect_injection_risk_levels(self):
        low = InputSanitizer.detect_injection("hello")
        assert low["risk_level"] == "low"


# ── SQLSanitizer ─────────────────────────────────────────────────────


class TestSQLSanitizer:
    def test_valid_identifier(self):
        assert SQLSanitizer.validate_identifier("users") is True
        assert SQLSanitizer.validate_identifier("user_id") is True

    def test_invalid_identifiers(self):
        assert SQLSanitizer.validate_identifier("") is False
        assert SQLSanitizer.validate_identifier("users; DROP") is False
        assert SQLSanitizer.validate_identifier("SELECT") is False
        assert SQLSanitizer.validate_identifier("drop") is False

    def test_escape_string(self):
        assert SQLSanitizer.escape_string("O'Reilly") == "O''Reilly"

    def test_escape_non_string(self):
        assert SQLSanitizer.escape_string(42) == "42"

    def test_detect_sql_injection_clean(self):
        assert SQLSanitizer.detect_sql_injection("WHERE id = 1")["safe"] is True

    def test_detect_sql_injection_union(self):
        result = SQLSanitizer.detect_sql_injection("1 UNION SELECT password")
        assert result["safe"] is False
        assert result["risk_level"] in ("medium", "high")

    def test_detect_sql_injection_boolean(self):
        result = SQLSanitizer.detect_sql_injection("' OR '1'='1")
        assert result["safe"] is False

    def test_detect_sql_injection_comment(self):
        result = SQLSanitizer.detect_sql_injection("admin' --")
        assert result["safe"] is False

    def test_detect_non_string(self):
        assert SQLSanitizer.detect_sql_injection(None)["safe"] is True

    def test_detect_risk_levels(self):
        assert SQLSanitizer.detect_sql_injection("hi")["risk_level"] == "low"


# ── SafeQueryBuilder ─────────────────────────────────────────────────


class TestSafeQueryBuilder:
    def test_builds_select_all(self):
        q, params = SafeQueryBuilder().select("users").build()
        assert q == "SELECT * FROM users"
        assert params == []

    def test_builds_select_columns(self):
        q, params = SafeQueryBuilder().select("users", ["id", "name"]).build()
        assert q == "SELECT id, name FROM users"

    def test_invalid_table_rejected(self):
        with pytest.raises(ValueError):
            SafeQueryBuilder().select("users; DROP TABLE x")

    def test_invalid_column_rejected(self):
        with pytest.raises(ValueError):
            SafeQueryBuilder().select("users", ["id; DROP"])

    def test_where_with_params(self):
        q, params = SafeQueryBuilder().select("users").where("id = ?", 5).build()
        assert q == "SELECT * FROM users WHERE id = ?"
        assert params == [5]

    def test_where_eq(self):
        q, params = (
            SafeQueryBuilder().select("users").where_eq("email", "a@b.c").build()
        )
        assert q == "SELECT * FROM users WHERE email = ?"
        assert params == ["a@b.c"]

    def test_where_eq_invalid_column(self):
        with pytest.raises(ValueError):
            SafeQueryBuilder().where_eq("email; DROP", "x")

    def test_order_by_direction_validation(self):
        with pytest.raises(ValueError):
            SafeQueryBuilder().order_by("id", "SIDEWAYS")

    def test_order_by_desc(self):
        q, _ = SafeQueryBuilder().select("users").order_by("id", "desc").build()
        assert q.endswith("ORDER BY id DESC")

    def test_order_by_invalid_column(self):
        with pytest.raises(ValueError):
            SafeQueryBuilder().order_by("id; DROP", "ASC")

    def test_limit_validation(self):
        with pytest.raises(ValueError):
            SafeQueryBuilder().limit(-1)
        with pytest.raises(ValueError):
            SafeQueryBuilder().limit("ten")

    def test_offset_validation(self):
        with pytest.raises(ValueError):
            SafeQueryBuilder().offset(-5)

    def test_full_chain(self):
        q, params = (
            SafeQueryBuilder()
            .select("trips", ["id", "name"])
            .where_eq("user_id", 7)
            .order_by("name")
            .limit(10)
            .build()
        )
        assert (
            q
            == "SELECT id, name FROM trips WHERE user_id = ? ORDER BY name ASC LIMIT 10"
        )
        assert params == [7]

    def test_params_are_copied(self):
        builder = SafeQueryBuilder().where_eq("a", 1)
        q, params = builder.build()
        params.append(99)
        _, params2 = builder.build()
        assert params2 == [1]


# ── PasswordSecurity ─────────────────────────────────────────────────


class TestPasswordSecurity:
    def test_hash_roundtrip_bcrypt(self):
        hashed = PasswordSecurity.hash_password("Str0ng!Pass")
        assert hashed != "Str0ng!Pass"
        assert PasswordSecurity.verify_password("Str0ng!Pass", hashed) is True
        assert PasswordSecurity.verify_password("Wrong!Pass", hashed) is False

    def test_validate_strength_strong_password(self):
        result = PasswordSecurity.validate_strength("Str0ng!Pass")
        assert result["valid"] is True
        assert result["strength"] == 100

    def test_validate_strength_weak_password(self):
        result = PasswordSecurity.validate_strength("weak")
        assert result["valid"] is False
        assert len(result["errors"]) >= 4

    def test_validate_strength_missing_components(self):
        result = PasswordSecurity.validate_strength("alllowercase1")
        assert result["valid"] is False
        assert any("uppercase" in e for e in result["errors"])
        assert any("special" in e for e in result["errors"])

    def test_generate_secure_length(self):
        pwd = PasswordSecurity.generate_secure(24)
        assert len(pwd) == 24
        assert len(set(pwd) & set("!@#$%^&*")) > 0

    def test_generate_secure_default(self):
        assert len(PasswordSecurity.generate_secure()) == 16

    def test_verify_sha256_fallback_format(self):
        import hashlib
        import secrets

        salt = secrets.token_hex(16)
        computed = hashlib.sha256(("pw1" + salt).encode()).hexdigest()
        hashed = f"sha256${salt}${computed}"
        assert PasswordSecurity.verify_password("pw1", hashed) is True
        assert PasswordSecurity.verify_password("pw2", hashed) is False

    def test_verify_garbage_format(self):
        assert PasswordSecurity.verify_password("pw", "not-a-hash") is False


# ── TokenSecurity ───────────────────────────────────────────────────


class TestTokenSecurity:
    def test_generate_token_is_urlsafe(self):
        token = TokenSecurity.generate_token()
        assert len(token) >= 32
        assert re.fullmatch(r"[A-Za-z0-9_\-]+", token)

    def test_generate_otp_numeric(self):
        otp = TokenSecurity.generate_otp(6)
        assert len(otp) == 6
        assert otp.isdigit()

    def test_hash_and_verify_token(self):
        token = TokenSecurity.generate_token()
        hashed = TokenSecurity.hash_token(token)
        assert TokenSecurity.verify_token_hash(token, hashed) is True
        assert TokenSecurity.verify_token_hash("other", hashed) is False


# ── Decorators ───────────────────────────────────────────────────────


class TestDecorators:
    def test_sanitize_inputs_kwargs(self):
        @sanitize_inputs(schema={"name": {"max_length": 3}})
        def func(name):
            return name

        assert func(name="abcdef") == "abc"

    def test_sanitize_inputs_args(self):
        @sanitize_inputs()
        def func(value):
            return value

        assert func("<script>x</script>") == "&ltscript&gtx&lt/script&gt"

    def test_sanitize_inputs_other_args_passthrough(self):
        @sanitize_inputs()
        def func(a, b):
            return a, b

        assert func(5, [1, 2]) == (5, [1, 2])

    def test_sanitize_inputs_preserves_kwargs(self):
        @sanitize_inputs()
        def func(a, *, b):
            return a, b

        result = func(1, b="<b>")
        # dangerous-pattern strip also removes ';' from the HTML-escaped output
        assert result == (1, "&ltb&gt")

    def test_require_strong_password_passes(self):
        @require_strong_password("password")
        def func(password):
            return password

        assert func(password="Str0ng!Pass") == "Str0ng!Pass"

    def test_require_strong_password_rejects(self):
        @require_strong_password("password")
        def func(password):
            return password

        with pytest.raises(ValueError, match="Password too weak"):
            func(password="weak")


# ── Module-level functions ───────────────────────────────────────────


class TestModuleFunctions:
    def test_hash_password_roundtrip(self):
        hashed = hash_password("Str0ng!Pass")
        assert verify_password("Str0ng!Pass", hashed) is True
        assert verify_password("nope", hashed) is False


# ── SecurityAudit (logs only, assert no exceptions) ──────────────────


class TestSecurityAudit:
    def test_log_security_event_low(self, caplog):
        import logging

        caplog.set_level(logging.INFO)
        SecurityAudit.log_security_event("TEST_EVENT", user_id="1")
        assert any("TEST_EVENT" in r.message for r in caplog.records)

    def test_log_security_event_critical_warns(self, caplog):
        SecurityAudit.log_security_event(
            "CRITICAL_EVENT", risk_level="critical", details={"k": "v"}
        )
        assert any(r.levelname == "WARNING" for r in caplog.records)

    def test_log_failed_login(self, caplog):
        import logging

        caplog.set_level(logging.INFO)
        SecurityAudit.log_failed_login("u1", "127.0.0.1", "bad password")
        assert any("FAILED_LOGIN" in r.message for r in caplog.records)

    def test_log_suspicious_activity(self, caplog):
        SecurityAudit.log_suspicious_activity("u1", "many login attempts")
        assert any("SUSPICIOUS_ACTIVITY" in r.message for r in caplog.records)

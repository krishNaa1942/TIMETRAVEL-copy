"""
Shared test fixtures for the Time Travel test suite.
"""

import os

os.environ.setdefault("TESTING", "1")
os.environ.setdefault("FLASK_ENV", "testing")

import pytest
from app.main import create_app
from app.config import TestingConfig
from app.models.database import db as _db


@pytest.fixture(scope="session")
def app():
    """Create a Flask app configured for testing."""
    _app = create_app(config_class=TestingConfig)
    yield _app


@pytest.fixture(scope="session")
def client(app):
    """Provide a Flask test client."""
    return app.test_client()


@pytest.fixture(scope="function")
def db(app):
    """Provide a clean database for each test function.

    Tables are recreated after the drop so later tests (which rely on the
    schema existing without requesting this fixture) keep working.
    """
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.rollback()
        _db.drop_all()
        _db.create_all()

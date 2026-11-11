"""Production and demo guards: no external connections or credentials are used."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.seed import require_demo_database


def production(**overrides):
    values = {
        "APP_ENV": "production",
        "DATABASE_URL": "postgresql://test:unused@db/test",
        "SECRET_KEY": "A7x_kR4vQm9-jF3zTs8Np2Yw6Le0Ud5C",
        "CORS_ORIGINS": ["https://parking.example.com"],
    }
    return Settings(_env_file=None, **(values | overrides))


def test_production_requires_a_private_key_without_exposing_bad_values():
    sentinel = "secret-sentinel-demo-do-not-deploy-long-value"
    with pytest.raises(ValidationError) as error:
        production(SECRET_KEY=sentinel)
    assert sentinel not in str(error.value)
    assert "SECRET_KEY=" not in repr(production())


@pytest.mark.parametrize("overrides", [
    {"ALGORITHM": "none"}, {"ALGORITHM": "RS256"},
    {"DATABASE_URL": "sqlite:///private.db"}, {"CORS_ORIGINS": []},
    {"CORS_ORIGINS": ["*"]}, {"CORS_ORIGINS": ["http://parking.example.com"]},
    {"CORS_ORIGINS": ["https://parking.example.com/path"]},
    {"ACCESS_TOKEN_EXPIRE_MINUTES": 0},
])
def test_production_rejects_unsafe_configuration(overrides):
    with pytest.raises(ValidationError):
        production(**overrides)


def test_production_accepts_an_exact_https_origin():
    assert production().CORS_ORIGINS == ["https://parking.example.com"]


def test_demo_seed_refuses_an_unconfirmed_or_preserved_database():
    # The guard executes before creating a SQLAlchemy session.
    with pytest.raises(RuntimeError):
        require_demo_database("not-the-disposable-database")

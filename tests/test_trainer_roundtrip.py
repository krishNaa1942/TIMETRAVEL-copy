"""
End-to-end smoke round-trip: train on tiny synthetic CSVs, then load the
artifacts through the runtime LearnedPriors loader.
"""

import json

import pytest

from app.services.learned_prior import LearnedPriors
from scripts.train_models import train

QUALITY_COLS = [
    "Name",
    "State",
    "City",
    "Type",
    "Google review rating",
    "Entrance Fee in INR",
    "time needed to visit in hrs",
    "Significance",
]

PLACES_COLS = ["Place", "City", "Ratings", "Place_desc"]

EXPANDED_COLS = ["Name", "State", "Type", "Popularity"]

SYNTH_COLS = [
    "destination_name",
    "state_ut",
    "region",
    "category",
    "famous_for",
    "nearby_cities",
    "local_language",
    "popular_festival",
    "top_local_cuisine",
    "adventure_activities",
    "peak_season",
]


def _write_synthetic_data(data_dir):
    import pandas as pd

    data_dir.mkdir(parents=True, exist_ok=True)

    top = pd.DataFrame(
        [
            [
                "Taj Mahal",
                "Uttar Pradesh",
                "Agra",
                "Monument",
                4.6,
                50.0,
                3.0,
                "Mughal architecture",
            ],
            [
                "Goa Beach",
                "Goa",
                "Panaji",
                "Beach",
                4.4,
                0.0,
                6.0,
                "Nightlife and water sports",
            ],
            [
                "Jaipur Palace",
                "Rajasthan",
                "Jaipur",
                "Palace",
                4.3,
                100.0,
                2.0,
                "Rajput heritage",
            ],
            [
                "Darjeeling View",
                "West Bengal",
                "Darjeeling",
                "Hill station",
                4.5,
                30.0,
                5.0,
                "Tea gardens and mountains",
            ],
            [
                "Varanasi Ghats",
                "Uttar Pradesh",
                "Varanasi",
                "Religious",
                4.7,
                0.0,
                4.0,
                "Evening aarti",
            ],
            [
                "Munnar Hills",
                "Kerala",
                "Munnar",
                "Hill station",
                4.2,
                40.0,
                8.0,
                "Tea plantations",
            ],
        ],
        columns=QUALITY_COLS,
    )
    top.to_csv(data_dir / "top_indian_places.csv", index=False)

    places = pd.DataFrame(
        [
            ["Aguada Beach", "Panaji", 4.2, "Fort overlooking the Arabian Sea"],
            ["Calangute Beach", "Panaji", 4.0, "Popular party beach"],
            ["Hawa Mahal", "Jaipur", 4.1, "Palace of winds"],
            ["Dal Lake", "Srinagar", 4.3, "Houseboats and shikaras"],
        ],
        columns=PLACES_COLS,
    )
    places.to_csv(data_dir / "places.csv", index=False)

    expanded = pd.DataFrame(
        [
            ["Goa", "Goa", "Beach", 9.2],
            ["Rajasthan", "Rajasthan", "Heritage", 8.9],
            ["Kerala", "Kerala", "Backwaters", 9.0],
            ["Himachal", "Himachal Pradesh", "Mountains", 8.5],
            ["Tamil Nadu", "Tamil Nadu", "Temples", 8.2],
        ],
        columns=EXPANDED_COLS,
    )
    expanded.to_csv(data_dir / "expanded_destinations.csv", index=False)

    synth = pd.DataFrame(
        [
            [
                "Beach Resort Town",
                "Goa",
                "coastal",
                "Beach",
                "sunset parties",
                "Panaji",
                "Konkani",
                "Carnival",
                "fish curry",
                "water sports",
                "winter",
            ],
            [
                "Hill Station Retreat",
                "Kerala",
                "hills",
                "Nature",
                "tea gardens",
                "Munnar",
                "Malayalam",
                "Onam",
                "appam",
                "trekking",
                "summer",
            ],
            [
                "Heritage City",
                "Rajasthan",
                "desert",
                "Heritage",
                "forts",
                "Jaipur",
                "Rajasthani",
                "Gangaur",
                "dal baati",
                "camel safari",
                "winter",
            ],
            [
                "Pilgrim Town",
                "Uttar Pradesh",
                "plains",
                "Religious",
                "aarti",
                "Varanasi",
                "Hindi",
                "Dev Deepawali",
                "kachori",
                "boat rides",
                "winter",
            ],
        ],
        columns=SYNTH_COLS,
    )
    synth.to_csv(data_dir / "tourism_destinations.csv", index=False)


class TestTrainerRoundTrip:
    def test_smoke_train_and_load(self, tmp_path):
        data_dir = tmp_path / "training"
        out_dir = tmp_path / "models"
        _write_synthetic_data(data_dir)

        metadata = train(data_dir, out_dir, smoke=True)

        assert metadata["smoke"] is True
        assert metadata["quality"]["test_rows"] >= 1
        assert metadata["popularity"]["test_rows"] >= 1
        assert metadata["content"]["destinations"] >= 10

        for artifact in (
            "quality_model.joblib",
            "popularity_model.joblib",
            "content_vectorizer.joblib",
            "content_matrix.joblib",
            "content_names.json",
            "metadata.json",
        ):
            assert (out_dir / artifact).exists()

        priors = LearnedPriors(model_dir=str(out_dir))
        assert priors.is_available

        q = priors.quality("Taj Mahal")
        assert q is not None and 0.0 <= q <= 5.0

        p = priors.popularity("Goa")
        assert p is not None and 0.0 <= p <= 1.0

        matches = priors.content_similarity("goa beach nightlife", top_k=3)
        assert len(matches) >= 1

        score = priors.content_score("goa beach nightlife", "Calangute Beach")
        assert score is not None and 0.0 <= score <= 1.0

        meta = json.loads((out_dir / "metadata.json").read_text())
        assert meta["smoke"] is True

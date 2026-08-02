"""
Hermetic tests for scripts/prepare_training_data.py — ingest cleaning and
synthetic-data validation.
"""

import json

import pandas as pd
import pytest

from scripts.prepare_training_data import (
    GARBAGE_NAME_RE,
    _clean_qa,
    validate_tourism_destinations,
)


class TestQACleaning:
    def test_strips_newline_tags_and_empty_rows(self):
        raw = pd.DataFrame(
            [
                ["What is safe in Goa?", "TGU\n", "TGUHEA\n"],
                ["Best beaches?", "TTD", "TTDSPO"],
                ["", "TTD", "TTDSIG"],
                ["Empty tag question", "\n", "ACMOTH"],
            ],
            columns=["question", "coarse_intent", "fine_intent"],
        )
        qa = _clean_qa(raw)
        assert len(qa) == 2
        assert qa.iloc[0]["coarse_intent"] == "TGU"
        assert qa.iloc[0]["fine_intent"] == "TGUHEA"
        assert qa.iloc[1]["question"] == "Best beaches?"


class TestGarbageDetection:
    @pytest.mark.parametrize(
        "name,expected",
        [
            ("Place_0", True),
            ("Place_2999", True),
            ("Place 7", True),
            ("Sample1", True),
            ("Taj Mahal", False),
            ("Baga Beach", False),
            ("", False),
        ],
    )
    def test_garbage_patterns(self, name, expected):
        assert (
            GARBAGE_NAME_RE.match(name or "") is not None
            if expected
            else (GARBAGE_NAME_RE.match(name or "") is None)
        )


class TestTourismValidation:
    def _df(self):
        return pd.DataFrame(
            [
                {"destination_name": "Place_0", "state_ut": "goa", "x": 1},
                {"destination_name": "Place_0", "state_ut": "Goa", "x": 2},
                {"destination_name": "Baga Beach", "state_ut": "Goa", "x": 3},
                {"destination_name": "Mystery", "state_ut": "NotAState", "x": 4},
            ]
        )

    def test_dedupes_and_canonicalizes_states(self):
        clean, report = validate_tourism_destinations(self._df())
        assert report["duplicates_dropped"] == 1
        assert report["invalid_state_dropped"] == 1
        assert report["synthetic_rows"] == 1
        assert len(clean) == 2
        assert clean.iloc[0]["state_ut"] == "Goa"

    def test_all_rows_flagged_synthetic_for_place_n_names(self):
        df = pd.DataFrame(
            [{"destination_name": f"Place_{i}", "state_ut": "Kerala"} for i in range(5)]
        )
        clean, report = validate_tourism_destinations(df)
        assert len(clean) == 5
        assert report["synthetic_rows"] == 5
        assert clean["is_synthetic"].all()

    def test_jammu_kashmir_canonicalization(self):
        df = pd.DataFrame(
            [{"destination_name": "Gulmarg", "state_ut": "Jammu & Kashmir"}]
        )
        clean, _ = validate_tourism_destinations(df)
        assert clean.iloc[0]["state_ut"] == "Jammu And Kashmir"


class TestEndToEndPrepare:
    def test_full_roundtrip_on_synthetic_sources(self, tmp_path, monkeypatch):
        import scripts.prepare_training_data as prep

        source = tmp_path / "source"
        source.mkdir()
        (source / "5000TravelQuestionsDataset.csv").write_text(
            "Where to go in Goa?,TGU,TGUHEA\n,ENT,\n", encoding="latin-1"
        )
        (source / "cultural_events.json").write_text(
            json.dumps([{"title": "Carnival", "state": "Goa", "description": "x"}])
        )
        (source / "tourism_destinations-2026-01-01.csv").write_text(
            "destination_name,state_ut,region\nPlace_0,Goa,coastal\n"
        )

        training_dir = tmp_path / "training"
        prep.ingest(source, training_dir)

        qa = pd.read_csv(training_dir / "qa_questions.csv", encoding="utf-8")
        assert list(qa.columns) == ["question", "coarse_intent", "fine_intent"]
        assert len(qa) == 1
        assert qa.iloc[0]["coarse_intent"] == "TGU"

        events = json.loads((training_dir / "cultural_events.json").read_text())
        assert events[0]["title"] == "Carnival"

        synth = pd.read_csv(training_dir / "tourism_destinations.csv")
        assert len(synth) == 1

        report = prep.validate(training_dir, training_dir / "clean")
        clean_csv = training_dir / "clean" / "tourism_destinations_clean.csv"
        assert clean_csv.exists()
        clean = pd.read_csv(clean_csv)
        assert "is_synthetic" in clean.columns
        assert clean["is_synthetic"].iloc[0]
        assert report["files"]["tourism_destinations.csv"]["synthetic_rows"] == 1

"""Tests for the hybrid chatbot training data loader (Phase 7)."""

import json

from app.chatbot.engine import _load_training_data


def _write_intents(path, tags):
    path.write_text(
        json.dumps(
            {
                "intents": [
                    {
                        "tag": tag,
                        "patterns": [f"{tag} pattern one", f"{tag} pattern two"],
                    }
                    for tag in tags
                ]
            }
        )
    )


class TestLoadTrainingData:
    def test_patterns_are_lowercased(self, tmp_path):
        intents = tmp_path / "intents.json"
        qa = tmp_path / "qa_questions.csv"
        _write_intents(intents, ["greeting"])
        qa.write_text("question,coarse_intent\n")
        texts, labels, pattern_count, qa_count = _load_training_data(intents, qa)
        assert texts == ["greeting pattern one", "greeting pattern two"]
        assert labels == ["greeting", "greeting"]
        assert (pattern_count, qa_count) == (2, 0)

    def test_qa_rows_mapped_to_template_tags(self, tmp_path):
        intents = tmp_path / "intents.json"
        qa = tmp_path / "qa_questions.csv"
        _write_intents(intents, ["greeting"])
        qa.write_text(
            "question,coarse_intent\n"
            "Where can I eat in Goa?,FOD\n"
            "how to reach jaipur,TRS\n"
            "is it safe?,UNMAPPED\n"
        )
        texts, labels, pattern_count, qa_count = _load_training_data(intents, qa)
        assert texts[2:] == ["where can i eat in goa?", "how to reach jaipur"]
        assert labels[2:] == ["food_dining", "transport"]
        assert qa_count == 2

    def test_missing_qa_file_falls_back_to_patterns(self, tmp_path):
        intents = tmp_path / "intents.json"
        _write_intents(intents, ["greeting", "goodbye"])
        texts, labels, pattern_count, qa_count = _load_training_data(
            intents, tmp_path / "missing.csv"
        )
        assert pattern_count == 4
        assert qa_count == 0
        assert len(texts) == 4

    def test_malformed_qa_file_ignored(self, tmp_path):
        intents = tmp_path / "intents.json"
        qa = tmp_path / "qa_questions.csv"
        _write_intents(intents, ["greeting"])
        qa.write_text("not,header,rows\n")
        texts, labels, _, qa_count = _load_training_data(intents, qa)
        assert texts == ["greeting pattern one", "greeting pattern two"]
        assert qa_count == 0

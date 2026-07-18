/**
 * Language Phrasebook Service
 * Backend: /api/language
 */
import apiService from "./api";

interface LegacyPhraseRecord {
  id?: string;
  meaning?: string;
  phrase?: string;
  english?: string;
  local?: string;
  pronunciation?: string;
  transliteration?: string;
  category?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  tags?: string[];
  usage?: string;
}

interface LegacyPhrasebookResponse {
  destination: string;
  language: string;
  script?: string;
  phrases: LegacyPhraseRecord[];
}

export interface PhraseData {
  destination: string;
  language: string;
  script?: string;
  phrases: {
    id?: string;
    english: string;
    local: string;
    pronunciation?: string;
    transliteration?: string;
    category?: string;
    difficulty?: "beginner" | "intermediate" | "advanced";
    tags?: string[];
  }[];
}

function normalizePhraseRecord(
  phrase: LegacyPhraseRecord,
  destination: string,
  index: number,
): PhraseData["phrases"][number] {
  const english = phrase.english || phrase.meaning || phrase.phrase || "";
  const local = phrase.local || phrase.phrase || phrase.meaning || "";

  return {
    id: phrase.id || `${destination}-${index}`,
    english,
    local,
    pronunciation: phrase.pronunciation,
    transliteration: phrase.transliteration,
    category: phrase.category,
    difficulty: phrase.difficulty,
    tags: Array.isArray(phrase.tags) ? phrase.tags : [],
  };
}

function normalizePhrasebookResponse(
  response: LegacyPhrasebookResponse,
): PhraseData {
  return {
    destination: response.destination,
    language: response.language,
    script: response.script,
    phrases: (response.phrases || []).map((phrase, index) =>
      normalizePhraseRecord(phrase, response.destination, index),
    ),
  };
}

export interface DestinationInfo {
  key: string;
  label: string;
  language: string;
  script: string;
}

export const phrasebookService = {
  async getPhrases(destination: string): Promise<PhraseData> {
    const response = await apiService.get<LegacyPhrasebookResponse>(
      `/language/phrases?destination=${encodeURIComponent(destination)}`,
    );
    return normalizePhrasebookResponse(response);
  },

  async getDestinations(): Promise<{ destinations: DestinationInfo[] }> {
    return apiService.get("/language/destinations");
  },
};

export default phrasebookService;

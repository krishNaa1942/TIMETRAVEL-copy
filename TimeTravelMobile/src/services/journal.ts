/**
 * Travel Journal / Notes Service
 * Backend: /api/notes
 */
import apiService from "./api";

export interface TravelNote {
  id: number;
  destination: string;
  title: string;
  content: string;
  mood?: string;
  rating?: number;
  is_public: boolean;
  user_id?: number;
  created_at?: string;
}

export const journalService = {
  async createNote(data: {
    destination: string;
    title: string;
    content: string;
    mood?: string;
    rating?: number;
    is_public?: boolean;
  }): Promise<{ note: TravelNote }> {
    return apiService.post("/notes", data);
  },

  async listNotes(destination?: string): Promise<{ notes: TravelNote[] }> {
    const q = destination
      ? `?destination=${encodeURIComponent(destination)}`
      : "";
    return apiService.get(`/notes${q}`);
  },

  async getNote(id: number): Promise<{ note: TravelNote }> {
    return apiService.get(`/notes/${id}`);
  },

  async updateNote(
    id: number,
    data: Partial<TravelNote>,
  ): Promise<{ note: TravelNote }> {
    return apiService.put(`/notes/${id}`, data);
  },

  async deleteNote(id: number): Promise<void> {
    return apiService.delete(`/notes/${id}`);
  },

  async communityNotes(destination?: string): Promise<{ notes: TravelNote[] }> {
    const q = destination
      ? `?destination=${encodeURIComponent(destination)}`
      : "";
    return apiService.get(`/notes/community${q}`);
  },
};

export default journalService;

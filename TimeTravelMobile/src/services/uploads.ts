/**
 * uploadsService - Client for the /api/uploads blueprint
 * Photos + documents upload, list, delete
 */
import apiService from "./api";
import type { TripPhoto, TripDocument } from "./tripPlanner";

const toFormDataFile = (uri: string, field: string, fallbackName: string) => {
  const filename = uri.split("/").pop() || fallbackName;
  const match = /\.(\w+)$/.exec(filename);
  const type = match
    ? `image/${match[1]}`
    : "application/octet-stream";
  return { uri, name: filename, type };
};

export const uploadsService = {
  /**
   * Upload trip photos (one request per file; backend stores files[0])
   */
  async uploadPhotos(
    tripId: number,
    uris: string[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<TripPhoto[]> {
    const uploaded: TripPhoto[] = [];
    const total = uris.length;
    for (let index = 0; index < uris.length; index += 1) {
      const formData = new FormData();
      formData.append("trip_id", String(tripId));
      formData.append(
        "file",
        toFormDataFile(uris[index], "file", `photo_${index}.jpg`) as any,
      );
      const response = await apiService.post<{ photo: TripPhoto }>(
        "/uploads/photos",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      if (response?.photo) uploaded.push(response.photo);
      onProgress?.(index + 1, total);
    }
    return uploaded;
  },

  /**
   * Delete a trip photo
   */
  async deletePhoto(photoId: number): Promise<void> {
    return apiService.delete(`/uploads/photos/${photoId}`);
  },

  /**
   * Upload a trip document
   */
  async uploadDocument(
    tripId: number | undefined,
    data: {
      doc_type: string;
      title: string;
      expiry_date?: string;
      notes?: string;
      fileUri: string;
    },
  ): Promise<TripDocument> {
    const formData = new FormData();
    if (tripId != null) formData.append("trip_id", String(tripId));
    formData.append("doc_type", data.doc_type);
    formData.append("title", data.title);
    if (data.expiry_date) formData.append("expiry_date", data.expiry_date);
    if (data.notes) formData.append("notes", data.notes);
    formData.append("file", toFormDataFile(data.fileUri, "file", "document.pdf") as any);
    const response = await apiService.post<{ document: TripDocument }>(
      "/uploads/documents",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.document;
  },

  /**
   * List trip documents
   */
  async listDocuments(tripId?: number): Promise<TripDocument[]> {
    const query = tripId != null ? `?trip_id=${tripId}` : "";
    const response = await apiService.get<{ documents: TripDocument[] }>(
      `/uploads/documents${query}`,
    );
    return response.documents ?? [];
  },

  /**
   * Delete a trip document
   */
  async deleteDocument(documentId: number): Promise<void> {
    return apiService.delete(`/uploads/documents/${documentId}`);
  },
};

export default uploadsService;

/**
 * exportService - Client for the /api/export PDF endpoints
 */

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { API_BASE_URL } from "@/constants/config";
import { tokenManager } from "@/services/apiClient";

interface ItineraryExportPayload {
  destination: string;
  num_days: number;
  family_size: number;
  travel_class: string;
  interests?: string;
  itinerary: Array<{
    day: number;
    title?: string;
    morning?: unknown;
    afternoon?: unknown;
    evening?: unknown;
    tip?: string;
  }>;
}

const fetchPdfBytes = async (
  path: string,
  payload: Record<string, unknown>,
): Promise<string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const accessToken = await tokenManager.getValidToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(typeof result === "string" ? result : "");
    };
    reader.onerror = () => reject(new Error("Failed to read PDF response"));
    reader.readAsDataURL(blob);
  });
};

const saveAndShare = async (
  base64DataUrl: string,
  filename: string,
): Promise<string | null> => {
  const base64 = base64DataUrl.split(",")[1] ?? base64DataUrl;
  if (!FileSystem.cacheDirectory) {
    throw new Error("Local storage is unavailable on this device.");
  }

  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: "application/pdf",
      dialogTitle: filename,
      UTI: "com.adobe.pdf",
    });
  }
  return fileUri;
};

export const exportService = {
  async exportItineraryPdf(
    payload: ItineraryExportPayload,
  ): Promise<string | null> {
    const base64 = await fetchPdfBytes("/export/itinerary", {
      ...payload,
    } as unknown as Record<string, unknown>);
    const filename = `${(payload.destination || "Trip").replace(
      /[^\w]+/g,
      "_",
    )}_Itinerary.pdf`;
    return saveAndShare(base64, filename);
  },

  async exportBudgetPdf(
    payload: Record<string, unknown>,
  ): Promise<string | null> {
    const base64 = await fetchPdfBytes("/export/budget", payload);
    return saveAndShare(base64, "Trip_Budget.pdf");
  },
};

export default exportService;

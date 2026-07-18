/**
 * Chat Service — Enhanced with AI Agent mode
 * Supports agent mode with tool/route context for proactive recommendations
 */

import apiService from "./api";
import { ChatResponse } from "@/types";

type ChatResponseWithError = ChatResponse & {
  error_type?: string;
};

export const chatService = {
  /** Send a message to the chatbot */
  async sendMessage(
    message: string,
    sessionId: string,
    destination?: string,
  ): Promise<ChatResponse> {
    return apiService.post<ChatResponse>("/chat", {
      message,
      session_id: sessionId,
      destination: destination || undefined,
      mode: "auto",
    });
  },

  /** Send a message in AI Agent mode with rich context */
  async sendAgentMessage(
    message: string,
    sessionId: string,
    options: {
      destination?: string;
      routeContext?: string;
      toolsContext?: string[];
    } = {},
  ): Promise<ChatResponse> {
    const response = await apiService.post<ChatResponseWithError>("/chat", {
      message,
      session_id: sessionId,
      destination: options.destination || undefined,
      agent_mode: true,
      route_context: options.routeContext || "travel_agent",
      tools_context: options.toolsContext || [
        "itinerary",
        "budget",
        "safety",
        "weather",
        "maps",
        "places",
        "packing",
        "currency",
        "compare",
        "booking",
      ],
      mode: "ai",
    });

    if (
      response.model === "error" ||
      response.error_type === "quota_exhausted"
    ) {
      const classicResponse = await this.sendClassicMessage(
        message,
        sessionId,
        options.destination,
      );
      return {
        ...classicResponse,
        fallback_from: "gemini",
      };
    }

    return response;
  },

  /** Send a message to the classic assistant explicitly */
  async sendClassicMessage(
    message: string,
    sessionId: string,
    destination?: string,
  ): Promise<ChatResponse> {
    return apiService.post<ChatResponse>("/chat/classic", {
      message,
      session_id: sessionId,
      destination: destination || undefined,
    });
  },

  /** Check which chat engines are available */
  async getStatus(): Promise<{
    engines: {
      classic: { available: boolean; model: string };
      ai: { available: boolean; model: string | null };
    };
    default: string;
  }> {
    return apiService.get("/chat/status");
  },
};

export default chatService;

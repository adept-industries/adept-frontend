import { apiRequest } from "../../api/client.js";
import type { ChatMessage, ProjectTeam } from "./types.js";

export function fetchTeam(projectId: string, signal?: AbortSignal): Promise<ProjectTeam> {
  return apiRequest<ProjectTeam>({
    method: "GET",
    path: `/projects/${projectId}/team`,
    auth: "bearer",
    signal,
  });
}

export function fetchMessages(projectId: string, signal?: AbortSignal): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>({
    method: "GET",
    path: `/projects/${projectId}/messages`,
    auth: "bearer",
    signal,
  });
}

export function sendChatMessage(projectId: string, content: string): Promise<ChatMessage> {
  return apiRequest<ChatMessage, { content: string }>({
    method: "POST",
    path: `/projects/${projectId}/messages`,
    auth: "bearer",
    body: { content },
  });
}

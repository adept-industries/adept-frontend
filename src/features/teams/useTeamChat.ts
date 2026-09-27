import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Client } from "@stomp/stompjs";
import { accessTokenStore } from "../../auth/accessTokenStore.js";
import { fetchMessages, fetchTeam, sendChatMessage } from "./api.js";
import type { ChatMessage, ProjectTeam } from "./types.js";

export function useTeamChat(projectId: string | null) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const stompClientRef = useRef<Client | null>(null);

  // Load team info
  const teamQuery = useQuery<ProjectTeam>({
    queryKey: ["team-info", projectId],
    queryFn: ({ signal }) => fetchTeam(projectId!, signal),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });

  // Load message history
  const messagesQuery = useQuery<ChatMessage[]>({
    queryKey: ["team-messages", projectId],
    queryFn: ({ signal }) => fetchMessages(projectId!, signal),
    enabled: Boolean(projectId),
    staleTime: 0,
  });

  // WebSocket / STOMP connection for real-time messages
  useEffect(() => {
    if (!projectId || typeof window === "undefined") {
      setIsConnected(false);
      return;
    }

    const token = accessTokenStore.get();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const brokerURL = `${protocol}//${window.location.host}/ws`;

    const client = new Client({
      brokerURL,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setIsConnected(true);
        // Subscribe to real-time project channel
        client.subscribe(`/topic/projects/${projectId}`, (message) => {
          try {
            const incoming = JSON.parse(message.body) as ChatMessage;
            queryClient.setQueryData<ChatMessage[]>(["team-messages", projectId], (prev = []) => {
              if (prev.some((m) => m.id === incoming.id)) {
                return prev;
              }
              return [...prev, incoming];
            });
          } catch {
            // ignore malformed message body
          }
        });
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onStompError: () => {
        setIsConnected(false);
      },
      onWebSocketClose: () => {
        setIsConnected(false);
      },
    });

    try {
      client.activate();
      stompClientRef.current = client;
    } catch {
      // WebSocket activation failure (e.g. In environments without full WS support)
      setIsConnected(false);
    }

    return () => {
      stompClientRef.current = null;
      try {
        client.deactivate();
      } catch {
        // ignore deactivate error on unmount
      }
      setIsConnected(false);
    };
  }, [projectId, queryClient]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!projectId || !content.trim()) return;

      setIsSending(true);
      try {
        const trimmed = content.trim();
        const client = stompClientRef.current;

        // If STOMP client is connected, send via WebSocket message mapping
        if (client && client.connected) {
          client.publish({
            destination: `/app/projects/${projectId}/chat.send`,
            body: JSON.stringify({ content: trimmed }),
          });
        } else {
          // Fallback or direct send via REST (backend still broadcasts to /topic/projects/{projectId})
          const sent = await sendChatMessage(projectId, trimmed);
          queryClient.setQueryData<ChatMessage[]>(["team-messages", projectId], (prev = []) => {
            if (prev.some((m) => m.id === sent.id)) return prev;
            return [...prev, sent];
          });
        }
      } finally {
        setIsSending(false);
      }
    },
    [projectId, queryClient],
  );

  return {
    team: teamQuery.data ?? null,
    isLoadingTeam: teamQuery.isLoading,
    teamError: teamQuery.error,
    messages: messagesQuery.data ?? [],
    isLoadingMessages: messagesQuery.isLoading,
    messagesError: messagesQuery.error,
    isConnected,
    isSending,
    sendMessage,
    refetchMessages: messagesQuery.refetch,
  };
}

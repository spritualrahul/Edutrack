"use client";

import { useState } from "react";
import { Bot, Send, Sparkles, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, EmptyState } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { useAuthState } from "@/hooks/useAuth";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: string[];
};

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail || fallback;
  }
  return fallback;
}

const quickPrompts = [
  "What fees are pending?",
  "Show attendance this month",
  "Any recent notices?",
  "What was the latest payment?",
];

export default function ParentAssistantPage() {
  const auth = useAuthState();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi, I can help with your child’s fees, attendance, notices, and recent payment information.",
      actions: quickPrompts,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (value = message) => {
    const trimmed = value.trim();
    if (!auth.schoolId || !trimmed) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setMessage("");
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.chatWithParentAssistant(auth.schoolId, {
        message: trimmed,
        conversation_id: conversationId,
      });
      setConversationId(response.data.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.data.answer || "I could not find enough information for that question.",
          actions: response.data.suggested_actions || [],
        },
      ]);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not reach the parent assistant."));
    } finally {
      setLoading(false);
    }
  };

  if (!auth.schoolId) {
    return (
      <EmptyState
        icon={<Bot className="h-12 w-12" />}
        title="No school assigned"
        description="Ask the school to link your parent account before using the assistant."
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" /> Parent AI Assistant
              </CardTitle>
              <CardDescription>Secure answers from your child’s school data only.</CardDescription>
            </div>
            <Badge variant="info">Tenant protected</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="min-h-[460px] space-y-4 rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
            {messages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`flex gap-3 ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                {item.role === "assistant" && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                  item.role === "user" ? "bg-indigo-600 text-white" : "border border-gray-100 bg-white text-gray-700"
                }`}>
                  {item.content}
                  {item.actions && item.actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.actions.map((action) => (
                        <button
                          key={action}
                          className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                          onClick={() => sendMessage(action)}
                          disabled={loading}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {item.role === "user" && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                    <UserRound className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Bot className="h-4 w-4 text-indigo-500" /> Checking school records...
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void sendMessage();
              }}
              placeholder="Ask about pending fees, attendance, notices, or payment history..."
            />
            <Button onClick={() => sendMessage()} loading={loading}>
              <Send className="h-4 w-4" /> Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

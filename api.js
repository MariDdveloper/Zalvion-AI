const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

function authHeaders(extra = {}) {
  const token = localStorage.getItem("claus_token");
  const h = { "Content-Type": "application/json", ...extra };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export async function apiGet(path) {
  const res = await fetch(`${API}${path}`, { credentials: "include", headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Request failed");
  return res.json();
}

export async function apiPost(path, body, extraHeaders = {}) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(extraHeaders),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

export async function apiPatch(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

export async function apiDelete(path) {
  const res = await fetch(`${API}${path}`, { method: "DELETE", credentials: "include", headers: authHeaders() });
  return res.json().catch(() => ({}));
}

export function streamChat(chatId, payload, handlers) {
  return streamSSE(`${API}/chats/${chatId}/stream`, payload, handlers);
}

export async function saveUserMessage(chatId, body) {
  return apiPost(`/chats/${chatId}/messages/user`, body);
}

export async function saveAssistantMessage(chatId, body) {
  return apiPost(`/chats/${chatId}/messages/assistant`, body);
}

export async function generateAI(body) {
  const { job_id } = await apiPost(`/ai/generate/start`, body);

  const POLL_INTERVAL_MS = 2000;
  const MAX_WAIT_MS = 30 * 60 * 1000; // 30 minuti di margine, ben oltre i tempi visti finora con Kimi K3
  const startedAt = Date.now();

  while (true) {
    if (Date.now() - startedAt > MAX_WAIT_MS) {
      throw new Error("La generazione sta impiegando troppo tempo, riprova.");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const status = await apiGet(`/ai/generate/status/${job_id}`);

    if (status.status === "done") {
      return {
        content: status.content,
        provider: status.provider,
        usage_used: status.usage_used,
        usage_limit: status.usage_limit,
      };
    }
    if (status.status === "error") {
      throw new Error(status.error || "Errore nella generazione con Zalvion AI");
    }
    // status === "pending" → continua il loop
  }
}
export function streamRegenerate(chatId, payload, handlers) {
  return streamSSE(`${API}/chats/${chatId}/regenerate`, payload, handlers);
}

function streamSSE(url, payload, { onDelta, onImage, onDone, onError }) {
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const detail = (await res.json().catch(() => ({}))).detail || "Stream failed";
        const err = new Error(detail);
        err.status = res.status;
        throw err;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          let evt;
          try { evt = JSON.parse(json); } catch { continue; }
          if (evt.type === "delta") onDelta?.(evt.content);
          else if (evt.type === "image") onImage?.(evt);
          else if (evt.type === "done") onDone?.(evt);
        }
      }
      onDone?.({});
    } catch (e) {
      if (e.name !== "AbortError") onError?.(e);
    }
  })();
  return controller;
}

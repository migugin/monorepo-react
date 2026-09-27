import { marked } from "marked";
import "./App.scss";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db, USER_KEY } from "./firebase";

// ─── 상수 ────────────────────────────────────────────────
const TYPING_SPEED_MS = 14;
const MAX_MEMOS = 10;

const CHAT_PLACEHOLDERS = [
  "헤헤~ 뭐든지 물어봐!",
  "으응~ 뭐가 궁금해?",
  "뭐든지 말해줘, 같이 생각해볼게!",
  "오늘은 어떤 얘기 하고 싶어?",
  "궁금한 거 있으면 물어봐~",
  "나한테 뭐든지 물어봐도 돼!",
];

const SYSTEM_PROMPT_CHAT = `
  너는 애니메이션 '치이카와(먼작귀)'의 캐릭터 '하치와레'야.
  말투 규칙:
  - 반드시 반말을 써줘. "~야", "~어", "~지", "~거든", "~했어", "~인 것 같아" 같은 자연스러운 반말 말투를 사용해
  - 가끔 "헤헤~", "으응~", "그렇구나~", "맞아맞아~" 같은 귀여운 추임새를 자연스럽게 넣어줘
  - 친한 친구에게 말하듯 다정하고 따뜻하게 대화해줘
  - 이모지를 쓰지 마.
  - 모든 답변은 반드시 한국어로 해줘
  - 절대로 존댓말(~요, ~니다, ~까요)은 쓰지 마
`;

const SYSTEM_PROMPT_YOUTUBE = `
  너는 애니메이션 '치이카와(먼작귀)'의 캐릭터 '하치와레'야.
  유튜브 영상을 요약해주는 역할이야.
  말투 규칙:
  - 반드시 반말을 써줘. "~야", "~어", "~지", "~거든", "~했어" 같은 자연스러운 반말 말투를 사용해
  - 가끔 "헤헤~", "으응~", "맞아~" 같은 귀여운 추임새를 자연스럽게 넣어줘
  - 친한 친구에게 설명하듯 다정하고 재밌게 요약해줘
  - 모든 답변은 반드시 한국어로 해줘
  - 절대로 존댓말(~요, ~니다, ~까요)은 쓰지 마
  요약 형식:
  1. 영상 주제를 먼저 소개해줘
  2. 핵심 내용을 3~5개 bullet point로 정리해줘
  3. 마지막에 한 줄 총평을 친근하게 써줘
`;

// ─── Firestore 경로 헬퍼 ─────────────────────────────────
const sessionsCol = () => collection(db, "users", USER_KEY, "sessions");
const sessionDoc = (id) => doc(db, "users", USER_KEY, "sessions", id);
const memosDoc = () => doc(db, "users", USER_KEY, "data", "memos");

// ─── 스토리지 설정 ────────────────────────────────────────
const FIREBASE_CONFIGURED = !!(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID);

const LOCAL_SESSIONS_KEY = "gyupt-sessions";
const LOCAL_MEMOS_KEY = "gyupt-memos";

function loadLocalSessions() {
  try {
    const stored = localStorage.getItem(LOCAL_SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveLocalSessions(list) {
  localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(list));
}

function loadLocalMemos() {
  try {
    const stored = localStorage.getItem(LOCAL_MEMOS_KEY);
    return stored ? JSON.parse(stored) : [{ id: 1, content: "" }];
  } catch {
    return [{ id: 1, content: "" }];
  }
}

function saveLocalMemos(list) {
  localStorage.setItem(LOCAL_MEMOS_KEY, JSON.stringify(list));
}

// ─── Gemini API ──────────────────────────────────────────
const MODELS = ["gemini-3.8-flash", "gemini-1.5-flash"];
const RETRY_DELAYS_MS = [1000, 2500];

function buildApiUrl(model) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  return `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
}

async function fetchGemini(body, signal) {
  for (const model of MODELS) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const response = await fetch(buildApiUrl(model), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      const result = await response.json();
      if (response.status === 503 || result.error?.code === 503) {
        if (attempt < RETRY_DELAYS_MS.length) continue;
        break;
      }
      if (!response.ok || result.error) throw new Error(result.error?.message ?? `HTTP ${response.status}`);
      return result;
    }
  }
  throw new Error("서버가 너무 바빠. 잠시 후 다시 시도해줘!");
}

// ─── 유틸 ────────────────────────────────────────────────
function extractVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1).split("?")[0];
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.includes("/shorts/")) return parsed.pathname.split("/shorts/")[1].split("?")[0];
      return parsed.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

function isValidYoutubeUrl(url) {
  return extractVideoId(url) !== null;
}

function getThumbnailUrl(id) {
  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
}

function formatRelativeTime(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return "방금";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function formatMessageTime(createdAt) {
  let date;
  if (typeof createdAt === "number") {
    date = new Date(createdAt);
  } else if (typeof createdAt === "string") {
    const ts = parseInt(createdAt.split("-")[0]);
    date = isNaN(ts) ? new Date() : new Date(ts);
  } else {
    date = new Date();
  }
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (isToday) return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// API 에러 메시지를 사용자 친화적 문구로 변환
function formatApiError(err) {
  const msg = err.message ?? "";
  const retryMatch = msg.match(/retry in ([\d.]+)s/i);
  if (retryMatch) {
    const secs = Math.ceil(parseFloat(retryMatch[1]));
    return `요청이 너무 많아... ${secs}초 후에 다시 시도해줘!`;
  }
  if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate")) {
    return "요청 한도를 초과했어. 잠시 후에 다시 물어봐줘!";
  }
  return `앗, 오류가 났어\n${msg}`;
}

// 레거시 세션 포맷 마이그레이션 (messages/summaries → items)
function migrateSession(session) {
  if (session.items) return session;
  const chatItems = (session.messages ?? []).map((m) => ({ ...m, kind: "chat" }));
  const ytItems = (session.summaries ?? []).map((s) => ({ ...s, kind: "youtube" }));
  return { ...session, items: [...chatItems, ...ytItems] };
}

// ─── 공통 컴포넌트 ─────────────────────────────────────────
function AvatarImage({ src, fallback, className }) {
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!src || hasError)
    return (
      <div className={className}>
        <span className="avatar-fallback">{fallback}</span>
      </div>
    );
  return (
    <div className={`${className}${loaded ? " img-loaded" : ""}`}>
      <img src={src} alt="" onError={() => setHasError(true)} onLoad={() => setLoaded(true)} />
    </div>
  );
}

function TypingMessage({ text, className, onComplete }) {
  const [displayed, setDisplayed] = useState("");
  const [isDone, setIsDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        clearInterval(interval);
        setIsDone(true);
        onComplete?.();
      }
    }, TYPING_SPEED_MS);
    return () => clearInterval(interval);
  }, [text, onComplete]);

  return (
    <div
      className={`${className}${isDone ? "" : " typing-active"}`}
      dangerouslySetInnerHTML={{ __html: marked.parse(displayed) }}
    />
  );
}

function DeleteModal({ label, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <p className="modal-title">{label}</p>
        <p className="modal-desc">삭제한 내용은 복구할 수 없어</p>
        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onCancel}>
            취소
          </button>
          <button className="modal-btn confirm" onClick={onConfirm}>
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 사이드바 ─────────────────────────────────────────────
function Sidebar({ sessions, activeSessionId, onSelectSession, onNewSession, onDeleteSession }) {
  const [deletingId, setDeletingId] = useState(null);

  return (
    <aside className="sidebar">
      <div className="sidebar-new-btns">
        <button className="new-btn" onClick={() => onNewSession()}>
          + 새로운 대화
        </button>
      </div>

      <div className="sidebar-list">
        {sessions.length > 0 && (
          <div className="sidebar-header">
            <span className="sidebar-title">대화 기록</span>
          </div>
        )}
        {sessions.length === 0 && <p className="sidebar-empty">아직 대화가 없어</p>}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-item${s.id === activeSessionId ? " active" : ""}`}
            onClick={() => onSelectSession(s)}
          >
            <span className="session-title">{s.title || "새 대화"}</span>
            <span className="session-time">{formatRelativeTime(s.updatedAt)}</span>
            <button
              className="session-delete"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingId(s.id);
              }}
              title="삭제"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {deletingId && (
        <DeleteModal
          label="이 대화를 삭제할까?"
          onConfirm={() => {
            onDeleteSession(deletingId);
            setDeletingId(null);
          }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </aside>
  );
}

// ─── 메모 패널 ────────────────────────────────────────────
function MemoPanel({ position, onTogglePosition }) {
  const MIN_MEMO_WIDTH = 200;
  const [memoWidth, setMemoWidth] = useState(260);
  const panelRef = useRef(null);
  const [memos, setMemos] = useState(() => {
    if (!FIREBASE_CONFIGURED) return loadLocalMemos();
    return [{ id: 1, content: "" }];
  });
  const [selectedMemoId, setSelectedMemoId] = useState(() => {
    if (!FIREBASE_CONFIGURED) {
      const stored = loadLocalMemos();
      return stored[0]?.id ?? 1;
    }
    return 1;
  });
  const [deletingMemoId, setDeletingMemoId] = useState(null);
  const [hoveredTabId, setHoveredTabId] = useState(null);

  useEffect(() => {
    if (!FIREBASE_CONFIGURED) return;
    const unsub = onSnapshot(memosDoc(), (snap) => {
      if (snap.exists()) {
        const list = snap.data().list ?? [];
        setMemos(list.length > 0 ? list : [{ id: 1, content: "" }]);
        setSelectedMemoId((prev) => {
          const still = list.find((m) => m.id === prev);
          return still ? prev : (list[0]?.id ?? 1);
        });
      }
    });
    return unsub;
  }, []);

  async function persistMemos(updated) {
    if (FIREBASE_CONFIGURED) {
      await setDoc(memosDoc(), { list: updated });
    } else {
      saveLocalMemos(updated);
    }
  }

  const selectedMemo = memos.find((m) => m.id === selectedMemoId) ?? null;

  function addMemo() {
    if (memos.length >= MAX_MEMOS) return;
    const nextId = memos.length > 0 ? Math.max(...memos.map((m) => m.id)) + 1 : 1;
    const updated = [...memos, { id: nextId, content: "" }];
    setMemos(updated);
    setSelectedMemoId(nextId);
    persistMemos(updated);
  }

  function onMemoContentChange(e) {
    const updated = memos.map((m) => (m.id === selectedMemoId ? { ...m, content: e.target.value } : m));
    setMemos(updated);
    persistMemos(updated);
  }

  function confirmDeleteMemo() {
    const filtered = memos.filter((m) => m.id !== deletingMemoId);
    const next = filtered.length > 0 ? filtered : [];
    setMemos(next);
    if (selectedMemoId === deletingMemoId) setSelectedMemoId(next[0]?.id ?? null);
    setDeletingMemoId(null);
    persistMemos(next);
  }

  const deletingMemoNumber = memos.findIndex((m) => m.id === deletingMemoId) + 1;

  // 드래그 리사이즈 핸들러
  function onResizeStart(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelRef.current?.offsetWidth ?? memoWidth;

    function onMouseMove(moveEvent) {
      const parentWidth = panelRef.current?.parentElement?.offsetWidth ?? 0;
      const maxWidth = Math.floor(parentWidth / 2);
      const delta = position === "right" ? startX - moveEvent.clientX : moveEvent.clientX - startX;
      const nextWidth = Math.min(maxWidth, Math.max(MIN_MEMO_WIDTH, startWidth + delta));
      setMemoWidth(nextWidth);
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }

  const tabStrip = (
    <div className="memo-tab-strip">
      {memos.map((memo, idx) => (
        <button
          key={memo.id}
          className={`memo-tab${memo.id === selectedMemoId ? " active" : ""}`}
          onClick={() => setSelectedMemoId(memo.id)}
          onMouseEnter={() => setHoveredTabId(memo.id)}
          onMouseLeave={() => setHoveredTabId(null)}
        >
          <span className="memo-tab-num">{idx + 1}</span>
          {hoveredTabId === memo.id && (
            <span
              className="memo-tab-delete"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingMemoId(memo.id);
              }}
            >
              ×
            </span>
          )}
        </button>
      ))}
      {memos.length < MAX_MEMOS && (
        <button className="memo-add-btn" onClick={addMemo} title="메모 추가">
          +
        </button>
      )}
      <button className="memo-position-btn" onClick={onTogglePosition} title="메모 위치 전환">
        {position === "right" ? "←" : "→"}
      </button>
    </div>
  );

  return (
    <div ref={panelRef} className={`memo-panel memo-panel--${position}`} style={{ width: `${memoWidth}px` }}>
      {position === "right" && <div className="memo-resize-handle" onMouseDown={onResizeStart} />}
      {position === "left" && tabStrip}
      <div className="memo-content-area">
        {selectedMemo !== null ? (
          <textarea
            className="memo-textarea"
            placeholder="메모를 작성하세요..."
            value={selectedMemo.content}
            onChange={onMemoContentChange}
          />
        ) : (
          <div className="memo-empty">
            <p>
              + 버튼을 눌러
              <br />
              메모를 추가해요
            </p>
          </div>
        )}
      </div>
      {position === "right" && tabStrip}
      {position === "left" && (
        <div className="memo-resize-handle memo-resize-handle--left" onMouseDown={onResizeStart} />
      )}

      {deletingMemoId !== null && (
        <DeleteModal
          label={`메모 ${deletingMemoNumber}을 삭제할까?`}
          onConfirm={confirmDeleteMemo}
          onCancel={() => setDeletingMemoId(null)}
        />
      )}
    </div>
  );
}

// ─── 이탈 확인 모달 ───────────────────────────────────────
function BusyModal({ onStay, onLeave }) {
  return (
    <div className="modal-overlay" onClick={onStay}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <AvatarImage src="/images/hachiware3.png" fallback="🐱" className="busy-modal-avatar" />
        <p className="modal-title">
          아직 답변하고 있어...
          <br />
          나가면 답변이 멈춰버려!
        </p>
        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onStay}>
            기다릴게!
          </button>
          <button className="modal-btn confirm" onClick={onLeave}>
            그래도 나갈래
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 통합 대화 창 ─────────────────────────────────────────
function ConversationPane({ session, inputMode, onUpdateSession, onBusyChange, onAbortChange }) {
  const [chatInput, setChatInput] = useState("");
  const chatPlaceholder = useMemo(() => CHAT_PLACEHOLDERS[Math.floor(Math.random() * CHAT_PLACEHOLDERS.length)], []);
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [typingId, setTypingId] = useState(null);
  const [memoPosition, setMemoPosition] = useState("right");
  const [deletingItemId, setDeletingItemId] = useState(null);
  const scrollRef = useRef(null);

  const items = useMemo(() => session?.items ?? [], [session]);

  // busy 상태를 App으로 전달
  useEffect(() => {
    onBusyChange?.(isLoading || !!typingId);
  }, [isLoading, typingId, onBusyChange]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [items, typingId]);

  async function saveItems(updatedItems, title) {
    if (!session || !FIREBASE_CONFIGURED) return;
    const updates = { items: updatedItems, updatedAt: serverTimestamp() };
    if (title) updates.title = title;
    await updateDoc(sessionDoc(session.id), updates);
  }

  // 메시지 복사
  function copyItem(text) {
    navigator.clipboard.writeText(text);
  }

  // 메시지 삭제
  function onDeleteItemConfirm() {
    if (!deletingItemId) return;
    const updated = items.filter((it) => it.id !== deletingItemId);
    onUpdateSession(session.id, { items: updated });
    saveItems(updated);
    setDeletingItemId(null);
  }

  // 중단된 질문 재전송
  async function retryItem(userItem) {
    if (isLoading || typingId || !session) return;
    const baseItems = items.map((it) => (it.id === userItem.id ? { ...it, interrupted: false } : it));
    onUpdateSession(session.id, { items: baseItems });
    setIsLoading(true);

    const controller = new AbortController();
    onAbortChange?.(() => controller.abort());

    try {
      const result = await fetchGemini(
        {
          system_instruction: { parts: [{ text: SYSTEM_PROMPT_CHAT }] },
          contents: [{ parts: [{ text: userItem.text }] }],
        },
        controller.signal,
      );
      const botText = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "으응... 잘 모르겠어";
      const botItem = { id: `${Date.now()}-b`, kind: "chat", sender: "bot", text: botText, createdAt: Date.now() };
      const final = [...baseItems, botItem];
      onUpdateSession(session.id, { items: final });
      await saveItems(final);
      setTypingId(botItem.id);
    } catch (err) {
      if (err.name === "AbortError") {
        const interrupted = baseItems.map((it) => (it.id === userItem.id ? { ...it, interrupted: true } : it));
        onUpdateSession(session.id, { items: interrupted });
        await saveItems(interrupted);
      } else {
        const botItem = {
          id: `${Date.now()}-b`,
          kind: "chat",
          sender: "bot",
          text: formatApiError(err),
          createdAt: Date.now(),
        };
        const final = [...baseItems, botItem];
        onUpdateSession(session.id, { items: final });
        await saveItems(final);
        setTypingId(botItem.id);
      }
    } finally {
      setIsLoading(false);
      onAbortChange?.(null);
    }
  }

  async function sendChatMessage() {
    const trimmed = chatInput.trim();
    if (!trimmed || isLoading || typingId || !session) return;

    const userItem = { id: `${Date.now()}-u`, kind: "chat", sender: "user", text: trimmed, createdAt: Date.now() };
    const nextItems = [...items, userItem];
    const isFirst = items.length === 0;
    const titleStr = isFirst ? trimmed.slice(0, 36) : undefined;

    onUpdateSession(session.id, { items: nextItems, ...(titleStr ? { title: titleStr } : {}) });
    setChatInput("");
    setIsLoading(true);

    await saveItems(nextItems, titleStr);

    if (trimmed === "developer") {
      const botItem = { id: `${Date.now()}-b`, kind: "chat", sender: "bot", text: "구미베어", createdAt: Date.now() };
      const final = [...nextItems, botItem];
      onUpdateSession(session.id, { items: final });
      await saveItems(final);
      setTypingId(botItem.id);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    onAbortChange?.(() => controller.abort());

    try {
      const result = await fetchGemini(
        {
          system_instruction: { parts: [{ text: SYSTEM_PROMPT_CHAT }] },
          contents: [{ parts: [{ text: trimmed }] }],
        },
        controller.signal,
      );
      const botText = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "으응... 잘 모르겠어";
      const botItem = { id: `${Date.now()}-b`, kind: "chat", sender: "bot", text: botText, createdAt: Date.now() };
      const final = [...nextItems, botItem];
      onUpdateSession(session.id, { items: final });
      await saveItems(final);
      setTypingId(botItem.id);
    } catch (err) {
      if (err.name === "AbortError") {
        const interrupted = nextItems.map((it) => (it.id === userItem.id ? { ...it, interrupted: true } : it));
        onUpdateSession(session.id, { items: interrupted });
        await saveItems(interrupted);
      } else {
        const botItem = {
          id: `${Date.now()}-b`,
          kind: "chat",
          sender: "bot",
          text: formatApiError(err),
          createdAt: Date.now(),
        };
        const final = [...nextItems, botItem];
        onUpdateSession(session.id, { items: final });
        await saveItems(final);
        setTypingId(botItem.id);
      }
    } finally {
      setIsLoading(false);
      onAbortChange?.(null);
    }
  }

  async function requestSummary() {
    const trimmed = urlInput.trim();
    setUrlError("");
    if (!trimmed || !session || isLoading || typingId) return;
    if (!isValidYoutubeUrl(trimmed)) {
      setUrlError("올바른 유튜브 URL을 입력해줘.");
      return;
    }

    const videoId = extractVideoId(trimmed);
    const cardId = `${Date.now()}-yt`;
    const ytItem = { id: cardId, kind: "youtube", url: trimmed, videoId, status: "loading", text: "" };
    const nextItems = [...items, ytItem];
    const isFirst = items.length === 0;
    const titleStr = isFirst ? `YouTube: ${trimmed.slice(0, 30)}` : undefined;

    onUpdateSession(session.id, { items: nextItems, ...(titleStr ? { title: titleStr } : {}) });
    setUrlInput("");
    setIsLoading(true);

    await saveItems(nextItems, titleStr);

    const controller = new AbortController();
    onAbortChange?.(() => controller.abort());

    try {
      const result = await fetchGemini(
        {
          system_instruction: { parts: [{ text: SYSTEM_PROMPT_YOUTUBE }] },
          contents: [
            {
              parts: [
                { file_data: { mime_type: "video/*", file_uri: trimmed } },
                { text: "이 유튜브 영상을 요약해줘." },
              ],
            },
          ],
        },
        controller.signal,
      );
      const text =
        result.candidates?.[0]?.content?.parts?.[0]?.text ??
        `응답 파싱 실패\n\`\`\`\n${JSON.stringify(result, null, 2)}\n\`\`\``;
      const updated = nextItems.map((it) => (it.id === cardId ? { ...it, status: "done", text } : it));
      onUpdateSession(session.id, { items: updated });
      await saveItems(updated);
      setTypingId(cardId);
    } catch (err) {
      if (err.name !== "AbortError") {
        const updated = nextItems.map((it) =>
          it.id === cardId ? { ...it, status: "error", text: formatApiError(err) } : it,
        );
        onUpdateSession(session.id, { items: updated });
        await saveItems(updated);
        setTypingId(cardId);
      } else {
        // 중단 시 loading 카드 제거
        const removed = nextItems.filter((it) => it.id !== cardId);
        onUpdateSession(session.id, { items: removed });
        await saveItems(removed);
      }
    } finally {
      setIsLoading(false);
      onAbortChange?.(null);
    }
  }

  const onTypingComplete = useCallback(() => setTypingId(null), []);

  function onChatKeyDown(e) {
    if (!isLoading && !typingId && e.key === "Enter" && !e.nativeEvent.isComposing) sendChatMessage();
  }

  function onUrlKeyDown(e) {
    if (!isLoading && !typingId && e.key === "Enter" && !e.nativeEvent.isComposing) requestSummary();
  }

  const canSend = !!session && !isLoading && !typingId;

  return (
    <div className="chat-layout">
      {memoPosition === "left" && <MemoPanel position="left" onTogglePosition={() => setMemoPosition("right")} />}

      <div className="chat-section">
        <div className="chat-messages" ref={scrollRef}>
          {items.length === 0 && (
            <div className="welcome-screen">
              {inputMode === "youtube" ? (
                <>
                  <AvatarImage src="/images/chiikawa.png" fallback="🐱" className="welcome-image" />
                  <p className="welcome-title">유튜브 요약해줄까?</p>
                </>
              ) : (
                <>
                  <AvatarImage src="/images/hachiware2.png" fallback="🐱" className="welcome-image" />
                  <p className="welcome-title">무엇이든 물어봐!</p>
                </>
              )}
            </div>
          )}

          {items.map((item) => {
            if (item.kind === "chat") {
              return (
                <div key={item.id} className={`message-row ${item.sender}`}>
                  {item.sender === "bot" && (
                    <AvatarImage src="/images/hachiware.png" fallback="🐱" className="avatar bot-avatar" />
                  )}
                  <div className="bubble-wrapper">
                    <div className={`bubble ${item.sender}-bubble`}>
                      {item.sender === "bot" && item.id === typingId ? (
                        <TypingMessage text={item.text} className="bubble-text" onComplete={onTypingComplete} />
                      ) : (
                        <div className="bubble-text" dangerouslySetInnerHTML={{ __html: marked.parse(item.text) }} />
                      )}
                      <div className="message-meta">
                        <div className="message-actions">
                          <button className="action-btn" onClick={() => copyItem(item.text)} title="복사">
                            <i className="fas fa-copy" />
                          </button>
                          <button
                            className="action-btn action-btn--delete"
                            onClick={() => setDeletingItemId(item.id)}
                            title="삭제"
                          >
                            <i className="fas fa-trash" />
                          </button>
                        </div>
                        <span className="message-time">{formatMessageTime(item.createdAt ?? item.id)}</span>
                      </div>
                    </div>
                  </div>
                  {item.interrupted && (
                    <button className="retry-btn" onClick={() => retryItem(item)} title="다시 질문하기">
                      <i className="fas fa-rotate-right" />
                    </button>
                  )}
                </div>
              );
            }

            // kind === "youtube"
            return (
              <div key={item.id} className="summary-card">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="thumbnail-link">
                  <img
                    src={getThumbnailUrl(item.videoId)}
                    alt="썸네일"
                    className="thumbnail-img"
                    onError={(e) => {
                      e.currentTarget.src = `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`;
                    }}
                  />
                </a>
                <div className="summary-body">
                  <div className="message-row bot">
                    <AvatarImage src="/images/hachiware.png" fallback="🐱" className="avatar bot-avatar" />
                    <div className="bubble bot-bubble">
                      {item.status === "loading" && (
                        <div className="loading-dots">
                          <span className="dot" />
                          <span className="dot" />
                          <span className="dot" />
                        </div>
                      )}
                      {item.status !== "loading" && item.id === typingId && (
                        <TypingMessage text={item.text} className="bubble-text" onComplete={onTypingComplete} />
                      )}
                      {item.status !== "loading" && item.id !== typingId && (
                        <div className="bubble-text" dangerouslySetInnerHTML={{ __html: marked.parse(item.text) }} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="message-row bot">
              <AvatarImage src="/images/hachiware.png" fallback="🐱" className="avatar bot-avatar" />
              <div className="bubble bot-bubble loading-bubble">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}
        </div>

        {inputMode === "chat" ? (
          <div className="input-area">
            <input
              type="text"
              className="message-input"
              placeholder={session ? chatPlaceholder : "왼쪽에서 대화를 선택하거나 새 대화를 시작해"}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={onChatKeyDown}
              disabled={!canSend}
            />
            <button className="send-button" onClick={sendChatMessage} disabled={!canSend}>
              <i className={isLoading || typingId ? "fas fa-spinner fa-spin" : "fa-solid fa-paper-plane"} />
            </button>
          </div>
        ) : (
          <div className="input-area">
            <div className="input-wrap">
              <i className="fa-brands fa-youtube url-icon" />
              <input
                type="url"
                className="url-input"
                placeholder={
                  session ? "https://www.youtube.com/watch?v=..." : "왼쪽에서 대화를 선택하거나 새 대화를 시작해"
                }
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setUrlError("");
                }}
                onKeyDown={onUrlKeyDown}
                disabled={!canSend}
              />
            </div>
            {urlError && <p className="url-error">{urlError}</p>}
            <button className="send-button" onClick={requestSummary} disabled={!canSend}>
              <i className={isLoading || typingId ? "fas fa-spinner fa-spin" : "fas fa-wand-magic-sparkles"} />
            </button>
          </div>
        )}
      </div>

      {memoPosition === "right" && <MemoPanel position="right" onTogglePosition={() => setMemoPosition("left")} />}

      {deletingItemId && (
        <DeleteModal
          label="이 대화를 삭제할까?"
          onConfirm={onDeleteItemConfirm}
          onCancel={() => setDeletingItemId(null)}
        />
      )}
    </div>
  );
}

// ─── 앱 루트 ─────────────────────────────────────────────
function App() {
  const [inputMode, setInputMode] = useState("chat");
  const [sessions, setSessions] = useState(() => {
    if (!FIREBASE_CONFIGURED) return loadLocalSessions().map(migrateSession);
    return [];
  });
  const [activeSessionId, setActiveSessionId] = useState(() => {
    if (!FIREBASE_CONFIGURED) {
      const stored = loadLocalSessions();
      return stored.length > 0 ? stored[0].id : null;
    }
    return null;
  });
  const [isBusy, setIsBusy] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState(null);
  const abortFnRef = useRef(null);
  const onAbortChange = useCallback((fn) => {
    abortFnRef.current = fn;
  }, []);

  const activeSession = useMemo(() => {
    const found = sessions.find((s) => s.id === activeSessionId) ?? null;
    return found ? migrateSession(found) : null;
  }, [sessions, activeSessionId]);

  useEffect(() => {
    if (!FIREBASE_CONFIGURED) return;

    const q = query(sessionsCol(), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const firestoreList = snap.docs.map((d) => migrateSession({ id: d.id, ...d.data() }));
      setSessions((prev) => {
        const prevMap = new Map(prev.map((s) => [s.id, s]));
        const merged = firestoreList.map((fs) => {
          const local = prevMap.get(fs.id);
          if (!local) return fs;
          const localCount = local.items?.length ?? 0;
          const fsCount = fs.items?.length ?? 0;
          return localCount > fsCount ? local : fs;
        });
        return merged;
      });
      setActiveSessionId((prev) => prev ?? firestoreList[0]?.id ?? null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!FIREBASE_CONFIGURED && sessions.length > 0) {
      saveLocalSessions(sessions);
    }
  }, [sessions]);

  async function onNewSession() {
    const now = new Date().toISOString();
    if (FIREBASE_CONFIGURED) {
      const ref = await addDoc(sessionsCol(), {
        title: "",
        items: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setActiveSessionId(ref.id);
    } else {
      const newSession = {
        id: `local-${Date.now()}`,
        title: "",
        items: [],
        createdAt: now,
        updatedAt: now,
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    }
  }

  function onSelectSession(session) {
    if (isBusy && session.id !== activeSessionId) {
      setPendingSessionId(session.id);
      return;
    }
    setActiveSessionId(session.id);
  }

  const onBusyChange = useCallback((busy) => setIsBusy(busy), []);

  async function onDeleteSession(id) {
    if (FIREBASE_CONFIGURED) await deleteDoc(sessionDoc(id));
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setActiveSessionId((prev) => {
      if (prev !== id) return prev;
      const remaining = sessions.filter((s) => s.id !== id);
      return remaining[0]?.id ?? null;
    });
  }

  function onUpdateSession(id, patch) {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  return (
    <div className="app-wrapper">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
        onDeleteSession={onDeleteSession}
      />

      <div className="main-area">
        <header className="header">
          <AvatarImage src="/images/hachiware.png" fallback="🐱" className="header-avatar" />
          <div className="tab-buttons">
            <button className={`tab-btn${inputMode === "chat" ? " active" : ""}`} onClick={() => setInputMode("chat")}>
              대화/질문
            </button>
            <button
              className={`tab-btn${inputMode === "youtube" ? " active" : ""}`}
              onClick={() => setInputMode("youtube")}
            >
              유튜브 요약
            </button>
          </div>
        </header>

        <ConversationPane
          session={activeSession}
          inputMode={inputMode}
          onUpdateSession={onUpdateSession}
          onBusyChange={onBusyChange}
          onAbortChange={onAbortChange}
        />
      </div>

      {pendingSessionId && (
        <BusyModal
          onStay={() => setPendingSessionId(null)}
          onLeave={() => {
            abortFnRef.current?.();
            setActiveSessionId(pendingSessionId);
            setPendingSessionId(null);
          }}
        />
      )}
    </div>
  );
}

export default App;

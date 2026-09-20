"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeftRight, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Crown, Flag, History, LogOut, Maximize2, Minimize2, Pause, Play, Plus, RotateCcw, Settings2, Timer, Trophy, UserRound, UsersRound, Volume2, VolumeX, X, Zap } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Toaster, toast } from "sonner";
import { newClock, transition, remaining, formatTime, type Clock, type Side, type Outcome, type ClockAction } from "@/lib/clock";

type Account = { id: string; email: string; name: string };
type Player = { id: string; name: string; wins: number; losses: number; draws: number; games: number };
type Game = { id: string; white_id: string; black_id: string; white_name: string; black_name: string; outcome: Outcome; base: number; increment: number; moves: number; reason: string; created_at: number };
type Data = { account: Account | null; players: Player[]; games: Game[] };
type Modal = "auth" | "players" | "settings" | "result" | "help" | "account" | null;
const PRESETS = [{ base: 60, increment: 0, label: "Пуля" }, { base: 180, increment: 2, label: "Блиц" }, { base: 300, increment: 3, label: "Блиц" }, { base: 600, increment: 0, label: "Рапид" }, { base: 900, increment: 10, label: "Рапид" }];
const labelSide = (side: Side) => side === "white" ? "Белые" : "Чёрные";
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();
const modeLabel = (base: number, increment: number) => `${Number((base / 60).toFixed(2))} + ${increment}`;
async function api<T = Record<string, unknown>>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...(body !== undefined ? { method: "POST", headers: { "Content-Type": "application/json", "X-Tempo-Request": "1" }, body: JSON.stringify(body) } : {}) }); }
  catch { throw new Error("Нет соединения. Проверьте интернет и повторите попытку."); }
  const result = await response.json().catch(() => ({ error: "Не удалось связаться с сервером." }));
  if (!response.ok) throw new Error((result as { error?: string }).error || "Не удалось сохранить. Попробуйте ещё раз.");
  return result as T;
}

export default function ChessApp() {
  const [clock, setClock] = useState<Clock>(() => newClock());
  const clockRef = useRef(clock);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Data>({ account: null, players: [], games: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("clock");
  const [modal, setModal] = useState<Modal>(null);
  const modalRef = useRef<Modal>(null);
  const [selection, setSelection] = useState<{ white: string; black: string }>({ white: "guest-white", black: "guest-black" });
  const [sound, setSound] = useState(false);
  const [flipped, setFlipped] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [authMode, setAuthMode] = useState("register");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [newName, setNewName] = useState("");
  const [minutes, setMinutes] = useState("5");
  const [seconds, setSeconds] = useState("0");
  const [increment, setIncrement] = useState("3");
  const [resultChoice, setResultChoice] = useState<Outcome | null>(null);
  const [saved, setSaved] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const timeoutShown = useRef("");
  const savedRef = useRef(false);
  const running = clock.status === "running";
  const started = clock.status !== "ready";
  const locked = started && clock.status !== "finished";
  const nameFor = (side: Side) => data.players.find(p => p.id === selection[side])?.name || labelSide(side);

  const refresh = useCallback(async () => {
    setLoading(true); setLoadError("");
    try { const result = await api<Data>("/api/data"); setData(result); return result as Data; }
    catch (error) { setLoadError((error as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const commit = useCallback((next: Clock) => { clockRef.current = next; setClock(next); return next; }, []);
  const act = useCallback((action: ClockAction) => commit(transition(clockRef.current, action)), [commit]);
  useEffect(() => { modalRef.current = modal; setFormError(""); }, [modal]);
  useEffect(() => {
    try {
      const preferences = JSON.parse(localStorage.getItem("tempo-preferences") || "null");
      if (preferences) {
        setSound(!!preferences.sound); setFlipped(preferences.flipped !== false);
        if (Number.isInteger(preferences.base) && preferences.base >= 1 && preferences.base <= 10800 && Number.isInteger(preferences.increment) && preferences.increment >= 0 && preferences.increment <= 180) commit(newClock(preferences.base, preferences.increment, crypto.randomUUID()));
      } else commit(newClock(300, 3, crypto.randomUUID()));
      const draft = JSON.parse(sessionStorage.getItem("tempo-current") || "null");
      if (draft?.clock?.id && ["ready", "running", "paused", "finished"].includes(draft.clock.status) && ["white", "black"].includes(draft.clock.active) && Number.isFinite(draft.clock.white) && Number.isFinite(draft.clock.black) && draft.clock.moves && Number.isFinite(draft.clock.anchor)) {
        commit(transition(draft.clock, { type: "tick", now: Date.now() }));
        setSelection(draft.selection); setSaved(!!draft.saved); savedRef.current = !!draft.saved;
      }
    } catch { /* Browser storage is optional. */ }
    setNow(Date.now()); setReady(true);
  }, [commit]);
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem("tempo-current", JSON.stringify({ clock, selection, saved }));
      localStorage.setItem("tempo-preferences", JSON.stringify({ base: clock.base, increment: clock.increment, sound, flipped }));
    } catch { /* The active clock also works without browser storage. */ }
  }, [clock, selection, saved, sound, flipped, ready]);
  useEffect(() => {
    if (!running) return;
    const tick = () => { const time = Date.now(); setNow(time); act({ type: "tick", now: time }); };
    const interval = window.setInterval(tick, 65);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", tick); window.removeEventListener("pageshow", tick); };
  }, [running, act]);
  const beep = useCallback((finish = false) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(finish ? [80, 70, 80] : 12);
    if (!sound) return;
    try {
      const Audio = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioRef.current ??= new Audio();
      const audio = audioRef.current; void audio.resume();
      const oscillator = audio.createOscillator(); const gain = audio.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = finish ? 440 : 760;
      gain.gain.setValueAtTime(0.08, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + (finish ? 0.5 : 0.06));
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + (finish ? 0.5 : 0.07));
    } catch { /* Audio is optional. */ }
  }, [sound]);
  useEffect(() => {
    if (clock.status === "finished" && clock.reason === "timeout" && timeoutShown.current !== clock.id && !saved) {
      timeoutShown.current = clock.id; setResultChoice(clock.outcome); setModal("result"); beep(true);
    }
  }, [clock.status, clock.reason, clock.id, clock.outcome, saved, beep]);
  useEffect(() => {
    if (!running || !("wakeLock" in navigator)) return;
    let disposed = false; let lock: WakeLockSentinel | null = null;
    const request = async () => { try { if (document.visibilityState === "visible") { const next = await navigator.wakeLock.request("screen"); if (disposed) await next.release(); else lock = next; } } catch { /* Unsupported / battery saver. */ } };
    void request(); document.addEventListener("visibilitychange", request);
    return () => { disposed = true; void lock?.release(); document.removeEventListener("visibilitychange", request); };
  }, [running]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (modalRef.current || (e.target instanceof HTMLElement && ((e.target.matches("input, textarea, select, [role=tab], [role=combobox]") || (e.target.matches("button") && !e.target.matches(".start-button, .clock-hit"))) || e.target.isContentEditable))) return;
      if (e.code === "Space") { e.preventDefault(); const c = clockRef.current; if (c.status === "running") { act({ type: "move", side: c.active, now: Date.now() }); beep(); } else if (c.status === "ready" || c.status === "paused") act({ type: "start", now: Date.now() }); }
      if (e.code === "Escape" && clockRef.current.status === "running") act({ type: "pause", now: Date.now() });
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [act, beep]);
  useEffect(() => {
    const context = (document as unknown as { modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => Promise<void> | void } }).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const tools = [
      { name: "read_chess_clock", title: "Прочитать часы", description: "Read the current chess clock, active side and move counts.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => { const c = clockRef.current; return { status: c.status, active: c.active, whiteMs: remaining(c, "white", Date.now()), blackMs: remaining(c, "black", Date.now()), base: c.base, increment: c.increment, moves: c.moves }; } },
      { name: "configure_chess_clock", title: "Настроить часы", description: "Set base seconds and Fischer increment while the clock is ready. Does not start a game.", inputSchema: { type: "object", properties: { baseSeconds: { type: "integer", minimum: 1, maximum: 10800 }, incrementSeconds: { type: "integer", minimum: 0, maximum: 180 } }, required: ["baseSeconds", "incrementSeconds"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: (input: unknown) => { const v = input as { baseSeconds: number; incrementSeconds: number }; if (!v || !Number.isInteger(v.baseSeconds) || v.baseSeconds < 1 || v.baseSeconds > 10800 || !Number.isInteger(v.incrementSeconds) || v.incrementSeconds < 0 || v.incrementSeconds > 180 || clockRef.current.status !== "ready") throw new Error("Invalid time control or game already started"); commit(newClock(v.baseSeconds, v.incrementSeconds, crypto.randomUUID())); return { baseSeconds: v.baseSeconds, incrementSeconds: v.incrementSeconds, status: "ready" }; } }
    ];
    for (const tool of tools) { try { void Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch(() => {}); } catch { /* Optional API. */ } }
    return () => controller.abort();
  }, [commit]);

  function swapped(s: { white: string; black: string }) { return { white: s.black.startsWith("guest-") ? "guest-white" : s.black, black: s.white.startsWith("guest-") ? "guest-black" : s.white }; }
  function reset(swap = false, base = clock.base, inc = clock.increment) {
    commit(newClock(base, inc, crypto.randomUUID())); setNow(Date.now()); setSaved(false); savedRef.current = false; setResultChoice(null); setModal(null);
    if (swap) setSelection(s => swapped(s));
  }
  function open(next: Modal) {
    if (running) act({ type: "pause", now: Date.now() });
    if (next === "settings") { setMinutes(String(Math.floor(clock.base / 60))); setSeconds(String(clock.base % 60)); setIncrement(String(clock.increment)); }
    setModal(next);
  }
  function choosePreset(base: number, inc: number) { if (clockRef.current.status !== "ready") return; reset(false, base, inc); }
  function startPause() {
    if (clock.status === "finished") { setResultChoice(clock.outcome); setModal("result"); return; }
    act({ type: running ? "pause" : "start", now: Date.now() });
    if (!running) beep();
  }
  function tap(side: Side) {
    if (clockRef.current.status !== "running" || clockRef.current.active !== side) return;
    act({ type: "move", side, now: Date.now() }); beep();
  }
  function switchTab(next: string) { if (running) act({ type: "pause", now: Date.now() }); setTab(next); }
  async function authSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFormError("");
    const fields = new FormData(event.currentTarget);
    try {
      await api("/api/auth", { action: authMode, name: fields.get("name"), email: fields.get("email"), password: fields.get("password") });
      const current = await refresh();
      if (current) { setModal(null); toast.success(authMode === "register" ? "Аккаунт создан" : "Вы вошли в Tempo"); }
    } catch (error) { setFormError((error as Error).message); }
    finally { setBusy(false); }
  }
  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!data.account) { setModal("auth"); return; }
    setBusy(true); setFormError("");
    try { const player = await api<{ id: string }>("/api/players", { name: newName }); setNewName(""); const next = await refresh(); if (next && !locked) setSelection(s => s.white.startsWith("guest-") ? { ...s, white: player.id } : s.black.startsWith("guest-") ? { ...s, black: player.id } : s); toast.success("Игрок добавлен"); }
    catch (error) { setFormError((error as Error).message); } finally { setBusy(false); }
  }
  async function saveResult() {
    if (!resultChoice || savedRef.current || busy) return;
    setBusy(true); setFormError("");
    const finished = clock.status === "finished" ? clock : act({ type: "finish", outcome: resultChoice, now: Date.now() });
    try {
      await api("/api/games", { id: finished.id, whiteId: selection.white, blackId: selection.black, outcome: resultChoice, base: finished.base, increment: finished.increment, moves: Math.max(finished.moves.white, finished.moves.black), reason: finished.reason, whiteRemaining: Math.round(remaining(finished, "white", Date.now())), blackRemaining: Math.round(remaining(finished, "black", Date.now())) });
      commit({ ...finished, outcome: resultChoice }); setSaved(true); savedRef.current = true; await refresh(); toast.success("Результат сохранён");
    } catch (error) { setFormError((error as Error).message); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); try { await api("/api/auth", { action: "logout" }); setData({ account: null, players: [], games: [] }); setSelection({ white: "guest-white", black: "guest-black" }); reset(); toast.success("Вы вышли из аккаунта"); } catch (error) { setFormError((error as Error).message); } finally { setBusy(false); }
  }
  function settingsSubmit(event: FormEvent) {
    event.preventDefault(); const mins = Number(minutes), secs = Number(seconds), inc = Number(increment); const base = mins * 60 + secs;
    if (![mins, secs, inc].every(Number.isInteger) || mins < 0 || secs < 0 || secs > 59 || base < 1 || base > 10800 || inc < 0 || inc > 180) { setFormError("Время: от 1 секунды до 180 минут. Добавление: от 0 до 180 секунд."); return; }
    if (!started) reset(false, base, inc); else setModal(null);
  }
  const selectedPlayers = data.players.some(p => p.id === selection.white) && data.players.some(p => p.id === selection.black) && selection.white !== selection.black;
  const pairGames = selectedPlayers ? data.games.filter(g => (g.white_id === selection.white && g.black_id === selection.black) || (g.white_id === selection.black && g.black_id === selection.white)) : [];
  const pairPoints = (id: string) => pairGames.reduce((sum, game) => sum + (game.outcome === "draw" ? 0.5 : (game.outcome === "white" ? game.white_id : game.black_id) === id ? 1 : 0), 0);
  const statusText = clock.status === "ready" ? "Готовы к партии" : clock.status === "paused" ? "Партия на паузе" : clock.status === "finished" ? "Партия завершена" : `Ходят ${clock.active === "white" ? "белые" : "чёрные"}`;
  const playerPicker = (side: Side) => <Select value={selection[side]} disabled={locked || saved} onValueChange={value => setSelection(s => ({ ...s, [side]: value }))}><SelectTrigger className="player-select" aria-label={`Игрок за ${side === "white" ? "белых" : "чёрных"}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value={`guest-${side}`}>{labelSide(side)} · гость</SelectItem>{data.players.filter(p => p.id !== selection[side === "white" ? "black" : "white"]).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>;

  return <div className={`app ${focusMode ? "focus-mode" : ""} ${running ? "is-running" : ""}`}>
    <Toaster position="top-center" richColors />
    <Tabs value={tab} onValueChange={switchTab} className="app-tabs">
      <header className="topbar"><div className="topbar-inner">
        <button className="brand" onClick={() => switchTab("clock")} aria-label="Tempo — к таймеру"><span className="brand-mark"><Timer size={23} strokeWidth={1.8} /></span><span>tempo<span className="brand-dot">.</span></span></button>
        <TabsList className="nav-tabs" aria-label="Разделы"><TabsTrigger value="clock"><Timer />Таймер</TabsTrigger><TabsTrigger value="players"><UsersRound />Игроки</TabsTrigger><TabsTrigger value="history"><History />История</TabsTrigger></TabsList>
        <button className={`account-button ${data.account ? "signed-in" : ""}`} onClick={() => open(data.account ? "account" : "auth")}><UserRound size={17}/><span>{data.account ? data.account.name : "Войти"}</span></button>
      </div></header>
      <main className="main-wrap">
        <TabsContent value="clock" className="clock-page">
          <section className="page-heading"><div><p className="eyebrow">КАЖДЫЙ ХОД ВАЖЕН</p><h1>Шахматные часы</h1></div><div className={`game-status ${running ? "live" : ""}`}><span />{statusText}</div></section>
          <section className="time-controls" aria-label="Режимы времени"><div className="control-caption"><Clock3 size={17}/><span>Контроль времени</span></div><div className="preset-list">{PRESETS.map(p => <button key={`${p.base}-${p.increment}`} disabled={started} className={`preset ${clock.base === p.base && clock.increment === p.increment ? "selected" : ""}`} onClick={() => choosePreset(p.base, p.increment)}><span className="preset-value">{modeLabel(p.base, p.increment)}</span><span className="preset-label">{p.label}</span></button>)}<button aria-label="Свой режим" className={`preset custom ${!PRESETS.some(p => p.base === clock.base && p.increment === clock.increment) ? "selected" : ""}`} onClick={() => open("settings")}><Settings2 size={19}/><span>{PRESETS.some(p => p.base === clock.base && p.increment === clock.increment) ? "Свой режим" : modeLabel(clock.base, clock.increment)}</span></button></div></section>
          <div className="clock-board">
            {(["white", "black"] as Side[]).map(side => {
              const ms = remaining(clock, side, now || clock.anchor); const active = running && clock.active === side;
              return <section key={side} className={`clock-card ${side} ${active ? "active" : ""} ${ms < 10000 && started ? "low-time" : ""} ${side === "black" && flipped ? "flipped" : ""}`}>
                <button className="clock-hit" onClick={() => tap(side)} disabled={!active} aria-label={`${nameFor(side)}: ${formatTime(ms)}. Завершить ход`}>
                  <div className="clock-content"><div className="clock-top"><span className={`piece-badge ${side}`}><Crown size={19} strokeWidth={1.6}/></span><span className="clock-player">{nameFor(side)}<small>{selection[side].startsWith("guest-") ? "Игрок не выбран" : labelSide(side)}</small></span><span className="turn-indicator">{active ? "ВАШ ХОД" : clock.status === "finished" ? (clock.outcome === side ? "ПОБЕДА" : clock.outcome === "draw" ? "НИЧЬЯ" : "КОНЕЦ ПАРТИИ") : ""}</span></div>
                  <div className="digits" aria-hidden="true">{formatTime(ms)}</div>
                  <div className="clock-bottom"><span>{active ? "Нажмите после хода" : clock.status === "ready" ? "Всё готово к игре" : clock.status === "paused" ? "На паузе" : clock.status === "finished" ? "Партия завершена" : "Ожидание хода"}</span><span className="move-count">Ход {clock.moves[side]}<i/>+{clock.increment} сек</span></div></div>
                  <span className="time-track"><span style={{ width: `${Math.min(100, ms / (clock.base * 1000) * 100)}%` }}/></span>
                </button>
                {!started && <button className="choose-player" onClick={() => open("players")} aria-label={`Выбрать игрока: ${labelSide(side)}`}><ChevronDown size={17}/></button>}
              </section>;
            })}
            <div className="game-toolbar"><div className="toolbar-left"><button className="icon-button" title="Сбросить часы" aria-label="Сбросить часы" disabled={!started} onClick={() => saved || !started ? reset() : setConfirmReset(true)}><RotateCcw size={20}/></button><button className="icon-button" title="Поменять цвета" aria-label="Поменять цвета" disabled={started} onClick={() => setSelection(s => swapped(s))}><ArrowLeftRight size={20}/></button></div><button className={`start-button ${running ? "pause-button" : ""}`} onClick={startPause} disabled={!ready}>{running ? <Pause size={19} fill="currentColor"/> : clock.status === "finished" ? <Trophy size={19}/> : <Play size={18} fill="currentColor"/>}<span>{running ? "Пауза" : clock.status === "paused" ? "Продолжить" : clock.status === "finished" ? "Результат" : "Начать партию"}</span></button><div className="toolbar-right"><button className="icon-button" title="Завершить партию" aria-label="Завершить партию" disabled={!started || clock.status === "finished"} onClick={() => { setResultChoice(null); open("result"); }}><Flag size={20}/></button><button className="icon-button" title={focusMode ? "Обычный экран" : "Режим фокуса"} aria-label={focusMode ? "Обычный экран" : "Режим фокуса"} onClick={() => setFocusMode(!focusMode)}>{focusMode ? <Minimize2 size={20}/> : <Maximize2 size={20}/>}</button></div></div>
          </div>
          <div className="clock-hint"><span><span className="keyboard-key">пробел</span> переключить ход <span className="hint-separator">·</span> <span className="keyboard-key">esc</span> пауза</span><button onClick={() => open("help")}><CircleHelp size={16}/>Как играть</button></div>
          <section className="match-summary"><div className="summary-label"><span className="summary-icon"><Trophy size={20}/></span><div><h2>Личный счёт</h2><p>{selectedPlayers ? `${pairGames.length} партий между игроками` : "Выберите игроков, чтобы вести счёт"}</p></div></div><div className="match-score"><span>{nameFor("white")}</span><strong>{pairPoints(selection.white).toLocaleString("ru")}<i>:</i>{pairPoints(selection.black).toLocaleString("ru")}</strong><span>{nameFor("black")}</span></div><button className="text-button summary-action" onClick={() => selectedPlayers ? switchTab("history") : open("players")}>{selectedPlayers ? "История партий" : "Выбрать игроков"}<ChevronRight size={16}/></button></section>
          <footer className="app-footer"><span>Ваш ритм. Ваша игра.</span><div><button className="icon-button" aria-label={sound ? "Выключить звук" : "Включить звук"} title={sound ? "Выключить звук" : "Включить звук"} onClick={() => setSound(!sound)}>{sound ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button><button className="icon-button" aria-label="Настройки" title="Настройки" onClick={() => open("settings")}><Settings2 size={17}/></button></div></footer>
        </TabsContent>
        <TabsContent value="players"><section className="page-heading"><div><p className="eyebrow">ЗА ОДНОЙ ДОСКОЙ</p><h1>Игроки</h1></div><button className="primary-button" onClick={() => open(data.account ? "players" : "auth")}><Plus size={18}/>Добавить игрока</button></section><p className="section-description">Победы, поражения и ничьи — вся статистика ваших партий.</p>{loadError && <div className="error-banner">{loadError}<button onClick={() => void refresh()}>Повторить</button></div>}{loading ? <Skeleton className="h-52 w-full rounded-3xl"/> : data.players.length ? <div className="players-grid">{[...data.players].sort((a,b) => b.wins + b.draws / 2 - a.wins - a.draws / 2).map((p, i) => <article className="player-profile" key={p.id}><div className="profile-top"><div className={`avatar color-${i % 4}`}>{initials(p.name)}</div><span className="points">{p.wins + p.draws / 2}<small>очков</small></span></div><h2>{p.name}</h2><p>{p.games} партий</p><div className="player-stats"><div><strong>{p.wins}</strong><span>Победы</span></div><div><strong>{p.draws}</strong><span>Ничьи</span></div><div><strong>{p.losses}</strong><span>Поражения</span></div></div></article>)}</div> : <Empty className="empty-state"><EmptyHeader><div className="empty-icon"><UsersRound size={30}/></div><EmptyTitle>У каждой партии свои герои</EmptyTitle><EmptyDescription>{data.account ? "Добавьте игроков и выберите, кто играет белыми и чёрными." : "Создайте аккаунт, добавляйте игроков и сохраняйте их результаты."}</EmptyDescription></EmptyHeader><button className="primary-button" onClick={() => open(data.account ? "players" : "auth")}><Plus size={17}/>{data.account ? "Добавить первого игрока" : "Создать аккаунт"}</button></Empty>}</TabsContent>
        <TabsContent value="history"><section className="page-heading"><div><p className="eyebrow">КАЖДАЯ ПАРТИЯ — ИСТОРИЯ</p><h1>История партий</h1></div><span className="count-badge">{data.games.length} партий</span></section><p className="section-description">Завершённые партии и результаты встреч.</p>{loadError && <div className="error-banner">{loadError}<button onClick={() => void refresh()}>Повторить</button></div>}{loading ? <Skeleton className="h-52 w-full rounded-3xl"/> : data.games.length ? <div className="history-table"><Table><TableHeader><TableRow><TableHead>Игроки</TableHead><TableHead>Результат</TableHead><TableHead className="hide-mobile">Контроль</TableHead><TableHead className="hide-mobile">Ходы</TableHead><TableHead>Дата</TableHead></TableRow></TableHeader><TableBody>{data.games.map(game => <TableRow key={game.id}><TableCell><div className="history-names"><span><i className="piece-dot light"/>{game.white_name}</span><span><i className="piece-dot dark"/>{game.black_name}</span></div></TableCell><TableCell><span className="result-score">{game.outcome === "white" ? "1 : 0" : game.outcome === "black" ? "0 : 1" : "½ : ½"}</span><small className="table-note">{game.outcome === "draw" ? "Ничья" : game.reason === "timeout" ? "По времени" : "Победа"}</small></TableCell><TableCell className="hide-mobile">{modeLabel(game.base, game.increment)}</TableCell><TableCell className="hide-mobile">{game.moves}</TableCell><TableCell><span className="table-date">{new Date(game.created_at).toLocaleDateString("ru", { day: "numeric", month: "short" })}</span><small className="table-note">{new Date(game.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}</small></TableCell></TableRow>)}</TableBody></Table></div> : <Empty className="empty-state"><EmptyHeader><div className="empty-icon"><History size={30}/></div><EmptyTitle>Первая партия ещё впереди</EmptyTitle><EmptyDescription>{data.account ? "Выберите двух игроков, сыграйте и сохраните результат. Он появится здесь." : "Войдите в аккаунт, чтобы сохранять результаты и возвращаться к истории."}</EmptyDescription></EmptyHeader><button className="primary-button" onClick={() => data.account ? switchTab("clock") : open("auth")}>{data.account ? <Play size={17}/> : <UserRound size={17}/>}{data.account ? "К таймеру" : "Войти или зарегистрироваться"}</button></Empty>}</TabsContent>
      </main>
    </Tabs>
    <Dialog open={modal !== null} onOpenChange={value => { if (!value && !busy) setModal(null); }}><DialogContent className="tempo-dialog" showCloseButton={!busy}>
      {modal === "auth" && <><DialogHeader><div className="modal-mark"><Timer size={27}/></div><DialogTitle>Ваша игра. Ваш Tempo.</DialogTitle><DialogDescription>Сохраняйте игроков, результаты и историю партий в своём аккаунте.</DialogDescription></DialogHeader><Tabs value={authMode} onValueChange={v => { setAuthMode(v); setFormError(""); }}><TabsList className="form-tabs"><TabsTrigger value="register">Регистрация</TabsTrigger><TabsTrigger value="login">Вход</TabsTrigger></TabsList></Tabs><form className="form-stack" onSubmit={authSubmit}>{authMode === "register" && <label>Ваше имя<input name="name" placeholder="Как к вам обращаться" autoComplete="name" required minLength={1} maxLength={40}/></label>}<label>Электронная почта<input name="email" type="email" placeholder="you@example.com" autoComplete="email" maxLength={254} required/></label><label>Пароль<input name="password" type="password" placeholder={authMode === "register" ? "Не менее 10 символов" : "Ваш пароль"} autoComplete={authMode === "register" ? "new-password" : "current-password"} minLength={authMode === "register" ? 10 : 1} maxLength={128} required/></label>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="primary-button wide" disabled={busy}>{busy ? "Подождите…" : authMode === "register" ? "Создать аккаунт" : "Войти"}<ChevronRight size={17}/></button><p className="form-note">Для входа используются email и пароль. Таймер доступен и без аккаунта.</p></form></>}
      {modal === "account" && <><DialogHeader><div className="avatar account-avatar">{initials(data.account?.name || "T")}</div><DialogTitle>{data.account?.name}</DialogTitle><DialogDescription>{data.account?.email}</DialogDescription></DialogHeader><div className="account-summary"><span>{data.players.length} игроков</span><span>{data.games.length} партий</span></div><p className="muted-text">Игроки и результаты сохраняются в вашем аккаунте и доступны после входа на другом устройстве.</p>{formError && <p className="form-error">{formError}</p>}<button className="secondary-button wide" onClick={() => void logout()} disabled={busy}><LogOut size={17}/>{busy ? "Выходим…" : "Выйти из аккаунта"}</button></>}
      {modal === "players" && <><DialogHeader><DialogTitle>Кто за доской?</DialogTitle><DialogDescription>Выберите игроков или добавьте новых.</DialogDescription></DialogHeader>{locked && <p className="inline-note">Игроки зафиксированы до конца партии.</p>}<div className="picker-row"><div><label>Белые</label>{playerPicker("white")}</div><button className="icon-button" aria-label="Поменять игроков местами" disabled={started} onClick={() => setSelection(s => swapped(s))}><ArrowLeftRight size={20}/></button><div><label>Чёрные</label>{playerPicker("black")}</div></div>{data.account ? <form className="form-stack add-player-form" onSubmit={addPlayer}><label>Новый игрок<input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Имя игрока" required maxLength={32}/></label>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="secondary-button wide" disabled={busy || !newName.trim()}><Plus size={17}/>{busy ? "Сохраняем…" : "Добавить игрока"}</button></form> : <div className="sign-in-note"><UserRound size={22}/><p>Войдите, чтобы добавлять игроков и вести счёт.</p><button className="primary-button wide" onClick={() => setModal("auth")}>Войти или зарегистрироваться</button></div>}<button className="primary-button wide" onClick={() => setModal(null)}>Готово<Check size={17}/></button></>}
      {modal === "settings" && <><DialogHeader><DialogTitle>Время на вашу игру</DialogTitle><DialogDescription>Добавление Фишера: секунды начисляются после каждого завершённого хода.</DialogDescription></DialogHeader><form className="form-stack" onSubmit={settingsSubmit}><div className="time-inputs"><label>Минуты<input type="number" value={minutes} onChange={e => setMinutes(e.target.value)} min="0" max="180" step="1" required disabled={started}/></label><label>Секунды<input type="number" value={seconds} onChange={e => setSeconds(e.target.value)} min="0" max="59" step="1" required disabled={started}/></label><label>За ход, сек<input type="number" value={increment} onChange={e => setIncrement(e.target.value)} min="0" max="180" step="1" required disabled={started}/></label></div>{started && <p className="inline-note">Время можно изменить перед новой партией.</p>}<div className="setting-row"><div><strong>Звук нажатия</strong><p>Короткий сигнал при смене хода</p></div><Switch checked={sound} onCheckedChange={setSound} aria-label="Звук нажатия"/></div><div className="setting-row"><div><strong>Лицом к сопернику</strong><p>Разворот верхних часов на телефоне</p></div><Switch checked={flipped} onCheckedChange={setFlipped} aria-label="Развернуть верхние часы"/></div>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="primary-button wide">{started ? "Готово" : "Применить настройки"}<Check size={17}/></button></form></>}
      {modal === "result" && <><DialogHeader><div className={`result-icon ${saved ? "saved" : ""}`}>{saved ? <Check size={30}/> : <Trophy size={30}/>}</div><DialogTitle>{saved ? "Хорошая партия." : clock.reason === "timeout" ? "Время вышло" : "Как закончилась партия?"}</DialogTitle><DialogDescription>{saved ? "Результат сохранён, личный счёт обновлён." : clock.reason === "timeout" ? "Подтвердите результат. Если победа невозможна по позиции, выберите ничью." : "Укажите победителя или зафиксируйте ничью."}</DialogDescription></DialogHeader><div className="outcome-options">{(["white", "draw", "black"] as Outcome[]).map(value => <button key={value} className={`outcome-option ${resultChoice === value ? "chosen" : ""}`} disabled={saved || busy} aria-pressed={resultChoice === value} onClick={() => setResultChoice(value)}><strong>{value === "white" ? "1 : 0" : value === "black" ? "0 : 1" : "½ : ½"}</strong><span>{value === "draw" ? "Ничья" : nameFor(value)}</span>{resultChoice === value && <Check size={15}/>}</button>)}</div>{!saved && !selectedPlayers && data.account && <><p className="inline-note">Для счёта выберите двух игроков.</p><div className="picker-row result-pickers"><div><label>Белые</label><Select value={selection.white} onValueChange={v => setSelection(s => ({ ...s, white: v }))}><SelectTrigger aria-label="Белые в результате"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="guest-white">Выберите игрока</SelectItem>{data.players.filter(p => p.id !== selection.black).map(p => <SelectItem value={p.id} key={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div><div><label>Чёрные</label><Select value={selection.black} onValueChange={v => setSelection(s => ({ ...s, black: v }))}><SelectTrigger aria-label="Чёрные в результате"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="guest-black">Выберите игрока</SelectItem>{data.players.filter(p => p.id !== selection.white).map(p => <SelectItem value={p.id} key={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div></div>{data.players.length < 2 && <button className="secondary-button wide" onClick={() => setModal("players")}><Plus size={17}/>Добавить игроков</button>}</>}{formError && <p className="form-error" role="alert">{formError}</p>}{saved ? <><button className="primary-button wide" onClick={() => reset(true)}><ArrowLeftRight size={18}/>Реванш · сменить цвета</button><button className="secondary-button wide" onClick={() => reset()}>Новая партия</button></> : <>{!data.account ? <button className="primary-button wide" onClick={() => setModal("auth")}>Войти и сохранить</button> : <button className="primary-button wide" disabled={!resultChoice || !selectedPlayers || busy} onClick={() => void saveResult()}>{busy ? "Сохраняем…" : "Сохранить результат"}<Check size={18}/></button>}<button className="text-button centered" onClick={() => { if (resultChoice && clock.status !== "finished") act({ type: "finish", outcome: resultChoice, now: Date.now() }); setModal(null); }} disabled={!resultChoice}>Завершить без сохранения</button></>}</>}
      {modal === "help" && <><DialogHeader><DialogTitle>Всё просто. Играйте.</DialogTitle><DialogDescription>Поставьте телефон рядом с доской.</DialogDescription></DialogHeader><ol className="help-list"><li><span>1</span><div><strong>Настройте партию</strong><p>Выберите время и игроков. «5 + 3» — это 5 минут каждому и 3 секунды после хода.</p></div></li><li><span>2</span><div><strong>Сделайте первый ход</strong><p>Нажмите «Начать партию». Первыми идут белые. После хода нажимайте свою большую область часов.</p></div></li><li><span>3</span><div><strong>Сохраните результат</strong><p>Нажмите флажок, выберите победителя или ничью. Для общего счёта нужны аккаунт и два игрока.</p></div></li></ol><p className="inline-note">Часы продолжают отсчёт при переключении вкладки. Для перерыва нажмите паузу.</p><button className="primary-button wide" onClick={() => setModal(null)}>Понятно</button></>}
    </DialogContent></Dialog>
    <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}><AlertDialogContent className="tempo-dialog"><AlertDialogHeader><AlertDialogTitle>Начать заново?</AlertDialogTitle><AlertDialogDescription>Текущая партия будет сброшена. Несохранённый результат не попадёт в историю.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Продолжить игру</AlertDialogCancel><AlertDialogAction onClick={() => reset()}>Сбросить часы</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

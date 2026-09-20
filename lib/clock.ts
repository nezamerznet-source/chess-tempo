export type Side = "white" | "black";
export type Outcome = Side | "draw";
export type Clock = {
  id: string; status: "ready" | "running" | "paused" | "finished";
  active: Side; white: number; black: number; anchor: number;
  moves: { white: number; black: number }; base: number; increment: number;
  outcome: Outcome | null; reason: "manual" | "timeout"; startedAt: number | null;
};
export type ClockAction = { type: "start" | "pause" | "tick"; now: number } |
  { type: "move"; side: Side; now: number } | { type: "finish"; outcome: Outcome; now: number };
export const otherSide = (side: Side): Side => side === "white" ? "black" : "white";
export function newClock(base = 300, increment = 3, id = "initial"): Clock {
  return { id, status: "ready", active: "white", white: base * 1000, black: base * 1000,
    anchor: 0, moves: { white: 0, black: 0 }, base, increment, outcome: null, reason: "manual", startedAt: null };
}
export function remaining(clock: Clock, side: Side, now: number) {
  return Math.max(0, clock[side] - (clock.status === "running" && clock.active === side ? Math.max(0, now - clock.anchor) : 0));
}
export function transition(clock: Clock, action: ClockAction): Clock {
  if (clock.status === "finished") return clock;
  const now = action.now;
  if (clock.status === "running" && remaining(clock, clock.active, now) <= 0) {
    return { ...clock, [clock.active]: 0, status: "finished", outcome: otherSide(clock.active), reason: "timeout", anchor: now };
  }
  if (action.type === "tick") return clock;
  if (action.type === "start" && (clock.status === "ready" || clock.status === "paused"))
    return { ...clock, status: "running", anchor: now, startedAt: clock.startedAt ?? now };
  if (action.type === "pause" && clock.status === "running")
    return { ...clock, [clock.active]: remaining(clock, clock.active, now), status: "paused", anchor: now };
  if (action.type === "move" && clock.status === "running" && action.side === clock.active) {
    return { ...clock, [clock.active]: remaining(clock, clock.active, now) + clock.increment * 1000,
      moves: { ...clock.moves, [clock.active]: clock.moves[clock.active] + 1 }, active: otherSide(clock.active), anchor: now };
  }
  if (action.type === "finish" && clock.status !== "ready")
    return { ...clock, [clock.active]: remaining(clock, clock.active, now), status: "finished", outcome: action.outcome, reason: "manual", anchor: now };
  return clock;
}
export function formatTime(ms: number): string {
  if (ms > 0 && ms < 10000) return `${Math.floor(ms / 1000)}.${Math.floor(ms % 1000 / 100)}`;
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

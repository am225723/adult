import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  RefreshCw,
  AlertCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCalendarAccount } from "@/hooks/useCalendarAccount";
import { useCalendarEvents, type CalendarEvent } from "@/hooks/useCalendarEvents";
import { toast } from "@/hooks/useToast";

type CalView = "month" | "week" | "day" | "agenda";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

// ── Helpers ────────────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7);
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmt12(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmtWeekRange(d: Date): string {
  const s = startOfWeek(d);
  const e = addDays(s, 6);
  if (s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString("en-US", { month: "long" })} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function fmtDayFull(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function dateRangeForView(view: CalView, cursor: Date): { start: Date; end: Date } {
  switch (view) {
    case "month": {
      const s = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      s.setDate(s.getDate() - s.getDay()); // back to Sunday
      const e = addDays(s, 42);
      return { start: s, end: e };
    }
    case "week": {
      const s = startOfWeek(cursor);
      return { start: s, end: addDays(s, 7) };
    }
    case "day": {
      const s = new Date(cursor);
      s.setHours(0, 0, 0, 0);
      return { start: s, end: addDays(s, 1) };
    }
    case "agenda": {
      const s = new Date();
      s.setHours(0, 0, 0, 0);
      return { start: s, end: addDays(s, 60) };
    }
  }
}

function detectConflicts(events: CalendarEvent[]): Set<string> {
  const ids = new Set<string>();
  const timed = events.filter((e) => !e.all_day);
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const aS = new Date(timed[i].start_time).getTime();
      const aE = new Date(timed[i].end_time).getTime();
      const bS = new Date(timed[j].start_time).getTime();
      const bE = new Date(timed[j].end_time).getTime();
      if (aS < bE && aE > bS) {
        ids.add(timed[i].id);
        ids.add(timed[j].id);
      }
    }
  }
  return ids;
}

// ── Connect prompt ─────────────────────────────────────────────────────────────

function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <CalendarDays size={40} strokeWidth={1.25} className="text-muted-foreground" />
      <div>
        <p className="text-base font-medium text-foreground">
          Connect Google Calendar
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Your events will sync automatically and stay up to date.
        </p>
      </div>
      <Button onClick={onConnect} size="sm">
        Connect Google Calendar
      </Button>
    </div>
  );
}

// ── Event chip (month view) ────────────────────────────────────────────────────

function EventChip({
  event,
  hasConflict,
  onClick,
}: {
  event: CalendarEvent;
  hasConflict: boolean;
  onClick?: () => void;
}) {
  const start = new Date(event.start_time);
  return (
    <div
      title={`${event.title}${event.all_day ? "" : ` · ${fmt12(start)}`}`}
      onClick={onClick}
      className={cn(
        "text-[11px] leading-tight px-1 py-0.5 rounded-sm truncate",
        onClick ? "cursor-pointer hover:opacity-80" : "cursor-default",
        "bg-primary/15 text-primary",
        hasConflict &&
          "ring-1 ring-inset ring-destructive bg-destructive/10 text-destructive",
      )}
    >
      {!event.all_day && (
        <span className="opacity-60 mr-0.5">
          {start.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })}
        </span>
      )}
      {event.title}
    </div>
  );
}

// ── Month view ─────────────────────────────────────────────────────────────────

function MonthView({
  cursor,
  events,
  conflictIds,
  onEventClick,
}: {
  cursor: Date;
  events: CalendarEvent[];
  conflictIds: Set<string>;
  onEventClick?: (ev: CalendarEvent) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const cells: Date[] = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const k = new Date(ev.start_time).toDateString();
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(ev);
    }
    return m;
  }, [events]);

  const today = new Date();

  return (
    <div className="border-t border-border">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-border">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          const isCurrentMonth = date.getMonth() === month;
          const isToday = isSameDay(date, today);
          const dayEvs = byDate.get(date.toDateString()) ?? [];

          return (
            <div
              key={i}
              className={cn(
                "min-h-[100px] border-b border-r border-border p-1",
                !isCurrentMonth && "bg-muted/30",
                i % 7 === 0 && "border-l-0",
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 flex items-center justify-center text-xs rounded-full mb-1 font-medium",
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : !isCurrentMonth
                    ? "text-muted-foreground/50"
                    : "text-foreground",
                )}
              >
                {date.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvs.slice(0, 3).map((ev) => (
                  <EventChip
                    key={ev.id}
                    event={ev}
                    hasConflict={conflictIds.has(ev.id)}
                    onClick={onEventClick ? () => onEventClick(ev) : undefined}
                  />
                ))}
                {dayEvs.length > 3 && (
                  <div className="text-[11px] px-1 text-muted-foreground">
                    +{dayEvs.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week / Day view ────────────────────────────────────────────────────────────

const HOUR_PX = 48; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function TimeGrid({
  days,
  events,
  conflictIds,
  onEventClick,
}: {
  days: Date[];
  events: CalendarEvent[];
  conflictIds: Set<string>;
  onEventClick?: (ev: CalendarEvent) => void;
}) {
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const d of days) m.set(d.toDateString(), []);
    for (const ev of events) {
      if (ev.all_day) continue;
      const k = new Date(ev.start_time).toDateString();
      if (m.has(k)) m.get(k)!.push(ev);
    }
    return m;
  }, [days, events]);

  const allDay = useMemo(
    () => events.filter((e) => e.all_day),
    [events],
  );

  const today = new Date();
  const [, forceUpdate] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    intervalRef.current = setInterval(() => forceUpdate((n) => n + 1), 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div className="flex flex-col overflow-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
      {/* Day headers */}
      <div className="sticky top-0 z-10 bg-background border-b border-border flex">
        <div className="w-14 shrink-0" />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "flex-1 py-2 text-center border-l border-border",
                isToday && "bg-primary/5",
              )}
            >
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div
                className={cn(
                  "mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold",
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground",
                )}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day strip */}
      {allDay.length > 0 && (
        <div className="flex border-b border-border bg-muted/20 shrink-0">
          <div className="w-14 shrink-0 flex items-center justify-end pr-2">
            <span className="text-[10px] text-muted-foreground">all-day</span>
          </div>
          {days.map((d) => {
            const dayAllDay = allDay.filter((e) =>
              isSameDay(new Date(e.start_time), d),
            );
            return (
              <div key={d.toISOString()} className="flex-1 border-l border-border p-0.5 space-y-0.5 min-h-[24px]">
                {dayAllDay.map((ev) => (
                  <div
                    key={ev.id}
                    className="text-[11px] bg-primary/15 text-primary rounded-sm px-1 truncate"
                  >
                    {ev.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable time grid */}
      <div
        className="flex relative"
        style={{ height: `${HOUR_PX * 24}px` }}
      >
        {/* Hour labels */}
        <div className="w-14 shrink-0 relative">
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute right-2 text-[10px] text-muted-foreground"
              style={{
                top: `${h * HOUR_PX - 6}px`,
                display: h === 0 ? "none" : undefined,
              }}
            >
              {fmtHour(h)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          const dayEvs = byDay.get(d.toDateString()) ?? [];

          return (
            <div
              key={d.toISOString()}
              className={cn(
                "flex-1 relative border-l border-border",
                isToday && "bg-primary/[0.03]",
              )}
            >
              {/* Hour lines */}
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute w-full border-t border-border/40"
                  style={{ top: `${h * HOUR_PX}px` }}
                />
              ))}

              {/* Current time indicator */}
              {isToday && (() => {
                const now = new Date();
                const mins = now.getHours() * 60 + now.getMinutes();
                return (
                  <div
                    className="absolute left-0 right-0 z-10 flex items-center"
                    style={{ top: `${(mins / 60) * HOUR_PX}px` }}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                    <div className="flex-1 border-t border-red-500" />
                  </div>
                );
              })()}

              {/* Events */}
              {dayEvs.map((ev) => {
                const start = new Date(ev.start_time);
                const end = new Date(ev.end_time);
                const startMins = start.getHours() * 60 + start.getMinutes();
                const endMins = end.getHours() * 60 + end.getMinutes();
                const topPx = (startMins / 60) * HOUR_PX;
                const heightPx = Math.max(((endMins - startMins) / 60) * HOUR_PX, 18);

                return (
                  <div
                    key={ev.id}
                    title={`${ev.title} · ${fmt12(start)} – ${fmt12(end)}`}
                    onClick={() => onEventClick?.(ev)}
                    className={cn(
                      "absolute left-0.5 right-0.5 rounded-sm text-[11px] px-1 py-0.5 overflow-hidden",
                      onEventClick ? "cursor-pointer hover:opacity-80" : "cursor-default",
                      "bg-primary/20 text-primary border border-primary/30",
                      conflictIds.has(ev.id) &&
                        "bg-destructive/15 text-destructive border-destructive/40",
                    )}
                    style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                  >
                    <div className="font-medium truncate leading-tight">{ev.title}</div>
                    {heightPx >= 28 && (
                      <div className="opacity-70 truncate leading-tight">
                        {fmt12(start)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Agenda view ────────────────────────────────────────────────────────────────

function AgendaView({
  events,
  conflictIds,
  onEventClick,
}: {
  events: CalendarEvent[];
  conflictIds: Set<string>;
  onEventClick?: (ev: CalendarEvent) => void;
}) {
  const grouped = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = new Date(ev.start_time).toDateString();
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(ev);
    }
    return m;
  }, [events]);

  if (grouped.size === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No upcoming events in the next 60 days.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {Array.from(grouped.entries()).map(([dateStr, dayEvs]) => {
        const date = new Date(dateStr);
        const isToday = isSameDay(date, new Date());
        return (
          <div key={dateStr} className="flex">
            {/* Date column */}
            <div className="w-28 shrink-0 py-3 px-4 text-right">
              <div
                className={cn(
                  "text-sm font-semibold",
                  isToday ? "text-primary" : "text-foreground",
                )}
              >
                {date.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>

            {/* Events column */}
            <div className="flex-1 py-2 px-2 space-y-1 border-l border-border">
              {dayEvs.map((ev) => {
                const start = new Date(ev.start_time);
                const end = new Date(ev.end_time);
                const hasConflict = conflictIds.has(ev.id);
                return (
                  <div
                    key={ev.id}
                    onClick={() => onEventClick?.(ev)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg px-3 py-2 text-sm",
                      "bg-card border border-border",
                      hasConflict && "border-destructive/50",
                      onEventClick && "cursor-pointer hover:bg-muted/50 transition-colors",
                    )}
                  >
                    <div className="min-w-[80px] text-xs text-muted-foreground pt-0.5">
                      {ev.all_day ? (
                        "All day"
                      ) : (
                        <>
                          {fmt12(start)}
                          <br />
                          {fmt12(end)}
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{ev.title}</span>
                        {hasConflict && (
                          <AlertCircle
                            size={12}
                            className="text-destructive shrink-0"
                            title="Overlapping event"
                          />
                        )}
                      </div>
                      {ev.location && (
                        <div className="text-xs text-muted-foreground truncate">
                          {ev.location}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Event Detail / Edit / Delete Dialog ───────────────────────────────────────

type EventDialogMode = "detail" | "edit" | "delete-confirm";

function EventDetailDialog({
  event,
  open,
  onOpenChange,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState<EventDialogMode>("detail");
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [allDay, setAllDay] = useState(false);

  useEffect(() => {
    if (event && open) {
      setMode("detail");
      setSaving(false);
      const s = new Date(event.start_time);
      const e = new Date(event.end_time);
      setTitle(event.title ?? "");
      setDate(s.toISOString().slice(0, 10));
      setStartTime(s.toTimeString().slice(0, 5));
      setEndTime(e.toTimeString().slice(0, 5));
      setLocation(event.location ?? "");
      setDescription(event.description ?? "");
      setAllDay(event.all_day ?? false);
    }
  }, [event, open]);

  const canWrite =
    event && !event.is_read_only && !!event.external_event_id && !!session;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!event || !session) return;
    if (!allDay) {
      const s = new Date(`${date}T${startTime}`);
      const en = new Date(`${date}T${endTime}`);
      if (en <= s) {
        toast({ variant: "destructive", title: "End time must be after start time" });
        return;
      }
    }
    setSaving(true);
    try {
      const startISO = allDay
        ? `${date}T00:00:00.000Z`
        : new Date(`${date}T${startTime}`).toISOString();
      const endISO = allDay
        ? `${date}T23:59:59.000Z`
        : new Date(`${date}T${endTime}`).toISOString();
      const res = await fetch(`${FN_BASE}/google-calendar-write`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "update",
          event_id: event.id,
          external_event_id: event.external_event_id,
          title: title.trim(),
          description: description || undefined,
          location: location || undefined,
          start_time: startISO,
          end_time: endISO,
          all_day: allDay,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update event");
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({ title: "Event updated" });
      onOpenChange(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to update event", description: String(err) });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event || !session) return;
    setSaving(true);
    try {
      const res = await fetch(`${FN_BASE}/google-calendar-write`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "delete",
          event_id: event.id,
          external_event_id: event.external_event_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete event");
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({ title: "Event deleted" });
      onOpenChange(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to delete event", description: String(err) });
    } finally {
      setSaving(false);
    }
  }

  if (!event) return null;

  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {mode === "detail" && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">{event.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  When
                </span>
                <p className="mt-0.5 text-foreground">
                  {event.all_day
                    ? startDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                    : `${startDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · ${fmt12(startDate)} – ${fmt12(endDate)}`}
                </p>
              </div>
              {event.location && (
                <div>
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Location
                  </span>
                  <p className="mt-0.5 text-foreground">{event.location}</p>
                </div>
              )}
              {event.description && (
                <div>
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Description
                  </span>
                  <p className="mt-0.5 text-foreground whitespace-pre-wrap">{event.description}</p>
                </div>
              )}
              {event.is_read_only && (
                <p className="text-xs text-muted-foreground italic">Read-only event</p>
              )}
            </div>
            <DialogFooter className="gap-2">
              {canWrite && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setMode("delete-confirm")}
                  >
                    <Trash2 size={13} className="mr-1" />
                    Delete
                  </Button>
                  <Button type="button" size="sm" onClick={() => setMode("edit")}>
                    <Pencil size={13} className="mr-1" />
                    Edit
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}

        {mode === "edit" && (
          <>
            <DialogHeader>
              <DialogTitle>Edit event</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-allday"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="edit-allday" className="cursor-pointer">All day</Label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="edit-date">Date</Label>
                  <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                {!allDay && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="edit-start">Start</Label>
                      <Input id="edit-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-end">End</Label>
                      <Input id="edit-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-loc">Location</Label>
                <Input id="edit-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add location" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setMode("detail")}>
                  Back
                </Button>
                <Button type="submit" size="sm" disabled={saving || !title.trim()}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {mode === "delete-confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>Delete event?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will permanently delete <span className="font-medium text-foreground">{event.title}</span> from your Google Calendar.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setMode("detail")}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving ? "Deleting…" : "Delete event"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── New Event Dialog ───────────────────────────────────────────────────────────

interface NewEventDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialDate?: Date;
}

function NewEventDialog({ open, onOpenChange, initialDate }: NewEventDialogProps) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(
    (initialDate ?? new Date()).toISOString().slice(0, 10),
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !session) return;

    if (!allDay) {
      const s = new Date(`${date}T${startTime}`);
      const en = new Date(`${date}T${endTime}`);
      if (en <= s) {
        toast({ variant: "destructive", title: "End time must be after start time" });
        return;
      }
    }

    setSaving(true);
    try {
      const startISO = allDay
        ? `${date}T00:00:00.000Z`
        : new Date(`${date}T${startTime}`).toISOString();
      const endISO = allDay
        ? `${date}T00:00:00.000Z`
        : new Date(`${date}T${endTime}`).toISOString();

      const res = await fetch(`${FN_BASE}/google-calendar-write`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "create",
          title: title.trim(),
          description: description || undefined,
          location: location || undefined,
          start_time: startISO,
          end_time: endISO,
          all_day: allDay,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create event");
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({ title: "Event created" });
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setLocation("");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to create event",
        description: String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ev-title">Title</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              autoFocus
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ev-allday"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="ev-allday" className="cursor-pointer">
              All day
            </Label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="ev-date">Date</Label>
              <Input
                id="ev-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            {!allDay && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="ev-start">Start</Label>
                  <Input
                    id="ev-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ev-end">End</Label>
                  <Input
                    id="ev-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="ev-loc">Location</Label>
            <Input
              id="ev-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ev-desc">Description</Label>
            <Textarea
              id="ev-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !title.trim()}>
              {saving ? "Saving…" : "Save event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const [view, setView] = useState<CalView>("month");
  const [cursor, setCursor] = useState(new Date());
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const { session } = useAuth();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { data: account, isLoading: accountLoading, refetch: refetchAccount } =
    useCalendarAccount();

  // Handle OAuth redirect back
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "true") {
      toast({ title: "Google Calendar connected", description: "Your events are syncing now." });
      refetchAccount();
      navigate("/calendar", { replace: true });
    } else if (error) {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error.replace(/_/g, " "),
      });
      navigate("/calendar", { replace: true });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const { start, end } = dateRangeForView(view, cursor);
  const { data: events = [], isLoading: eventsLoading } = useCalendarEvents(start, end);
  const conflictIds = useMemo(() => detectConflicts(events), [events]);

  // Navigation
  function prev() {
    if (view === "month") setCursor((c) => addMonths(c, -1));
    else if (view === "week") setCursor((c) => addWeeks(c, -1));
    else if (view === "day") setCursor((c) => addDays(c, -1));
  }
  function next() {
    if (view === "month") setCursor((c) => addMonths(c, 1));
    else if (view === "week") setCursor((c) => addWeeks(c, 1));
    else if (view === "day") setCursor((c) => addDays(c, 1));
  }
  function goToday() {
    setCursor(new Date());
  }

  function periodLabel(): string {
    if (view === "month") return fmtMonthYear(cursor);
    if (view === "week") return fmtWeekRange(cursor);
    if (view === "day") return fmtDayFull(cursor);
    return "Next 60 days";
  }

  async function handleConnect() {
    if (!session) return;
    try {
      const res = await fetch(
        `${FN_BASE}/google-calendar-oauth?origin=${encodeURIComponent(window.location.origin)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (err) {
      toast({ variant: "destructive", title: "Could not connect", description: String(err) });
    }
  }

  async function handleSync() {
    if (!account || !session) return;
    setSyncing(true);
    try {
      const res = await fetch(`${FN_BASE}/google-calendar-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ calendar_account_id: account.id }),
      });
      if (!res.ok) throw new Error(`Sync returned ${res.status}`);
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({ title: "Calendar synced" });
    } catch {
      toast({ variant: "destructive", title: "Sync failed" });
    } finally {
      setSyncing(false);
    }
  }

  const weekDays = useMemo(() => {
    const s = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [cursor]);

  const dayView = [cursor].map((d) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        {/* Today + nav */}
        <Button variant="outline" size="sm" onClick={goToday}>
          Today
        </Button>
        {view !== "agenda" && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next}>
              <ChevronRight size={16} />
            </Button>
          </>
        )}

        <span className="text-sm font-medium text-foreground min-w-0">
          {periodLabel()}
        </span>

        <div className="flex-1" />

        {/* Conflict indicator */}
        {conflictIds.size > 0 && (
          <div className="flex items-center gap-1 text-xs text-destructive mr-1">
            <AlertCircle size={13} />
            {conflictIds.size} conflicting event{conflictIds.size !== 1 ? "s" : ""}
          </div>
        )}

        {/* Sync */}
        {account && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleSync}
            disabled={syncing}
            title="Sync calendar"
          >
            <RefreshCw size={14} className={cn(syncing && "animate-spin")} />
          </Button>
        )}

        {/* View tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["month", "week", "day", "agenda"] as CalView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* New event */}
        {account && (
          <Button size="sm" onClick={() => setNewEventOpen(true)}>
            <Plus size={14} className="mr-1" />
            New event
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {accountLoading ? null : !account ? (
          <ConnectPrompt onConnect={handleConnect} />
        ) : eventsLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Loading events…
          </div>
        ) : view === "month" ? (
          <MonthView cursor={cursor} events={events} conflictIds={conflictIds} onEventClick={setSelectedEvent} />
        ) : view === "week" ? (
          <TimeGrid days={weekDays} events={events} conflictIds={conflictIds} onEventClick={setSelectedEvent} />
        ) : view === "day" ? (
          <TimeGrid days={dayView} events={events} conflictIds={conflictIds} onEventClick={setSelectedEvent} />
        ) : (
          <AgendaView events={events} conflictIds={conflictIds} onEventClick={setSelectedEvent} />
        )}
      </div>

      <NewEventDialog
        open={newEventOpen}
        onOpenChange={setNewEventOpen}
      />

      <EventDetailDialog
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={(v) => { if (!v) setSelectedEvent(null); }}
      />
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, LOCALE_MAP } from "@/lib/i18n";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Calendar, Clock, CheckCircle2, Circle, BookOpen, ChevronLeft, ChevronRight, MessageCircle, Plus, X, LogOut, Search, Copy, Users, TrendingUp, CalendarCheck, UserX, UserPlus, Home, TreePine, AlertTriangle } from "lucide-react";
import { startOfWeekMondayUTC } from "@/lib/rota-utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/app/dashboard")({ component: DashboardRoute });

const WHATSAPP_URL = "https://chat.whatsapp.com/DvsSz15BQp98Zl8mQRIMLp";

type VolColor = { chip: string; dot: string };
const VOL_PALETTE: VolColor[] = [
  { chip: "bg-violet-100 text-violet-800",   dot: "bg-violet-400" },
  { chip: "bg-sky-100 text-sky-800",         dot: "bg-sky-400" },
  { chip: "bg-teal-100 text-teal-800",       dot: "bg-teal-400" },
  { chip: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-400" },
  { chip: "bg-amber-100 text-amber-800",     dot: "bg-amber-400" },
  { chip: "bg-orange-100 text-orange-800",   dot: "bg-orange-400" },
  { chip: "bg-rose-100 text-rose-800",       dot: "bg-rose-400" },
  { chip: "bg-pink-100 text-pink-800",       dot: "bg-pink-400" },
  { chip: "bg-indigo-100 text-indigo-800",   dot: "bg-indigo-400" },
  { chip: "bg-cyan-100 text-cyan-800",       dot: "bg-cyan-400" },
  { chip: "bg-lime-100 text-lime-800",       dot: "bg-lime-400" },
  { chip: "bg-red-100 text-red-800",         dot: "bg-red-400" },
  { chip: "bg-fuchsia-100 text-fuchsia-800", dot: "bg-fuchsia-400" },
  { chip: "bg-yellow-100 text-yellow-800",   dot: "bg-yellow-400" },
  { chip: "bg-green-100 text-green-800",     dot: "bg-green-400" },
  { chip: "bg-blue-100 text-blue-800",       dot: "bg-blue-400" },
];

type ShiftTemplate = { name: string | null; start_time: string | null; end_time: string | null };
type Shift = {
  id: string;
  shift_date: string;
  notes?: string | null;
  volunteers?: { name: string | null } | { name: string | null }[] | null;
  shift_templates: ShiftTemplate | ShiftTemplate[] | null;
};
type ShiftTask = {
  id: string;
  title: string;
  notes: string | null;
  shift_date: string;
};

type CleaningEntry = { id: string; room_name: string; room_type: string };

type IssueRow = { id: string; title: string; category: string; status: string; reporter_name: string | null; manager_notes: string | null; created_at: string; };

function pickTemplate(t: Shift["shift_templates"]): ShiftTemplate | null {
  if (!t) return null;
  return Array.isArray(t) ? t[0] ?? null : t;
}

function DashboardRoute() {
  const { user, loading, isVolunteer } = useAuth();
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!user) return null;
  if (isVolunteer) return <VolunteerDashboard />;
  return <Dashboard />;
}

type VolShift = {
  id: string;
  shift_date: string;
  notes?: string | null;
  volunteers?: { name: string | null } | { name: string | null }[] | null;
  shift_templates: ShiftTemplate | ShiftTemplate[] | null;
};

const TYPE_COLORS: { match: string; cls: string }[] = [
  { match: "breakfast",    cls: "bg-orange-100 text-orange-900 border-orange-200" },
  { match: "housekeep",   cls: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  { match: "laundry",     cls: "bg-blue-100 text-blue-900 border-blue-200" },
  { match: "cottage",     cls: "bg-teal-100 text-teal-900 border-teal-200" },
  { match: "maintenance", cls: "bg-amber-100 text-amber-900 border-amber-200" },
  { match: "deep",        cls: "bg-purple-100 text-purple-900 border-purple-200" },
  { match: "special",     cls: "bg-red-100 text-red-900 border-red-200" },
  { match: "family",      cls: "bg-pink-100 text-pink-900 border-pink-200" },
  { match: "dinner",      cls: "bg-pink-100 text-pink-900 border-pink-200" },
];
function shiftColor(name: string | null | undefined) {
  if (!name) return "bg-muted/40 text-muted-foreground border-border";
  const n = name.toLowerCase();
  for (const t of TYPE_COLORS) if (n.includes(t.match)) return t.cls;
  return "bg-secondary text-secondary-foreground border-border";
}

function ymdDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const MONTHS_SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function fmtDayMonth(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

function todayLocalYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Volunteer dashboard ────────────────────────────────────────────────────

function VolunteerDashboard() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<VolShift[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMondayUTC(new Date()));
  const [volunteerId, setVolunteerId] = useState<string | null>(null);
  const [volunteerStatus, setVolunteerStatus] = useState<string | null>(null);
  const [roleType, setRoleType] = useState<string | null>(null);
  const [cleaningRooms, setCleaningRooms] = useState<CleaningEntry[]>([]);
  const [shiftTasks, setShiftTasks] = useState<ShiftTask[]>([]);
  const [volunteerLinked, setVolunteerLinked] = useState<boolean | null>(null);

  const locale = LOCALE_MAP[lang] ?? "en-GB";
  const name =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
    user?.email?.split("@")[0] ||
    t("dash.friend");

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setUTCDate(weekStart.getUTCDate() + i); return d; }),
    [weekStart]
  );
  const startStr = ymdDate(days[0]);
  const endStr = ymdDate(days[6]);

  useEffect(() => {
    const today = todayLocalYmd();
    hostackSupabase
      .from("cleaning_schedule")
      .select("id, property_rooms(name, type)")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .eq("clean_date", today)
      .then(({ data }) => {
        const entries = (data ?? []).map((d) => {
          const pr = Array.isArray(d.property_rooms) ? d.property_rooms[0] : d.property_rooms;
          return { id: d.id, room_name: (pr as { name: string; type: string } | null)?.name ?? "?", room_type: (pr as { name: string; type: string } | null)?.type ?? "room" };
        });
        setCleaningRooms(entries);
      })
      .catch(() => setCleaningRooms([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: volByAuth } = await hostackSupabase
        .from("volunteers")
        .select("id, role_type, status")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (volByAuth?.id) {
        const v = volByAuth as { id: string; role_type: string | null; status: string | null };
        setVolunteerId(v.id);
        setRoleType(v.role_type);
        setVolunteerStatus(v.status);
        setVolunteerLinked(true);
        return;
      }
      const fullName = (user.user_metadata as { full_name?: string } | undefined)?.full_name;
      if (fullName) {
        type VolRow = { id: string; role_type: string | null; status: string | null };
        let volByName: VolRow | null = null;

        // 1. Exact case-insensitive match — active only to avoid collisions with
        //    former volunteers who share the same first name
        const { data: exact } = await hostackSupabase
          .from("volunteers")
          .select("id, role_type, status")
          .eq("property_id", TORRIDONIA_PROPERTY_ID)
          .eq("status", "active")
          .ilike("name", fullName)
          .maybeSingle();
        volByName = (exact as VolRow | null) ?? null;

        // 2. First-name prefix fallback (active only)
        if (!volByName) {
          const firstName = fullName.trim().split(" ")[0];
          const { data: prefix } = await hostackSupabase
            .from("volunteers")
            .select("id, role_type, status")
            .eq("property_id", TORRIDONIA_PROPERTY_ID)
            .eq("status", "active")
            .ilike("name", `${firstName}%`)
            .maybeSingle();
          volByName = (prefix as VolRow | null) ?? null;
        }

        if (volByName?.id) {
          setVolunteerId(volByName.id);
          setRoleType(volByName.role_type);
          setVolunteerStatus(volByName.status);
          setVolunteerLinked(true);
          // Always update auth_user_id to current session (re-links after session expiry or re-login)
          hostackSupabase
            .from("volunteers")
            .update({ auth_user_id: user.id })
            .eq("id", volByName.id)
            .then(() => {});
          return;
        }
      }
      setVolunteerLinked(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!user || volunteerLinked === null) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      let query = hostackSupabase
        .from("shifts")
        .select("id, shift_date, notes, volunteers(name), shift_templates(name, start_time, end_time)")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .gte("shift_date", startStr)
        .lte("shift_date", endStr)
        .order("shift_date", { ascending: true });
      if (volunteerId) query = query.eq("volunteer_id", volunteerId);
      const { data } = await query;
      if (!cancelled) setShifts((data as VolShift[]) ?? []);

      // Load sub-tasks for this week
      if (volunteerId) {
        const { data: tasks } = await hostackSupabase
          .from("shift_tasks")
          .select("id, title, notes, shift_date")
          .eq("property_id", TORRIDONIA_PROPERTY_ID)
          .eq("volunteer_id", volunteerId)
          .gte("shift_date", startStr)
          .lte("shift_date", endStr)
          .order("shift_date", { ascending: true });
        if (!cancelled) setShiftTasks((tasks as ShiftTask[]) ?? []);
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, volunteerId, volunteerLinked, startStr, endStr]);

  const fmtTime = (v: string | null) => (v ? v.slice(0, 5) : "");
  const isCurrentWeek = ymdDate(startOfWeekMondayUTC(new Date())) === startStr;
  // When linked, one shift per date; when unlinked, multiple shifts per date grouped
  const shiftsByDate = shifts.reduce((acc, s) => {
    const arr = acc.get(s.shift_date) ?? [];
    arr.push(s);
    acc.set(s.shift_date, arr);
    return acc;
  }, new Map<string, VolShift[]>());
  const todayStr = ymdDate(new Date());
  const todayShifts = volunteerId ? (shiftsByDate.get(todayStr) ?? []) : [];
  const todayPrimaryShift = todayShifts.find((s) => {
    const n = pickTemplate(s.shift_templates)?.name ?? "";
    return n !== "Family Dinners" && n !== "Off";
  }) ?? todayShifts[0] ?? null;
  const todayTpl = todayPrimaryShift ? pickTemplate(todayPrimaryShift.shift_templates) : null;
  const todayTasks = shiftTasks.filter((t) => t.shift_date === todayStr);
  const tasksByDate = shiftTasks.reduce((acc, t) => {
    const arr = acc.get(t.shift_date) ?? [];
    arr.push(t);
    acc.set(t.shift_date, arr);
    return acc;
  }, new Map<string, ShiftTask[]>());
  // Determine task type from today's shift template first, fall back to volunteer role
  const todayShiftName = todayTpl?.name?.toLowerCase() ?? "";
  const isHousekeeping = todayShiftName.includes("housekeep") || (roleType?.toLowerCase().includes("housekeep") ?? false);
  const isCottages = todayShiftName.includes("cottage") || (roleType?.toLowerCase().includes("cottage") ?? false);
  const isPending = volunteerStatus === "pending";

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="font-display text-4xl font-semibold mt-1">{t("dash.hi")}, {name}! 👋</h1>
      </header>

      {isPending && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your profile is pending confirmation. Your manager will assign your shifts shortly.
        </div>
      )}

      {!loading && (
        <div className={`rounded-2xl border p-4 flex items-start gap-3 shadow-soft ${todayTpl ? shiftColor(todayTpl.name) : "bg-card border-border"}`}>
          <Calendar className="h-5 w-5 mt-0.5 shrink-0 opacity-70" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide opacity-60">{t("dash.todayShift")}</p>
            {volunteerId === null && volunteerLinked === false ? (
              <p className="font-semibold text-lg mt-0.5 text-muted-foreground">Awaiting shift assignment</p>
            ) : todayShifts.length > 0 ? (
              <div className="mt-0.5 space-y-1">
                {todayShifts.map((s) => {
                  const tpl = pickTemplate(s.shift_templates);
                  if (!tpl || tpl.name === "Off") return null;
                  return (
                    <div key={s.id}>
                      <p className="font-semibold text-lg leading-tight">
                        {tpl.name}
                        {tpl.start_time ? ` · ${fmtTime(tpl.start_time)}–${fmtTime(tpl.end_time)}` : ""}
                      </p>
                      {s.notes && <p className="text-xs opacity-70 italic">{s.notes}</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="font-semibold text-lg mt-0.5 text-muted-foreground">Free today 🌿</p>
            )}
          </div>
        </div>
      )}

      {todayTasks.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-accent" /> Extra tasks today
          </h2>
          <div className="space-y-1.5">
            {todayTasks.map((task) => (
              <div key={task.id} className="rounded-xl border bg-card px-4 py-2.5">
                <p className="font-medium text-sm">{task.title}</p>
                {task.notes && <p className="text-xs text-muted-foreground mt-0.5">{task.notes}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-accent" /> {t("dash.myShifts")}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setWeekStart((w) => { const d = new Date(w); d.setUTCDate(w.getUTCDate() - 7); return d; })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-xs px-2"
              onClick={() => setWeekStart(startOfWeekMondayUTC(new Date()))}>
              {isCurrentWeek ? t("dash.thisWeek") : t("dash.today")}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setWeekStart((w) => { const d = new Date(w); d.setUTCDate(w.getUTCDate() + 7); return d; })}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {fmtDayMonth(startStr)} – {fmtDayMonth(endStr)}
        </p>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map((i) => <div key={i} className="h-16 rounded-2xl bg-secondary/40 animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {days.map((d) => {
              const dateStr = ymdDate(d);
              const isToday = dateStr === ymdDate(new Date());
              const dayTasks = tasksByDate.get(dateStr) ?? [];

              // Linked volunteer: show all their shifts for this day
              if (volunteerId) {
                const dayShiftsLinked = shiftsByDate.get(dateStr) ?? [];
                const primaryShift = dayShiftsLinked.find((s) => {
                  const n = pickTemplate(s.shift_templates)?.name ?? "";
                  return n !== "Family Dinners" && n !== "Off";
                }) ?? dayShiftsLinked[0] ?? null;
                const primaryTpl = primaryShift ? pickTemplate(primaryShift.shift_templates) : null;
                const hasRealShift = dayShiftsLinked.some((s) => {
                  const n = pickTemplate(s.shift_templates)?.name ?? "";
                  return n !== "Off";
                });
                return (
                  <div key={dateStr} className={`rounded-2xl border p-3 transition ${isToday ? "ring-2 ring-accent/40 shadow-warm" : ""} ${primaryTpl ? shiftColor(primaryTpl.name) : "bg-card text-card-foreground border-border"}`}>
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[40px]">
                        <p className="text-[10px] uppercase font-mono font-medium opacity-70">{d.toLocaleDateString(locale, { weekday: "short" }).slice(0, 3).toUpperCase()}</p>
                        <p className={`text-lg font-semibold leading-none ${isToday ? "text-accent" : ""}`}>{d.getUTCDate()}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        {hasRealShift ? (
                          <div className="space-y-1">
                            {dayShiftsLinked.map((s) => {
                              const tpl = pickTemplate(s.shift_templates);
                              if (!tpl || tpl.name === "Off") return null;
                              return (
                                <div key={s.id}>
                                  <p className="font-medium text-sm">{tpl.name}
                                    {(tpl.start_time || tpl.end_time) && (
                                      <span className="text-xs opacity-70 ml-1">
                                        <Clock className="h-3 w-3 inline mr-0.5" />
                                        {fmtTime(tpl.start_time ?? null)}{tpl.end_time ? `–${fmtTime(tpl.end_time)}` : ""}
                                      </span>
                                    )}
                                  </p>
                                  {s.notes && <p className="text-xs opacity-60 italic truncate">{s.notes}</p>}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">—</p>
                        )}
                      </div>
                    </div>
                    {dayTasks.length > 0 && (
                      <div className="mt-2 pl-[52px] space-y-0.5">
                        {dayTasks.map((task) => (
                          <p key={task.id} className="text-xs text-muted-foreground flex items-center gap-1">
                            <Circle className="h-2.5 w-2.5 shrink-0" /> {task.title}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // Unlinked: show all team shifts for this day
              const dayShifts = shiftsByDate.get(dateStr) ?? [];
              return (
                <div key={dateStr} className={`rounded-2xl border p-3 transition bg-card text-card-foreground border-border ${isToday ? "ring-2 ring-accent/40 shadow-warm" : ""}`}>
                  <div className="flex gap-3">
                    <div className="text-center min-w-[40px] shrink-0">
                      <p className="text-[10px] uppercase font-mono font-medium opacity-70">{d.toLocaleDateString(locale, { weekday: "short" }).slice(0, 3).toUpperCase()}</p>
                      <p className={`text-lg font-semibold leading-none ${isToday ? "text-accent" : ""}`}>{d.getUTCDate()}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      {dayShifts.length === 0 ? (
                        <p className="text-xs text-muted-foreground mt-1">No shifts</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {dayShifts.map((s) => {
                            const tpl = pickTemplate(s.shift_templates);
                            const volName = Array.isArray(s.volunteers) ? s.volunteers[0]?.name : s.volunteers?.name;
                            return (
                              <span key={s.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border ${tpl ? shiftColor(tpl.name) : "bg-muted text-muted-foreground border-border"}`}>
                                {volName && <span className="opacity-70">{volName.split(" ")[0]}</span>}
                                {volName && tpl && <span className="opacity-40">·</span>}
                                {tpl?.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {(isHousekeeping || isCottages) && (() => {
        const toClean = cleaningRooms.filter((r) => isCottages ? r.room_type === "cottage" : r.room_type === "room");
        const heading = isCottages ? "Cottages to clean today" : "Rooms to clean today";
        const color = isCottages
          ? { card: "border-teal-200 bg-teal-50 text-teal-900", icon: "text-teal-500" }
          : { card: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: "text-emerald-500" };
        return (
          <section className="space-y-2">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              {isCottages ? <TreePine className={`h-4 w-4 ${color.icon}`} /> : <Home className={`h-4 w-4 ${color.icon}`} />}
              {heading}
            </h2>
            {toClean.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rooms assigned for today yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {toClean.map((r) => (
                  <div key={r.id} className={`rounded-xl border ${color.card} px-3 py-2 text-sm font-medium`}>
                    {r.room_name}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      <IssueReportButton reporterName={name} reporterVolunteerId={volunteerId} />

      <div className="flex flex-col gap-3">
        <Link
          to="/app/guidebook"
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground py-4 font-medium shadow-soft hover:opacity-90 transition"
        >
          <BookOpen className="h-5 w-5" /> {t("dash.viewGuides")}
        </Link>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-white py-4 font-medium shadow-soft hover:opacity-90 transition"
        >
          <MessageCircle className="h-5 w-5" /> {t("dash.whatsapp")}
        </a>
      </div>
    </div>
  );
}

function IssueReportButton({ reporterName, reporterVolunteerId }: { reporterName: string; reporterVolunteerId: string | null }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const resetForm = () => { setCategory(""); setTitle(""); setDescription(""); };

  const handleSubmit = async () => {
    if (!title || !category) return;
    setBusy(true);
    const { error } = await hostackSupabase.from("issues").insert({
      property_id: TORRIDONIA_PROPERTY_ID,
      title,
      description,
      category,
      reporter_name: reporterName,
      reporter_volunteer_id: reporterVolunteerId,
      status: "pending",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Issue reported! The manager has been notified.");
    setOpen(false);
    resetForm();
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 font-medium border-amber-300 text-amber-700 hover:bg-amber-50 transition"
        onClick={() => setOpen(true)}
      >
        <AlertTriangle className="h-5 w-5" /> Report an Issue
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Report an Issue</DialogTitle>
            <DialogDescription>Let the manager know about a problem that needs attention.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Plumbing">Plumbing</SelectItem>
                <SelectItem value="Supplies">Supplies</SelectItem>
                <SelectItem value="Electrical">Electrical</SelectItem>
                <SelectItem value="Cleaning">Cleaning</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="What's the issue?" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Describe what happened…" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            <Button className="w-full" onClick={handleSubmit} disabled={busy || !title || !category}>
              {busy ? "Submitting…" : "Submit Issue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Admin / Staff dashboard ────────────────────────────────────────────────

type MatrixShift = {
  id: string;
  shift_date: string;
  volunteer_id: string | null;
  shift_template_id: string | null;
  volunteers: { id: string; name: string } | { id: string; name: string }[] | null;
  shift_templates: { id: string; name: string } | { id: string; name: string }[] | null;
};

type VolunteerRow = { id: string; name: string; role_type?: string | null };
type TemplateRow  = { id: string; name: string; start_time: string | null; end_time: string | null };

const TASK_ORDER = [
  "Breakfast", "Housekeeping", "Cottages", "Maintenance",
  "Laundry", "Special Task", "Family Dinners",
  "Off", "Arrive", "Onboarding",
];

function pickName<T extends { name: string }>(v: T | T[] | null): string | null {
  if (!v) return null;
  const item = Array.isArray(v) ? v[0] : v;
  return item?.name ?? null;
}
function pickId<T extends { id: string }>(v: T | T[] | null): string | null {
  if (!v) return null;
  const item = Array.isArray(v) ? v[0] : v;
  return item?.id ?? null;
}

function addDaysUTC(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}


function AdminMatrix() {
  const { t, lang } = useI18n();
  const locale = LOCALE_MAP[lang] ?? "en-GB";
  const [weekStart, setWeekStart] = useState<string>(() => {
    const d = startOfWeekMondayUTC(new Date());
    return ymdDate(d);
  });
  const [shifts, setShifts]         = useState<MatrixShift[]>([]);
  const [volunteers, setVolunteers]  = useState<VolunteerRow[]>([]);
  const [templates, setTemplates]    = useState<TemplateRow[]>([]);
  const [loading, setLoading]        = useState(true);
  const [copying, setCopying]        = useState(false);
  const [assigning, setAssigning]    = useState<string | null>(null);
  const [volSearch, setVolSearch]    = useState("");
  const [creating, setCreating]      = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysUTC(weekStart, i)),
    [weekStart]
  );

  // Stable color map: sorted volunteer list index → VOL_PALETTE
  const volColorMap = useMemo(() => {
    const map = new Map<string, VolColor>();
    volunteers.forEach((v, i) => map.set(v.id, VOL_PALETTE[i % VOL_PALETTE.length]));
    return map;
  }, [volunteers]);

  const createAndAssign = async (name: string, tplName: string, date: string) => {
    const tpl = templates.find((t) => t.name === tplName);
    if (!tpl || !name.trim()) return;
    setCreating(true);
    try {
      const { data: newVol, error: volErr } = await hostackSupabase
        .from("volunteers")
        .insert({
          property_id: TORRIDONIA_PROPERTY_ID,
          name: name.trim(),
          status: "active",
          role_type: "Volunteer",
          start_date: date,
          end_date: addDaysUTC(date, 90),
        })
        .select("id, name, role_type")
        .single();
      if (volErr || !newVol) { toast.error(volErr?.message ?? "Failed to create"); return; }
      const v = newVol as VolunteerRow;
      setVolunteers((prev) => [...prev, v].sort((a, b) => a.name.localeCompare(b.name)));
      await assignVolunteer(tplName, date, v.id);
      toast.success(`${name.trim()} added and assigned`);
      setAssigning(null);
      setVolSearch("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error creating volunteer");
    } finally {
      setCreating(false);
    }
  };

  const loadData = useCallback(async (daysArr: string[]) => {
    setLoading(true);
    const [shiftRes, volRes, tplRes] = await Promise.all([
      hostackSupabase
        .from("shifts")
        .select("id, shift_date, volunteer_id, shift_template_id, volunteers(id, name), shift_templates(id, name)")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .gte("shift_date", daysArr[0])
        .lte("shift_date", daysArr[6]),
      hostackSupabase
        .from("volunteers")
        .select("id, name, role_type")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .eq("status", "active")
        .order("name"),
      hostackSupabase
        .from("shift_templates")
        .select("id, name, start_time, end_time")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .order("name"),
    ]);
    if (shiftRes.error) toast.error(shiftRes.error.message);
    if (volRes.error)   toast.error(volRes.error.message);
    if (tplRes.error)   toast.error(tplRes.error.message);
    setShifts((shiftRes.data as MatrixShift[]) ?? []);
    setVolunteers((volRes.data as VolunteerRow[]) ?? []);
    setTemplates((tplRes.data as TemplateRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(days); }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const taskNames = useMemo(() => {
    // Always show all fixed rows; append any unknown templates at the end
    const fromData = [...new Set(shifts.map((s) => pickName(s.shift_templates)).filter(Boolean) as string[])];
    const extra = fromData.filter((n) => !TASK_ORDER.includes(n)).sort();
    return [...TASK_ORDER, ...extra];
  }, [shifts]);

  const cellShifts = (tplName: string, date: string) =>
    shifts.filter((s) => pickName(s.shift_templates) === tplName && s.shift_date === date);

  const removeShift = async (shiftId: string) => {
    const { error } = await hostackSupabase.from("shifts").delete().eq("id", shiftId);
    if (error) { toast.error(error.message); return; }
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
  };

  const assignVolunteer = async (tplName: string, date: string, volId: string) => {
    const tpl = templates.find((t) => t.name === tplName);
    if (!tpl || !volId) return;
    const payload = {
      property_id: TORRIDONIA_PROPERTY_ID,
      shift_date: date,
      volunteer_id: volId,
      shift_template_id: tpl.id,
      start_time: tpl.start_time ?? "09:00",
      end_time:   tpl.end_time   ?? "17:00",
      status: "scheduled",
    };
    const { error } = await hostackSupabase.from("shifts").insert(payload);
    if (error) { toast.error(error.message); return; }
    await loadData(days);
  };

  const openAssign = useCallback((key: string) => {
    setAssigning(key);
    setVolSearch("");
    setTimeout(() => {
      const handler = (e: MouseEvent) => {
        if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
          setAssigning(null);
          setVolSearch("");
          document.removeEventListener("mousedown", handler);
        }
      };
      document.addEventListener("mousedown", handler);
    }, 0);
  }, []);


  const copyWeekToNext = async () => {
    setCopying(true);
    const nextStart = addDaysUTC(weekStart, 7);
    const nextEnd   = addDaysUTC(nextStart, 6);

    // Check for existing shifts in next week to avoid duplicates
    const { data: existing } = await hostackSupabase
      .from("shifts")
      .select("shift_date, volunteer_id, shift_template_id")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .gte("shift_date", nextStart)
      .lte("shift_date", nextEnd);

    const existingSet = new Set(
      (existing ?? []).map((s) => `${s.shift_date}__${s.volunteer_id}__${s.shift_template_id}`)
    );

    const tplMap = new Map(templates.map((t) => [t.id, t]));
    const toInsert = shifts
      .filter((s) => s.volunteer_id && s.shift_template_id)
      .map((s) => {
        const newDate = addDaysUTC(s.shift_date, 7);
        const key = `${newDate}__${s.volunteer_id}__${s.shift_template_id}`;
        if (existingSet.has(key)) return null;
        const srcTpl = tplMap.get(s.shift_template_id ?? "");
        return {
          property_id: TORRIDONIA_PROPERTY_ID,
          shift_date: newDate,
          volunteer_id: s.volunteer_id,
          shift_template_id: s.shift_template_id,
          start_time: srcTpl?.start_time ?? "09:00",
          end_time:   srcTpl?.end_time   ?? "17:00",
          status: "scheduled",
        };
      })
      .filter(Boolean);

    if (toInsert.length === 0) {
      toast.info("Next week already has shifts or no shifts to copy.");
      setCopying(false);
      return;
    }

    const { error } = await hostackSupabase.from("shifts").insert(toInsert as Record<string, unknown>[]);
    if (error) { toast.error(error.message); setCopying(false); return; }
    toast.success(`${toInsert.length} shifts copied to next week.`);
    setCopying(false);
    setWeekStart(nextStart);
  };

  const prevWeek = () => setWeekStart(addDaysUTC(weekStart, -7));
  const nextWeek = () => setWeekStart(addDaysUTC(weekStart, 7));
  const thisWeek = () => setWeekStart(ymdDate(startOfWeekMondayUTC(new Date())));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("matrix.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("matrix.sub")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={copyWeekToNext}
            disabled={copying || loading || shifts.length === 0}
          >
            <Copy className="h-3.5 w-3.5" />
            {copying ? t("matrix.copying") : t("matrix.copyWeek")}
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={thisWeek}>
              {fmtDayMonth(days[0])} – {fmtDayMonth(days[6])}
            </Button>
            <Button variant="outline" size="icon" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-40 rounded-xl bg-secondary/30 animate-pulse" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b bg-secondary/30">
                <th className="text-left p-3 font-semibold w-32 sticky left-0 bg-secondary/30">&nbsp;</th>
                {days.map((d) => {
                  const today = d === ymdDate(new Date());
                  return (
                    <th key={d} className={`p-2 text-center font-semibold ${today ? "text-accent" : "text-muted-foreground"}`}>
                      <div>{new Date(d + "T00:00:00Z").toLocaleDateString(locale, { weekday: "short" })}</div>
                      <div className={`text-base font-display ${today ? "text-accent" : ""}`}>
                        {new Date(d + "T00:00:00Z").getUTCDate()}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {taskNames.map((task) => (
                <tr key={task} className="border-b last:border-0 hover:bg-secondary/10">
                  <td className="p-3 font-medium text-foreground sticky left-0 bg-card border-r w-32">{task}</td>
                  {days.map((d) => {
                    const cellKey = `${task}__${d}`;
                    const cell = cellShifts(task, d);
                    const isAssigning = assigning === cellKey;
                    const filtered = volunteers.filter((v) => {
                      if (!volSearch) return true;
                      return v.name.toLowerCase().includes(volSearch.toLowerCase());
                    });
                    const exactExists = volunteers.some(
                      (v) => v.name.toLowerCase() === volSearch.trim().toLowerCase()
                    );
                    const showCreate = volSearch.trim().length > 0 && !exactExists;
                    return (
                      <td key={d} className="p-2 align-top min-w-[120px] relative">
                        <div className="flex flex-wrap gap-1">
                          {cell.map((s) => {
                            const volId = s.volunteer_id ?? pickId(s.volunteers) ?? "";
                            const vc = volColorMap.get(volId) ?? VOL_PALETTE[0];
                            return (
                              <span
                                key={s.id}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${vc.chip}`}
                              >
                                <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${vc.dot}`} />
                                {pickName(s.volunteers) ?? "?"}
                                <button
                                  type="button"
                                  onClick={() => removeShift(s.id)}
                                  className="opacity-50 hover:opacity-100 ml-0.5"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </span>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => isAssigning ? (setAssigning(null), setVolSearch("")) : openAssign(cellKey)}
                            className={`inline-flex items-center justify-center rounded-full border border-dashed w-5 h-5 transition ${
                              isAssigning
                                ? "border-primary text-primary"
                                : "border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary"
                            }`}
                          >
                            {isAssigning ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          </button>
                        </div>

                        {isAssigning && (
                          <div
                            ref={pickerRef}
                            className="absolute z-50 top-8 left-0 bg-popover border rounded-xl shadow-xl w-56 overflow-hidden"
                            onKeyDown={(e) => { if (e.key === "Escape") { setAssigning(null); setVolSearch(""); } }}
                          >
                            <div className="px-2 pt-2 pb-1 border-b">
                              <div className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1">
                                <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                                <input
                                  autoFocus
                                  className="text-xs bg-transparent outline-none w-full placeholder:text-muted-foreground"
                                  placeholder={t("matrix.selectVol")}
                                  value={volSearch}
                                  onChange={(e) => setVolSearch(e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="max-h-52 overflow-y-auto py-1">
                              {filtered.map((v) => {
                                const alreadyHere = cell.some((s) => s.volunteer_id === v.id);
                                if (alreadyHere) return null;
                                const vc = volColorMap.get(v.id) ?? VOL_PALETTE[0];
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => assignVolunteer(task, d, v.id)}
                                    className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition hover:bg-secondary/60 cursor-pointer"
                                  >
                                    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${vc.dot}`} />
                                    <div className="min-w-0">
                                      <div className="font-medium truncate">{v.name}</div>
                                      {v.role_type && (
                                        <div className="text-[10px] text-muted-foreground">{v.role_type}</div>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                              {showCreate && (
                                <button
                                  type="button"
                                  disabled={creating}
                                  onClick={() => createAndAssign(volSearch.trim(), task, d)}
                                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-t transition hover:bg-accent/10 cursor-pointer text-accent font-medium"
                                >
                                  <span className="text-base leading-none">+</span>
                                  {creating ? "Creating…" : `Create "${volSearch.trim()}"`}
                                </button>
                              )}
                              {filtered.length === 0 && !showCreate && (
                                <p className="text-xs text-muted-foreground text-center py-3">No results</p>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Manager "Today" — full today view ─────────────────────────────────

type AnnouncementRow = { id: string; title: string; content: string | null };

function AdminTodayView() {
  const [entries, setEntries] = useState<CleaningEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftsToday, setShiftsToday] = useState<OverviewShift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [resolvingIssue, setResolvingIssue] = useState<string | null>(null);
  const [todayAnnouncements, setTodayAnnouncements] = useState<AnnouncementRow[]>([]);

  // Load cleaning schedule
  useEffect(() => {
    const today = todayLocalYmd();
    hostackSupabase
      .from("cleaning_schedule")
      .select("id, property_rooms(name, type)")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .eq("clean_date", today)
      .then(({ data }) => {
        const parsed = (data ?? []).map((d) => {
          const pr = Array.isArray(d.property_rooms) ? d.property_rooms[0] : d.property_rooms;
          return {
            id: d.id,
            room_name: (pr as { name: string; type: string } | null)?.name ?? "?",
            room_type: (pr as { name: string; type: string } | null)?.type ?? "room",
          };
        });
        setEntries(parsed);
        setLoading(false);
      })
      .catch(() => { setEntries([]); setLoading(false); });
  }, []);

  // Load today's shifts
  useEffect(() => {
    setLoadingShifts(true);
    const today = todayLocalYmd();
    hostackSupabase
      .from("shifts")
      .select("id, volunteer_id, volunteers(id, name, whatsapp_number), shift_templates(name, start_time, end_time)")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .eq("shift_date", today)
      .eq("status", "scheduled")
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        setShiftsToday((data as unknown as OverviewShift[]) ?? []);
        setLoadingShifts(false);
      });
  }, []);

  // Load issues
  const loadIssues = useCallback(() => {
    setLoadingIssues(true);
    hostackSupabase
      .from("issues")
      .select("id, title, category, status, reporter_name, manager_notes, created_at")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        setIssues((data as IssueRow[]) ?? []);
        setLoadingIssues(false);
      });
  }, []);

  useEffect(() => { loadIssues(); }, [loadIssues]);

  // Load today's announcements
  useEffect(() => {
    const today = todayLocalYmd();
    hostackSupabase
      .from("announcements")
      .select("id, title, content")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .eq("event_date", today)
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        setTodayAnnouncements((data as AnnouncementRow[]) ?? []);
      });
  }, []);

  const resolveIssue = async (id: string) => {
    setResolvingIssue(id);
    const { error } = await hostackSupabase
      .from("issues")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); setResolvingIssue(null); return; }
    setResolvingIssue(null);
    loadIssues();
  };

  const bbRooms = entries.filter((e) => e.room_type === "room");
  const cottages = entries.filter((e) => e.room_type === "cottage");
  const pendingIssues = issues.filter((i) => i.status === "pending");
  const resolvedIssues = issues.filter((i) => i.status !== "pending");

  return (
    <div className="space-y-6">
      {/* Cleaning schedule */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-accent" /> Cleaning today
        </h2>
        {loading ? (
          <div className="h-28 rounded-2xl bg-secondary/40 animate-pulse" />
        ) : bbRooms.length === 0 && cottages.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-secondary/30 p-6 text-center text-muted-foreground space-y-2">
            <Calendar className="h-6 w-6 mx-auto" />
            <p className="text-sm">No rooms scheduled for cleaning today.</p>
            <Link to="/app/admin/cleaning" className="text-xs text-accent hover:underline block">
              Edit cleaning schedule →
            </Link>
          </div>
        ) : (
          <>
            {bbRooms.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                  <Home className="h-4 w-4 text-emerald-500" /> B&amp;B Rooms to clean
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {bbRooms.map((r) => (
                    <div key={r.id} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <p className="font-semibold text-sm text-emerald-900">{r.room_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {cottages.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                  <TreePine className="h-4 w-4 text-teal-500" /> Cottages to clean
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {cottages.map((r) => (
                    <div key={r.id} className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5">
                      <p className="font-semibold text-sm text-teal-900">{r.room_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Link to="/app/admin/cleaning" className="text-xs text-accent hover:underline block">
              Edit cleaning schedule →
            </Link>
          </>
        )}
      </section>

      {/* On shift today */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-accent" /> On shift today
        </h2>
        <div className="rounded-2xl border bg-card p-4 shadow-soft">
          {loadingShifts ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-secondary/40 animate-pulse" />)}
            </div>
          ) : shiftsToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shifts scheduled today.</p>
          ) : (
            <ul className="divide-y">
              {shiftsToday.map((s, i) => {
                const vol = Array.isArray(s.volunteers) ? s.volunteers[0] : s.volunteers;
                const tpl = Array.isArray(s.shift_templates) ? s.shift_templates[0] : s.shift_templates;
                const wa = vol?.whatsapp_number?.replace(/[^\d]/g, "");
                return (
                  <li key={s.id ?? i} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{vol?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {tpl?.name ?? "—"}
                        {tpl?.start_time ? ` · ${tpl.start_time.slice(0, 5)}` : ""}
                        {tpl?.end_time ? `–${tpl.end_time.slice(0, 5)}` : ""}
                      </p>
                    </div>
                    {wa && (
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="shrink-0 gap-1.5">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Open issues */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Open issues
          {!loadingIssues && pendingIssues.length > 0 && (
            <Badge className="bg-amber-500 text-white text-xs">{pendingIssues.length} pending</Badge>
          )}
        </h2>
        {loadingIssues ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-secondary/40 animate-pulse" />)}
          </div>
        ) : issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">No issues reported.</p>
        ) : (
          <ul className="space-y-2">
            {[...pendingIssues, ...resolvedIssues].map((issue) => (
              <li key={issue.id} className={`rounded-xl border p-3 space-y-1 ${issue.status === "pending" ? "border-amber-200 bg-amber-50" : "border-border bg-secondary/20"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${issue.status === "pending" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-emerald-100 text-emerald-800 border-emerald-200"}`}>
                        {issue.category}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${issue.status === "pending" ? "bg-amber-200/60 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {issue.status === "pending" ? "Pending" : "Resolved"}
                      </span>
                    </div>
                    <p className="font-medium text-sm mt-1">{issue.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {issue.reporter_name ?? "Unknown"} · {new Date(issue.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  {issue.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      disabled={resolvingIssue === issue.id}
                      onClick={() => resolveIssue(issue.id)}
                    >
                      {resolvingIssue === issue.id ? "…" : "Mark resolved"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Today's announcements */}
      {todayAnnouncements.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-accent" /> Today's announcements
          </h2>
          <div className="space-y-2">
            {todayAnnouncements.map((a) => (
              <div key={a.id} className="rounded-xl border bg-card p-4 shadow-soft space-y-1">
                <p className="font-semibold text-sm">{a.title}</p>
                {a.content && <p className="text-sm text-muted-foreground">{a.content}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Admin overview KPIs ──────────────────────────────────────────────────

type VolDetail = { id: string; name: string | null; role_type: string | null; start_date: string | null; end_date: string | null; whatsapp_number: string | null };
type OverviewShift = { id: string; volunteer_id: string | null; volunteers: { id: string; name: string | null; whatsapp_number?: string | null } | null; shift_templates: { name: string | null; start_time: string | null; end_time: string | null } | null };

function OverviewSection() {
  const [stats, setStats] = useState<{
    activeVolunteers: number;
    weekShifts: number;
    upcomingDepartures: { name: string; end_date: string }[];
    upcomingArrivals: { name: string; start_date: string }[];
  } | null>(null);

  const [showVolunteers, setShowVolunteers] = useState(false);
  const [volOnProperty, setVolOnProperty] = useState<VolDetail[]>([]);
  const [loadingVols, setLoadingVols] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const loadVols = useCallback(() => {
    setLoadingVols(true);
    hostackSupabase
      .from("volunteers")
      .select("id, name, role_type, start_date, end_date, whatsapp_number")
      .eq("property_id", TORRIDONIA_PROPERTY_ID)
      .eq("status", "active")
      .order("name")
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        setVolOnProperty((data as VolDetail[]) ?? []);
        setLoadingVols(false);
      });
  }, []);

  useEffect(() => { if (showVolunteers) loadVols(); }, [showVolunteers, loadVols]);

  useEffect(() => {
    const today = todayLocalYmd();
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;
    const mon = startOfWeekMondayUTC(new Date());
    const weekMon = `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, "0")}-${String(mon.getUTCDate()).padStart(2, "0")}`;
    const weekSun = addDaysUTC(weekMon, 6);
    Promise.all([
      hostackSupabase.from("volunteers").select("id", { count: "exact" })
        .eq("property_id", TORRIDONIA_PROPERTY_ID).eq("status", "active"),
      hostackSupabase.from("shifts").select("id", { count: "exact" })
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .gte("shift_date", weekMon).lte("shift_date", weekSun).eq("status", "scheduled"),
      hostackSupabase.from("volunteers").select("name, end_date")
        .eq("property_id", TORRIDONIA_PROPERTY_ID).eq("status", "active")
        .gte("end_date", today).lte("end_date", weekEndStr).order("end_date", { ascending: true }),
      hostackSupabase.from("volunteers").select("name, start_date")
        .eq("property_id", TORRIDONIA_PROPERTY_ID).eq("status", "active")
        .gte("start_date", today).lte("start_date", weekEndStr).order("start_date", { ascending: true }),
    ]).then(([volRes, weekShiftsRes, depsRes, arrivalsRes]) => {
      setStats({
        activeVolunteers: volRes.count ?? 0,
        weekShifts: weekShiftsRes.count ?? 0,
        upcomingDepartures: (depsRes.data ?? []) as { name: string; end_date: string }[],
        upcomingArrivals: (arrivalsRes.data ?? []) as { name: string; start_date: string }[],
      });
    });
  }, []);

  const deactivateVol = async (volId: string) => {
    setDeactivating(volId);
    const { error } = await hostackSupabase
      .from("volunteers")
      .update({ status: "inactive" })
      .eq("id", volId);
    if (error) { toast.error(error.message); setDeactivating(null); return; }
    setVolOnProperty((prev) => prev.filter((v) => v.id !== volId));
    setStats((s) => s ? { ...s, activeVolunteers: Math.max(0, s.activeVolunteers - 1) } : s);
    setDeactivating(null);
    toast.success("Volunteer removed from active roster");
  };

  const fmtDate = (d: string): string => {
    const date = new Date(d + "T00:00:00");
    const day = date.getDate();
    const month = date.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
    const year = date.getFullYear();
    if (year !== new Date().getFullYear()) return `${day} ${month} ${String(year).slice(2)}`;
    return `${day} ${month}`;
  };

  if (!stats) return <div className="h-28 rounded-xl bg-secondary/30 animate-pulse" />;

  const minutesSaved = stats.weekShifts * 2;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setShowVolunteers(true)}
          className="rounded-xl bg-secondary/40 p-4 space-y-1 text-left hover:bg-secondary/60 transition">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Active volunteers</p>
          <p className="text-2xl font-semibold">{stats.activeVolunteers}</p>
          <p className="text-xs text-muted-foreground">tap to manage</p>
        </button>
        <div className="rounded-xl bg-secondary/40 p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Time saved this week</p>
          <p className="text-2xl font-semibold">{minutesSaved} min</p>
          <p className="text-xs text-muted-foreground">{stats.weekShifts} shifts</p>
        </div>
        <div className="rounded-xl bg-secondary/40 p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><UserX className="h-3.5 w-3.5 text-amber-500" /> Departures this week</p>
          <p className="text-2xl font-semibold">{stats.upcomingDepartures.length}</p>
          {stats.upcomingDepartures.length > 0 && (
            <ul className="space-y-0.5 pt-1">
              {stats.upcomingDepartures.map((v) => (
                <li key={v.name} className="text-xs text-muted-foreground truncate">{v.name} <span className="text-amber-600">· {fmtDate(v.end_date)}</span></li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl bg-secondary/40 p-4 space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5 text-emerald-500" /> Arrivals this week</p>
          <p className="text-2xl font-semibold">{stats.upcomingArrivals.length}</p>
          {stats.upcomingArrivals.length > 0 && (
            <ul className="space-y-0.5 pt-1">
              {stats.upcomingArrivals.map((v) => (
                <li key={v.name} className="text-xs text-muted-foreground truncate">{v.name} <span className="text-emerald-600">· {fmtDate(v.start_date)}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5 shadow-soft space-y-3">
          <h3 className="font-medium text-sm flex items-center gap-2"><UserX className="h-4 w-4 text-amber-500" /> Departures this week</h3>
          {stats.upcomingDepartures.length === 0 ? (
            <p className="text-sm text-muted-foreground">No departures this week.</p>
          ) : (
            <ul className="divide-y">
              {stats.upcomingDepartures.map((v) => (
                <li key={v.name} className="py-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{v.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700">{fmtDate(v.end_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-soft space-y-3">
          <h3 className="font-medium text-sm flex items-center gap-2"><UserPlus className="h-4 w-4 text-emerald-500" /> Arrivals this week</h3>
          {stats.upcomingArrivals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No arrivals this week.</p>
          ) : (
            <ul className="divide-y">
              {stats.upcomingArrivals.map((v) => (
                <li key={v.name} className="py-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{v.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">{fmtDate(v.start_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Active volunteers dialog — with deactivate */}
      <Dialog open={showVolunteers} onOpenChange={setShowVolunteers}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Active volunteers</DialogTitle>
            <DialogDescription>Tap × to remove someone no longer on the rota.</DialogDescription>
          </DialogHeader>
          {loadingVols ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : volOnProperty.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active volunteers.</p>
          ) : (
            <ul className="divide-y max-h-80 overflow-y-auto">
              {volOnProperty.map((v) => (
                <li key={v.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{v.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.role_type}{v.start_date ? ` · ${fmtDate(v.start_date)} → ${v.end_date ? fmtDate(v.end_date) : ""}` : ""}
                    </p>
                  </div>
                  {v.whatsapp_number && (
                    <a href={`https://wa.me/${v.whatsapp_number.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="shrink-0">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                  <Button
                    size="sm" variant="ghost"
                    className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={deactivating === v.id}
                    onClick={() => deactivateVol(v.id)}
                    title="Remove from active roster"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="pt-2 border-t">
            <Link to="/app/admin" className="text-sm text-accent hover:underline inline-flex items-center gap-1" onClick={() => setShowVolunteers(false)}>
              <Plus className="h-3.5 w-3.5" /> Add volunteer
            </Link>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function Dashboard() {
  const { user, profile } = useAuth();
  const { t, lang } = useI18n();
  const locale = LOCALE_MAP[lang] ?? "en-GB";

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="font-display text-4xl font-semibold mt-1">
          {t("dash.hi")}, {profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || t("dash.friend")} 👋
        </h1>
      </header>

      <Tabs defaultValue="today" className="space-y-4">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-6">
          <AdminTodayView />
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <OverviewSection />
          <AdminMatrix />
        </TabsContent>
      </Tabs>
    </div>
  );
}

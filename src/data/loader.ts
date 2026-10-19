import { AVATAR_BUCKET, supabase } from "@/lib/supabase";
import type {
  AppNotification,
  AppState,
  Application,
  Attendance,
  Availability,
  DayAvailability,
  Draw,
  DrawSlot,
  NotifPrefs,
  Opportunity,
  Period,
  Session,
  Staff,
  Substitution,
  Volunteer,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

/** Lê uma tabela inteira em páginas (o Supabase devolve no máximo 1000 linhas por vez). */
async function fetchAll(table: string, select = "*", order?: string): Promise<Row[]> {
  const out: Row[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    let q = supabase.from(table).select(select).range(from, from + size - 1);
    if (order) q = q.order(order);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < size) break;
  }
  return out;
}

const empty = (): AppState => ({
  volunteers: [],
  periods: [],
  availabilities: [],
  draws: [],
  attendance: [],
  substitutions: [],
  session: null,
  settings: { churchName: "", ministryName: "", visibilityPolicy: "privado" },
  opportunities: [],
  dayAvailability: [],
  applications: [],
  notifications: [],
  supervisors: [],
  notifPrefs: {},
  oppCounts: {},
});

export async function loadState(): Promise<AppState> {
  const { data: auth } = await supabase.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) return empty();

  const { data: meRow, error: meErr } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (meErr) throw meErr;
  // Sem perfil visível = conta inexistente ou desativada.
  if (!meRow || meRow.status !== "ativo") {
    await supabase.auth.signOut();
    return empty();
  }

  const session: Session = { role: meRow.role, userId: uid, name: meRow.name, mustChangePassword: meRow.must_change_password };

  const [profiles, details, settings, periods, needs, avail, draws, slots, picks, att, subs, opps, dayAv, apps, notifs, prefs, counts, oppCounts] =
    await Promise.all([
      fetchAll("profiles"),
      fetchAll("volunteer_details"),
      supabase.from("app_settings").select("*").maybeSingle(),
      fetchAll("periods"),
      fetchAll("needs"),
      fetchAll("availabilities"),
      fetchAll("draws"),
      fetchAll("draw_slots"),
      fetchAll("draw_picks"),
      fetchAll("attendance"),
      fetchAll("substitutions"),
      fetchAll("opportunities"),
      fetchAll("day_availability"),
      fetchAll("applications"),
      supabase.from("notifications").select("*").eq("recipient_id", uid).order("created_at", { ascending: false }).limit(300),
      fetchAll("notif_prefs"),
      supabase.rpc("scale_counts"),
      supabase.rpc("opportunity_counts"),
    ]);

  // Fotos ficam em bucket privado: geramos links temporários (1h) só das que o usuário pode ver.
  const paths = profiles.map((p) => p.photo_path).filter(Boolean) as string[];
  const photoUrl = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrls(paths, 3600);
    data?.forEach((d) => d.path && d.signedUrl && photoUrl.set(d.path, d.signedUrl));
  }

  const detailById = new Map(details.map((d) => [d.id, d]));
  const countById = new Map(((counts.data ?? []) as Row[]).map((c) => [c.volunteer_id, c]));

  const volunteers: Volunteer[] = profiles
    .filter((p) => p.role === "voluntario" || p.role === "responsavel")
    .map((p) => {
      const d = detailById.get(p.id);
      const c = countById.get(p.id);
      return {
        id: p.id,
        name: p.name,
        cpf: d?.cpf ?? "",
        phone: d?.phone ?? "",
        email: d?.email ?? "",
        birthDate: d?.birth_date ?? "",
        photoPath: p.photo_path ?? undefined,
        photoUrl: p.photo_path ? photoUrl.get(p.photo_path) : undefined,
        status: p.status,
        role: p.role,
        recent3m: c?.recent3m ?? 0,
        last12m: c?.last12m ?? 0,
        lastScaleDate: c?.last_date ?? undefined,
        mustChangePassword: p.must_change_password,
        joinedAt: d?.joined_at ?? p.created_at?.slice(0, 10) ?? "",
      };
    });

  const supervisors: Staff[] = profiles
    .filter((p) => p.role === "admin" || p.role === "supervisor")
    .map((p) => ({
      id: p.id,
      name: p.name,
      username: p.username ?? "",
      cpf: detailById.get(p.id)?.cpf ?? "",
      role: p.role,
      status: p.status,
      photoUrl: p.photo_path ? photoUrl.get(p.photo_path) : undefined,
      photoPath: p.photo_path ?? undefined,
      mustChangePassword: p.must_change_password,
    }));

  const periodList: Period[] = periods.map((p) => ({
    id: p.id,
    month: p.month,
    year: p.year,
    openDate: p.open_date,
    deadline: p.deadline,
    status: p.status,
    needs: needs
      .filter((n) => n.period_id === p.id)
      .map((n) => ({ id: n.id, date: n.date, start: n.start_time, end: n.end_time, slots: n.slots, responsavelId: n.responsavel_id ?? undefined })),
  }));

  const drawList: Draw[] = draws.map((d) => ({
    id: d.id,
    periodId: d.period_id,
    number: d.number,
    createdAt: d.created_at,
    createdBy: d.created_by,
    status: d.status,
    slots: slots
      .filter((s) => s.draw_id === d.id)
      .map(
        (s): DrawSlot => ({
          needId: s.need_id,
          eligible: s.eligible,
          picks: picks
            .filter((pk) => pk.draw_id === d.id && pk.need_id === s.need_id)
            .sort((a, b) => a.priority - b.priority)
            .map((pk) => ({ volunteerId: pk.volunteer_id, recent3m: pk.recent3m, last12m: pk.last12m, priority: pk.priority, tiebreak: pk.tiebreak })),
        }),
      ),
  }));

  const prefMap: Record<string, NotifPrefs> = {};
  prefs.forEach((p) => {
    prefMap[p.user_id] = { ...prefMap[p.user_id], [p.type]: p.enabled };
  });

  return {
    session,
    settings: {
      churchName: settings.data?.church_name ?? "",
      ministryName: settings.data?.ministry_name ?? "",
      visibilityPolicy: settings.data?.visibility_policy ?? "privado",
    },
    volunteers,
    supervisors,
    periods: periodList,
    availabilities: avail.map((a): Availability => ({ periodId: a.period_id, volunteerId: a.volunteer_id, needId: a.need_id, value: a.value, updatedAt: a.updated_at })),
    draws: drawList,
    attendance: att.map((a): Attendance => ({ id: a.id, periodId: a.period_id, needId: a.need_id, volunteerId: a.volunteer_id, status: a.status, recordedAt: a.recorded_at, supervisor: a.recorded_by })),
    substitutions: subs.map((s): Substitution => ({ id: s.id, periodId: s.period_id, needId: s.need_id, outId: s.out_id, inId: s.in_id, at: s.at, supervisor: s.recorded_by, reason: s.reason })),
    opportunities: opps.map((o): Opportunity => ({
      id: o.id,
      date: o.date,
      start: o.start_time,
      end: o.end_time,
      min: o.min,
      max: o.max,
      note: o.note ?? undefined,
      status: o.status,
      createdAt: o.created_at,
      responsavelId: o.responsavel_id ?? undefined,
    })),
    dayAvailability: dayAv.map((d): DayAvailability => ({ volunteerId: d.volunteer_id, date: d.date })),
    applications: apps.map((a): Application => ({ id: a.id, opportunityId: a.opportunity_id, volunteerId: a.volunteer_id, status: a.status, updatedAt: a.updated_at })),
    notifications: ((notifs.data ?? []) as Row[]).map((n): AppNotification => ({
      id: n.id,
      type: n.type,
      recipientId: n.recipient_id,
      key: n.key ?? undefined,
      opportunityId: n.opportunity_id ?? undefined,
      message: n.message,
      createdAt: n.created_at,
      read: n.read,
    })),
    notifPrefs: prefMap,
    oppCounts: Object.fromEntries(((oppCounts.data ?? []) as Row[]).map((c) => [c.opportunity_id, c.active])),
  };
}

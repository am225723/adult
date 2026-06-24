import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export type SearchCategory =
  | "all"
  | "tasks"
  | "emails"
  | "contacts"
  | "messages"
  | "calls"
  | "voicemails";

export type QuickFilter =
  | "unread"
  | "overdue"
  | "high_priority"
  | "missed_calls"
  | "has_voicemail"
  | "today"
  | "this_week";

export interface SearchResult {
  type: "task" | "email" | "contact" | "message" | "call" | "voicemail";
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  navigateTo: string;
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function weekRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

async function searchTasks(
  q: string,
  quickFilters: QuickFilter[]
): Promise<SearchResult[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let query = supabase
    .from("admin_tasks")
    .select("id, title, notes, tags, due_date, priority, status")
    .is("parent_task_id", null)
    .neq("status", "done")
    .neq("status", "cancelled")
    .limit(8);

  if (q) {
    query = query.textSearch("search_vector", q, { type: "websearch", config: "english" });
  }

  if (quickFilters.includes("overdue")) {
    query = query.eq("status", "open").lt("due_date", today.toISOString());
  } else if (quickFilters.includes("today")) {
    const { start, end } = todayRange();
    query = query.eq("status", "open").gte("due_date", start).lt("due_date", end);
  } else if (quickFilters.includes("this_week")) {
    const { start, end } = weekRange();
    query = query.eq("status", "open").gte("due_date", start).lt("due_date", end);
  }

  if (quickFilters.includes("high_priority")) {
    query = query.eq("priority", "high");
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((t) => ({
    type: "task" as const,
    id: t.id,
    title: t.title,
    subtitle: t.notes?.slice(0, 80) ?? undefined,
    meta: t.due_date ? `Due ${formatDate(t.due_date)}` : undefined,
    badge: t.priority !== "none" ? t.priority ?? undefined : undefined,
    navigateTo: "/tasks",
  }));
}

async function searchEmails(
  q: string,
  quickFilters: QuickFilter[]
): Promise<SearchResult[]> {
  let query = supabase
    .from("admin_emails")
    .select("id, subject, snippet, from_address, received_at, is_read")
    .limit(8);

  if (q) {
    query = query.textSearch("search_vector", q, { type: "websearch", config: "english" });
  }

  if (quickFilters.includes("unread")) query = query.eq("is_read", false);
  if (quickFilters.includes("today")) {
    const { start, end } = todayRange();
    query = query.gte("received_at", start).lt("received_at", end);
  } else if (quickFilters.includes("this_week")) {
    const { start, end } = weekRange();
    query = query.gte("received_at", start).lt("received_at", end);
  }

  query = query.order("received_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((e) => ({
    type: "email" as const,
    id: e.id,
    title: e.subject ?? "(no subject)",
    subtitle: e.from_address ?? undefined,
    meta: e.received_at ? formatDate(e.received_at) : undefined,
    badge: e.is_read === false ? "Unread" : undefined,
    navigateTo: "/mail",
  }));
}

async function searchContacts(q: string): Promise<SearchResult[]> {
  let query = supabase
    .from("admin_contacts")
    .select("id, display_name, primary_email, primary_phone, company")
    .eq("is_deleted", false)
    .limit(8);

  if (q) {
    query = query.textSearch("search_vector", q, { type: "websearch", config: "english" });
  }

  query = query.order("display_name");

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((c) => ({
    type: "contact" as const,
    id: c.id,
    title: c.display_name,
    subtitle: c.company ?? c.primary_email ?? undefined,
    meta: c.primary_phone ?? undefined,
    navigateTo: `/contacts/${c.id}`,
  }));
}

async function searchMessages(
  q: string,
  quickFilters: QuickFilter[]
): Promise<SearchResult[]> {
  let query = supabase
    .from("admin_phone_messages")
    .select("id, body, direction, occurred_at, is_read, contact_id")
    .limit(8);

  if (q) {
    query = query.textSearch("search_vector", q, { type: "websearch", config: "english" });
  }

  if (quickFilters.includes("unread")) query = query.eq("is_read", false);
  if (quickFilters.includes("today")) {
    const { start, end } = todayRange();
    query = query.gte("occurred_at", start).lt("occurred_at", end);
  } else if (quickFilters.includes("this_week")) {
    const { start, end } = weekRange();
    query = query.gte("occurred_at", start).lt("occurred_at", end);
  }

  query = query.order("occurred_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((m) => ({
    type: "message" as const,
    id: m.id,
    title: m.body?.slice(0, 60) ?? "(empty)",
    subtitle: m.direction === "incoming" ? "Received" : "Sent",
    meta: m.occurred_at ? formatDate(m.occurred_at) : undefined,
    badge: m.is_read === false ? "Unread" : undefined,
    navigateTo: "/chat",
  }));
}

async function searchCalls(
  q: string,
  quickFilters: QuickFilter[]
): Promise<SearchResult[]> {
  // Non-voicemail calls have no searchable text; a text query cannot match anything.
  if (q) return [];

  let query = supabase
    .from("admin_phone_calls")
    .select(
      "id, direction, status, occurred_at, duration_seconds, voicemail_transcript"
    )
    .is("voicemail_transcript", null)
    .limit(8);

  if (quickFilters.includes("missed_calls")) {
    query = query.in("status", ["missed", "no-answer", "abandoned"]);
  }
  if (quickFilters.includes("today")) {
    const { start, end } = todayRange();
    query = query.gte("occurred_at", start).lt("occurred_at", end);
  } else if (quickFilters.includes("this_week")) {
    const { start, end } = weekRange();
    query = query.gte("occurred_at", start).lt("occurred_at", end);
  }

  query = query.order("occurred_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((c) => ({
    type: "call" as const,
    id: c.id,
    title: c.direction === "incoming" ? "Incoming call" : "Outgoing call",
    subtitle: c.status ?? undefined,
    meta: c.occurred_at ? formatDate(c.occurred_at) : undefined,
    badge:
      c.status === "missed" || c.status === "no-answer" ? "Missed" : undefined,
    navigateTo: "/phone",
  }));
}

async function searchVoicemails(
  q: string,
  quickFilters: QuickFilter[]
): Promise<SearchResult[]> {
  let query = supabase
    .from("admin_phone_calls")
    .select("id, direction, occurred_at, voicemail_transcript")
    .not("voicemail_transcript", "is", null)
    .limit(8);

  if (q) {
    query = query.textSearch("search_vector", q, { type: "websearch", config: "english" });
  }

  if (quickFilters.includes("has_voicemail")) {
    // already filtered above
  }
  if (quickFilters.includes("today")) {
    const { start, end } = todayRange();
    query = query.gte("occurred_at", start).lt("occurred_at", end);
  } else if (quickFilters.includes("this_week")) {
    const { start, end } = weekRange();
    query = query.gte("occurred_at", start).lt("occurred_at", end);
  }

  query = query.order("occurred_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((c) => ({
    type: "voicemail" as const,
    id: c.id,
    title: "Voicemail",
    subtitle: c.voicemail_transcript?.slice(0, 80) ?? undefined,
    meta: c.occurred_at ? formatDate(c.occurred_at) : undefined,
    navigateTo: "/phone",
  }));
}

export interface GlobalSearchResults {
  tasks: SearchResult[];
  emails: SearchResult[];
  contacts: SearchResult[];
  messages: SearchResult[];
  calls: SearchResult[];
  voicemails: SearchResult[];
  all: SearchResult[];
  total: number;
}

export function useGlobalSearch(
  query: string,
  category: SearchCategory,
  quickFilters: QuickFilter[]
) {
  const { user } = useAuth();

  return useQuery<GlobalSearchResults>({
    queryKey: ["global-search", user?.id, query, category, quickFilters],
    queryFn: async () => {
      const q = query.trim();
      const qf = quickFilters;

      // Use ranked cross-type RPC for "all" text searches with no quick filters
      if (category === "all" && q && qf.length === 0) {
        const { data, error } = await supabase.rpc("search_workspace", {
          p_query: q,
          p_limit: 8,
        });
        if (error) throw error;

        const NAVIGATE: Record<string, string> = {
          task: "/tasks",
          email: "/mail",
          message: "/chat",
          voicemail: "/phone",
        };

        const all: SearchResult[] = (data ?? []).map(
          (r: { result_type: string; result_id: string; title: string; subtitle: string | null; rank: number }) => ({
            type: r.result_type as SearchResult["type"],
            id: r.result_id,
            title: r.title ?? "",
            subtitle: r.subtitle ?? undefined,
            navigateTo: r.result_type === "contact"
              ? `/contacts/${r.result_id}`
              : NAVIGATE[r.result_type] ?? "/",
          })
        );

        const byType = (t: string) => all.filter((r) => r.type === t);
        return {
          tasks: byType("task"),
          emails: byType("email"),
          contacts: byType("contact"),
          messages: byType("message"),
          calls: byType("call"),
          voicemails: byType("voicemail"),
          all,
          total: all.length,
        };
      }

      const runTask = category === "all" || category === "tasks";
      const runEmail = category === "all" || category === "emails";
      const runContact = category === "all" || category === "contacts";
      const runMessage = category === "all" || category === "messages";
      const runCall = category === "all" || category === "calls";
      const runVoicemail = category === "all" || category === "voicemails";

      // Quick-filter-only shortcuts
      const onlyVoicemails = qf.includes("has_voicemail") && category === "all";
      const onlyMissed = qf.includes("missed_calls") && category === "all";

      const [tasks, emails, contacts, messages, calls, voicemails] =
        await Promise.all([
          runTask && !onlyVoicemails && !onlyMissed ? searchTasks(q, qf) : Promise.resolve([]),
          runEmail && !onlyVoicemails && !onlyMissed ? searchEmails(q, qf) : Promise.resolve([]),
          runContact && !onlyVoicemails && !onlyMissed ? searchContacts(q) : Promise.resolve([]),
          runMessage && !onlyVoicemails && !onlyMissed ? searchMessages(q, qf) : Promise.resolve([]),
          runCall && !onlyVoicemails ? searchCalls(q, qf) : Promise.resolve([]),
          runVoicemail && !onlyMissed ? searchVoicemails(q, qf) : Promise.resolve([]),
        ]);

      const all = [
        ...tasks,
        ...emails,
        ...contacts,
        ...messages,
        ...calls,
        ...voicemails,
      ];

      return {
        tasks,
        emails,
        contacts,
        messages,
        calls,
        voicemails,
        all,
        total: all.length,
      };
    },
    enabled: !!user && (query.trim().length > 0 || quickFilters.length > 0),
    staleTime: 0,
  });
}

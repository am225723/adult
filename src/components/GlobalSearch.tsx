import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  CheckSquare,
  Mail,
  Users,
  MessageSquare,
  Phone,
  Voicemail,
  Bookmark,
  Trash2,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useGlobalSearch,
  type SearchCategory,
  type QuickFilter,
  type SearchResult,
} from "@/hooks/useGlobalSearch";
import {
  useSavedSearches,
  useCreateSavedSearch,
  useDeleteSavedSearch,
} from "@/hooks/useSavedSearches";

/* ---------- types ---------- */

interface Props {
  open: boolean;
  onClose: () => void;
}

/* ---------- constants ---------- */

const CATEGORIES: { value: SearchCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "tasks", label: "Tasks" },
  { value: "emails", label: "Emails" },
  { value: "contacts", label: "Contacts" },
  { value: "messages", label: "Messages" },
  { value: "calls", label: "Calls" },
  { value: "voicemails", label: "Voicemails" },
];

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: "unread", label: "Unread" },
  { value: "overdue", label: "Overdue" },
  { value: "high_priority", label: "High priority" },
  { value: "missed_calls", label: "Missed calls" },
  { value: "has_voicemail", label: "Has voicemail" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
];

const TYPE_ICONS: Record<SearchResult["type"], React.ElementType> = {
  task: CheckSquare,
  email: Mail,
  contact: Users,
  message: MessageSquare,
  call: Phone,
  voicemail: Voicemail,
};

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  task: "Tasks",
  email: "Emails",
  contact: "Contacts",
  message: "Messages",
  call: "Calls",
  voicemail: "Voicemails",
};

const BADGE_COLORS: Record<string, string> = {
  Unread: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Missed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  medium:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  low: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

/* ---------- sub-components ---------- */

function ResultRow({
  result,
  onNavigate,
}: {
  result: SearchResult;
  onNavigate: (to: string) => void;
}) {
  const Icon = TYPE_ICONS[result.type];
  return (
    <button
      onClick={() => onNavigate(result.navigateTo)}
      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left group"
    >
      <span className="mt-0.5 shrink-0 text-muted-foreground">
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium truncate">{result.title}</span>
        {result.subtitle && (
          <span className="block text-xs text-muted-foreground truncate mt-0.5">
            {result.subtitle}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2 shrink-0 mt-0.5">
        {result.badge && (
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded",
              BADGE_COLORS[result.badge] ??
                "bg-muted text-muted-foreground"
            )}
          >
            {result.badge}
          </span>
        )}
        {result.meta && (
          <span className="text-xs text-muted-foreground">{result.meta}</span>
        )}
        <ArrowRight
          size={13}
          className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </span>
    </button>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 mt-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-[11px] text-muted-foreground">{count}</span>
    </div>
  );
}

/* ---------- main component ---------- */

export function GlobalSearch({ open, onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const [quickFilters, setQuickFilters] = useState<QuickFilter[]>([]);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const { data: results, isLoading, error } = useGlobalSearch(
    debouncedQuery,
    category,
    quickFilters
  );
  const { data: savedSearches } = useSavedSearches();
  const createSaved = useCreateSavedSearch();
  const deleteSaved = useDeleteSavedSearch();

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // Focus on open and manage aria-hidden
  useEffect(() => {
    if (open) {
      // Move focus to search input
      setTimeout(() => inputRef.current?.focus(), 50);
      // Hide rest of page from assistive tech
      const root = document.getElementById("root");
      if (root) {
        const backdrop = root.querySelector('[role="dialog"]')?.parentElement;
        if (backdrop) {
          // Mark the rest of the page as hidden
          const siblings = Array.from(root.children).filter(child => child !== backdrop);
          siblings.forEach(sibling => {
            (sibling as HTMLElement).inert = true;
          });
        }
      }
    } else {
      // Restore visibility
      const root = document.getElementById("root");
      if (root) {
        const siblings = Array.from(root.children);
        siblings.forEach(sibling => {
          (sibling as HTMLElement).inert = false;
        });
      }
      setRawQuery("");
      setDebouncedQuery("");
      setCategory("all");
      setQuickFilters([]);
      setShowSaveInput(false);
      setSaveName("");
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleNavigate = useCallback(
    (to: string) => {
      navigate(to);
      onClose();
    },
    [navigate, onClose]
  );

  const toggleQuickFilter = (f: QuickFilter) => {
    setQuickFilters((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  const applySearch = useCallback(
    (s: { query: string; category: SearchCategory; filters: QuickFilter[] }) => {
      setRawQuery(s.query);
      setDebouncedQuery(s.query);
      setCategory(s.category);
      setQuickFilters(s.filters);
    },
    []
  );

  const handleSave = () => {
    if (!saveName.trim()) return;
    createSaved.mutate(
      {
        name: saveName.trim(),
        query: debouncedQuery,
        category,
        filters: quickFilters,
      },
      {
        onSuccess: () => {
          setSaveName("");
          setShowSaveInput(false);
        },
      }
    );
  };

  const isActive =
    debouncedQuery.trim().length > 0 || quickFilters.length > 0;
  const showEmpty = isActive && !isLoading && !error && results?.total === 0;
  const showSaved =
    !isActive && savedSearches && savedSearches.length > 0;

  // Group results by type for "all" view
  const grouped: [string, SearchResult[]][] = results
    ? ([
        ["tasks", results.tasks],
        ["emails", results.emails],
        ["contacts", results.contacts],
        ["messages", results.messages],
        ["calls", results.calls],
        ["voicemails", results.voicemails],
      ] as [SearchResult["type"], SearchResult[]][]).filter(
        ([, arr]) => arr.length > 0
      )
    : [];

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="w-full max-w-xl bg-background border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const focusable = e.currentTarget.querySelectorAll<HTMLElement>(
              'input, button, [href], [tabindex]:not([tabindex="-1"])'
            );
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search everything..."
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {isLoading && (
            <Loader2
              size={15}
              className="text-muted-foreground shrink-0 animate-spin"
            />
          )}
          {rawQuery && (
            <button
              onClick={() => setRawQuery("")}
              aria-label="Clear search query"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={15} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors ml-1 text-xs border border-border rounded px-1.5 py-0.5"
          >
            Esc
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto shrink-0 scrollbar-none">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors",
                category === c.value
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Quick filter chips */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border overflow-x-auto shrink-0 scrollbar-none">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => toggleQuickFilter(f.value)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full whitespace-nowrap border transition-colors",
                quickFilters.includes(f.value)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-destructive">
              <AlertCircle size={15} />
              Search failed. Please try again.
            </div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results for &ldquo;{debouncedQuery}&rdquo;
            </div>
          )}

          {/* Idle state — saved searches */}
          {!isActive && !showSaved && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Type to search tasks, emails, contacts, messages, and calls.
            </div>
          )}

          {showSaved && (
            <div>
              <SectionHeader label="Saved searches" count={savedSearches!.length} />
              {savedSearches!.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-accent group"
                >
                  <Bookmark
                    size={13}
                    className="text-muted-foreground shrink-0"
                  />
                  <button
                    className="flex-1 text-sm text-left"
                    onClick={() => applySearch(s)}
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={() => deleteSaved.mutate(s.id)}
                    aria-label={`Delete saved search ${s.name}`}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Results for "all" category — grouped */}
          {isActive && !isLoading && category === "all" && grouped.length > 0 && (
            <div>
              {grouped.map(([type, items]) => (
                <div key={type}>
                  <SectionHeader
                    label={TYPE_LABELS[type as SearchResult["type"]]}
                    count={items.length}
                  />
                  {items.map((r) => (
                    <ResultRow key={r.id} result={r} onNavigate={handleNavigate} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Results for specific category — flat list */}
          {isActive &&
            !isLoading &&
            category !== "all" &&
            results &&
            results[category].length > 0 && (
              <div>
                {results[category].map((r) => (
                  <ResultRow key={r.id} result={r} onNavigate={handleNavigate} />
                ))}
              </div>
            )}
        </div>

        {/* Footer: save search */}
        {isActive && !error && (
          <div className="border-t border-border px-4 py-2.5 shrink-0">
            {showSaveInput ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Name this search..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowSaveInput(false);
                    }
                  }}
                  className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={handleSave}
                  disabled={!saveName.trim() || createSaved.isPending}
                  className="text-xs text-primary font-medium disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSaveInput(false)}
                  className="text-xs text-muted-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Bookmark size={12} />
                Save this search
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

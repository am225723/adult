import { useState, useRef } from "react";
import { Plus, Search, Trash2, User, Mail, Phone, Building, StickyNote, ExternalLink, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useBulkImportContacts,
  type Contact,
} from "@/hooks/useContacts";
import { toast } from "@/hooks/useToast";

type ContactFormData = {
  display_name: string;
  primary_email: string;
  primary_phone: string;
  company: string;
  notes: string;
};

function ContactForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Partial<Contact>;
  onSave: (data: ContactFormData) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<ContactFormData>({
    display_name: initial?.display_name ?? "",
    primary_email: initial?.primary_email ?? "",
    primary_phone: initial?.primary_phone ?? "",
    company: initial?.company ?? "",
    notes: initial?.notes ?? "",
  });

  const set = (key: keyof ContactFormData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Name *</label>
        <Input
          value={form.display_name}
          onChange={(e) => set("display_name", e.target.value)}
          placeholder="Full name"
          className="mt-1"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Email</label>
        <Input
          value={form.primary_email}
          onChange={(e) => set("primary_email", e.target.value)}
          placeholder="email@example.com"
          type="email"
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Phone</label>
        <Input
          value={form.primary_phone}
          onChange={(e) => set("primary_phone", e.target.value)}
          placeholder="+1 555 000 0000"
          type="tel"
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Company</label>
        <Input
          value={form.company}
          onChange={(e) => set("company", e.target.value)}
          placeholder="Company name"
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Any notes…"
          rows={3}
          className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1"
          disabled={loading || !form.display_name.trim()}
          onClick={() => form.display_name.trim() && onSave(form)}
        >
          {loading ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const text = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold shrink-0",
        size === "sm" ? "h-8 w-8 text-xs" : "h-14 w-14 text-xl",
      )}
    >
      {text}
    </div>
  );
}

function ImportDialog({
  onClose,
  onImport,
  importing,
}: {
  onClose: () => void;
  onImport: (contacts: Array<{
    display_name: string;
    primary_email?: string | null;
    primary_phone?: string | null;
    company?: string | null;
    notes?: string | null;
  }>) => Promise<void>;
  importing: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Array<{
    display_name: string;
    primary_email?: string | null;
    primary_phone?: string | null;
    company?: string | null;
    notes?: string | null;
  }> | null>(null);

  function parseCSV(text: string) {
    const lines = text.trim().split("\n");
    if (lines.length < 2) { toast({ variant: "destructive", title: "CSV must have headers and at least one row" }); return; }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const contacts = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      return {
        display_name: values[headers.indexOf("name")] || values[headers.indexOf("display_name")] || "",
        primary_email: values[headers.indexOf("email")] || values[headers.indexOf("primary_email")] || null,
        primary_phone: values[headers.indexOf("phone")] || values[headers.indexOf("primary_phone")] || null,
        company: values[headers.indexOf("company")] || null,
        notes: values[headers.indexOf("notes")] || null,
      };
    }).filter((c) => c.display_name.trim());

    if (contacts.length === 0) { toast({ variant: "destructive", title: "No valid contacts found" }); return; }
    setPreview(contacts);
  }

  function handleFileSelect(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!preview || preview.length === 0) return;
    try {
      await onImport(preview);
      toast({ title: `Imported ${preview.length} contacts` });
      onClose();
    } catch (err) {
      toast({ variant: "destructive", title: "Import failed", description: String(err) });
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Import Contacts</h2>
          <button onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted">
            <X size={14} />
          </button>
        </div>

        {!preview ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Upload a CSV file with columns: Name, Email, Phone, Company, Notes</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
            >
              <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Click to select CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-3 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-foreground mb-2">{preview.length} contacts to import:</p>
              <div className="space-y-1">
                {preview.slice(0, 5).map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground truncate">{c.display_name}</p>
                ))}
                {preview.length > 5 && (
                  <p className="text-xs text-muted-foreground">+{preview.length - 5} more</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={handleImport} disabled={importing}>
                {importing ? "Importing…" : `Import ${preview.length}`}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreview(null)} disabled={importing}>
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ContactsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const { data: contacts = [], isLoading } = useContacts(search);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const bulkImport = useBulkImportContacts();

  async function handleCreate(form: ContactFormData) {
    try {
      const c = await createContact.mutateAsync({
        display_name: form.display_name,
        primary_email: form.primary_email || null,
        primary_phone: form.primary_phone || null,
        company: form.company || null,
        notes: form.notes || null,
      });
      setShowAdd(false);
      setSelected(c);
      toast({ title: "Contact added" });
    } catch {
      toast({ variant: "destructive", title: "Failed to add contact" });
    }
  }

  async function handleUpdate(form: ContactFormData) {
    if (!selected) return;
    try {
      const c = await updateContact.mutateAsync({
        id: selected.id,
        display_name: form.display_name,
        primary_email: form.primary_email || null,
        primary_phone: form.primary_phone || null,
        company: form.company || null,
        notes: form.notes || null,
      });
      setEditing(false);
      setSelected(c);
      toast({ title: "Contact updated" });
    } catch {
      toast({ variant: "destructive", title: "Failed to update contact" });
    }
  }

  async function handleDelete() {
    if (!selected || deleteContact.isPending) return;
    try {
      await deleteContact.mutateAsync(selected.id);
      setSelected(null);
      toast({ title: "Contact deleted" });
    } catch {
      toast({ variant: "destructive", title: "Failed to delete contact" });
    }
  }

  function selectContact(c: Contact) {
    setSelected(c);
    setShowAdd(false);
    setEditing(false);
  }

  return (
    <div className="flex h-full">
      {/* Left: contact list */}
      <div className="w-72 border-r border-border flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-border/50 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold font-display text-primary">Contacts</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage your network</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setShowImport(true)}
              title="Import contacts"
            >
              <Upload size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setShowAdd(true);
                setEditing(false);
                setSelected(null);
              }}
              title="New contact"
            >
              <Plus size={14} />
            </Button>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-7 h-8 text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
          ) : contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              {search ? "No contacts found." : "No contacts yet."}
            </p>
          ) : (
            contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => selectContact(c)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border hover:bg-muted/50 transition-colors",
                  selected?.id === c.id && !showAdd && "bg-muted",
                )}
              >
                <Avatar name={c.display_name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.company ?? c.primary_email ?? c.primary_phone ?? "No details"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: detail / form */}
      <div className="flex-1 overflow-auto">
        {showAdd ? (
          <div className="max-w-md mx-auto px-6 py-8 space-y-5">
            <h2 className="text-base font-semibold text-foreground">New Contact</h2>
            <ContactForm
              onSave={handleCreate}
              onCancel={() => setShowAdd(false)}
              loading={createContact.isPending}
            />
          </div>
        ) : selected ? (
          editing ? (
            <div className="max-w-md mx-auto px-6 py-8 space-y-5">
              <h2 className="text-base font-semibold text-foreground">Edit Contact</h2>
              <ContactForm
                initial={selected}
                onSave={handleUpdate}
                onCancel={() => setEditing(false)}
                loading={updateContact.isPending}
              />
            </div>
          ) : (
            <div className="max-w-md mx-auto px-6 py-8 space-y-6">
              {/* Contact header */}
              <div className="flex items-center gap-4">
                <Avatar name={selected.display_name} size="lg" />
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-semibold text-foreground truncate">
                    {selected.display_name}
                  </h1>
                  {selected.company && (
                    <p className="text-sm text-muted-foreground">{selected.company}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Link to={`/contacts/${selected.id}`}>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="View full profile">
                      <ExternalLink size={14} />
                    </Button>
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={handleDelete}
                    disabled={deleteContact.isPending}
                    title="Delete contact"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              {/* Details */}
              {(selected.primary_email || selected.primary_phone || selected.company || selected.notes) ? (
                <div className="rounded-xl border border-border bg-card divide-y divide-border">
                  {selected.primary_email && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Mail size={14} className="text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <a
                          href={`mailto:${selected.primary_email}`}
                          className="text-sm text-foreground hover:text-primary truncate block"
                        >
                          {selected.primary_email}
                        </a>
                      </div>
                    </div>
                  )}
                  {selected.primary_phone && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Phone size={14} className="text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <a
                          href={`tel:${selected.primary_phone}`}
                          className="text-sm text-foreground hover:text-primary"
                        >
                          {selected.primary_phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {selected.company && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Building size={14} className="text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Company</p>
                        <p className="text-sm text-foreground">{selected.company}</p>
                      </div>
                    </div>
                  )}
                  {selected.notes && (
                    <div className="flex items-start gap-3 px-4 py-3">
                      <StickyNote size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Notes</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {selected.notes}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">No details added yet.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => setEditing(true)}
                  >
                    Add details
                  </Button>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <User size={32} strokeWidth={1.25} />
            <p className="text-sm">Select a contact or add a new one.</p>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus size={14} className="mr-1.5" />
              New Contact
            </Button>
          </div>
        )}
      </div>

      {/* Import dialog */}
      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onImport={bulkImport.mutateAsync}
          importing={bulkImport.isPending}
        />
      )}
    </div>
  );
}

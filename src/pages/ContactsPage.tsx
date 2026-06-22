import { useState } from "react";
import { Plus, Search, Trash2, User, Mail, Phone, Building, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  type Contact,
} from "@/hooks/useContacts";
import { toast } from "@/hooks/useToast";

type ContactFormData = {
  full_name: string;
  email: string;
  phone: string;
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
    full_name: initial?.full_name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
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
          value={form.full_name}
          onChange={(e) => set("full_name", e.target.value)}
          placeholder="Full name"
          className="mt-1"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Email</label>
        <Input
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="email@example.com"
          type="email"
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Phone</label>
        <Input
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
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
          disabled={loading || !form.full_name.trim()}
          onClick={() => form.full_name.trim() && onSave(form)}
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

export function ContactsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data: contacts = [], isLoading } = useContacts(search);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  async function handleCreate(form: ContactFormData) {
    try {
      const c = await createContact.mutateAsync({
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
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
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
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
    <div className="flex h-screen">
      {/* Left: contact list */}
      <div className="w-72 border-r border-border flex flex-col shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-foreground">Contacts</span>
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
                <Avatar name={c.full_name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.company ?? c.email ?? c.phone ?? "No details"}
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
                <Avatar name={selected.full_name} size="lg" />
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-semibold text-foreground truncate">
                    {selected.full_name}
                  </h1>
                  {selected.company && (
                    <p className="text-sm text-muted-foreground">{selected.company}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
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
              {(selected.email || selected.phone || selected.company || selected.notes) ? (
                <div className="rounded-xl border border-border bg-card divide-y divide-border">
                  {selected.email && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Mail size={14} className="text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <a
                          href={`mailto:${selected.email}`}
                          className="text-sm text-foreground hover:text-primary truncate block"
                        >
                          {selected.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {selected.phone && (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Phone size={14} className="text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <a
                          href={`tel:${selected.phone}`}
                          className="text-sm text-foreground hover:text-primary"
                        >
                          {selected.phone}
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
    </div>
  );
}

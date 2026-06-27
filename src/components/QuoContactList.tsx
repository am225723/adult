import { useState, useEffect } from "react";
import { Mail, Phone, Building2, Trash2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { toast } from "@/hooks/useToast";
import { useQuoContacts, type QuoContact } from "@/hooks/useQuoContacts";

export function QuoContactList() {
  const { loading, error, getContacts, createContact, deleteContact } = useQuoContacts();
  const [contacts, setContacts] = useState<QuoContact[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  const [newContact, setNewContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    role: "",
  });

  const loadContacts = async () => {
    try {
      const result = await getContacts(cursor);
      setContacts((prev) => (cursor ? [...prev, ...result.contacts] : result.contacts));
      setCursor(result.nextCursor);
      setHasMore(!!result.nextCursor);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load contacts", variant: "destructive" });
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleCreateContact = async () => {
    if (!newContact.firstName.trim() && !newContact.lastName.trim()) {
      toast({ title: "Error", description: "At least one name field is required" });
      return;
    }

    try {
      await createContact({
        firstName: newContact.firstName || undefined,
        lastName: newContact.lastName || undefined,
        emails: newContact.email ? [newContact.email] : undefined,
        phoneNumbers: newContact.phone ? [{ value: newContact.phone }] : undefined,
        company: newContact.company || undefined,
        role: newContact.role || undefined,
      });

      setNewContact({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        company: "",
        role: "",
      });
      setShowCreateDialog(false);
      setCursor(undefined);
      await loadContacts();
      toast({ title: "Success", description: "Contact created" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to create contact", variant: "destructive" });
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      await deleteContact(contactId);
      setCursor(undefined);
      await loadContacts();
      toast({ title: "Success", description: "Contact deleted" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.toLowerCase();
    const company = (contact.company || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || company.includes(query);
  });

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Contacts</h2>
        <Button onClick={() => setShowCreateDialog(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Contact
        </Button>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by name or company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="First Name"
              value={newContact.firstName}
              onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
            />
            <Input
              placeholder="Last Name"
              value={newContact.lastName}
              onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
            />
            <Input
              placeholder="Email"
              type="email"
              value={newContact.email}
              onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
            />
            <Input
              placeholder="Phone"
              type="tel"
              value={newContact.phone}
              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
            />
            <Input
              placeholder="Company"
              value={newContact.company}
              onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
            />
            <Input
              placeholder="Role"
              value={newContact.role}
              onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateContact} disabled={loading}>
                {loading ? <LoadingSpinner /> : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {loading && contacts.length === 0 ? (
        <div className="flex justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-start justify-between"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-lg">
                  {contact.firstName} {contact.lastName}
                </h3>
                {contact.company && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    <Building2 className="w-4 h-4" />
                    <span>{contact.company}</span>
                    {contact.role && <span className="text-gray-400">•</span>}
                    {contact.role && <span>{contact.role}</span>}
                  </div>
                )}
                {contact.emails && contact.emails.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    <Mail className="w-4 h-4" />
                    <span>{contact.emails[0]}</span>
                  </div>
                )}
                {contact.phoneNumbers && contact.phoneNumbers.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    <Phone className="w-4 h-4" />
                    <span>{contact.phoneNumbers[0].value}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleDeleteContact(contact.id)}
                className="flex-shrink-0 p-2 hover:bg-gray-200 rounded ml-2"
              >
                <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
              </button>
            </div>
          ))}

          {filteredContacts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {contacts.length === 0
                ? "No contacts yet. Create one to get started!"
                : "No contacts match your search."}
            </div>
          )}

          {hasMore && filteredContacts.length === contacts.length && (
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={loadContacts}
              disabled={loading}
            >
              {loading ? <LoadingSpinner /> : "Load More"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

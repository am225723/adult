import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface Workspace {
  id: string;
  name: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  setSelectedWorkspaceId: (id: string) => void;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaces: [],
  selectedWorkspaceId: null,
  setSelectedWorkspaceId: () => {},
  isLoading: true,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setSelectedWorkspaceIdState(null);
      setIsLoading(false);
      return;
    }

    supabase
      .from("admin_workspaces")
      .select("id, name")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) {
          setIsLoading(false);
          return;
        }
        const ws = data as Workspace[];
        setWorkspaces(ws);

        const stored = localStorage.getItem(`selectedWorkspaceId:${user.id}`);
        const validStored = stored ? ws.some((w) => w.id === stored) : false;
        const initial = validStored ? stored! : (ws[0]?.id ?? null);
        setSelectedWorkspaceIdState(initial);
        setIsLoading(false);
      });
  }, [user?.id]);

  function setSelectedWorkspaceId(id: string) {
    setSelectedWorkspaceIdState(id);
    if (user) localStorage.setItem(`selectedWorkspaceId:${user.id}`, id);
  }

  return (
    <WorkspaceContext.Provider
      value={{ workspaces, selectedWorkspaceId, setSelectedWorkspaceId, isLoading }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

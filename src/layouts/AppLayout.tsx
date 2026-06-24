import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  MessageSquare,
  Mail,
  Phone,
  Users,
  Settings,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Search,
  Building2,
  Check,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Navigate } from "react-router-dom";
import { toast } from "@/hooks/useToast";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useMyAdminUser } from "@/hooks/useWorkspaceUsers";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Today" },
  { to: "/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/mail", icon: Mail, label: "Mail" },
  { to: "/phone", icon: Phone, label: "Phone" },
  { to: "/contacts", icon: Users, label: "Contacts" },
];

export function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const { workspaces, selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspace();
  const { data: myAdminUser } = useMyAdminUser();

  // Global Cmd/Ctrl+K shortcut — skip editable fields and key repeat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !isEditable) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;

  const user = session.user;

  const displayName =
    myAdminUser?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";

  const avatarUrl =
    myAdminUser?.avatar_url ||
    (user.user_metadata?.avatar_url as string | undefined);

  const initials = displayName.slice(0, 2).toUpperCase();

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Sign out failed",
        description: error.message,
      });
      return;
    }
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden">
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Sidebar (desktop only) */}
      <aside className="hidden md:flex w-14 flex-col items-center py-4 gap-1 bg-sidebar border-r border-sidebar-border shrink-0">
        {/* Workspace switcher / App mark */}
        {workspaces.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-10 h-10 rounded-full flex items-center justify-center mb-3 shrink-0 hover:opacity-80 transition-opacity overflow-hidden"
                title={selectedWorkspace?.name ?? "Switch workspace"}
              >
                <img src="/whitelogo.png" alt="Integrative Psychiatry" className="w-10 h-10 object-contain" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-52">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Workspaces
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                  className="flex items-center gap-2"
                >
                  <Building2 size={13} className="shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws.id === selectedWorkspaceId && (
                    <Check size={13} className="shrink-0 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-3 shrink-0 overflow-hidden"
            title={selectedWorkspace?.name}
          >
            <img src="/whitelogo.png" alt="Integrative Psychiatry" className="w-10 h-10 object-contain" />
          </div>
        )}

        {/* Search button */}
        <button
          onClick={() => setSearchOpen(true)}
          title="Search (⌘K)"
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mb-1"
        >
          <Search size={17} strokeWidth={1.75} />
        </button>

        {/* Nav items */}
        <nav className="flex flex-col items-center gap-0.5 flex-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) =>
                cn(
                  "w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                )
              }
            >
              <Icon size={17} strokeWidth={1.75} />
            </NavLink>
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="flex flex-col items-center gap-1 mt-auto">
          {/* Theme toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-9 h-9 flex items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                title="Toggle theme"
              >
                {theme === "dark" ? (
                  <Moon size={16} strokeWidth={1.75} />
                ) : theme === "light" ? (
                  <Sun size={16} strokeWidth={1.75} />
                ) : (
                  <Monitor size={16} strokeWidth={1.75} />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-36">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun size={14} className="mr-2" /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon size={14} className="mr-2" /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor size={14} className="mr-2" /> System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notification center */}
          <NotificationCenter />

          {/* Settings */}
          <NavLink
            to="/settings"
            title="Settings"
            className={({ isActive }) =>
              cn(
                "w-9 h-9 flex items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
              )
            }
          >
            <Settings size={16} strokeWidth={1.75} />
          </NavLink>

          {/* User avatar / account menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-52">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs truncate text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
              {selectedWorkspace && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="font-normal py-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 size={11} />
                      <span className="truncate">{selectedWorkspace.name}</span>
                    </div>
                  </DropdownMenuLabel>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut size={14} className="mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col pb-14 md:pb-0">
        <Outlet />
      </main>

      {/* Bottom navigation (mobile only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-sidebar border-t border-sidebar-border flex items-center justify-around px-2">
        {/* Search button (mobile) */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Search size={20} strokeWidth={1.75} />
          <span className="text-[10px] font-medium">Search</span>
        </button>

        {NAV_ITEMS.slice(0, 5).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-lg transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive &&
                  "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              )
            }
          >
            <Icon size={20} strokeWidth={1.75} />
            <span className="text-[10px] font-medium truncate">{label}</span>
          </NavLink>
        ))}

        {/* More menu (mobile) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
              <Settings size={20} strokeWidth={1.75} />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-48 mb-1">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs truncate text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.length > 1 && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal py-1">
                  Workspaces
                </DropdownMenuLabel>
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => setSelectedWorkspaceId(ws.id)}
                    className="flex items-center gap-2"
                  >
                    <span className="flex-1 truncate text-sm">{ws.name}</span>
                    {ws.id === selectedWorkspaceId && (
                      <Check size={13} className="shrink-0 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun size={14} className="mr-2" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon size={14} className="mr-2" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor size={14} className="mr-2" /> System
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut size={14} className="mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
  );
}

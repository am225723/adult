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
} from "lucide-react";
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

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;

  const user = session.user;
  const initials = (user.email ?? "?")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-14 flex flex-col items-center py-4 gap-1 bg-sidebar border-r border-sidebar-border shrink-0">
        {/* App mark */}
        <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center mb-3 shrink-0">
          <span className="text-background text-xs font-bold leading-none">
            A
          </span>
        </div>

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
                  <AvatarImage
                    src={user.user_metadata?.avatar_url as string | undefined}
                  />
                  <AvatarFallback className="text-[10px]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <p className="text-xs truncate text-muted-foreground">
                  {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut size={14} className="mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

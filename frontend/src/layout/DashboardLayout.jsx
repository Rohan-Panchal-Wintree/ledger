import { SidebarProvider, SidebarTrigger } from "../component/UI/Sidebar";
import { AppSidebar } from "../component/AppSidebar";
import { LogOut } from "lucide-react";
import { Badge } from "../component/UI/Badge";
import { useAuth } from "../contexts/AuthContext";
import { Outlet, useLocation } from "react-router-dom";

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const formatTitle = (path, user) => {
    if (path === "/") return "Home Dashboard";

    const name = path.replace("/", "").toLowerCase();

    if (name === "dashboard" && user?.role === "admin") {
      return "Management Dashboard";
    }

    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const title = formatTitle(location.pathname, user);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="h-14 shrink-0 border-b border-b-gray-200 bg-card px-4">
            <div className="flex h-full items-center justify-between">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <span className="text-md font-medium text-[#1f2937]">
                  {title}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="capitalize text-xs">
                  {user?.role}
                </Badge>

                <button
                  onClick={logout}
                  className="text-muted-foreground transition-colors hover:text-foreground md:hidden"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

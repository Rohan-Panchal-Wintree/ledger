import {
  LayoutDashboard,
  Upload,
  Users,
  LogOut,
  FileBarChart,
  User,
  Shield,
  Badge,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "./UI/Sidebar";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { open } = useSidebar();

  const sidebarItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      show: true,
    },
    {
      name: "Reports",
      icon: FileBarChart,
      path: "/reports",
      show: true,
    },
    {
      name: "Upload",
      icon: Upload,
      path: "/upload",
      show: user?.role === "admin",
    },
    {
      name: "Manage Emails",
      icon: Users,
      path: "/manage-emails",
      show: user?.role === "admin",
    },
    {
      name: "Profile",
      icon: User,
      path: "/profile",
      show: true,
    },
  ];

  const visibleItems = sidebarItems.filter((item) => item.show);

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="border-b border-[#1f2937]">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#627BFF]">
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>

          {open && (
            <span className="text-md font-semibold text-white">PayGate</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-6">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#64748b]">
            Navigation
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.path}>
                    <NavLink to={item.path}>
                      {({ isActive }) => (
                        <SidebarMenuButton isActive={isActive}>
                          <Icon className="h-4 w-4" />
                          {open && <span>{item.name}</span>}
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-[#1f2937] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-xs font-semibold text-white">
            {user?.email?.[0]?.toUpperCase() || "U"}
          </div>

          {open && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {user?.email}
                </p>
                <p className="text-sm capitalize text-[#94a3b8]">
                  {user?.role}
                </p>
              </div>

              <button
                onClick={logout}
                className="text-[#94a3b8] transition-colors hover:text-white"
                title="Logout"
                type="button"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

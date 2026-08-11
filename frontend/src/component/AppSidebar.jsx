import {
  LayoutDashboard,
  Building2,
  Landmark,
  Upload,
  Users,
  LogOut,
  FileBarChart,
  User,
  Shield,
  Blend,
  FilePlus,
  Handshake,
} from "lucide-react";
import { NavLink } from "react-router-dom";
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
import FloatingTooltip from "./UI/FloatingTooltip";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser, selectCurrentUser } from "../store/slices/Auth.slice";

export function AppSidebar() {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectCurrentUser);

  const { open } = useSidebar();

  const sidebarItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      show: ["admin", "finance", "settlement", "merchant", "support"].includes(
        currentUser?.role,
      ),
    },
    {
      name: "Merchants",
      icon: Building2,
      path: "/merchants",
      show: ["admin", "settlement", "finance", "support"].includes(
        currentUser?.role,
      ),
    },
    {
      name: "Acquirers",
      icon: Landmark,
      path: "/acquirers",
      show: ["admin", "finance", "settlement", "support"].includes(
        currentUser?.role,
      ),
    },
    {
      name: "Reports",
      icon: FileBarChart,
      path: "/reports",
      show: ["admin", "settlement", "finance"].includes(currentUser?.role),
    },
    {
      name: "Upload",
      icon: Upload,
      path: "/upload",
      show: ["admin", "settlement", "finance", "support"].includes(
        currentUser?.role,
      ),
    },
    {
      name: "Merchant Settlement",
      icon: Handshake,
      path: "/merchant-settlement",
      show: ["admin", "support", "settlement"].includes(currentUser?.role),
    },
    {
      name: "Miscellaneous",
      icon: Blend,
      path: "/miscellaneous",
      show: ["admin", "settlement", "finance"].includes(currentUser?.role),
    },
    {
      name: "Sheets",
      icon: FilePlus,
      path: "/sheets",
      show: ["admin", "settlement", "finance"].includes(currentUser?.role),
    },
    {
      name: "Manage Emails",
      icon: Users,
      path: "/manage-emails",
      show: ["admin"].includes(currentUser?.role),
    },
    {
      name: "Profile",
      icon: User,
      path: "/profile",
      show: ["admin", "finance", "settlement", "merchant", "support"].includes(
        currentUser?.role,
      ),
    },
  ];

  const visibleItems = sidebarItems.filter((item) => item.show);

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
            <Shield className="h-4 w-4" />
          </div>

          {open && (
            <div className="min-w-0">
              <p className="text-md font-semibold tracking-tight text-on-surface">
                PayGate
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-5">
        <SidebarGroup>
          {/* <SidebarGroupLabel>Navigation</SidebarGroupLabel> */}

          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.path}>
                    <FloatingTooltip label={item.name} disabled={open}>
                      <NavLink to={item.path}>
                        {({ isActive }) => (
                          <SidebarMenuButton isActive={isActive}>
                            <Icon className="h-4 w-4 shrink-0" />

                            {open ? (
                              <span className="truncate">{item.name}</span>
                            ) : null}
                          </SidebarMenuButton>
                        )}
                      </NavLink>
                    </FloatingTooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-outline-variant/20 p-3">
        <div
          className={`flex items-center rounded-lg bg-surface-container-low p-2 ${
            open ? "gap-3" : "justify-center"
          }`}
        >
          <FloatingTooltip
            label={`${currentUser?.email || "User"} · ${currentUser?.role || ""}`}
            disabled={open}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              {currentUser?.email?.[0]?.toUpperCase() || "U"}
            </div>
          </FloatingTooltip>

          {open ? (
            <>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-xs font-medium text-on-surface"
                  title={currentUser?.email}
                >
                  {currentUser?.email}
                </p>

                <p className="text-xs capitalize text-on-surface-variant">
                  {currentUser?.role}
                </p>
              </div>

              <button
                type="button"
                onClick={() => dispatch(logoutUser())}
                className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

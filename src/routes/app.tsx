import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { IS_DEMO } from "@/integrations/hostack/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LayoutDashboard, BookOpen, Mountain as Trail, Megaphone, Settings, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
const torridoniaLogo = "/staffapp/torridonia-logo.png";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, profile, loading, isAdmin, isRoomManager, isVolunteer, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: IS_DEMO ? "/demo" : "/volunteer-access" });
    else if (!isVolunteer && profile && !profile.onboarded) navigate({ to: "/onboarding" });
    if (!loading && isVolunteer && (loc.pathname.startsWith("/app/admin") || loc.pathname.startsWith("/app/rooms"))) {
      navigate({ to: "/app/dashboard" });
    }
  }, [loading, user, profile, isVolunteer, loc.pathname, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">{t("common.loading")}</div>;
  }

  const volunteerNav = [
    { to: "/app/dashboard",     label: t("nav.dashboard"),     icon: LayoutDashboard },
    { to: "/app/guidebook",     label: t("nav.guidebook"),     icon: BookOpen },
    { to: "/app/announcements", label: t("nav.announcements"), icon: Megaphone },
    { to: "/app/adventures",    label: t("nav.adventures"),    icon: Trail },
  ];

  const adminNav = [
    { to: "/app/dashboard",     label: t("nav.dashboard"),     icon: LayoutDashboard },
    { to: "/app/admin",         label: t("nav.admin"),         icon: ShieldCheck },
    { to: "/app/guidebook",     label: t("nav.guidebook"),     icon: BookOpen },
    { to: "/app/announcements", label: t("nav.announcements"), icon: Megaphone },
    { to: "/app/adventures",    label: t("nav.adventures"),    icon: Trail },
  ];

  const fullNav = isAdmin && !isVolunteer ? adminNav : volunteerNav;
  const mobileNav = fullNav;

  const displayName = profile?.full_name || profile?.email || (user.user_metadata as { full_name?: string } | undefined)?.full_name || user.email || "Volunteer";

  return (
    <div className="min-h-screen bg-cream-paper">
      <aside className="fixed inset-y-0 left-0 hidden lg:flex w-64 flex-col bg-sidebar border-r p-5">
        <Link to="/app/dashboard" className="flex items-center mb-8">
          <img src={torridoniaLogo} alt="Torridonia" className="h-12 w-auto" />
        </Link>
        <nav className="flex-1 space-y-1">
          {fullNav.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
          {isVolunteer && (
            <Link
              to="/app/settings"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                loc.pathname.startsWith("/app/settings")
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              <Settings className="h-4 w-4" /> {t("nav.settings")}
            </Link>
          )}
        </nav>
        <div className="border-t pt-4 space-y-3">
          <LanguageSwitcher />
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t("nav.signedInAs")}</p>
            <p className="text-sm font-medium truncate">{displayName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" /> {t("nav.signOut")}
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-20 bg-card border-b px-4 py-3 flex items-center justify-between">
        <Link to="/app/dashboard" className="flex items-center">
          <img src={torridoniaLogo} alt="Torridonia" className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-5xl p-6 lg:p-10 pb-24">
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-card border-t flex justify-around py-2">
          {mobileNav.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}

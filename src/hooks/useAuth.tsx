import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { hostackSupabase, IS_DEMO, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";

type Profile = {
  id: string;
  full_name: string | null;
  nationality: string | null;
  language: "en" | "pt" | "es" | "fr" | "it";
  phone: string | null;
  email: string | null;
  passport_number: string | null;
  passport_url: string | null;
  avatar_url: string | null;
  bio: string | null;
  onboarded: boolean;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isRoomManager: boolean;
  isVolunteer: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRoomManager, setIsRoomManager] = useState(false);
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyAnonymousVolunteer = async (currentUser: User) => {
    const meta = currentUser.user_metadata as { demo_admin?: boolean; full_name?: string } | undefined;
    const isDemoAdmin = meta?.demo_admin === true;
    setUser(currentUser);

    if (isDemoAdmin) {
      setIsVolunteer(false);
      setIsAdmin(true);
      setIsRoomManager(true);
      setProfile({
        id: currentUser.id,
        full_name: meta?.full_name ?? 'Demo Manager',
        email: null, phone: null, language: 'en', nationality: null,
        passport_number: null, passport_url: null, avatar_url: null, bio: null, onboarded: true,
      });
      setLoading(false);
      return;
    }

    // Check if this anonymous user is registered as a property manager in the volunteers table
    try {
      const { data: vol } = await hostackSupabase
        .from('volunteers')
        .select('role_type, name')
        .eq('property_id', TORRIDONIA_PROPERTY_ID)
        .eq('auth_user_id', currentUser.id)
        .maybeSingle();

      const isManagerVol = (vol as { role_type?: string | null } | null)?.role_type === 'Manager';
      if (isManagerVol) {
        const volName = (vol as { name?: string | null } | null)?.name ?? meta?.full_name ?? 'Manager';
        setIsAdmin(true);
        setIsRoomManager(true);
        setIsVolunteer(false);
        setProfile({
          id: currentUser.id,
          full_name: volName,
          email: null, phone: null, language: 'en', nationality: null,
          passport_number: null, passport_url: null, avatar_url: null, bio: null, onboarded: true,
        });
      } else {
        setIsAdmin(false);
        setIsRoomManager(false);
        setIsVolunteer(true);
        setProfile(null);
      }
    } catch {
      setIsAdmin(false);
      setIsRoomManager(false);
      setIsVolunteer(true);
      setProfile(null);
    }
    setLoading(false);
  };

  const loadProfile = async (currentUser: User) => {
    if (currentUser.email === null || !currentUser.email) {
      await applyAnonymousVolunteer(currentUser);
      return;
    }

    setIsVolunteer(false);
    try {
      // Direct client-side query — no server function needed
      const { data: staff } = await hostackSupabase
        .from("staff")
        .select("id, name, email, role, status, preferred_language, phone")
        .eq("auth_user_id", currentUser.id)
        .maybeSingle();

      if (staff) {
        const roleLc = (staff.role ?? "").toLowerCase();
        const admin = roleLc.includes("manager") || roleLc === "admin" || roleLc === "owner";
        setProfile({
          id: staff.id as string,
          full_name: (staff.name as string | null) ?? currentUser.email?.split("@")[0] ?? "Manager",
          email: staff.email as string | null,
          phone: staff.phone as string | null,
          language: ((staff.preferred_language ?? "en") as Profile["language"]),
          nationality: null,
          passport_number: null,
          passport_url: null,
          avatar_url: null,
          bio: null,
          onboarded: staff.status === "active",
        });
        setIsAdmin(admin);
        setIsRoomManager(admin);
      } else {
        // Fallback: treat any authenticated email user as manager (property owner)
        setProfile({
          id: currentUser.id,
          full_name: currentUser.email?.split("@")[0] ?? "Manager",
          email: currentUser.email ?? null,
          phone: null,
          language: "en",
          nationality: null,
          passport_number: null,
          passport_url: null,
          avatar_url: null,
          bio: null,
          onboarded: true,
        });
        setIsAdmin(true);
        setIsRoomManager(true);
      }
    } catch (e) {
      console.error("loadProfile failed", e);
      setProfile(null);
      setIsAdmin(false);
      setIsRoomManager(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user);
  };

  useEffect(() => {
    // Auth listener FIRST (sync)
    const { data: sub } = hostackSupabase.auth.onAuthStateChange((_e: string, s: Session | null) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Anonymous user: async check to detect manager-role volunteers
        if (s.user.email === null || !s.user.email) {
          applyAnonymousVolunteer(s.user).catch(() => setLoading(false));
          return;
        } else {
          setIsVolunteer(false);
          // defer profile load to avoid deadlocks
          setTimeout(() => loadProfile(s.user).finally(() => setLoading(false)), 0);
        }
      } else {
        setProfile(null);
        setIsAdmin(false);
        setIsRoomManager(false);
        setIsVolunteer(false);
        setLoading(false);
      }
    });

    hostackSupabase.auth.getSession().then(({ data: { session: s } }: { data: { session: Session | null } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        if (s.user.email === null || !s.user.email) {
          applyAnonymousVolunteer(s.user).catch(() => setLoading(false));
          return;
        } else {
          setIsVolunteer(false);
          loadProfile(s.user).finally(() => setLoading(false));
        }
      } else {
        setIsVolunteer(false);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await hostackSupabase.auth.signOut();
    window.location.href = IS_DEMO ? "/staffapp/demo" : "/staffapp/";
  };

  return (
    <Ctx.Provider value={{ user, session, profile, isAdmin, isRoomManager, isVolunteer, loading, refreshProfile, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}

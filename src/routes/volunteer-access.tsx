import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { hostackSupabase, TORRIDONIA_PROPERTY_ID } from "@/integrations/hostack/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mountain } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/volunteer-access")({ component: VolunteerAccess });

function VolunteerAccess() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data: anon, error: anonErr } = await hostackSupabase.auth.signInAnonymously();
      if (anonErr || !anon.user) throw anonErr ?? new Error("Login Error");

      await hostackSupabase.auth.updateUser({
        data: {
          full_name: name.trim(),
          role: "volunteer",
          property_id: TORRIDONIA_PROPERTY_ID,
        },
      });

      // Name-based lookup: exact then first-name prefix fallback
      const trimmedName = name.trim();
      let volunteer: { id: string } | null = null;

      const { data: exact } = await hostackSupabase
        .from("volunteers")
        .select("id")
        .eq("property_id", TORRIDONIA_PROPERTY_ID)
        .eq("status", "active")
        .ilike("name", trimmedName)
        .maybeSingle();
      volunteer = (exact as { id: string } | null) ?? null;

      if (!volunteer) {
        const firstName = trimmedName.split(" ")[0];
        const { data: prefix } = await hostackSupabase
          .from("volunteers")
          .select("id")
          .eq("property_id", TORRIDONIA_PROPERTY_ID)
          .eq("status", "active")
          .ilike("name", `${firstName}%`)
          .maybeSingle();
        volunteer = (prefix as { id: string } | null) ?? null;
      }

      if (!volunteer?.id) {
        await hostackSupabase.auth.signOut();
        toast.error("Name not found. Check the spelling or contact your manager.");
        setLoading(false);
        return;
      }

      await hostackSupabase
        .from("volunteers")
        .update({ auth_user_id: anon.user.id })
        .eq("id", volunteer.id);

      const { data: vol } = await hostackSupabase
        .from("volunteers")
        .select("whatsapp_number")
        .eq("id", volunteer.id)
        .single();
      const profileComplete = !!(vol as { whatsapp_number?: string | null } | null)?.whatsapp_number;

      if (!profileComplete) {
        navigate({ to: "/join" });
      } else {
        const onboardingDone = typeof window !== "undefined" && localStorage.getItem("onboarding_done") === "true";
        navigate({ to: onboardingDone ? "/app/dashboard" : "/onboarding" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Access Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-cream-paper">
      <div className="hidden lg:flex bg-gradient-moss text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-2 font-display text-xl">
          <Mountain className="h-6 w-6" /> Torridonia
        </div>
        <div>
          <h2 className="font-display text-4xl leading-tight">Welcome </h2>
          <p className="opacity-80 mt-3">Join the clan. No email, no password.</p>
        </div>
        <p className="text-xs opacity-60">Torridon Estate</p>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="font-display text-3xl font-semibold">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your name exactly as your manager registered you.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Roxana"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Loading…" : "Enter"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            You are manager?{" "}
            <Link to="/login" className="text-accent font-medium hover:underline">
              Login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TreePine, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Mode = "login" | "signup" | "forgot" | "reset";

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Lyssna på recovery-event så vi byter till "reset"-vyn när användaren klickar länken i mejlet
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast.success("Konto skapat! Du är nu inloggad.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      toast.success("Återställningslänk skickad! Kolla din e-post.");
      setMode("login");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Lösenord uppdaterat!");
      setNewPassword("");
      // Användaren är nu inloggad — AuthProvider tar över
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const title = {
    login: "Logga in",
    signup: "Skapa konto",
    forgot: "Glömt lösenord",
    reset: "Sätt nytt lösenord",
  }[mode];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <TreePine className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl text-foreground">Skogia</h1>
          <p className="text-sm text-muted-foreground mt-1">Ekonomisystem för skogsägare</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            {(mode === "forgot" || mode === "signup") && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Tillbaka"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="font-display text-xl text-card-foreground">{title}</h2>
          </div>

          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label>E-post</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="namn@exempel.se" required />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Lösenord</Label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-primary hover:underline"
                  >
                    Glömt lösenord?
                  </button>
                </div>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Laddar..." : "Logga in"}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Inget konto?{" "}
                <button type="button" onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">
                  Skapa konto
                </button>
              </p>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-1.5">
                <Label>E-post</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="namn@exempel.se" required />
              </div>
              <div className="space-y-1.5">
                <Label>Lösenord</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Laddar..." : "Skapa konto"}
              </Button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ange din e-postadress så skickar vi en länk för att återställa ditt lösenord.
              </p>
              <div className="space-y-1.5">
                <Label>E-post</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="namn@exempel.se" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Skickar..." : "Skicka återställningslänk"}
              </Button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleReset} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Välj ett nytt lösenord för ditt konto.
              </p>
              <div className="space-y-1.5">
                <Label>Nytt lösenord</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sparar..." : "Spara nytt lösenord"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

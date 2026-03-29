import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TreePine } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Konto skapat! Du är nu inloggad.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <TreePine className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl text-foreground">Skogskoll</h1>
          <p className="text-sm text-muted-foreground mt-1">Ekonomisystem för skogsägare</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-display text-xl text-card-foreground mb-4">
            {isLogin ? "Logga in" : "Skapa konto"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>E-post</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="namn@exempel.se" required />
            </div>
            <div className="space-y-1.5">
              <Label>Lösenord</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Laddar..." : isLogin ? "Logga in" : "Skapa konto"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground text-center mt-4">
            {isLogin ? "Inget konto?" : "Har redan konto?"}{" "}
            <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-medium hover:underline">
              {isLogin ? "Skapa konto" : "Logga in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const finishLoading = () => {
      if (isMounted) setLoading(false);
    };

    const seedDemoDataIfNeeded = async (nextSession: Session | null) => {
      if (!nextSession?.user) return;

      try {
        const userId = nextSession.user.id;
        const { data, error } = await supabase.from("properties").select("id").limit(1);

        if (!error && (!data || data.length === 0)) {
          await supabase.rpc("seed_demo_data", { p_user_id: userId });
        }
      } catch (error) {
        console.error("Kunde inte skapa demodata:", error);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!isMounted) return;

        setSession(nextSession);
        finishLoading();

        // Kör seed i bakgrunden så UI aldrig fastnar på "Laddar..."
        if (event === "SIGNED_IN") {
          void seedDemoDataIfNeeded(nextSession);
        }
      }
    );

    void supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!isMounted) return;
        setSession(currentSession);
      })
      .catch((error) => {
        console.error("Kunde inte hämta session:", error);
      })
      .finally(() => {
        finishLoading();
      });

    const loadingTimeout = window.setTimeout(() => {
      finishLoading();
    }, 5000);

    return () => {
      isMounted = false;
      window.clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

type Role = "alici" | "satici";

type AuthUser = {
  id: string;
  email: string | null;
  role?: Role;
  confirmed_at?: string | null;
} | null;

type AuthCtx = {
  user: AuthUser;
  loading: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  refresh: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.auth.getUser();
    const u = data?.user ?? null;

    // ⚠️ email ve confirmed alanlarında undefined → null dönüşümü yapıyoruz
    const email = (u?.email ?? null) as string | null;

    // Supabase v2'de genelde 'email_confirmed_at' var; bazı sürümlerde 'confirmed_at' görülebilir
    const confirmed_at =
      ((u as any)?.email_confirmed_at ??
        (u as any)?.confirmed_at ??
        null) as string | null;

    const role = (u?.user_metadata?.role as Role | undefined) ?? undefined;

    setUser(
      u
        ? {
            id: u.id,
            email,
            role,
            confirmed_at,
          }
        : null
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return <Ctx.Provider value={{ user, loading, refresh: load }}>{children}</Ctx.Provider>;
};

export const useAuth = () => useContext(Ctx);

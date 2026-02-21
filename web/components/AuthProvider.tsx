"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@supabase/supabase-js";
import type { User, Session } from "@supabase/supabase-js";
import type { UserProfile } from "@/types/citizen";

// Build client only on browser (no env vars needed server-side here)
const supabase =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      )
    : null;

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    role: "citizen" | "agency",
    fullName: string,
  ) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  session: null,
  profile: null,
  loading: false,
  signUp: async () => ({}),
  signIn: async () => ({}),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(uid: string) {
    if (!supabase) return;
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", uid)
      .single();
    if (data) setProfile(data as UserProfile);
  }

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchProfile(s.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchProfile(s.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signUp(
    email: string,
    password: string,
    role: "citizen" | "agency",
    fullName: string,
  ): Promise<{ error?: string }> {
    if (!supabase)
      return { error: "Auth not configured (add Supabase env vars)" };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role, full_name: fullName } },
    });
    return error ? { error: error.message } : {};
  }

  async function signIn(
    email: string,
    password: string,
  ): Promise<{ error?: string }> {
    if (!supabase)
      return { error: "Auth not configured (add Supabase env vars)" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

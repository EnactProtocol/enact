import type { Session, User } from "@supabase/supabase-js";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  needsUsername: boolean;
  signInWithGitHub: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  createProfile: (username: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // User is logged in but has no profile yet
  const needsUsername = !!user && !profile && !profileLoading;

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows found, which is expected for new users
        console.error("Error fetching profile:", error);
      }
      setProfile(data);
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signInWithGitHub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const normalizedUsername = username.toLowerCase().trim();

    // Check format first
    if (!/^[a-z0-9_-]+$/.test(normalizedUsername)) {
      return false;
    }

    if (normalizedUsername.length < 3 || normalizedUsername.length > 39) {
      return false;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (error) {
      console.error("Error checking username:", error);
      return false;
    }

    return data === null;
  };

  const createProfile = async (username: string) => {
    if (!user) {
      throw new Error("Must be logged in to create profile");
    }

    const normalizedUsername = username.toLowerCase().trim();

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        username: normalizedUsername,
        display_name: null,
        avatar_url: user.user_metadata?.avatar_url || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Username is already taken");
      }
      throw error;
    }

    setProfile(data);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        profileLoading,
        needsUsername,
        signInWithGitHub,
        signInWithGoogle,
        signOut,
        checkUsernameAvailable,
        createProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

import React, { useState, useEffect } from "react";
import { LogIn, LogOut, Shield, User, CheckCircle2, AlertCircle } from "lucide-react";
import { auth, signInWithGoogle, logOut, subscribeToAuth, AppUserProfile } from "../services/firebase";
import { User as FirebaseUser } from "firebase/auth";

interface AuthBarProps {
  onDirectoryOpen: () => void;
  touristsCount: number;
}

export default function AuthBar({ onDirectoryOpen, touristsCount }: AuthBarProps) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Sign-in failed:", err);
      // If user closed popup, don't scream error
      if (err?.code !== "auth/popup-closed-by-user") {
        setAuthError(err?.message || "Google authentication failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error("Sign-out failed:", err);
    }
  };

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {authError && (
        <span className="text-[10px] text-red-400 font-mono flex items-center gap-1 bg-red-950/40 px-2 py-1 border border-red-500/30">
          <AlertCircle className="w-3 h-3" />
          {authError}
        </span>
      )}

      {currentUser ? (
        <div className="flex items-center gap-2 bg-slate-900/80 border border-emerald-500/30 px-2.5 py-1.5 backdrop-blur-sm">
          {currentUser.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt={currentUser.displayName || "User"}
              referrerPolicy="no-referrer"
              className="w-6 h-6 rounded-full border border-emerald-400/50 object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold">
              {currentUser.displayName?.[0] || "U"}
            </div>
          )}

          <div className="flex flex-col text-left">
            <span className="text-[11px] font-bold text-white leading-tight truncate max-w-[120px] md:max-w-[160px]">
              {currentUser.displayName || currentUser.email?.split("@")[0] || "Ranger"}
            </span>
            <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" />
              Verified Ranger
            </span>
          </div>

          <button
            onClick={handleSignOut}
            title="Sign out of Firebase Auth"
            className="ml-1 text-slate-400 hover:text-rose-400 p-1 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="bg-white hover:bg-slate-100 text-slate-950 font-bold px-3 py-1.5 text-xs uppercase tracking-wider flex items-center gap-2 border border-white/20 transition-all shadow-sm cursor-pointer"
          title="Sign in securely with Google and Firebase Auth"
        >
          {isLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span className="font-display text-[11px]">Sign in with Google</span>
        </button>
      )}

      {/* Button to open complete Person Directory */}
      <button
        onClick={onDirectoryOpen}
        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 text-xs uppercase tracking-wider flex items-center gap-1.5 border border-emerald-400/40 transition-colors cursor-pointer"
        title="View and edit the complete personal data, blood group, medical history, and emergency contacts of every person"
      >
        <User className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Persons Directory</span>
        <span className="bg-emerald-950/80 px-1.5 py-0.2 rounded-none text-[10px] font-mono">
          {touristsCount}
        </span>
      </button>
    </div>
  );
}

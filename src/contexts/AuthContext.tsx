import { User } from '@supabase/supabase-js'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface McProfile {
  id: string;
  name: string;
  token?: string; // We can store the access token if needed for game launch
}

interface AuthContextType {
  user: User | null
  mcUser: McProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>
  setMicrosoftUser: (profile: McProfile) => void
  signOut: () => Promise<void>
  cachedSkinUrl: string | null
  setCachedSkinUrl: (url: string | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [mcUser, setMcUser]   = useState<McProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [cachedSkinUrl, setCachedSkinUrlState] = useState<string | null>(null)

  const setCachedSkinUrl = (url: string | null) => {
    setCachedSkinUrlState(url);
    if (url) {
      localStorage.setItem('verdant_skin_cache', url);
    } else {
      localStorage.removeItem('verdant_skin_cache');
    }
  }

  useEffect(() => {
    // Carrega sessao do Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const skinCache = localStorage.getItem('verdant_skin_cache');
    if (skinCache) setCachedSkinUrlState(skinCache);

    // Carrega MS user do LocalStorage
    const msStr = localStorage.getItem('verdant_ms_user')
    if (msStr) {
      try {
        const p = JSON.parse(msStr);
        setMcUser(p)
        // Usa API publica com CORS liberado para interface gráfica
        setCachedSkinUrl(`https://api.mcheads.org/skin/${p.name}`);
      } catch(e) {}
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUp = async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    return { error: error?.message ?? null }
  }
  
  const setMicrosoftUser = (profile: McProfile) => {
    setMcUser(profile)
    const url = `https://api.mcheads.org/skin/${profile.name}`;
    setCachedSkinUrl(url);
    localStorage.setItem('verdant_ms_user', JSON.stringify(profile))
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setMcUser(null)
    setCachedSkinUrl(null)
    localStorage.removeItem('verdant_ms_user')
  }

  return (
    <AuthContext.Provider value={{ user, mcUser, loading, signIn, signUp, setMicrosoftUser, signOut, cachedSkinUrl, setCachedSkinUrl }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}










import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Icon } from '@iconify/react'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import logoGlow from '../assets/images/VerdantLauncherGlowingLogo.png'
import { getVersion } from '@tauri-apps/api/app'

type Mode = 'login' | 'register'

export default function AuthPage() {
  const { signIn, signUp, setMicrosoftUser } = useAuth()
  
  const [appVersion, setAppVersion] = useState<string>('0.1.0')
  const [mode, setMode]       = useState<Mode>('login')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    getVersion().then(v => setAppVersion(v)).catch(() => {})
  }, [])

  // MS Auth States
  const [msAuthStep, setMsAuthStep] = useState<'idle' | 'device_code' | 'polling' | 'exchanging'>('idle')
  const [deviceCodeData, setDeviceCodeData] = useState<any>(null)
  const [msStatusMsg, setMsStatusMsg] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error)
    } else {
      if (!username.trim()) { setError('Nome de usuario e obrigatorio'); setLoading(false); return }
      const { error } = await signUp(email, password, username)
      if (error) setError(error)
      else setSuccess(true)
    }
    setLoading(false)
  }

  const handleMicrosoftLogin = async () => {
    try {
      setMsAuthStep('device_code')
      setError(null)
      
      // 1. Request Device Code
      setMsStatusMsg('Gerando código de pareamento...')
      const codeRes: any = await invoke('ms_request_device_code')
      setDeviceCodeData(codeRes)
      setMsStatusMsg('Aguardando autorização...')
      setMsAuthStep('polling')

      // 2. Poll for token
      const msToken: string = await invoke('ms_poll_token', { 
        deviceCode: codeRes.device_code, 
        interval: codeRes.interval 
      })

      setMsAuthStep('exchanging')
      setMsStatusMsg('Autenticando Xbox Live...')
      const xblRes: any = await invoke('auth_xbox_live', { msToken })
      
      setMsStatusMsg('Autorizando XSTS...')
      const xstsRes: any = await invoke('auth_xsts', { xblToken: xblRes.Token })

      setMsStatusMsg('Gerando Token do Minecraft...')
      const mcToken: string = await invoke('auth_minecraft', { 
        uhs: xblRes.DisplayClaims.xui[0].uhs, 
        xstsToken: xstsRes.Token 
      })

      setMsStatusMsg('Obtendo Perfil...')
      const profile: any = await invoke('get_minecraft_profile', { mcToken })

      // Success!
      setMicrosoftUser({
        id: profile.id,
        name: profile.name,
        token: mcToken
      })
      
    } catch (e: any) {
      console.error(e)
      setError(e.toString())
      setMsAuthStep('idle')
    }
  }

  return (
    <div
      className="h-screen w-screen flex items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at center, #0d1f14 0%, #0a0c0a 70%)' }}
      data-tauri-drag-region
    >
      <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-none">
        <img
          src={logoGlow}
          alt="Verdant Launcher"
          className="w-48 drop-shadow-[0_0_15px_rgba(45,186,126,0.3)] animate-pulse-slow"
        />
      </div>

      <div className="bg-[#111411] border border-[#2dba7e]/30 rounded-xl p-8 w-[360px] shadow-2xl mt-32 z-10 relative">
        
        {msAuthStep !== 'idle' ? (
          <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in zoom-in-95">
            <h2 className="text-[#32d583] font-mc-big text-xl mb-4">MICROSOFT LOGIN</h2>
            
            {msAuthStep === 'polling' && deviceCodeData ? (
              <div className="bg-[#0a0c0a] border border-[#2dba7e]/30 rounded-lg p-4 mb-6 w-full">
                <p className="text-[#8a9a8a] font-sans text-[11px] mb-2 uppercase tracking-wide">
                  Acesse o link abaixo e digite o código:
                </p>
                <div className="bg-[#1a1c1a] border border-[#2dba7e]/50 py-3 px-4 rounded flex items-center justify-between mb-3 relative group">
                  <div className="flex-1 text-center pl-6">
                    <span className="font-mc-big text-white text-2xl tracking-[0.2em]">{deviceCodeData.user_code}</span>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(deviceCodeData.user_code);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="text-[#8a9a8a] hover:text-[#32d583] transition-colors flex items-center justify-center p-1 rounded bg-[#2a2d2a] hover:bg-[#1a1c1a] border border-transparent hover:border-[#32d583]/50"
                    title="Copiar Código"
                  >
                    <Icon icon={copied ? "mdi:check" : "mdi:content-copy"} className="w-5 h-5" />
                  </button>
                </div>
                <button 
                  onClick={() => openUrl(deviceCodeData.verification_uri)}
                  className="text-[#32d583] hover:text-white font-sans text-xs underline underline-offset-2 transition-colors"
                >
                  Abrir {deviceCodeData.verification_uri}
                </button>
              </div>
            ) : null}

            <div className="flex flex-col items-center gap-3">
              <div className="w-5 h-5 border-2 border-[#32d583] border-t-transparent rounded-full animate-spin"></div>
              <p className="font-mc-small text-[#8a9a8a] text-xs animate-pulse">
                {msStatusMsg}
              </p>
            </div>

            <button 
              onClick={() => { setMsAuthStep('idle'); setError(null) }}
              className="mt-6 text-white/50 hover:text-white font-mc-small text-[10px] transition-colors"
            >
              CANCELAR
            </button>
          </div>
        ) : (
          <>
            <div className="flex mb-6 border-b border-[#2dba7e]/20">
              {(['login', 'register'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); setSuccess(false) }}
                  className={`flex-1 flex justify-center pb-4 pt-1 font-mc-small text-[14px] tracking-widest transition-colors ${
                    mode === m
                      ? 'text-[#32d583] border-b-2 border-[#32d583]'
                      : 'text-[#8a9a8a] hover:text-white'
                  }`}
                >
                  <span className="mt-1">{m === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}</span>
                </button>
              ))}
            </div>

            {success ? (
              <div className="text-center py-4">
                <p className="font-mc-small text-[#32d583] text-xs leading-relaxed">
                  CONTA CRIADA COM SUCESSO!<br/>
                  <span className="text-[#8a9a8a]">Entrando...</span>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {mode === 'register' && (
                  <div>
                    <label className="font-mc-small text-[10px] text-[#8a9a8a] tracking-widest block mb-1">
                      NOME DE USUARIO
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Steve"
                      className="w-full bg-[#0a0c0a] border border-[#2dba7e]/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#32d583] transition-colors"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="font-mc-small text-[10px] text-[#8a9a8a] tracking-widest block mb-1">
                    E-MAIL
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full bg-[#0a0c0a] border border-[#2dba7e]/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#32d583] transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="font-mc-small text-[10px] text-[#8a9a8a] tracking-widest block mb-1">
                    SENHA
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="        "
                      className="w-full bg-[#0a0c0a] border border-[#2dba7e]/30 rounded-lg pl-3 pr-10 py-2 text-white text-sm focus:outline-none focus:border-[#32d583] transition-colors [&::-ms-reveal]:hidden"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#32d583] hover:text-[#4ade80] transition-colors"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="font-mc-small text-red-400 text-[10px] leading-relaxed bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1db868] hover:bg-[#32d583] disabled:opacity-50 disabled:cursor-not-allowed text-white font-mc-big text-[20px] pt-2 pb-3 rounded-lg transition-colors shadow-[0_4px_0_#14844a] active:translate-y-[2px] active:shadow-none flex justify-center items-center mt-2"
                >
                  <span className="mt-1 drop-shadow-[0_4px_0_rgba(13,89,42,1)]">{loading ? '...' : mode === 'login' ? 'LOGIN OFFLINE' : 'CRIAR CONTA OFFLINE'}</span>
                </button>
                
                {mode === 'login' && (
                  <>
                    <div className="relative flex items-center justify-center w-full mt-2 mb-1">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[#2dba7e]/20"></div>
                      </div>
                      <div className="relative bg-[#111411] px-3 font-mc-small text-[10px] text-[#8a9a8a] tracking-widest">OU</div>
                    </div>

                    <button
                      type="button"
                      onClick={handleMicrosoftLogin}
                      className="w-full bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-[#3a3a3a] text-white font-sans font-bold text-sm py-3 rounded-lg transition-colors flex items-center justify-center gap-3"
                    >
                      <svg viewBox="0 0 21 21" className="w-5 h-5"><path fill="#f35325" d="M1 1h9v9H1z"/><path fill="#81bc06" d="M11 1h9v9h-9z"/><path fill="#05a6f0" d="M1 11h9v9H1z"/><path fill="#ffba08" d="M11 11h9v9h-9z"/></svg>
                      LOGIN COM A MICROSOFT
                    </button>
                  </>
                )}
              </form>
            )}
          </>
        )}
      </div>

      <span className="absolute bottom-3 right-4 font-mc-small text-[9px] text-[#2dba7e]/40">
        VERDANT MVP v{appVersion}
      </span>
    </div>
  )
}


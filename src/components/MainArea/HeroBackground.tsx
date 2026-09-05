import logoGlow from '../../assets/images/VerdantLauncherGlowingLogo.png'
import bg from '../../assets/images/Background.jpg'

export default function HeroBackground() {
  return (
    <div className="relative w-full" style={{ height: '40%' }}>
      {/* Background image */}
      <img
        src={bg}
        alt="Background"
        className="w-full h-full object-cover"
        draggable={false}
      />

      {/* Overlay gradient na parte inferior para fundir com o conteúdo */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0c0a]/90" />

      {/* Logo centralizada */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none pb-8 xl:pb-12 2xl:pb-16 transition-all duration-300">
        <img 
          src={logoGlow} 
          alt="Verdant Launcher Logo" 
          className="w-[26rem] xl:w-[32rem] 2xl:w-[42rem] drop-shadow-[0_0_15px_rgba(45,186,126,0.3)] animate-pulse-slow transition-all duration-300"
        />
      </div>
    </div>
  )
}

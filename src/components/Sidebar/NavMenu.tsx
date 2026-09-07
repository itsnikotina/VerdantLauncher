type NavItem = {
  label: string
  action?: 'create' | 'instances' | 'packs' | 'settings'
  active?: boolean
}

const items: NavItem[] = [
  { label: 'CREATE PACK', action: 'create' },
  { label: 'MODPACKS', action: 'packs' },
  { label: 'INSTANCES', action: 'instances' },
  { label: 'SETTINGS', action: 'settings' },
]

export default function NavMenu({ setModal }: { setModal: (modal: string | null) => void }) {
  return (
    <nav className="flex flex-col gap-1 px-2 xl:px-3 py-4 flex-1">
      {items.map((item) => (
        <button
          key={item.label}
         onClick={() => {
             if (item.action === 'create' || item.action === 'instances' || item.action === 'packs' || item.action === 'settings') {
                 setModal(item.action)
             }
          }}
          className={`
            w-full text-left font-mc-small text-xs xl:text-sm 2xl:text-base tracking-widest px-4 py-3 xl:py-4 rounded
            transition-all duration-300
            ${item.active
              ? 'text-[#32d583] bg-[#32d583]/10 border-l-2 border-[#32d583]'
              : 'text-white hover:text-[#32d583] hover:bg-[#32d583]/5 hover:border-l-2 hover:border-[#32d583]/50'
            }
          `}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}



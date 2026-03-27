import { NavLink } from 'react-router-dom'
import { ClipboardList, Wrench, PackageOpen, Activity } from 'lucide-react'

const navItems = [
  { to: '/requests', label: 'Заявки', icon: ClipboardList },
  { to: '/montage', label: 'Монтаж', icon: Wrench },
  { to: '/leftovers', label: 'Остатки', icon: PackageOpen },
  { to: '/process', label: 'Процесс', icon: Activity },
]

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">DocStroy</h1>
        <p className="text-xs text-gray-500 mt-1">Управление материалами</p>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

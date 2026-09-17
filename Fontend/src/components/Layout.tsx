import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export function Layout({ children }: { children: ReactNode }) {
  const logout = useAuthStore((s) => s.logout)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Knowledge Workspace</div>
        <nav>
          <NavLink to="/documents" className={({ isActive }) => (isActive ? 'active' : '')}>
            Documents
          </NavLink>
          <NavLink to="/chat" className={({ isActive }) => (isActive ? 'active' : '')}>
            Chat
          </NavLink>
          <NavLink to="/notes" className={({ isActive }) => (isActive ? 'active' : '')}>
            Notes
          </NavLink>
          <NavLink to="/agent" className={({ isActive }) => (isActive ? 'active' : '')}>
            AI Agent
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            Settings
          </NavLink>
        </nav>
        <button className="logout-button" onClick={logout}>
          Log out
        </button>
      </aside>
      <main className="content">{children}</main>
    </div>
  )
}

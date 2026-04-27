import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface AppShellProps {
  children: React.ReactNode
  username?: string | null
  avatarUrl?: string | null
  unreadNotifications?: number
  rightPanel?: React.ReactNode
}

export default function AppShell({
  children,
  username,
  avatarUrl,
  unreadNotifications,
  rightPanel,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <Sidebar username={username} />

      <div className="ml-60 flex flex-col min-h-screen">
        <TopBar
          avatarUrl={avatarUrl}
          username={username}
          unreadNotifications={unreadNotifications}
        />

        <div className="flex gap-6 px-6 py-6 max-w-5xl w-full mx-auto">
          {/* Main content */}
          <main className="flex-1 min-w-0">{children}</main>

          {/* Right panel */}
          {rightPanel && (
            <aside className="w-72 shrink-0 hidden lg:block">
              {rightPanel}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}

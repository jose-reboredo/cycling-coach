import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { Dashboard } from '../pages/Dashboard';
import { BottomNav } from '../components/BottomNav/BottomNav';
import { useTabsEnabled } from '../lib/featureFlags';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: () => {
    // When the tabs flag is on, redirect bare /dashboard to /dashboard/today.
    // read() is safe to call here (no React context needed).
    const raw =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('cc_tabsEnabled')
        : null;
    const tabsEnabled = raw === 'true';
    if (tabsEnabled) {
      throw redirect({ to: '/dashboard/today' });
    }
  },
  component: DashboardRoute,
});

function DashboardRoute() {
  const tabsEnabled = useTabsEnabled();

  if (!tabsEnabled) {
    return <Dashboard />;
  }

  // Flag is on — render the Outlet shell so sub-routes render below BottomNav.
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}

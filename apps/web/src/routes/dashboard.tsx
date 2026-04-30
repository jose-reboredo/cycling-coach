import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { Dashboard } from '../pages/Dashboard';
import { BottomNav } from '../components/BottomNav/BottomNav';
import { computeTabsEnabled, useTabsEnabled } from '../lib/featureFlags';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: () => {
    // v9.3.1 — viewport-aware: mobile default ON, desktop default OFF,
    // localStorage override wins in both directions. Mirrors useTabsEnabled().
    if (computeTabsEnabled()) {
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

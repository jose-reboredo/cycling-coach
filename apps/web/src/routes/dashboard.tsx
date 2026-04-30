import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { Dashboard } from '../pages/Dashboard';
import { BottomNav } from '../components/BottomNav/BottomNav';
import { computeTabsEnabled, useTabsEnabled } from '../lib/featureFlags';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ location }) => {
    // v9.3.2 fix — only redirect bare /dashboard, NOT sub-routes. Parent
    // beforeLoad fires on every nested navigation in Tanstack Router; without
    // the pathname guard, navigating to /dashboard/today re-triggers another
    // redirect to /dashboard/today → infinite loop, JS thread blocked, React
    // never mounts, page renders blank. That was the v9.3.1 prod regression.
    if (location.pathname === '/dashboard' && computeTabsEnabled()) {
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

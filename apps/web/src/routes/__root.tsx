import { Outlet, createRootRoute } from '@tanstack/react-router';
import { AppFooter } from '../components/AppFooter/AppFooter';
import { AppContextProvider } from '../lib/AppContext';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <AppContextProvider>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Outlet />
      <AppFooter />
    </AppContextProvider>
  );
}

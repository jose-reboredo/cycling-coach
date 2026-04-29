import { Outlet, createRootRoute } from '@tanstack/react-router';
import { AppFooter } from '../components/AppFooter/AppFooter';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Outlet />
      <AppFooter />
    </>
  );
}

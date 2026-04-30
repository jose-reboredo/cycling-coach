import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/rides')({
  component: RidesTab,
});

function RidesTab() {
  return <div style={{ padding: '2rem' }}>Rides tab — content moves here in sub-task B</div>;
}

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/you')({
  component: YouTab,
});

function YouTab() {
  return <div style={{ padding: '2rem' }}>You tab — content moves here in sub-task B</div>;
}

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/today')({
  component: TodayTab,
});

function TodayTab() {
  return <div style={{ padding: '2rem' }}>Today tab — content moves here in sub-task B</div>;
}

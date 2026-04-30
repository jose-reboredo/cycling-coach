import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/train')({
  component: TrainTab,
});

function TrainTab() {
  return <div style={{ padding: '2rem' }}>Train tab — content moves here in sub-task B</div>;
}

import { createFileRoute } from '@tanstack/react-router';
import { WhatsNext } from '../pages/WhatsNext';

export const Route = createFileRoute('/whats-next')({
  component: WhatsNext,
});

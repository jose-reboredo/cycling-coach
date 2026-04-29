import { createFileRoute } from '@tanstack/react-router';
import { JoinClub } from '../pages/JoinClub';

export const Route = createFileRoute('/join/$code')({
  component: JoinRoute,
});

function JoinRoute() {
  const { code } = Route.useParams();
  return <JoinClub code={code} />;
}

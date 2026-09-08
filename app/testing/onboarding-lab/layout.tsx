import { notFound } from 'next/navigation';
import '../../helm-design.css';
import '../../helm-terminal-details.css';

// Design lab. Same guard as /testing: never reachable in production.
export default function OnboardingLabLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <div className="helm-platform helm-terminal" data-helm-page="testing" data-helm-route="onboarding-lab">{children}</div>;
}

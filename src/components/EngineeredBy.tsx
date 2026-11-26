import SiteLink from './SiteLink';
import { hubHomeLink, isStandalone } from '../utils/site';

/**
 * The one quiet credit that lives inside the standalone tools. It is deliberately
 * small and plain: the tools should feel like products, with the hub one click away.
 */
export default function EngineeredBy({ className = '' }: { className?: string }) {
  const hub = hubHomeLink();
  // A standalone site with no hub URL configured has nothing to link to, so the credit is plain text.
  if (isStandalone && !hub.external) {
    return (
      <p className={`text-[11px] opacity-70 ${className}`} data-testid="engineered-by">
        Engineered by Farai — Custom Edge Vision &amp; AI Engineering
      </p>
    );
  }
  return (
    <p className={`text-[11px] ${className}`} data-testid="engineered-by">
      <SiteLink to={hub} className="underline-offset-2 hover:underline opacity-70 hover:opacity-100">
        Engineered by Farai — Custom Edge Vision &amp; AI Engineering
      </SiteLink>
    </p>
  );
}

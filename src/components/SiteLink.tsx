import type { ReactNode, AnchorHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import type { ToolLink } from '../utils/appMode';

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: ToolLink;
  children: ReactNode;
}

/** A link that is a router Link inside this site and a plain anchor when it points at another domain. */
export default function SiteLink({ to, children, ...rest }: Props) {
  if (to.external) {
    return (
      <a href={to.href} rel="noopener" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to.href} {...(rest as any)}>
      {children}
    </Link>
  );
}

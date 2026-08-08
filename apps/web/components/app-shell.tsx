import { BarChart3, Compass, MessageSquareText, Plus, Target } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "./brand-mark";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="product-shell">
      <aside className="product-nav">
        <Link className="product-wordmark" href="/campaigns">
          <BrandMark /> <span>motiongrid</span>
        </Link>
        <nav aria-label="Workspace navigation" className="product-nav-links">
          <Link className="is-active" href="/campaigns"><Compass size={17} /> Campaigns</Link>
          <span><Target size={17} /> Targets</span>
          <span><MessageSquareText size={17} /> Approvals</span>
          <span><BarChart3 size={17} /> Outcomes</span>
        </nav>
        <Link className="new-campaign-link" href="/campaigns/new"><Plus size={16} /> New campaign</Link>
        <div className="connection-note"><i /> Systems ready</div>
      </aside>
      <main className="product-main">{children}</main>
    </div>
  );
}

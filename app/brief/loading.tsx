import { SiteNav } from '@/components/site-nav';
import { AnalysisLoadingTerminal } from '@/components/analysis-loading-terminal';

export default function BriefLoading() {
  return <div className="helm-public-loading"><SiteNav /><main id="main-content"><AnalysisLoadingTerminal title="Opening the daily brief." description="A written perspective on the market, with the developments worth a closer look. Your brief will appear here when it’s ready." /></main></div>;
}

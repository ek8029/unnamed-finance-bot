import { SiteNav } from '@/components/site-nav';
import { AnalysisLoadingTerminal } from '@/components/analysis-loading-terminal';

export default function CompareLoading() {
  return <div className="helm-public-loading"><SiteNav /><main id="main-content"><AnalysisLoadingTerminal /></main></div>;
}

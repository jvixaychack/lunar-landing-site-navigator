import { useState } from 'react';
import { GitCompareArrows, Layers } from 'lucide-react';
import { CompareView } from './CompareView';
import { MultiCompareView } from './MultiCompareView';
import type { ComponentProps } from 'react';

type CompareHubProps = ComponentProps<typeof CompareView>;
type Tab = 'pair' | 'multi';

/** Wraps the two compare views behind a tab switch. */
export function CompareHub(props: CompareHubProps) {
  const [tab, setTab] = useState<Tab>('pair');

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 border-b-2 pb-1.5 text-sm font-medium transition-colors ${
      active ? 'border-slate-100 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
    }`;

  return (
    <div className="flex h-full flex-col gap-2">
      <div
        className="flex w-fit items-center gap-5 px-1"
        role="group"
        aria-label="Comparison view"
      >
        <button type="button" onClick={() => setTab('pair')} className={tabClass(tab === 'pair')}>
          <GitCompareArrows className="h-3.5 w-3.5" />
          Two sites
        </button>
        <button type="button" onClick={() => setTab('multi')} className={tabClass(tab === 'multi')}>
          <Layers className="h-3.5 w-3.5" />
          Multi-scenario
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'pair' ? <CompareView {...props} /> : <MultiCompareView {...props} />}
      </div>
    </div>
  );
}

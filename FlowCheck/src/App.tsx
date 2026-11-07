import { useEffect, useMemo, useRef, useState } from 'react';
import type { Appetite, Brief, DataBundle, Match, Profile } from './types.ts';
import { loadData } from './data.ts';
import { WardMap } from './WardMap.tsx';
import { evidenceBrief, matchAreas, thresholds, validateProfile } from './matching.ts';

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const exactGBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);
const compactGBP = (n: number) => n >= 1e6 ? `£${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2)}m` : `£${Math.round(n / 1000)}k`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('en-GB')}`;
const DEFAULT: Profile = { capital: 1000000, appetite: 'balanced', works_allowance: 50000, reserve_percent: 10, homes: 1, focus: 'growth' };
const SHORT_NAMES: Record<string, string> = { 'Barking and Dagenham': 'Barking & Dagenham', 'Hammersmith and Fulham': 'Hammersmith & Fulham', 'Kensington and Chelsea': 'Kensington & Chelsea', 'Richmond upon Thames': 'Richmond', 'Kingston upon Thames': 'Kingston' };
const nameOf = (name: string) => SHORT_NAMES[name] || name;
const bandName: Record<Appetite, string> = { conservative: 'Lower variability', balanced: 'Middle variability', ambitious: 'Higher variability' };

type IconName = 'building' | 'explore' | 'bookmark' | 'book' | 'arrow' | 'download' | 'close' | 'chevron' | 'shield' | 'balance' | 'rise' | 'search' | 'check' | 'info' | 'spark' | 'map' | 'table' | 'plus' | 'minus' | 'people' | 'home' | 'external' | 'copy' | 'reset';
function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    building: <><path d="M4 21V9h7V3h9v18M2 21h20M7 12v2m0 3v2m8-12h2m-2 4h2m-2 4h2" /></>,
    explore: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    bookmark: <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z"/>,
    book: <><path d="M3 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H3V4Zm18 0h-6a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h5V4Z"/></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>, download: <><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>, chevron: <path d="m8 5 7 7-7 7"/>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
    balance: <><path d="M5 5v14m7-14v14m7-14v14"/><path d="M2 9h6m1 6h6m1-8h6"/></>,
    rise: <path d="m3 17 6-6 4 4 8-10m-6 0h6v6"/>, search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    check: <path d="m5 12 4 4L19 6"/>, info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"/></>,
    table: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 10v10"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, minus: <path d="M5 12h14"/>,
    people: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/></>,
    home: <><path d="m3 10 9-7 9 7M5 9v12h14V9m-10 12v-7h6v7"/></>,
    external: <path d="M14 3h7v7m0-7L10 14M9 3H3v18h18v-6"/>,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
    reset: <><path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{paths[name]}</svg>;
}

function mapCenter(path: string): [number, number] {
  const values = [...path.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
  return [(Math.min(...values.map(v => v[0])) + Math.max(...values.map(v => v[0]))) / 2, (Math.min(...values.map(v => v[1])) + Math.max(...values.map(v => v[1]))) / 2];
}

function investigation(area: Match): { title: string; text: string } {
  if (area.population_change_2024_25_midyear > 0 && area.hdt_2025_pct < 95) return { title: 'Investigate delivery constraints', text: 'Population grew while delivery was below its requirement. Check permissions, starts and completions before choosing an intervention.' };
  if (area.internal_net_2024_25_midyear < 0) return { title: 'Understand household needs', text: 'Domestic outflows change the migration picture. Check household formation, affordability and which empty homes could return to use.' };
  return { title: 'Check property-level feasibility', text: 'Use the area evidence to guide a site visit, then verify the price, condition, household needs and deliverable housing outcome.' };
}

function sourceLink(url: string, label: string) { return <a href={url} target="_blank" rel="noreferrer">{label}<Icon name="external" size={13}/></a>; }

export function App() {
  const [bundle, setBundle] = useState<DataBundle | null>(null);
  const [loadingError, setLoadingError] = useState('');
  const [profile, setProfile] = useState<Profile>(DEFAULT);
  const [capitalInput, setCapitalInput] = useState('1,000,000');
  const [selectedCode, setSelectedCode] = useState('E09000016');
  const [drilldownCode, setDrilldownCode] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'map' | 'table'>('map');
  const [section, setSection] = useState<'explore' | 'saved'>('explore');
  const [saved, setSaved] = useState<string[]>(() => { try { const v = JSON.parse(localStorage.getItem('flowcheck-saved') || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; } });
  const [modal, setModal] = useState<'method' | 'research' | 'brief' | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => { let live = true; loadData().then(data => { if (live) { setBundle(data); setProfile(data.policy.default_profile); setCapitalInput(data.policy.default_profile.capital.toLocaleString('en-GB')); } }).catch(e => { if (live) setLoadingError(e.message); }); return () => { live = false; }; }, []);
  useEffect(() => { try { localStorage.setItem('flowcheck-saved', JSON.stringify(saved)); } catch { /* Browser storage can be disabled; the current session remains usable. */ } }, [saved]);
  useEffect(() => { if (modal && dialog.current && !dialog.current.open) dialog.current.showModal(); if (!modal && dialog.current?.open) dialog.current.close(); }, [modal]);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(''), 4000); return () => window.clearTimeout(id); }, [notice]);

  const issue = validateProfile(profile);
  const results = useMemo(() => bundle && !issue ? matchAreas(bundle.areas, profile, bundle.policy) : [], [bundle, profile, issue]);
  const caps = useMemo(() => bundle ? thresholds(bundle.areas, bundle.policy) : null, [bundle]);
  const visible = results.filter(a => a.borough.toLowerCase().includes(query.trim().toLowerCase()) && (section !== 'saved' || saved.includes(a.code)));
  const matching = visible.filter(a => a.matches);
  const visibleCodes = new Set(visible.map(a => a.code));
  const selected = results.find(a => a.code === selectedCode) || results.find(a => a.matches) || results[0];
  const hoveredArea = results.find(a => a.code === hovered);
  const cheapest = matching.length ? Math.min(...matching.map(a => a.required_capital)) : null;
  const drilldown = drilldownCode ? bundle?.wards.boroughs[drilldownCode] : null;

  function openBorough(code: string) {
    setSelectedCode(code);
    setDrilldownCode(code);
    setHovered(null);
    setView('map');
  }
  function returnToLondon() {
    const code = drilldownCode;
    setDrilldownCode(null);
    requestAnimationFrame(() => document.getElementById(`borough-${code}`)?.focus({ preventScroll: true }));
  }

  function changeProfile(patch: Partial<Profile>) {
    const next = { ...profile, ...patch };
    setProfile(next);
    if ('capital' in patch) setCapitalInput(Number.isFinite(next.capital) ? next.capital.toLocaleString('en-GB') : '');
    if (bundle && !validateProfile(next) && !drilldownCode) {
      const nextResults = matchAreas(bundle.areas, next, bundle.policy);
      if (!nextResults.find(a => a.code === selectedCode)?.matches) setSelectedCode(nextResults.find(a => a.matches)?.code || selectedCode);
    }
  }
  function toggleSaved(code: string) { setSaved(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]); }
  function exportShortlist() {
    const headings = ['borough', 'area_code', 'capital_gbp', 'appetite', 'target_homes', 'works_allowance_per_home_gbp', 'reserve_percent', 'indicative_capital_gbp', 'capital_headroom_gbp', 'march_2025_average_price_gbp', 'historical_annualised_volatility_pct', 'historical_max_drawdown_pct', 'population_change_year_to_mid2025', 'hdt_2025_percent', 'net_dwellings_fy2024_25', 'longterm_empty_6oct2025'];
    const rows = matching.map(a => [a.borough, a.code, profile.capital, profile.appetite, profile.homes, profile.works_allowance, profile.reserve_percent, a.required_capital, a.capital_headroom, a.average_price_gbp, a.historical_annualized_index_volatility_36m_pct, a.historical_max_drawdown_36m_pct, a.population_change_2024_25_midyear, a.hdt_2025_pct, a.net_additions_fy2024_25, a.longterm_empty_2025_10_06]);
    const csv = [headings, ...rows].map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'FlowCheck_shortlist_2025.csv'; anchor.click(); URL.revokeObjectURL(url);
    setNotice(`Exported ${matching.length} matching ${matching.length === 1 ? 'area' : 'areas'}.`);
  }
  async function createBrief() {
    if (!selected) return;
    const baseline = evidenceBrief(selected, profile);
    setBrief(baseline); setModal('brief');
    const configuredBase = import.meta.env.VITE_API_BASE_URL;
    if (!configuredBase) return;
    const apiBase = configuredBase.replace(/\/$/, '');
    setBriefBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/brief`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: selected.code, profile }), signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Brief service unavailable');
      const generated = await response.json();
      if (typeof generated.summary !== 'string' || !Array.isArray(generated.next_steps) || !Array.isArray(generated.source_ids)) throw new Error('Invalid brief response');
      setBrief(generated);
    } catch { setNotice('The brief service is unavailable. Your source-based evidence brief is ready.'); }
    finally { setBriefBusy(false); }
  }
  async function copyBrief() {
    if (!brief) return;
    const text = `${brief.title}\n\n${brief.summary}\n\nNext steps\n${brief.next_steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n${brief.caveat}\n\nSource snapshot: March 2025 prices; year to mid-2025 migration; 2025 HDT; October 2025 vacancies.`;
    try { await navigator.clipboard.writeText(text); setNotice('Evidence brief copied.'); } catch { setNotice('Select the brief text to copy it in this browser.'); }
  }

  if (loadingError) return <main className="loading-screen"><div className="brand-mark"><Icon name="building" size={30}/></div><h1>The evidence could not load</h1><p>{loadingError}</p><button className="button primary" onClick={() => location.reload()}>Try again</button></main>;
  if (!bundle || !caps) return <main className="loading-screen"><div className="brand-mark"><Icon name="building" size={30}/></div><h1>FlowCheck</h1><p>Preparing your London evidence…</p><span className="loading-line"/></main>;

  return <>
    <a className="skip-link" href="#main-content">Skip to the explorer</a>
    <aside className="rail" aria-label="Main navigation">
      <button className="brand-mark" aria-label="FlowCheck home" onClick={() => { setSection('explore'); setDrilldownCode(null); }}><Icon name="building" size={26}/></button>
      <nav>
        <button className={`rail-link ${section === 'explore' ? 'active' : ''}`} onClick={() => { setSection('explore'); setDrilldownCode(null); }} aria-current={section === 'explore' ? 'page' : undefined}><Icon name="explore"/><span>Explore</span></button>
        <button className={`rail-link ${section === 'saved' ? 'active' : ''}`} onClick={() => { setSection('saved'); setDrilldownCode(null); }} aria-current={section === 'saved' ? 'page' : undefined}><Icon name="bookmark"/><span>Saved</span>{saved.length > 0 && <i className="nav-count">{saved.length}</i>}</button>
        <button className="rail-link" onClick={() => setModal('research')}><Icon name="book"/><span>Research</span></button>
      </nav>
      <button className="rail-help" onClick={() => setModal('method')} aria-label="How FlowCheck works"><Icon name="info"/></button>
      <div className="rail-footer">FC<span>London</span></div>
    </aside>

    <div className="app-shell">
      <header className="topbar">
        <div className="wordmark">FlowCheck<span className="wordmark-divider"/><span className="product-label">Housing explorer</span></div>
        <div className="topbar-actions"><span className="snapshot-pill"><span/>2025 evidence snapshot</span><button className="button subtle" onClick={() => setModal('method')}><Icon name="book" size={16}/>Sources & method</button><button className="button outline export-button" onClick={exportShortlist} disabled={!matching.length}><Icon name="download" size={16}/>Export shortlist</button></div>
      </header>
      <nav className="mobile-navigation" aria-label="Mobile navigation"><button className={section === 'explore' ? 'active' : ''} onClick={() => { setSection('explore'); setDrilldownCode(null); }}><Icon name="explore" size={15}/>Explore</button><button className={section === 'saved' ? 'active' : ''} onClick={() => { setSection('saved'); setDrilldownCode(null); }}><Icon name="bookmark" size={15}/>Saved{saved.length > 0 ? ` (${saved.length})` : ''}</button><button onClick={() => setModal('research')}><Icon name="book" size={15}/>Research</button></nav>
      <main id="main-content" className="page">
        <div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/>LONDON · 33 LOCAL AUTHORITIES</div><h1>{section === 'saved' ? 'Your saved areas.' : 'Find your fit in London.'}</h1><p>Match your capital and appetite with the evidence behind each area.</p></div><div className="coverage-note"><Icon name="shield" size={19}/><div><strong>Official sources. Clear assumptions.</strong><span>Prices, migration, delivery and empty homes</span></div></div></div>

        <div className="workbench">
          <section className="panel brief-panel" aria-labelledby="brief-heading">
            <div className="panel-eyebrow">YOUR INVESTMENT BRIEF</div><h2 id="brief-heading">Set your parameters</h2><p className="muted small">Your shortlist updates as you explore.</p>
            <label className="field-label" htmlFor="capital">Available capital</label>
            <div className={`capital-field ${issue && !Number.isFinite(profile.capital) ? 'invalid' : ''}`}><span>£</span><input id="capital" inputMode="decimal" autoComplete="off" aria-describedby={issue ? 'capital-note profile-error' : 'capital-note'} aria-invalid={issue && (!Number.isFinite(profile.capital) || profile.capital <= 0) ? true : undefined} value={capitalInput} onChange={e => { const raw = e.target.value; setCapitalInput(raw); setProfile(p => ({ ...p, capital: raw.trim() === '' ? NaN : Number(raw.replace(/[,£\s]/g, '')) })); }} onBlur={() => { if (Number.isFinite(profile.capital)) { setCapitalInput(profile.capital.toLocaleString('en-GB')); changeProfile({ capital: profile.capital }); } }} /></div>
            <div className="capital-presets">{[250000, 500000, 1000000, 2000000].map(value => <button key={value} className={profile.capital === value ? 'selected' : ''} onClick={() => changeProfile({ capital: value })}>{compactGBP(value)}</button>)}</div>
            <p className="field-note" id="capital-note">Cash-only area benchmark. No borrowing assumed.</p>

            <div className="section-rule"/><div className="field-label-row"><span className="field-label">Risk appetite</span><button className="icon-button tiny" aria-label="Explain risk appetite" onClick={() => setModal('method')}><Icon name="info" size={15}/></button></div>
            <div className="appetite-options" role="group" aria-label="Risk appetite">
              {(['conservative', 'balanced', 'ambitious'] as Appetite[]).map(appetite => <button key={appetite} className={`appetite-option ${profile.appetite === appetite ? 'selected' : ''}`} aria-pressed={profile.appetite === appetite} onClick={() => changeProfile({ appetite })}><span className="appetite-icon"><Icon name={appetite === 'conservative' ? 'shield' : appetite === 'balanced' ? 'balance' : 'rise'} size={19}/></span><span><strong>{bundle.policy.appetites[appetite].label}</strong><small>{appetite === 'conservative' ? '0–5% variability · 16 areas' : appetite === 'balanced' ? 'Above 5–15% variability · 16 areas' : '15% or higher · 1 area'}</small></span><span className="radio-dot">{profile.appetite === appetite && <span/>}</span></button>)}
            </div>
            <p className="field-note risk-note">Based on historical price-index variability, not predicted investment returns.</p>
            <div className="section-rule"/>
            <label className="field-label" htmlFor="focus">Prioritise evidence</label><div className="select-wrap"><select id="focus" value={profile.focus} onChange={e => changeProfile({ focus: e.target.value as Profile['focus'] })}><option value="growth">Growing population</option><option value="vacancy">Recorded empty homes</option><option value="delivery">Housing delivery shortfall</option></select><Icon name="chevron" size={14}/></div>
            <details className="assumptions"><summary>Budget assumptions<Icon name="plus" size={16}/></summary><div className="assumption-fields"><label htmlFor="homes">Target homes<input id="homes" type="number" min="1" max="1000" step="1" value={profile.homes} onChange={e => changeProfile({ homes: Number(e.target.value) })}/></label><label htmlFor="works">Works allowance / home (£)<input id="works" type="number" min="0" max="100000000" step="5000" value={profile.works_allowance} onChange={e => changeProfile({ works_allowance: Number(e.target.value) })}/></label><label htmlFor="reserve">Reserve (%)<input id="reserve" type="number" min="0" max="100" step="1" value={profile.reserve_percent} onChange={e => changeProfile({ reserve_percent: Number(e.target.value) })}/></label></div><p className="field-note">Editable assumptions, not quotes. Taxes, fees and finance need a property-specific budget.</p></details>
            <div className="brief-bottom"><span className="small muted">{profile.homes} {profile.homes === 1 ? 'home' : 'homes'} · {GBP.format(profile.works_allowance || 0)} works/home · {profile.reserve_percent}% reserve</span><button className="reset-link" onClick={() => { changeProfile(bundle.policy.default_profile); setQuery(''); setDrilldownCode(null); }}><Icon name="reset" size={13}/>Reset brief</button></div>
            {issue && <p className="form-error" id="profile-error" role="alert">{issue}</p>}
          </section>

          <section className="panel map-panel" aria-labelledby="map-heading">
            <div className="map-header"><div><div className="panel-eyebrow">{drilldown ? 'BOROUGH DETAIL' : 'AREA MATCHES'}</div><h2 id="map-heading">{drilldown ? drilldown.name : 'London, at a glance'}</h2></div><div className="view-toggle" role="group" aria-label="Results view"><button className={view === 'map' ? 'selected' : ''} aria-pressed={view === 'map'} onClick={() => setView('map')}><Icon name="map" size={15}/>Map</button><button className={view === 'table' ? 'selected' : ''} aria-pressed={view === 'table'} onClick={() => { setView('table'); setDrilldownCode(null); }}><Icon name="table" size={15}/>List</button></div></div>
            <div className="map-summary" aria-live="polite"><div><strong>{matching.length}</strong><span>areas match your brief</span></div><div><strong>{cheapest === null ? '—' : compactGBP(cheapest)}</strong><span>lowest capital reference</span></div><div><strong>{caps[profile.appetite].toFixed(2)}<small>%</small></strong><span>historical variability cap</span></div></div>
            {!drilldown && <div className="map-search"><Icon name="search" size={16}/><input aria-label="Search boroughs" placeholder="Search a borough…" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button className="icon-button tiny" aria-label="Clear borough search" onClick={() => setQuery('')}><Icon name="close" size={14}/></button>}</div>}
            {view === 'map' ? (drilldown ? <WardMap key={drilldown.code} group={drilldown} onBack={returnToLondon}/> : <div className="map-stage">
              <div className="map-grid"/>
              <svg className="borough-map" viewBox={bundle.boundaries.viewBox} aria-label="London borough map. Select a borough to zoom in and explore its districts.">
                <defs><filter id="map-shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#244d40" floodOpacity=".08"/></filter></defs>
                <g filter="url(#map-shadow)">{results.map(area => <path id={`borough-${area.code}`} key={area.code} d={bundle.boundaries.boroughs[area.code].path} fillRule="evenodd" className={`borough ${area.matches ? 'match' : !area.budget_fits ? 'budget-out' : 'risk-out'} ${area.code === selected?.code ? 'selected' : ''} ${visibleCodes.has(area.code) ? '' : 'dimmed'}`} role="button" tabIndex={visibleCodes.has(area.code) ? 0 : -1} aria-label={`${area.borough}: ${area.matches ? 'matches' : area.exclusion_reasons.join('; ')}; capital reference ${GBP.format(area.required_capital)}`} aria-pressed={area.code === selected?.code} onClick={() => openBorough(area.code)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBorough(area.code); } }} onMouseEnter={() => setHovered(area.code)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(area.code)} onBlur={() => setHovered(null)}><title>{area.borough} · {GBP.format(area.required_capital)} · {area.historical_annualized_index_volatility_36m_pct.toFixed(2)}% historical variability</title></path>)}</g>
                {['E09000016', 'E09000002', 'E09000008', 'E09000003', 'E09000006', 'E09000017', 'E09000009', 'E09000025', 'E09000032', 'E09000027'].map(code => { const area = results.find(a => a.code === code); if (!area) return null; const [x, y] = mapCenter(bundle.boundaries.boroughs[code].path); const label = code === 'E09000002' ? ['Barking &', 'Dagenham'] : [nameOf(area.borough)]; return <text key={code} x={x} y={y} className={`map-label ${selected?.code === code && area.matches ? 'selected' : ''}`} textAnchor="middle" pointerEvents="none">{label.map((line, i) => <tspan x={x} dy={i === 0 ? 0 : 14} key={line}>{line}</tspan>)}</text>; })}
              </svg>
              <div className="north-marker"><span>N</span><svg viewBox="0 0 20 28" width="16" height="23" aria-hidden="true"><path d="m10 1 7 23-7-5-7 5Z" fill="currentColor"/><path d="M10 1v18l7 5Z" fill="#b2c1b4"/></svg></div>
              <div className="map-location"><span/>GREATER LONDON</div>
              {hoveredArea && <div className="map-tooltip" aria-live="polite"><strong>{hoveredArea.borough}</strong><span>{GBP.format(hoveredArea.required_capital)} capital reference</span><small>{hoveredArea.matches ? 'Fits capital and appetite' : hoveredArea.exclusion_reasons.join(' · ')}</small></div>}
              {!matching.length && <div className="map-empty"><Icon name={section === 'saved' && !saved.length ? 'bookmark' : 'search'} size={24}/><strong>{issue ? 'Check your parameters' : section === 'saved' && !saved.length ? 'Your saved areas will appear here' : 'No areas match this brief'}</strong><span>{issue ? 'Enter valid values to update the map.' : section === 'saved' && !saved.length ? 'Save an area using its bookmark button.' : 'Try a different capital amount, appetite or search.'}</span></div>}
            </div>) : <div className="results-table-wrap"><table className="results-table"><thead><tr><th>Borough</th><th>Capital reference</th><th>Variability</th><th>Fit</th></tr></thead><tbody>{visible.map(area => <tr key={area.code} className={area.code === selected?.code ? 'selected' : ''}><td><button onClick={() => openBorough(area.code)}>{nameOf(area.borough)}</button></td><td>{compactGBP(area.required_capital)}</td><td>{area.historical_annualized_index_volatility_36m_pct.toFixed(2)}%</td><td>{area.matches ? <span className="table-match"><Icon name="check" size={13}/>Match</span> : <span className="table-out">{!area.budget_fits ? 'Budget' : 'Appetite'}</span>}</td></tr>)}</tbody></table>{!visible.length && <p className="table-empty">No areas in this view. Clear your search or save a borough.</p>}</div>}
            <div className="map-footer">{drilldown ? <div className="legend"><span><i className="legend-ward"/>District boundaries</span><span><i className="legend-ward-selected"/>Selected district</span></div> : <div className="legend"><span><i className="legend-match"/>Matches</span><span><i className="legend-budget"/>Outside capital</span><span><i className="legend-risk"/>Outside appetite</span></div>}<span className="map-caption">{drilldown ? '2025 wards · GLA' : 'Click a borough to explore districts'}</span></div>
          </section>

          <aside className="panel detail-panel" aria-label="Selected borough evidence">
            {selected ? <><div className="detail-topline"><span className="panel-eyebrow">AREA SPOTLIGHT</span><button className={`icon-button save-button ${saved.includes(selected.code) ? 'saved' : ''}`} aria-label={saved.includes(selected.code) ? `Remove ${selected.borough} from saved areas` : `Save ${selected.borough}`} aria-pressed={saved.includes(selected.code)} onClick={() => toggleSaved(selected.code)}><Icon name="bookmark" size={18}/></button></div><h2 className="area-name">{nameOf(selected.borough)}</h2><span className={`fit-badge ${selected.matches ? 'fits' : 'outside'}`}><Icon name={selected.matches ? 'check' : 'info'} size={13}/>{selected.matches ? 'Matches your brief' : 'Outside your brief'}</span>
            {!selected.matches && <div className="exclusion-note">{selected.exclusion_reasons.map(reason => <span key={reason}>{reason}</span>)}</div>}
            <div className="capital-receipt"><span>Indicative capital · {profile.homes} {profile.homes === 1 ? 'home' : 'homes'}</span><strong>{exactGBP(selected.required_capital)}</strong><div className="headroom">{selected.budget_fits ? <><Icon name="check" size={13}/>{exactGBP(selected.capital_headroom)} below your capital</> : <>{exactGBP(selected.budget_gap)} above your capital</>}</div><details><summary>See the calculation<Icon name="chevron" size={12}/></summary><dl><div><dt>Borough price reference</dt><dd>{GBP.format(selected.average_price_gbp)}</dd></div><div><dt>Works / home</dt><dd>+ {GBP.format(profile.works_allowance)}</dd></div><div><dt>Homes</dt><dd>× {profile.homes}</dd></div><div><dt>Reserve</dt><dd>+ {profile.reserve_percent}%</dd></div></dl><p>March 2025 average. Separate property taxes, fees and finance are not calculated.</p></details></div>
            <div className="variability-row"><div><span>Historical price variability</span><strong>{selected.historical_annualized_index_volatility_36m_pct.toFixed(2)}<small>%</small></strong></div><span className={`risk-tag ${selected.risk_band}`}>{bandName[selected.risk_band]}</span></div><div className="risk-meter"><span className={selected.risk_band === 'conservative' ? 'current' : ''}/><span className={selected.risk_band === 'balanced' ? 'current' : ''}/><span className={selected.risk_band === 'ambitious' ? 'current' : ''}/></div><p className="micro muted">36 monthly HPI changes · Apr 2022–Mar 2025</p>
            <div className="evidence-metrics"><div><span><Icon name="people" size={15}/>Population change</span><strong>{signed(selected.population_change_2024_25_midyear)}</strong><small>Year to mid-2025 · people</small></div><div><span><Icon name="building" size={15}/>Housing delivery</span><strong>{selected.hdt_2025_pct}<small>%</small></strong><small>2025 HDT · three-year requirement</small></div><div><span><Icon name="home" size={15}/>Long-term empty</span><strong>{selected.longterm_empty_2025_10_06.toLocaleString('en-GB')}</strong><small>6 Oct 2025 · recorded dwellings</small></div></div>
            <div className="next-investigation"><span className="tiny-eyebrow">WHAT TO INVESTIGATE</span><strong>{investigation(selected).title}</strong><p>{investigation(selected).text}</p></div><button className="button primary brief-cta" onClick={createBrief}><Icon name="spark" size={17}/>Create evidence brief<Icon name="arrow" size={16}/></button><button className="text-button area-sources" onClick={() => setModal('method')}>View sources and limitations<Icon name="external" size={12}/></button></> : <div className="no-selection"><Icon name="map" size={30}/><h2>Select an area</h2><p>Enter valid parameters, then choose a borough on the map.</p></div>}
          </aside>
        </div>

        <section className="shortlist-section" aria-labelledby="shortlist-heading"><div className="shortlist-heading"><div><div className="panel-eyebrow">YOUR SHORTLIST</div><h2 id="shortlist-heading">{section === 'saved' ? 'Saved areas that fit' : 'Start with these areas'}</h2></div><span className="muted small">Sorted by {profile.focus === 'growth' ? 'population growth' : profile.focus === 'vacancy' ? 'recorded empty homes' : 'delivery shortfall'} · no return forecast</span></div><div className="area-cards">{matching.slice(0, 4).map((area, index) => <article className={`area-card ${selected?.code === area.code ? 'selected' : ''}`} key={area.code}><div className="area-card-top"><span className="rank-number">0{index + 1}</span><span className={`small-band ${area.risk_band}`}>{bandName[area.risk_band]}</span><button className={`icon-button ${saved.includes(area.code) ? 'saved' : ''}`} aria-label={saved.includes(area.code) ? `Unsave ${area.borough}` : `Save ${area.borough}`} aria-pressed={saved.includes(area.code)} onClick={() => toggleSaved(area.code)}><Icon name="bookmark" size={16}/></button></div><button className="card-select" onClick={() => openBorough(area.code)}><h3>{nameOf(area.borough)}</h3><p>{compactGBP(area.required_capital)}<span>capital reference</span></p><div className="card-bottom"><span>{profile.focus === 'vacancy' ? `${area.longterm_empty_2025_10_06.toLocaleString('en-GB')} recorded empty` : profile.focus === 'delivery' ? `${area.hdt_2025_pct}% housing delivery` : `${signed(area.population_change_2024_25_midyear)} population`}</span><Icon name="arrow" size={17}/></div></button></article>)}</div>{!matching.length && <div className="shortlist-empty"><strong>{section === 'saved' && !saved.length ? 'Build a shortlist as you explore.' : 'No matching areas yet.'}</strong><span>Adjust your brief to see suitable area benchmarks.</span></div>}</section>

        <section className="context-strip"><span className="context-icon"><Icon name="building" size={21}/></span><div><strong>Capital is one part of the housing story.</strong><p>London recorded £{bundle.evidence.london_fdi_context.net_inward_flow_gbp_billion_2024.toFixed(1)}bn in net inward FDI in 2024. Its contribution to borough housing delivery is not identified in these data.</p></div><button className="text-button" onClick={() => setModal('research')}>Read the research<Icon name="arrow" size={15}/></button></section>
        <footer className="page-footer"><span>FlowCheck · House London · Migration flows & investment</span><span>Historical area screen · No property availability or return forecast</span></footer>
      </main>
    </div>

    <dialog ref={dialog} className={`evidence-dialog ${modal === 'brief' ? 'brief-dialog' : ''}`} onCancel={() => setModal(null)} onClick={e => { if (e.target === dialog.current) { const rect = dialog.current.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) setModal(null); } }} aria-labelledby="dialog-title"><div className="dialog-top"><div className="panel-eyebrow">{modal === 'research' ? 'RESEARCH LIBRARY' : modal === 'brief' ? 'YOUR EVIDENCE BRIEF' : 'SOURCES & METHODOLOGY'}</div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close dialog"><Icon name="close"/></button></div>
      {modal === 'method' && <><h2 id="dialog-title">Know what your match means.</h2><p className="dialog-lead">A transparent, historical area screen. A match means the borough reference fits your cash assumptions and relative variability cap.</p><div className="method-grid"><section><h3>Capital</h3><p>{bundle.policy.capital_method}</p><p>{bundle.policy.allowance_note}</p></section><section><h3>Risk appetite</h3><p>{bundle.policy.risk_method}</p><div className="method-caps"><span>Conservative<strong>0–5%</strong></span><span>Balanced<strong>&gt;5–15%</strong></span><span>Ambitious<strong>≥15%</strong></span></div><p>Historical drawdown and variability are not a calibrated probability of loss. Property condition, financing, legal title and market liquidity are not scored.</p></section></div><h3>Official evidence and exact periods</h3><div className="source-list"><div><strong>UK House Price Index</strong><span>March 2025 prices · archived release, 21 May 2025. Variability uses Mar 2022–Mar 2025 index levels.</span>{sourceLink(String(bundle.market.metadata.landing_page_url), 'HM Land Registry / ONS')}</div>{['migration', 'hdt', 'housing_supply', 'vacancy', 'fdi_london'].map(id => { const s = bundle.evidence.sources[id]; return <div key={id}><strong>{id === 'migration' ? 'Population and migration' : id === 'hdt' ? 'Housing Delivery Test' : id === 'housing_supply' ? 'Net housing additions' : id === 'vacancy' ? 'Long-term empty dwellings' : 'Foreign direct investment'}</strong><span>{s.period}{s.sheet ? ` · ${s.sheet}` : ''}</span>{sourceLink(s.url, s.publisher)}</div>; })}<div><strong>London borough boundaries</strong><span>GLA / OS historical borough polygons, simplified for display.</span>{sourceLink(String(bundle.boundaries.metadata.service_url), 'GLA geometry service')}</div><div><strong>District / ward boundaries</strong><span>GLA London Wards (2025) · 704 wards in 33 boroughs. Names and parent codes are supplied by GLA; housing figures remain borough-level.</span>{sourceLink(bundle.wards.metadata.service_url, 'GLA ward geometry service')}</div></div><div className="method-important"><h3>Read the evidence together</h3><ul><li>People, households and dwellings are different units. Migration is not converted into homes needed.</li><li>Mid-year migration, financial-year delivery and October vacancies have different reference periods.</li><li>HDT measures delivery against a policy requirement; it is not an investment-risk measure.</li><li>Vacancy counts do not identify recoverable homes or overseas ownership. FDI is shown at London level only.</li><li>The City of London has a small residential base. Borough averages conceal neighbourhood and property-type differences.</li></ul></div><p className="micro">Contains HM Land Registry, ONS, MHCLG, GLA and Ordnance Survey public sector information under the Open Government Licence v3.0. Source retrieval: 7 November 2026.</p></>}
      {modal === 'research' && <><h2 id="dialog-title">Better questions. Better interventions.</h2><p className="dialog-lead">Research informs the investigation prompts. It does not establish which policy will work on a particular site or predict investment performance.</p><div className="research-list">{[
        { title: 'Remove binding supply constraints', author: 'Hilber & Vermeulen · 2016 · The Economic Journal', text: 'English evidence links restrictive planning to stronger house-price responses to earnings. Check whether the bottleneck is permission, infrastructure or delivery.', url: 'https://doi.org/10.1111/ecoj.12213' },
        { title: 'Check that permissions become homes', author: 'Greenaway-McGrevy & Phillips · 2023 · Journal of Urban Economics', text: 'Auckland research found an increase in permitted dwellings after extensive rezoning. Permits and completed, occupied homes remain different outcomes.', url: 'https://doi.org/10.1016/j.jue.2023.103555' },
        { title: 'Supply conditions change subsidy outcomes', author: 'Carozzi, Hilber & Yu · 2024 · Journal of Urban Economics', text: 'Help to Buy increased prices without a detectable construction increase in supply-constrained Greater London. Demand support alone need not unlock delivery.', url: 'https://doi.org/10.1016/j.jue.2023.103611' },
        { title: 'Investigate suitable empty homes', author: 'Segú · 2020 · Journal of Public Economics', text: 'A French vacancy-tax study estimated lower vacancy, concentrated in long-term vacancy. Its estimated effect is not a forecast for London.', url: 'https://doi.org/10.1016/j.jpubeco.2019.104079' },
        { title: 'Local context matters', author: 'Freemark · 2020 · Urban Affairs Review', text: 'A Chicago zoning study found no detectable increase in newly permitted dwellings over five years, highlighting that zoning reform is not automatically sufficient.', url: 'https://doi.org/10.1177/1078087418824672' },
      ].map((paper, index) => <article key={paper.title}><span className="research-number">0{index + 1}</span><div><h3>{paper.title}</h3><small>{paper.author}</small><p>{paper.text}</p>{sourceLink(paper.url, 'Read original study')}</div></article>)}</div></>}
      {modal === 'brief' && brief && <><h2 id="dialog-title">{brief.title}</h2><div className="brief-mode"><Icon name="spark" size={14}/>{briefBusy ? 'Preparing enhanced explanation…' : brief.mode === 'openai' ? 'AI-assisted explanation · source identifiers checked' : 'Source-based evidence template'}</div><p className="brief-summary">{brief.summary}</p><h3>What to investigate next</h3><ol className="brief-steps">{brief.next_steps.map(step => <li key={step}>{step}</li>)}</ol><div className="brief-caveat"><Icon name="info" size={17}/><p>{brief.caveat}</p></div><div className="brief-sources">{brief.source_ids.map(id => id === 'market' ? sourceLink(String(bundle.market.metadata.landing_page_url), 'UK HPI') : bundle.evidence.sources[id] ? sourceLink(bundle.evidence.sources[id].url, id === 'hdt' ? 'HDT' : id === 'migration' ? 'Migration' : 'Vacancy') : null)}</div><button className="button primary" onClick={copyBrief}><Icon name="copy" size={16}/>Copy brief</button></>}
    </dialog>
    {notice && <div className="toast" role="status"><Icon name="check" size={16}/>{notice}</div>}
  </>;
}

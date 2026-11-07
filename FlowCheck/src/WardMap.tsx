import { useEffect, useRef, useState } from 'react';
import type { WardGroup } from './types.ts';

type Props = { group: WardGroup; onBack: () => void };

export function WardMap({ group, onBack }: Props) {
  const [selectedCode, setSelectedCode] = useState('');
  const [hoveredCode, setHoveredCode] = useState('');
  const backButton = useRef<HTMLButtonElement>(null);
  const selected = group.wards.find(ward => ward.code === selectedCode);
  const highlighted = group.wards.find(ward => ward.code === (hoveredCode || selectedCode));
  useEffect(() => { backButton.current?.focus({ preventScroll: true }); }, []);

  function selectWard(code: string) {
    setSelectedCode(code);
    setHoveredCode('');
  }

  return <div className="ward-explorer" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onBack(); } }}>
    <div className="ward-toolbar">
      <button ref={backButton} className="ward-back" onClick={onBack} aria-label="Back to London borough map"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>Back to London</button>
      <span>{group.wards.length} districts <small>(wards)</small></span>
    </div>
    <div className="map-stage ward-stage">
      <div className="map-grid"/>
      <svg className="borough-map ward-map" viewBox={group.viewBox} role="group" aria-label={`${group.name} district map. Select a ward to see its name.`}>
        {group.wards.map((ward, index) => <g key={ward.code}>
          <path className={`ward-boundary ${ward.code === selectedCode ? 'selected' : ''} ${ward.code === hoveredCode ? 'hovered' : ''}`} d={ward.path} fillRule="evenodd" role="button" tabIndex={0} aria-label={`${ward.name}, district ${index + 1} in ${group.name}`} aria-pressed={ward.code === selectedCode} onClick={() => selectWard(ward.code)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectWard(ward.code); } }} onMouseEnter={() => setHoveredCode(ward.code)} onMouseLeave={() => setHoveredCode('')} onFocus={() => setHoveredCode(ward.code)} onBlur={() => setHoveredCode('')}><title>{`${index + 1}. ${ward.name} · ${ward.code}`}</title></path>
          <text x={ward.label[0]} y={ward.label[1]} textAnchor="middle" dominantBaseline="middle" className={`ward-label ${ward.code === selectedCode ? 'selected' : ''}`} pointerEvents="none">{ward.label_clearance >= 24 && ward.name.length <= 21 && group.code !== 'E09000001' ? ward.name : index + 1}</text>
        </g>)}
      </svg>
      {highlighted && <div className="map-tooltip ward-tooltip" aria-live="polite"><strong>{highlighted.name}</strong><span>{group.name} · {highlighted.code}</span><small>{highlighted.code === selectedCode ? 'Selected district' : 'Click to select this district'}</small></div>}
    </div>
    <div className="ward-selector">
      <label htmlFor="ward-select">Explore a district <span>Official electoral wards</span></label>
      <select id="ward-select" aria-label={`Choose a district in ${group.name}`} value={selectedCode} onChange={event => selectWard(event.target.value)}><option value="">Choose a district on the map or here…</option>{group.wards.map((ward, index) => <option key={ward.code} value={ward.code}>{index + 1}. {ward.name}</option>)}</select>
      <div className="ward-selection" aria-live="polite">{selected ? <><strong>{selected.name}</strong><span>{selected.code} · {group.name}</span></> : <span>Click any district to inspect its name and area code.</span>}</div>
      <p>GLA 2025 ward boundaries. Capital, risk and housing evidence apply to the whole borough; district-level figures are not available in this snapshot.</p>
    </div>
  </div>;
}

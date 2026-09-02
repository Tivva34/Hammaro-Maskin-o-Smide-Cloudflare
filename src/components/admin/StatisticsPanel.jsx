import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { PackageOpen, MessageSquare, TrendingUp, Archive, ShieldAlert, CheckCircle, DollarSign, Percent } from 'lucide-react';

import { getMachines, getStatusLabel, getStatusColor } from '../../lib/machinesService';
import { getInventoryItems } from '../../lib/inventoryService';
import { getQuoteRequests, QUOTE_STATUS_OPTIONS } from '../../lib/quoteService';
import translations from '../../i18n/translations';

export default function StatisticsPanel({ onNavigate }) {
  const [machines, setMachines] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('30'); // '7', '30', '365', 'all'
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [mRes, iRes, qRes] = await Promise.all([
          getMachines(),
          getInventoryItems(),
          getQuoteRequests()
        ]);
        if (mRes.data) setMachines(mRes.data);
        if (iRes.data) setInventory(iRes.data);
        if (qRes.data) setQuotes(qRes.data);
      } catch (err) {
        console.error('Error loading stats', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const generateLast12Months = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      let label = d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
      label = label.charAt(0).toUpperCase() + label.slice(1);
      if (i === 0) {
        label = `Denna månad (${label})`;
      }
      const val = `month-${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      months.push({ label, value: val });
    }
    return months;
  };

  // Time filtering logic for items created within the period
  const filterByDate = (items) => {
    if (timeFilter === 'all') return items;
    
    if (timeFilter.startsWith('month-')) {
      const [_, year, month] = timeFilter.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      
      return items.filter(item => {
        const d = new Date(item.created_at);
        return d >= startDate && d <= endDate;
      });
    }

    const now = new Date();
    const days = parseInt(timeFilter, 10);
    const cutoff = new Date(now.setDate(now.getDate() - days));
    return items.filter(item => new Date(item.created_at) >= cutoff);
  };


  // KPIs
  const allStock = [...machines, ...inventory];
  const isAllTime = timeFilter === 'all';
  
  const isHistorical = useMemo(() => {
    if (isAllTime || ['7', '30', '90', '365'].includes(timeFilter)) return false;
    if (timeFilter.startsWith('month-')) {
      const [_, yearStr, monthStr] = timeFilter.split('-');
      const now = new Date();
      if (parseInt(yearStr, 10) === now.getFullYear() && parseInt(monthStr, 10) === now.getMonth() + 1) {
        return false;
      }
      return true;
    }
    return false;
  }, [timeFilter, isAllTime]);

  const isCurrentMonth = useMemo(() => {
    if (timeFilter.startsWith('month-')) {
      const [_, yearStr, monthStr] = timeFilter.split('-');
      const now = new Date();
      return parseInt(yearStr, 10) === now.getFullYear() && parseInt(monthStr, 10) === now.getMonth() + 1;
    }
    return false;
  }, [timeFilter]);



  const totalStockAll = allStock.length;
  const publishedStockAll = allStock.filter(item => item.status === 'published').length;
  const draftStockAll = allStock.filter(item => item.status === 'draft').length;
  const soldStockAll = allStock.filter(item => item.status === 'sold').length;
  const newQuotesAll = quotes.filter(q => q.status === 'new').length;

  // Time-filtered quotes
  const recentQuotes = filterByDate(quotes);
  const recentMachines = filterByDate(machines);
  const recentInventory = filterByDate(inventory);
  const recentStock = [...recentMachines, ...recentInventory];
  
  // Group quotes over time
  const quotesOverTime = useMemo(() => {
    if (recentQuotes.length === 0) return [];
    
    // Sort oldest to newest
    const sorted = [...recentQuotes].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const grouped = {};
    
    sorted.forEach(q => {
      const d = new Date(q.created_at);
      let key;
      if (timeFilter === '365' || timeFilter === 'all') {
        key = d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' });
      } else {
        key = d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
      }
      
      if (!grouped[key]) grouped[key] = 0;
      grouped[key]++;
    });
    
    return Object.entries(grouped).map(([name, count]) => ({ name, count }));
  }, [recentQuotes, timeFilter]);

  // Quotes by status
  const quotesByStatus = useMemo(() => {
    return QUOTE_STATUS_OPTIONS.map(opt => ({
      name: opt.label,
      value: recentQuotes.filter(q => q.status === opt.value).length,
      color: opt.color
    })).filter(item => item.value > 0);
  }, [recentQuotes]);

  // Quotes by type
  const quotesByType = useMemo(() => {
    const grouped = {};
    recentQuotes.forEach(q => {
      let t = q.request_type || 'other';
      t = translations.sv.quote.types[t] || t;
      
      if (!grouped[t]) grouped[t] = 0;
      grouped[t]++;
    });
    return Object.entries(grouped)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [recentQuotes]);

  // Stock status
  const stockByStatus = useMemo(() => {
    const statuses = ['published', 'draft', 'reserved', 'sold'];
    return statuses.map(s => {
      const count = recentStock.filter(item => item.status === s).length;
      return {
        name: getStatusLabel(s),
        value: count,
        color: getStatusColor(s)
      };
    }).filter(item => item.value > 0);
  }, [recentStock]);

  // Stock by category
  const stockByCategory = useMemo(() => {
    const grouped = {};
    recentStock.forEach(item => {
      const rawCat = item.category || item.type || 'other';
      const cat = translations.sv.inventory.categories[rawCat] || translations.sv.machinery.types[rawCat] || translations.sv.machinery.categories[rawCat] || rawCat;
      if (!grouped[cat]) grouped[cat] = 0;
      grouped[cat]++;
    });
    return Object.entries(grouped)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [recentStock]);

  const KPICard = ({ title, subtitle, value, icon: Icon, color, onClick, noData }) => (
    <div 
      onClick={!noData ? onClick : undefined}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '1.25rem',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        cursor: (!noData && onClick) ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        height: '100%',
        minHeight: '130px'
      }}
      onMouseEnter={e => { if (!noData && onClick) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px -2px rgba(0,0,0,0.1)' } }}
      onMouseLeave={e => { if (!noData && onClick) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)' } }}
    >
      <div style={{ flex: 1, paddingRight: '0.75rem', minWidth: 0 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.25rem 0', wordBreak: 'break-word', lineHeight: 1.3 }}>{title}</p>
        {subtitle && <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: '0 0 0.5rem 0', wordBreak: 'break-word', lineHeight: 1.3 }}>{subtitle}</p>}
        {noData ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: subtitle ? 0 : '0.5rem 0 0 0', fontStyle: 'italic' }}>Ingen data för vald period</p>
        ) : (
          <h3 style={{ color: 'var(--text-primary)', fontSize: '2rem', fontWeight: 700, margin: 0, fontFamily: 'Outfit, sans-serif' }}>{value}</h3>
        )}
      </div>
      <div style={{ backgroundColor: `${color}15`, padding: '0.75rem', borderRadius: '12px', flexShrink: 0 }}>
        <Icon color={color} size={24} />
      </div>
    </div>
  );

  const ChartCard = ({ title, children, minHeight = '350px' }) => (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight
    }}>
      <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.125rem', color: 'var(--text-primary)', fontWeight: 600 }}>{title}</h3>
      <div style={{ flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        <div style={{ width: '24px', height: '24px', border: '2px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '0.75rem' }} />
        Hämtar statistik...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease' }}>
      
      {/* Header & Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Översikt</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select 
            value={timeFilter} 
            onChange={(e) => setTimeFilter(e.target.value)}
            style={{
              padding: '0.5rem 2rem 0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.9375rem',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.7rem center'
            }}
          >
            <optgroup label="Rullande perioder">
              <option value="7">Senaste 7 dagarna</option>
              <option value="30">Senaste 30 dagarna</option>
              <option value="90">Senaste 3 månaderna</option>
              <option value="365">Senaste 12 månaderna</option>
              <option value="all">Alla tider</option>
            </optgroup>
            <optgroup label="Tidigare kalendermånader">
              {generateLast12Months().map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '-1.5rem' }}>
        Tidsfiltret påverkar hela vyn.
      </p>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1rem' }}>
        <KPICard title={isHistorical ? 'Tillkommet Lager' : 'Totalt Lager'} subtitle={isHistorical ? 'Skapade objekt' : 'Nuvarande saldo'} value={isHistorical ? recentStock.length : totalStockAll} icon={PackageOpen} color="#3b82f6" onClick={() => onNavigate && onNavigate('machines', 'all')} noData={false} />
        <KPICard title="Publicerat" subtitle={isHistorical ? undefined : 'Nuvarande status'} value={publishedStockAll} icon={TrendingUp} color="#22c55e" onClick={() => onNavigate && onNavigate('machines', 'published')} noData={isHistorical} />
        <KPICard title="Inkomna Leads" subtitle={isHistorical ? 'Skapade under perioden' : (isCurrentMonth ? 'Skapade denna månad' : (isAllTime ? 'Status: Ny' : 'Skapade under perioden'))} value={isAllTime ? newQuotesAll : recentQuotes.length} icon={MessageSquare} color="#f59e0b" onClick={() => onNavigate && onNavigate('quotes')} noData={false} />
        <KPICard title="Utkast" subtitle={isHistorical ? undefined : 'Nuvarande status'} value={draftStockAll} icon={Archive} color="#6b7277" onClick={() => onNavigate && onNavigate('machines', 'draft')} noData={isHistorical} />
        <KPICard title="Sålda" subtitle={isHistorical ? undefined : 'Nuvarande status'} value={soldStockAll} icon={CheckCircle} color="#ef4444" onClick={() => onNavigate && onNavigate('machines', 'sold')} noData={isHistorical} />
      </div>


      {/* Grid for charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1.5rem' }}>
        
        {/* Förfrågningar över tid */}
        <ChartCard title="Förfrågningar över tid">
          {quotesOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={quotesOverTime} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Line type="monotone" dataKey="count" name="Förfrågningar" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Ingen data för vald period
            </div>
          )}
        </ChartCard>

        {/* Status på förfrågningar */}
        <ChartCard title="Förfrågningarnas status">
          {quotesByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={quotesByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {quotesByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Ingen data för vald period
            </div>
          )}
        </ChartCard>
        
        {/* Maskiner vs Lösöre */}
        <ChartCard title="Maskiner vs Lösöre">
          {(recentMachines.length > 0 || recentInventory.length > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Maskiner', value: recentMachines.length, color: '#3b82f6' },
                    { name: 'Lösöre', value: recentInventory.length, color: '#8b5cf6' }
                  ].filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                >
                  {
                    [
                      { name: 'Maskiner', value: recentMachines.length, color: '#3b82f6' },
                      { name: 'Lösöre', value: recentInventory.length, color: '#8b5cf6' }
                    ].filter(d => d.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Ingen data för vald period
            </div>
          )}
        </ChartCard>

        {/* Nuvarande status för lager */}
        <ChartCard title="Nuvarande lagerstatus" minHeight={isMobile ? '400px' : '350px'}>
          {stockByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stockByStatus}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                >
                  {stockByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Ingen data för vald period
            </div>
          )}
        </ChartCard>

        {/* Lager per kategori */}
        <ChartCard title="Lager per kategori" minHeight={isMobile ? '450px' : '350px'}>
          {stockByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockByCategory} layout={isMobile ? 'horizontal' : 'vertical'} margin={isMobile ? { top: 5, right: 5, left: -20, bottom: 40 } : { top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={isMobile} vertical={!isMobile} />
                  
                  {isMobile ? (
                    <>
                      <XAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tick={{ angle: -45, textAnchor: 'end', dy: 25 }} height={110} interval={0} />
                      <YAxis type="number" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    </>
                  ) : (
                    <>
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} width={100} />
                    </>
                  )}
                  
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    cursor={{ fill: 'var(--bg-secondary)', opacity: 0.4 }}
                  />
                  <Bar dataKey="count" name="Antal" fill="#8b5cf6" radius={isMobile ? [4, 4, 0, 0] : [0, 4, 4, 0]} barSize={isMobile ? undefined : 24} maxBarSize={50} />
                </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Ingen data för vald period
            </div>
          )}
        </ChartCard>

        {/* Förfrågningar per typ */}
        <ChartCard title="Förfrågningar per typ" minHeight={isMobile ? '450px' : '350px'}>
          {quotesByType.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quotesByType} margin={isMobile ? { top: 5, right: 5, left: -20, bottom: 40 } : { top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tick={{ angle: -45, textAnchor: 'end', dy: isMobile ? 25 : 20 }} height={isMobile ? 110 : 80} interval={0} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  cursor={{ fill: 'var(--bg-secondary)', opacity: 0.4 }}
                />
                <Bar dataKey="count" name="Antal" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Ingen data för vald period
            </div>
          )}
        </ChartCard>

      </div>
    </div>
  );
}

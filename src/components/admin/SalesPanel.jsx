import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, DollarSign, Percent, X } from 'lucide-react';

import { getActiveSales } from '../../lib/salesService';

export default function SalesPanel({ machines = [], inventory = [] }) {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('30'); // '7', '30', '365', 'all'
  const [selectedSale, setSelectedSale] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const sRes = await getActiveSales();
        if (sRes.data) setSales(sRes.data);
      } catch (err) {
        console.error('Error loading sales', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const CATEGORY_TRANSLATIONS = {
    'construction': 'Entreprenad',
    'agriculture': 'Lantbruk',
    'forestry': 'Skogsbruk',
    'transport': 'Transport',
    'attachment': 'Redskap',
    'workshop': 'Verkstad'
  };

  const translateCategory = (cat) => {
    if (!cat) return '';
    return CATEGORY_TRANSLATIONS[cat] || cat;
  };

  const getSaleImage = (sale) => {
    if (!sale) return null;
    if (sale.item_type === 'machine') {
      const machine = machines.find(m => m.id === sale.item_id);
      if (machine && machine.machine_images && machine.machine_images.length > 0) {
        const primary = machine.machine_images.find(img => img.is_primary);
        return primary ? primary.image_url : machine.machine_images[0].image_url;
      }
    } else {
      const inv = inventory.find(i => i.id === sale.item_id);
      if (inv && inv.inventory_images && inv.inventory_images.length > 0) {
        const primary = inv.inventory_images.find(img => img.is_primary);
        return primary ? primary.image_url : inv.inventory_images[0].image_url;
      }
    }
    return null;
  };

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

  const filterSalesByDate = (items) => {
    if (timeFilter === 'all') return items;
    
    if (timeFilter.startsWith('month-')) {
      const [_, year, month] = timeFilter.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      
      return items.filter(item => {
        const d = new Date(item.sold_at);
        return d >= startDate && d <= endDate;
      });
    }

    const now = new Date();
    const days = parseInt(timeFilter, 10);
    const cutoff = new Date(now.setDate(now.getDate() - days));
    return items.filter(item => new Date(item.sold_at) >= cutoff);
  };

  // KPIs
  const recentSales = filterSalesByDate(sales);
  
  const totalSalesValue = recentSales.reduce((acc, sale) => acc + (sale.sold_price || 0), 0);
  const salesWithPrice = recentSales.filter(s => s.sold_price != null);
  const avgSalePrice = salesWithPrice.length > 0 ? totalSalesValue / salesWithPrice.length : 0;
  
  const formatPrice = (p) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(p);

  const KPICard = ({ title, subtitle, value, icon: Icon, color, noData }) => (
    <div 
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '1.5rem',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        height: '100%',
        minHeight: '130px'
      }}
    >
      <div style={{ flex: 1, paddingRight: '1rem', minWidth: 0 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.25rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
        {subtitle && <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: '0 0 0.5rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</p>}
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

  const ChartCard = ({ title, children }) => (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
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
        Hämtar försäljningshistorik...
      </div>
    );
  }

  const noData = recentSales.length === 0;

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
        Tidsfiltret påverkar hela vyn och baseras på försäljningsdatumet.
      </p>

      {/* Försäljnings-KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1.5rem' }}>
        <KPICard title="Antal Sålda" subtitle="Inkl. maskiner & lösöre" value={recentSales.length} icon={CheckCircle} color="#10b981" noData={noData} />
        <KPICard title="Försäljningsvärde" subtitle="Totalt för perioden" value={totalSalesValue > 0 ? formatPrice(totalSalesValue) : '0 kr'} icon={DollarSign} color="#3b82f6" noData={noData} />
        <KPICard title="Snittpris" subtitle="Per sålt objekt" value={avgSalePrice > 0 ? formatPrice(avgSalePrice) : '0 kr'} icon={Percent} color="#8b5cf6" noData={noData} />
      </div>

      {/* Försäljningslista */}
      <ChartCard title="Registrerade försäljningar">
        {!noData ? (
          <>
            {/* Desktop table */}
            <div className="admin-table-wrap" style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Objekt</th>
                    <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Typ</th>
                    <th style={{ padding: '0.75rem 0', fontWeight: 500 }}>Datum</th>
                    <th style={{ padding: '0.75rem 0', fontWeight: 500, textAlign: 'right' }}>Pris</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <tr 
                      key={sale.id} 
                      onClick={() => setSelectedSale(sale)}
                      style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-primary)' }}>{sale.item_name}</td>
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-secondary)' }}>
                        {sale.item_type === 'machine' ? 'Maskin' : 'Lösöre'}
                      </td>
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-secondary)' }}>
                        {new Date(sale.sold_at).toLocaleDateString('sv-SE')}
                      </td>
                      <td style={{ padding: '0.75rem 0', color: 'var(--text-primary)', textAlign: 'right', fontWeight: 500 }}>
                        {sale.sold_price != null ? formatPrice(sale.sold_price) : 'Satt ej'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="admin-card-list">
              {recentSales.map((sale) => (
                <div 
                  key={sale.id} 
                  onClick={() => setSelectedSale(sale)}
                  style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem', wordBreak: 'break-word' }}>
                      {sale.item_name}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    {sale.item_type === 'machine' ? 'Maskin' : 'Lösöre'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{new Date(sale.sold_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {sale.sold_price != null ? formatPrice(sale.sold_price) : 'Satt ej'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Ingen data för vald period
          </div>
        )}
      </ChartCard>

      {/* ─── Detail Modal ─── */}
      {selectedSale && (
        <div 
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}
          onClick={() => setSelectedSale(null)}
        >
          <div 
            style={{ 
              backgroundColor: 'var(--bg-primary)', width: '100%', maxWidth: '500px', borderRadius: '12px', 
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
              maxHeight: '90vh'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-surface)' }}>
              <div>
                <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>Försäljningsdetaljer</h2>
              </div>
              <button onClick={() => setSelectedSale(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {getSaleImage(selectedSale) && (
                  <div style={{ width: '100%', height: '180px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }}>
                    <img src={getSaleImage(selectedSale)} alt={selectedSale.item_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                
                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Objekt</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{selectedSale.item_name}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Typ</div>
                    <div style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{selectedSale.item_type === 'machine' ? 'Maskin' : 'Lösöre'}</div>
                  </div>
                  {selectedSale.item_category && (
                    <div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kategori</div>
                      <div style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{translateCategory(selectedSale.item_category)}</div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: 'var(--bg-surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Försäljningspris</div>
                    <div style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {selectedSale.sold_price != null ? formatPrice(selectedSale.sold_price) : 'Satt ej'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datum</div>
                    <div style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {new Date(selectedSale.sold_at).toLocaleDateString('sv-SE')}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Artikel-ID</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>{selectedSale.item_id}</div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

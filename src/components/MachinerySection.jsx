import { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import MachineryCard from './MachineryCard';
import { getPublicMachines } from '../lib/machinesService';
import { useLang } from '../contexts/LanguageContext';

const MachinerySection = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [machines, setMachines] = useState([]);
  
  const showAll = searchParams.get('showAll') === 'true';
  const selectedCategory = searchParams.get('category') || 'all';
  const searchQuery = searchParams.get('q') || '';

  const updateParams = (updates) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || (key === 'category' && value === 'all') || (key === 'showAll' && value === false)) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    setSearchParams(newParams, { replace: true });
  };
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [currentPage, setCurrentPage] = useState(0);
  
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  const { t } = useLang();

  const CATEGORIES = ['all', 'tractor', 'construction', 'agriculture', 'implements', 'trailers', 'road_snow', 'other'];

  useEffect(() => {
    const fetchMachines = async () => {
      setLoading(true);
      const { data } = await getPublicMachines();
      if (data) setMachines(data);
      setLoading(false);
    };
    fetchMachines();
  }, []);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      checkScroll();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [machines]);

  const scrollBy = (amount) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const filteredMachines = machines.filter(m => {
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const searchableText = [
      m.name,
      m.name_en,
      m.type,
      ...(m.features || []),
      ...(m.features_en || [])
    ].filter(Boolean).join(' ').toLowerCase();

    return searchableText.includes(q);
  });

  const displayedMachines = showAll ? filteredMachines : filteredMachines.slice(0, 6);

  return (
    <section id="maskiner" className="section">
      <div className="container">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          marginBottom: '2rem',
        }}>
          <span className="eyebrow">{t('machinery.eyebrow')}</span>
          <h2 style={{ marginBottom: '1rem' }}>{t('machinery.heading')}</h2>
          <p style={{ maxWidth: '600px', fontSize: '1.25rem' }}>{t('machinery.desc')}</p>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '3rem',
        }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
              <Search size={20} />
            </div>
            <input
              type="search"
              placeholder={t('machinery.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => updateParams({ q: e.target.value, showAll: true })}
              style={{
                width: '100%',
                padding: '0.875rem 2.5rem 0.875rem 3rem',
                borderRadius: '9999px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
            {searchQuery && (
              <button
                onClick={() => updateParams({ q: '' })}
                aria-label={t('machinery.clearSearch')}
                style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>

            {/* Categories */}
            {isMobile ? (
              <div className="fade-up mobile-category-nav" style={{ animationDelay: '0.4s' }}>
                <button
                  className="nav-arrow"
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  aria-label="Föregående kategorier"
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="mobile-categories-wrapper">
                  {CATEGORIES.slice(currentPage * 2, (currentPage + 1) * 2).map(cat => {
                    const isActive = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => updateParams({ category: cat, showAll: false })}
                        style={{
                          flex: 1,
                          padding: '0.5rem 0.5rem',
                          borderRadius: '9999px',
                          border: '1px solid',
                          borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-color)',
                          backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                          color: isActive ? 'var(--text-inverse)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          transition: 'all 0.2s ease-in-out',
                          textAlign: 'center'
                        }}
                      >
                        {t(`machinery.categories.${cat}`)}
                      </button>
                    );
                  })}
                </div>

                <button
                  className="nav-arrow"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(CATEGORIES.length / 2) - 1, p + 1))}
                  disabled={currentPage >= Math.ceil(CATEGORIES.length / 2) - 1}
                  aria-label="Nästa kategorier"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            ) : (
              <div className="category-nav-container">
                {canScrollLeft && (
                  <button
                    onClick={() => scrollBy(-200)}
                    aria-label="Visa tidigare kategorier"
                    style={{
                      flexShrink: 0,
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.25rem',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ background: 'var(--bg-surface)', borderRadius: '50%', padding: '4px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                      <ChevronLeft size={20} />
                    </div>
                  </button>
                )}

                <div
                  ref={scrollContainerRef}
                  onScroll={checkScroll}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    gap: '0.75rem',
                    overflowX: 'auto',
                    paddingBottom: '0.5rem',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {CATEGORIES.map(cat => {
                    const isActive = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => updateParams({ category: cat, showAll: false })}
                        style={{
                          flexShrink: 0,
                          padding: '0.4rem 1rem',
                          borderRadius: '9999px',
                          border: '1px solid',
                          borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-color)',
                          backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                          color: isActive ? 'var(--text-inverse)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s ease-in-out'
                        }}
                      >
                        {t(`machinery.categories.${cat}`)}
                      </button>
                    );
                  })}
                </div>

                {canScrollRight && (
                  <button
                    onClick={() => scrollBy(200)}
                    aria-label="Visa fler kategorier"
                    style={{
                      flexShrink: 0,
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.25rem',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ background: 'var(--bg-surface)', borderRadius: '50%', padding: '4px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                      <ChevronRight size={20} />
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>

          <style>{`
            div::-webkit-scrollbar { display: none; }
            .category-nav-container {
              display: none;
            }
            .mobile-category-nav {
              display: flex;
              align-items: center;
              justify-content: space-between;
              width: calc(100% + 3rem);
              margin-left: -1.5rem;
              margin-right: -1.5rem;
              padding: 0 0.5rem;
              gap: 0.5rem;
            }
            .mobile-categories-wrapper {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.5rem;
              flex: 1;
              min-width: 0;
            }
            button.nav-arrow {
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 2.5rem;
              height: 2.5rem;
              border-radius: 9999px;
              background-color: var(--bg-surface);
              border: 1px solid var(--border-color);
              color: var(--text-primary);
              cursor: pointer;
              transition: all 0.2s ease-in-out;
            }
            button.nav-arrow:disabled {
              opacity: 0.2;
              cursor: not-allowed;
            }
            @media (min-width: 768px) {
              .mobile-category-nav {
                display: none;
              }
              .category-nav-container {
                display: flex;
                align-items: center;
                width: 100%;
                margin-left: 0;
                margin-right: 0;
                padding: 0;
                gap: 0.5rem;
              }
            }
          `}</style>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            <div style={{ width: '24px', height: '24px', border: '2px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '0.75rem' }} />
            {t('machinery.loading')}
          </div>
        ) : machines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1.125rem' }}>{t('machinery.empty')}</p>
          </div>
        ) : filteredMachines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>
              {searchQuery ? t('machinery.noSearchResults') : t('machinery.emptyCategory')}
            </p>
            <button 
              onClick={() => updateParams({ category: 'all', q: '', showAll: false })} 
              className="btn btn-secondary"
            >
              {t('machinery.clearSearch')}
            </button>
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '2rem',
              marginBottom: '4rem',
            }}>
              {displayedMachines.map(machine => (
                <MachineryCard key={machine.id} machine={machine} />
              ))}
            </div>

            {!showAll && filteredMachines.length > 6 && (
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => updateParams({ showAll: true })}
                  className="btn btn-primary"
                  style={{ padding: '1rem 3rem', fontSize: '1.125rem' }}
                >
                  {t('machinery.showAll')} ({filteredMachines.length})
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
};

export default MachinerySection;

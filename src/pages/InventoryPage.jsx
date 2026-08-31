import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getPublicInventoryItems } from '../lib/inventoryService';
import InventoryCard from '../components/InventoryCard';
import QuoteModal from '../components/QuoteModal';
import { MessageSquare, PackageOpen, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';

const InventoryPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get('category') || 'all';
  const searchQuery = searchParams.get('q') || '';

  const updateParams = (updates) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || (key === 'category' && value === 'all')) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    setSearchParams(newParams, { replace: true });
  };
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [currentPage, setCurrentPage] = useState(0);

  const scrollContainerRef = React.useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const CATEGORIES = ['all', 'agriculture', 'construction', 'workshop', 'tires', 'parts', 'other'];

  const { t } = useLang();

  useEffect(() => {
    // Dynamic page title for basic SEO
    document.title = `${t('inventory.heading')} | Hammarö Maskin & Smide`;

    const fetchItems = async () => {
      setLoading(true);
      const { data } = await getPublicInventoryItems();
      if (data) setItems(data);
      setLoading(false);
    };
    fetchItems();
  }, [t]);

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
  }, [items]);

  const scrollBy = (amount) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const searchableText = [
      item.name,
      item.name_en,
      item.description,
      item.description_en,
      item.category
    ].filter(Boolean).join(' ').toLowerCase();

    return searchableText.includes(q);
  });

  return (
    <>
      <section className="section" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="container" style={{ flexGrow: 1 }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            marginBottom: '4rem',
          }}>
            <span className="eyebrow fade-up" style={{ animationDelay: '0.1s' }}>{t('inventory.eyebrow')}</span>
            <h1 className="fade-up" style={{ marginBottom: '1rem', animationDelay: '0.2s' }}>
              {t('inventory.heading')}
            </h1>
            <p className="fade-up" style={{ maxWidth: '700px', fontSize: '1.25rem', color: 'var(--text-secondary)', animationDelay: '0.3s' }}>
              {t('inventory.desc')}
            </p>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginBottom: '3rem',
          }}>
            {/* Search Input */}
            <div className="fade-up" style={{ position: 'relative', width: '100%', maxWidth: '400px', animationDelay: '0.35s' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                <Search size={20} />
              </div>
              <input
                type="search"
                placeholder={t('inventory.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => updateParams({ q: e.target.value })}
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
                  aria-label={t('inventory.clearSearch')}
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
                    // Kortare namn på mobil
                    let displayName = t(`inventory.categories.${cat}`);
                    if (displayName === 'Lantbrukstillbehör') displayName = 'Lantbruk';
                    else if (displayName === 'Entreprenadtillbehör') displayName = 'Entreprenad';
                    else if (displayName === 'Verkstadsutrustning') displayName = 'Verkstad';
                    else if (displayName === 'Reservdelar & Komp.') displayName = 'Reservdelar';
                    else if (displayName === 'Däck & Fälgar') displayName = 'Däck & fälgar';

                    return (
                      <button
                        key={cat}
                        onClick={() => updateParams({ category: cat })}
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
                        {displayName}
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
              <div className="fade-up category-nav-container" style={{ animationDelay: '0.4s' }}>
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
                        onClick={() => updateParams({ category: cat })}
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
                        {t(`inventory.categories.${cat}`)}
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
              {t('inventory.loading')}
            </div>
          ) : items.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '6rem 2rem',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--border-color)',
              margin: '2rem 0 4rem'
            }} className="fade-up">
              <PackageOpen size={48} color="var(--text-muted)" style={{ margin: '0 auto 1.5rem', display: 'block' }} />
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{t('inventory.emptyTitle')}</h2>
              <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
                {t('inventory.emptyDesc')}
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }} className="fade-up">
              <p style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>
                {searchQuery ? t('inventory.noSearchResults') : t('inventory.emptyCategory')}
              </p>
              <button
                onClick={() => updateParams({ category: 'all', q: '' })}
                className="btn btn-secondary"
              >
                {t('inventory.clearSearch')}
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '2rem',
              marginBottom: '4rem',
            }}>
              {filteredItems.map((item, index) => (
                <div key={item.id} className="fade-up" style={{ animationDelay: `${0.1 * (index % 5)}s` }}>
                  <InventoryCard
                    item={item}
                    onQuoteClick={() => {
                      setSelectedItem(item);
                      setQuoteModalOpen(true);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Contact CTA Section */}
      <section className="section" style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: '600px' }}>
          <MessageSquare size={40} color="var(--accent-primary)" style={{ margin: '0 auto 1.5rem' }} />
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            {t('inventory.ctaHeading')}
          </h2>
          <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            {t('inventory.ctaDesc')}
          </p>
          <button
            onClick={() => {
              setSelectedItem(null);
              setQuoteModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ padding: '1rem 2rem', fontSize: '1.125rem', border: 'none', cursor: 'pointer' }}
          >
            {t('inventory.ctaButton')}
          </button>
        </div>
      </section>

      <QuoteModal
        key={selectedItem ? `item-${selectedItem.id}` : 'general-requested'}
        isOpen={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        preselectedType={selectedItem ? "inventory" : "requested"}
        inventoryItem={selectedItem}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
};

export default InventoryPage;

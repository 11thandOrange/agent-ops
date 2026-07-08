import { useState, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ContentArea from './components/ContentArea';
import CodePanel from './components/CodePanel';
import { sections, navigationBySection } from './data/navigation';
import { getPage } from './data/pages';

export default function App() {
  const [activeSection, setActiveSection] = useState('overview');
  const [activePage, setActivePage] = useState('/');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleSectionChange = useCallback((sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    setActiveSection(sectionId);
    const navItems = navigationBySection[sectionId];
    setActivePage(navItems && navItems.length > 0 ? navItems[0].route : section.slug);
  }, []);

  const handlePageChange = useCallback((route: string) => {
    setActivePage(route);
    setMobileSidebarOpen(false);
  }, []);

  const navItems = navigationBySection[activeSection] || [];
  const currentPage = getPage(activePage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      <Header
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          navItems={navItems}
          activePage={activePage}
          onPageChange={handlePageChange}
          searchQuery={searchQuery}
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />
        <ContentArea page={currentPage} />
        <CodePanel page={currentPage} />
      </div>
    </div>
  );
}

import { HashRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { ApiReference } from './pages/ApiReference';
import { AppList } from './pages/AppList';
import { CiCd } from './pages/CiCd';
import { Automation } from './pages/Automation';
import { Tests } from './pages/Tests';
import { DocsPage } from './pages/DocsPage';

// HashRouter (#/api/bundles, etc.) per issue #286 - GitHub Pages project
// sites (and the many differently-hosted repos this template targets) have
// no server-side rewrite for deep-linked client-side routes, so this
// deliberately does not switch to BrowserRouter.
function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/api" element={<ApiReference />} />
        <Route path="/api/:group" element={<ApiReference />} />
        <Route path="/apps" element={<AppList />} />
        <Route path="/apps/:app" element={<AppList />} />
        <Route path="/ci-cd" element={<CiCd />} />
        <Route path="/ci-cd/:workflow" element={<CiCd />} />
        <Route path="/automation" element={<Automation />} />
        <Route path="/automation/:pipeline" element={<Automation />} />
        <Route path="/tests" element={<Tests />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/docs/:page" element={<DocsPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </HashRouter>
  );
}

export default App;

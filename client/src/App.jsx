import { Routes, Route } from 'react-router-dom';
import FrontPage from './pages/FrontPage.jsx';
import EditionPage from './pages/Edition.jsx';
import ArchivePage from './pages/Archive.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FrontPage />} />
      <Route path="/edition/:date" element={<EditionPage />} />
      <Route path="/archive" element={<ArchivePage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

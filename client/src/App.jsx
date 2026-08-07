import { Routes, Route } from 'react-router';
import FrontPage from './pages/FrontPage.jsx';
import EditionPage from './pages/Edition.jsx';
import ArchivePage from './pages/Archive.jsx';
import DeskPage from './pages/Desk.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FrontPage />} />
      <Route path="/edition/:date" element={<EditionPage />} />
      <Route path="/archive" element={<ArchivePage />} />
      <Route path="/desk" element={<DeskPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

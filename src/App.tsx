import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import RequestsPage from './pages/RequestsPage'
import MontagePage from './pages/MontagePage'
import HistoryPage from './pages/HistoryPage'
import LeftoversPage from './pages/LeftoversPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/montage" element={<MontagePage />} />
          <Route path="/leftovers" element={<LeftoversPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/requests" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import RequestsPage from './pages/RequestsPage'
import MontagePage from './pages/MontagePage'
import ProcessPage from './pages/ProcessPage'
import LeftoversPage from './pages/LeftoversPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/montage" element={<MontagePage />} />
          <Route path="/leftovers" element={<LeftoversPage />} />
          <Route path="/process" element={<ProcessPage />} />
          <Route path="*" element={<Navigate to="/requests" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

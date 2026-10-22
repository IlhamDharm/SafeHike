import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/Dashboard';
import MountainDetail from './pages/MountainDetail';

const queryClient = new QueryClient();

// Mode demo: halaman utama dapat dibuka tanpa login.
// Login/register tetap tersedia dan endpoint yang mengubah data tetap dilindungi backend.
const DemoRoute = ({ children }: { children: React.ReactElement }) => children;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/" 
            element={
              <DemoRoute>
                <Dashboard />
              </DemoRoute>
            } 
          />
          <Route 
            path="/mountains/:id" 
            element={
              <DemoRoute>
                <MountainDetail />
              </DemoRoute>
            } 
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}


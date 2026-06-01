import React, { useState } from 'react'
import { Landing } from './views/pages/Landing'
import { Login } from './views/pages/Login'
import { Register } from './views/pages/Register'
import { SeekerDashboard } from './views/pages/SeekerDashboard'
import { OwnerDashboard } from './views/pages/OwnerDashboard'
import { MainLayout } from './views/layouts/MainLayout'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { MessagesProvider } from './contexts/MessagesContext'

function AppRoutes() {
  const { logout } = useAuth()
  const [page, setPage] = useState('landing')
  const [currentUser, setCurrentUser] = useState(null)

  const handleLogin = (profile) => {
    setCurrentUser(profile)
    setPage(profile.role === 'seeker' ? 'seeker-dashboard' : 'owner-dashboard')
  }

  const handleLogout = async () => {
    await logout()
    setCurrentUser(null)
    setPage('landing')
  }

  return (
    <>
      {page === 'landing' && (
        <Landing
          onGetStarted={() => setPage('register')}
          onLogin={() => setPage('login')}
        />
      )}

      {page === 'login' && (
        <Login
          onLogin={handleLogin}
          onGoToRegister={() => setPage('register')}
          onBack={() => setPage('landing')}
        />
      )}

      {page === 'register' && (
        <Register
          onRegister={handleLogin}
          onGoToLogin={() => setPage('login')}
          onBack={() => setPage('landing')}
        />
      )}

      {page === 'seeker-dashboard' && currentUser && (
        <MainLayout onLogout={handleLogout} currentUser={currentUser}>
          <SeekerDashboard user={currentUser} />
        </MainLayout>
      )}

      {page === 'owner-dashboard' && currentUser && (
        <MainLayout onLogout={handleLogout} currentUser={currentUser}>
          <OwnerDashboard user={currentUser} />
        </MainLayout>
      )}
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <MessagesProvider>
        <AppRoutes />
      </MessagesProvider>
    </AuthProvider>
  )
}

export default App

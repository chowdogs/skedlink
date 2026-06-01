import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword as updatePasswordFb,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const register = async (email, password, fullName, role, phone) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)
    const profile = {
      uid: user.uid,
      email,
      fullName,
      role,
      phone: phone || '',
      weeklySchedule: {},
      customActivities: []
    }
    await setDoc(doc(db, 'users', user.uid), profile)
    return profile
  }

  const login = async (email, password) => {
    const { user } = await signInWithEmailAndPassword(auth, email, password)
    const snap = await getDoc(doc(db, 'users', user.uid))
    if (!snap.exists()) throw new Error('User profile not found. Please register first.')
    return snap.data()
  }

  const logout = () => signOut(auth)

  const updateUserProfile = async (data) => {
    if (!currentUser) throw new Error('Not logged in')
    await updateDoc(doc(db, 'users', currentUser.uid), data)
    setUserProfile(prev => ({ ...prev, ...data }))
  }

  const changePassword = async (currentPassword, newPassword) => {
    if (!currentUser) throw new Error('Not logged in')
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword)
    await reauthenticateWithCredential(currentUser, credential)
    await updatePasswordFb(currentUser, newPassword)
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid))
        setUserProfile(snap.exists() ? snap.data() : null)
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <AuthContext.Provider value={{
      currentUser, userProfile, loading,
      register, login, logout,
      updateUserProfile, changePassword
    }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

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
import { doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { TERMS_VERSION } from '../lib/terms'

const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const register = async (email, password, fullName, role, phone, termsAccepted) => {
    if (!termsAccepted) throw new Error('Please accept the Terms and Conditions to create an account.')
    const { user } = await createUserWithEmailAndPassword(auth, email, password)
    const profile = {
      uid: user.uid,
      email,
      fullName,
      role,
      phone: phone || '',
      weeklySchedule: {},
      customActivities: [],
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: serverTimestamp()
    }
    await setDoc(doc(db, 'users', user.uid), profile)
    const savedProfile = (await getDoc(doc(db, 'users', user.uid))).data()
    setUserProfile(savedProfile)
    return savedProfile
  }

  const login = async (email, password) => {
    const { user } = await signInWithEmailAndPassword(auth, email, password)
    const snap = await getDoc(doc(db, 'users', user.uid))
    if (!snap.exists()) throw new Error('User profile not found. Please register first.')
    setUserProfile(snap.data())
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
    let profileUnsub = () => {}
    const unsub = onAuthStateChanged(auth, (user) => {
      profileUnsub()
      setCurrentUser(user)
      if (user) {
        profileUnsub = onSnapshot(doc(db, 'users', user.uid), snap => {
          setUserProfile(snap.exists() ? snap.data() : null)
          setLoading(false)
        }, () => { setUserProfile(null); setLoading(false) })
      } else {
        setUserProfile(null)
        setLoading(false)
      }
    })
    return () => { unsub(); profileUnsub() }
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

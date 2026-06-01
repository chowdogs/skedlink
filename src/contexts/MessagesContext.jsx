import React, { createContext, useContext, useState } from 'react'

const MessagesContext = createContext(null)

export const MessagesProvider = ({ children }) => {
  const [activeConversation, setActiveConversation] = useState(null)
  const [showPanel, setShowPanel] = useState(false)

  const openConversation = (conv) => {
    setActiveConversation(conv)
    setShowPanel(true)
  }

  const togglePanel = () => setShowPanel(v => !v)
  const closePanel = () => setShowPanel(false)

  return (
    <MessagesContext.Provider value={{ activeConversation, setActiveConversation, showPanel, openConversation, togglePanel, closePanel }}>
      {children}
    </MessagesContext.Provider>
  )
}

export const useMessages = () => useContext(MessagesContext)

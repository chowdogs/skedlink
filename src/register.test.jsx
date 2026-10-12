import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Register } from './views/pages/Register'

const mockRegister = jest.fn()
jest.mock('./contexts/AuthContext', () => ({ useAuth: () => ({ register: mockRegister }) }))

test('sign up shows terms in a modal and requires acceptance', async () => {
  mockRegister.mockResolvedValue({ uid: 'new-user', role: 'seeker' })
  render(<Register onRegister={jest.fn()} onGoToLogin={jest.fn()} />)

  const terms = screen.getByRole('checkbox')
  expect(terms).toBeRequired()
  fireEvent.click(screen.getByRole('button', { name: 'Terms and Conditions' }))
  expect(screen.getByRole('dialog', { name: 'Terms and Conditions' })).toBeInTheDocument()
  expect(screen.getByText(/current PayMongo checkout runs in test mode/i)).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test Tenant' } })
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'tenant@example.test' } })
  fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '09123456789' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
  const form = screen.getByRole('button', { name: 'Create Account' }).closest('form')
  fireEvent.submit(form)
  expect(mockRegister).not.toHaveBeenCalled()
  expect(screen.getByText(/Please accept the Terms and Conditions/)).toBeInTheDocument()

  fireEvent.click(terms)
  fireEvent.submit(form)
  await waitFor(() => expect(mockRegister).toHaveBeenCalledWith('tenant@example.test', 'password123', 'Test Tenant', 'seeker', '09123456789', true))
})

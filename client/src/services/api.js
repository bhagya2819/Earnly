import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const demoUser = localStorage.getItem('demoUser')
  if (demoUser) {
    config.headers['x-demo-user'] = demoUser
  }
  return config
})

// Auth
export const registerRider = (data) => api.post('/auth/register', data)
export const loginRider = (data) => api.post('/auth/login', data)
export const getProfile = (uid) => api.get(`/auth/profile/${uid}`)

// OTP
export const sendOtp = (email) => api.post('/otp/send', { email })
export const verifyOtp = (email, otp) => api.post('/otp/verify', { email, otp })

// Policies
export const getPlans = () => api.get('/policies/plans')
export const purchasePolicy = (data) => api.post('/policies/purchase', data)
export const getMyPolicies = (uid) => api.get(`/policies/my-policies/${uid}`)
export const calculatePremium = (data) => api.post('/policies/calculate-premium', data)

// Claims
export const getMyClaims = (uid) => api.get(`/claims/my-claims/${uid}`)
export const initiateClaim = (data) => api.post('/claims/initiate', data)

// Disruptions
export const getCurrentDisruptions = (city) => api.get(`/disruptions/current/${city}`)
export const checkTriggers = (data) => api.post('/disruptions/check-triggers', data)
export const simulateDisruption = (data) => api.post('/disruptions/simulate', data)
export const getDisruptionHistory = (city) => api.get(`/disruptions/history/${city}`)

// Admin
export const getAdminDashboard = () => api.get('/admin/dashboard')
export const getFraudFlags = () => api.get('/admin/fraud-flags')
export const overrideClaim = (claimId, data) => api.patch(`/admin/override/${claimId}`, data)

// Notifications
export const getNotifications = (uid) => api.get(`/notifications/${uid}`)
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`)
export const markAllRead = (uid) => api.patch(`/notifications/read-all/${uid}`)
export const getUnreadCount = (uid) => api.get(`/notifications/unread-count/${uid}`)

// Risk Profile
export const getRiskProfile = (uid) => api.get(`/auth/risk-profile/${uid}`)

// Admin Live Feed
export const getLiveFeed = () => api.get('/admin/claims/live-feed')

export default api

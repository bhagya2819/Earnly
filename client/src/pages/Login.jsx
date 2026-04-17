import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { registerRider } from '../services/api'
import toast from 'react-hot-toast'
import { Shield, LogIn, Zap } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { demoLogin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Please fill in all fields')
    setLoading(true)
    try {
      const emailKey = email.trim().toLowerCase()
      const registered = JSON.parse(localStorage.getItem('registeredUsers') || '{}')
      const record = registered[emailKey]

      if (!record) {
        toast.error('No account found for this email. Please register first.')
        return
      }
      if (record.password !== password) {
        toast.error('Incorrect password. Please try again.')
        return
      }

      demoLogin(record.profile)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Login failed. Try demo login instead.')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    const profile = {
      uid: 'demo_' + Date.now(),
      name: 'Rahul Sharma',
      email: 'rahul@demo.earnly.in',
      phone: '+91 98765 43210',
      city: 'Mumbai',
      zone: 'Andheri West',
      platform: 'zomato',
      vehicleType: 'Bike',
      avgWeeklyEarnings: 5000,
      workingHoursPerDay: 8,
      role: 'rider',
    }
    // Register on the backend so automation pipeline can find this rider
    try {
      await registerRider(profile)
    } catch {
      // ignore - demo still works with in-memory fallback
    }
    demoLogin(profile)
    toast.success('Demo session started! Explore Earnly freely.')
    navigate('/dashboard')
  }

  const inputClass = 'w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors'

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500 mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
          <p className="text-gray-400 mt-1">Log in to check your coverage and claims</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                className={inputClass}
                placeholder="rahul@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <input
                type="password"
                className={inputClass}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <LogIn className="w-4 h-4" />
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-[#0f172a] px-3 text-gray-500">or</span>
            </div>
          </div>

          <button
            onClick={handleDemoLogin}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold hover:bg-emerald-500/20 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Try Demo — Instant Access
          </button>
          <p className="text-xs text-gray-500 text-center mt-3">
            No sign-up needed. Explore with a sample delivery partner profile.
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          New to Earnly?{' '}
          <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}

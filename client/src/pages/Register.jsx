import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { registerRider } from '../services/api'
import toast from 'react-hot-toast'
import { Shield, ArrowRight, ArrowLeft, User, MapPin, Briefcase, CheckCircle } from 'lucide-react'

const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Jaipur']
const platforms = ['Zomato', 'Swiggy', 'Zepto', 'Blinkit', 'Amazon', 'Flipkart']
const vehicleTypes = ['Bike', 'Scooter', 'Bicycle', 'Car']

const stepInfo = [
  { label: 'Personal Info', icon: User },
  { label: 'Delivery Details', icon: MapPin },
  { label: 'Work Profile', icon: Briefcase },
]

export default function Register() {
  const navigate = useNavigate()
  const { demoLogin } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    city: '',
    zone: '',
    platform: '',
    vehicleType: '',
    avgWeeklyEarnings: '',
    workingHoursPerDay: '',
  })

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  // Returns the 10-digit local number if valid (accepts +91/91 country-code prefix), else null.
  const getLocalPhone = (p) => {
    const d = (p || '').replace(/\D/g, '')
    if (d.length === 10) return d
    if (d.length === 12 && d.startsWith('91')) return d.slice(2)
    return null
  }

  // Strong password: min 6 chars, at least 1 uppercase, 1 digit, 1 special char.
  const isStrongPassword = (p) =>
    !!p && p.length >= 6 && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p)

  const canNext = () => {
    if (step === 1) return form.name && form.email && getLocalPhone(form.phone) && isStrongPassword(form.password)
    if (step === 2) return form.city && form.zone && form.platform
    if (step === 3) return form.vehicleType && form.avgWeeklyEarnings && form.workingHoursPerDay
    return false
  }

  const handleSubmit = async () => {
    if (!canNext()) return
    setLoading(true)
    try {
      const uid = 'demo_' + Date.now()
      const profile = {
        uid,
        name: form.name,
        email: form.email,
        phone: form.phone,
        city: form.city,
        zone: form.zone,
        platform: form.platform,
        vehicleType: form.vehicleType,
        avgWeeklyEarnings: Number(form.avgWeeklyEarnings),
        workingHoursPerDay: Number(form.workingHoursPerDay),
        role: 'rider',
      }

      try {
        await registerRider(profile)
      } catch {
        // Demo mode — backend might not be available
      }

      const phoneKey = getLocalPhone(form.phone)
      if (!phoneKey) {
        toast.error('Please enter a valid 10-digit phone number.')
        setLoading(false)
        return
      }

      const emailKey = form.email.trim().toLowerCase()
      const registered = JSON.parse(localStorage.getItem('registeredUsers') || '{}')

      if (registered[emailKey]) {
        toast.error('An account with this email already exists. Please log in instead.')
        setLoading(false)
        return
      }
      const phoneTaken = Object.values(registered).some(
        (r) => getLocalPhone(r?.profile?.phone) === phoneKey
      )
      if (phoneTaken) {
        toast.error('An account with this phone number already exists.')
        setLoading(false)
        return
      }

      registered[emailKey] = { password: form.password, profile }
      localStorage.setItem('registeredUsers', JSON.stringify(registered))

      demoLogin(profile)
      toast.success('Welcome to Earnly! Your account is ready.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors'
  const selectClass = 'w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors appearance-none'

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500 mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Your Account</h1>
          <p className="text-gray-400 mt-1">Get started with income protection in minutes</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {stepInfo.map((s, i) => {
            const StepIcon = s.icon
            const isActive = step === i + 1
            const isDone = step > i + 1
            return (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  isDone ? 'bg-emerald-500/10 text-emerald-500' : 'bg-white/5 text-gray-500'
                }`}>
                  {isDone ? <CheckCircle className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < 2 && <div className={`w-8 h-px ${step > i + 1 ? 'bg-emerald-500' : 'bg-white/10'}`} />}
              </div>
            )
          })}
        </div>

        {/* Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Rahul Sharma"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="rahul@example.com"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  className={inputClass}
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
                {form.phone && !getLocalPhone(form.phone) && (
                  <p className="mt-1.5 text-xs text-red-400">Please enter a valid 10-digit phone number.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                <input
                  type="password"
                  className={inputClass}
                  placeholder="Min 6 chars, 1 uppercase, 1 number, 1 special"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                />
                {form.password && !isStrongPassword(form.password) && (
                  <p className="mt-1.5 text-xs text-red-400">
                    Password must be at least 6 characters and include one uppercase letter, one number, and one special character.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">City</label>
                <select
                  className={selectClass}
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                >
                  <option value="" className="bg-[#0f172a]">Select your city</option>
                  {cities.map((c) => (
                    <option key={c} value={c} className="bg-[#0f172a]">{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Zone / Area</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Koramangala, Andheri West"
                  value={form.zone}
                  onChange={(e) => update('zone', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Delivery Platform</label>
                <select
                  className={selectClass}
                  value={form.platform}
                  onChange={(e) => update('platform', e.target.value)}
                >
                  <option value="" className="bg-[#0f172a]">Select your platform</option>
                  {platforms.map((p) => (
                    <option key={p} value={p} className="bg-[#0f172a]">{p}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Vehicle Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {vehicleTypes.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => update('vehicleType', v)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium border transition-colors ${
                        form.vehicleType === v
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Average Weekly Earnings (INR)</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="e.g. 5000"
                  value={form.avgWeeklyEarnings}
                  onChange={(e) => update('avgWeeklyEarnings', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Working Hours per Day</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="e.g. 8"
                  min="1"
                  max="24"
                  value={form.workingHoursPerDay}
                  onChange={(e) => update('workingHoursPerDay', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8">
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}
            {step < 3 ? (
              <button
                onClick={() => canNext() && setStep((s) => s + 1)}
                disabled={!canNext()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canNext() || loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}

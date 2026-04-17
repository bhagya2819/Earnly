import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMyPolicies, getMyClaims, getCurrentDisruptions } from '../services/api'
import StatsCard from '../components/StatsCard'
import DisruptionCard from '../components/DisruptionCard'
import ReportDisruption from '../components/ReportDisruption'
import toast from 'react-hot-toast'
import {
  ShieldCheck, IndianRupee, CreditCard, AlertTriangle,
  CloudRain, Thermometer, Wind, ShoppingBag,
  Plus, Eye, CloudSun, Loader2, RefreshCw,
  TrendingUp, TrendingDown, Calendar, Clock,
  CheckCircle, Zap, Wallet, FileSearch, Shield,
  Activity
} from 'lucide-react'

function AnimatedNumber({ value, prefix = '', suffix = '' }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const num = typeof value === 'number' ? value : parseInt(String(value).replace(/[^0-9]/g, '')) || 0
    const duration = 800
    const start = performance.now()
    const startVal = display

    function animate(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(startVal + (num - startVal) * eased))
      if (progress < 1) ref.current = requestAnimationFrame(animate)
    }

    ref.current = requestAnimationFrame(animate)
    return () => ref.current && cancelAnimationFrame(ref.current)
  }, [value])

  return <span>{prefix}{display.toLocaleString('en-IN')}{suffix}</span>
}

const pipelineSteps = [
  { key: 'detected', label: 'Disruption Detected', icon: CloudRain, color: 'text-red-400', bg: 'bg-red-500/10' },
  { key: 'initiated', label: 'Claim Initiated', icon: FileSearch, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { key: 'fraud_check', label: 'Fraud Check Passed', icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { key: 'approved', label: 'Approved', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { key: 'payout', label: 'Payout Sent', icon: Wallet, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
]

function getStepStatus(claim) {
  const status = claim.status?.toLowerCase()
  if (status === 'approved' || status === 'payout_sent') return { detected: true, initiated: true, fraud_check: true, approved: true, payout: status === 'payout_sent' || !!claim.payoutAmount }
  if (status === 'rejected') return { detected: true, initiated: true, fraud_check: true, approved: false, payout: false }
  if (status === 'processing') return { detected: true, initiated: true, fraud_check: false, approved: false, payout: false }
  return { detected: true, initiated: true, fraud_check: false, approved: false, payout: false }
}

export default function Dashboard() {
  const { user } = useAuth()
  const [policies, setPolicies] = useState([])
  const [claims, setClaims] = useState([])
  const [disruptions, setDisruptions] = useState([])
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(Date.now())
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [showReport, setShowReport] = useState(false)

  useEffect(() => {
    loadData()
  }, [user])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user?.uid) return
    const poll = setInterval(() => {
      loadData(true)
    }, 30000)
    return () => clearInterval(poll)
  }, [user?.uid])

  // Seconds ago counter
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [lastUpdated])

  const loadData = async (silent = false) => {
    if (!user?.uid) return
    if (!silent) setLoading(true)
    try {
      const [polRes, claimRes, disRes] = await Promise.allSettled([
        getMyPolicies(user.uid),
        getMyClaims(user.uid),
        getCurrentDisruptions(user.city || 'Mumbai'),
      ])

      if (polRes.status === 'fulfilled') setPolicies(polRes.value?.data?.policies || polRes.value?.data || [])
      if (claimRes.status === 'fulfilled') setClaims(claimRes.value?.data?.claims || claimRes.value?.data || [])
      if (disRes.status === 'fulfilled') {
        const disData = disRes.value?.data
        setDisruptions(disData?.disruptions || disData?.active || [])
        const w = disData?.weather || disData?.current
        const aqiVal = disData?.aqi?.aqi ?? disData?.aqi
        setWeather(w ? { ...w, aqi: aqiVal } : (aqiVal != null ? { aqi: aqiVal } : null))
      }
    } catch {
      setPolicies([])
      setClaims([])
      setDisruptions([])
    } finally {
      setLoading(false)
      setLastUpdated(Date.now())
      setSecondsAgo(0)
    }
  }

  const activePolicy = policies.find((p) => p.status === 'active')
  const totalPayouts = claims
    .filter((c) => c.status === 'approved')
    .reduce((sum, c) => sum + (c.payoutAmount || c.amount || 0), 0)
  const activeDisruptionCount = disruptions.length
  const earningsProtected = user?.avgWeeklyEarnings || 0

  const recentClaims = [...claims].sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0)).slice(0, 5)
  const latestClaim = recentClaims[0]

  // Policy days remaining
  const policyEndDate = activePolicy?.endDate ? new Date(activePolicy.endDate) : null
  const daysRemaining = policyEndDate ? Math.max(0, Math.ceil((policyEndDate - Date.now()) / 86400000)) : null
  const coverageUsed = activePolicy ? Math.min(100, Math.round(((activePolicy.durationDays || 7) - (daysRemaining || 0)) / (activePolicy.durationDays || 7) * 100)) : 0

  const statusBadge = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    processing: 'bg-blue-100 text-blue-700',
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Live Disruption Banner */}
      {disruptions.length > 0 && (
        <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-orange-500 to-red-600 bg-[length:200%_100%] animate-[shimmer_3s_ease-in-out_infinite]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
              <span className="text-sm font-bold text-white uppercase tracking-wider">Active Disruption</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/90 truncate">
                {disruptions[0]?.type || disruptions[0]?.disruptionType || 'Weather'} disruption in {disruptions[0]?.city || user?.city || 'your area'}.
                {activePolicy ? ' Your policy is protecting you.' : ' Get covered now.'}
              </p>
            </div>
            {activePolicy && (
              <div className="flex items-center gap-1.5 shrink-0 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                <ShieldCheck className="w-4 h-4 text-white" />
                <span className="text-xs font-semibold text-white">Protected</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome + Last Updated */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.name?.split(' ')[0] || 'Rider'}!
            </h1>
            <p className="text-gray-500 mt-1">
              {user?.city && user?.platform ? `${user.platform} partner in ${user.city}` : 'Your income protection dashboard'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <RefreshCw className={`w-3.5 h-3.5 ${secondsAgo < 2 ? 'animate-spin' : ''}`} />
            <span>Updated {secondsAgo}s ago</span>
            <button
              onClick={() => loadData(true)}
              className="ml-1 px-2 py-1 rounded-md text-emerald-600 hover:bg-emerald-50 font-medium transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Stats with animated counters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Policy</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{activePolicy ? activePolicy.planName || 'Active' : 'None'}</p>
                {activePolicy && (
                  <div className="flex items-center gap-1 mt-2 text-sm font-medium text-emerald-600">
                    <TrendingUp className="w-4 h-4" />
                    <span>Protected</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Earnings Protected</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  <AnimatedNumber value={earningsProtected} prefix="₹" suffix="/wk" />
                </p>
                <div className="flex items-center gap-1 mt-2 text-sm font-medium text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                  <span>+5% vs last week</span>
                </div>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600">
                <IndianRupee className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Payouts</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  <AnimatedNumber value={totalPayouts} prefix="₹" />
                </p>
                {totalPayouts > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-sm font-medium text-emerald-600">
                    <TrendingUp className="w-4 h-4" />
                    <span>Claimed</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Disruptions</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  <AnimatedNumber value={activeDisruptionCount} />
                </p>
                {activeDisruptionCount > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-sm font-medium text-red-500">
                    <TrendingUp className="w-4 h-4" />
                    <span>In your area</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-red-50 text-red-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Active Policy Card (enhanced) */}
            {activePolicy && (
              <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/20">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{activePolicy.planName || 'Active Policy'}</h3>
                        <p className="text-sm text-gray-400">{activePolicy.coverageType || 'Income Protection'}</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                      Active
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Days Left</p>
                      <p className="text-xl font-bold">{daysRemaining ?? '7'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Coverage</p>
                      <p className="text-xl font-bold">₹{(activePolicy.coverageAmount || earningsProtected || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Renewal</p>
                      <p className="text-xl font-bold flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        {policyEndDate ? policyEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Coverage meter */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                      <span>Coverage period</span>
                      <span>{coverageUsed}% elapsed</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-white/10">
                      <div
                        className="h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700"
                        style={{ width: `${coverageUsed}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Weather Widget */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <CloudSun className="w-5 h-5 text-blue-500" />
                  Current Conditions -- {user?.city || 'Mumbai'}
                </h2>
              </div>
              {weather ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <Thermometer className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{weather.temp || weather.temperature || '--'}°C</p>
                    <p className="text-xs text-gray-500 mt-1">Temperature</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-4 text-center">
                    <CloudRain className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{weather.rainfall ?? weather.rain ?? '--'} mm</p>
                    <p className="text-xs text-gray-500 mt-1">Rainfall</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 text-center">
                    <Wind className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{weather.aqi ?? '--'}</p>
                    <p className="text-xs text-gray-500 mt-1">AQI</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <Thermometer className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">34°C</p>
                    <p className="text-xs text-gray-500 mt-1">Temperature</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-4 text-center">
                    <CloudRain className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">0 mm</p>
                    <p className="text-xs text-gray-500 mt-1">Rainfall</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 text-center">
                    <Wind className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">82</p>
                    <p className="text-xs text-gray-500 mt-1">AQI</p>
                  </div>
                </div>
              )}
            </div>

            {/* Active Disruptions */}
            {disruptions.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Disruptions</h2>
                <div className="space-y-3">
                  {disruptions.map((d, i) => (
                    <DisruptionCard key={d._id || i} disruption={d} />
                  ))}
                </div>
              </div>
            )}

            {/* Payout Timeline */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between p-6 pb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-500" />
                  Claim Pipeline
                </h2>
                <Link to="/claims" className="text-sm font-medium text-emerald-600 hover:text-emerald-500">
                  View all
                </Link>
              </div>

              {latestClaim ? (
                <div className="px-6 pb-6">
                  <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
                    <span className="capitalize font-medium text-gray-700">{latestClaim.disruptionType || latestClaim.type || 'Disruption'} claim</span>
                    <span>--</span>
                    <span>₹{(latestClaim.amount || 0).toLocaleString('en-IN')}</span>
                  </div>

                  {/* Timeline */}
                  <div className="relative">
                    {pipelineSteps.map((step, i) => {
                      const steps = getStepStatus(latestClaim)
                      const done = steps[step.key]
                      const isLast = i === pipelineSteps.length - 1
                      const StepIcon = step.icon
                      return (
                        <div key={step.key} className="flex items-start gap-4 relative">
                          {!isLast && (
                            <div className={`absolute left-[18px] top-10 w-0.5 h-8 ${done ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                          )}
                          <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${
                            done ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {done ? <CheckCircle className="w-5 h-5" /> : <StepIcon className="w-4 h-4" />}
                          </div>
                          <div className="pb-6 flex-1">
                            <p className={`text-sm font-medium ${done ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {done ? (latestClaim.createdAt ? new Date(latestClaim.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Completed') : 'Pending'}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-6 pt-2 text-center text-gray-400 text-sm">
                  No claims yet. Your policy monitors disruptions automatically.
                </div>
              )}

              {/* Recent claims table */}
              {recentClaims.length > 1 && (
                <div className="border-t border-gray-100">
                  <div className="px-6 pt-4 pb-2">
                    <p className="text-sm font-medium text-gray-500">Other Recent Claims</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t border-gray-100 bg-gray-50">
                          <th className="text-left px-6 py-3 font-medium text-gray-500">Date</th>
                          <th className="text-left px-6 py-3 font-medium text-gray-500">Type</th>
                          <th className="text-left px-6 py-3 font-medium text-gray-500">Amount</th>
                          <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {recentClaims.slice(1).map((c, i) => (
                          <tr key={c._id || i} className="hover:bg-gray-50/50">
                            <td className="px-6 py-3 text-gray-600">
                              {new Date(c.createdAt || c.date || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </td>
                            <td className="px-6 py-3 text-gray-900 font-medium capitalize">{c.disruptionType || c.type || '--'}</td>
                            <td className="px-6 py-3 text-gray-900">₹{(c.amount || 0).toLocaleString('en-IN')}</td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge[c.status?.toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
                                {c.status || 'pending'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={() => setShowReport(true)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-red-50 text-red-700 font-medium hover:bg-red-100 transition-colors"
                >
                  <AlertTriangle className="w-5 h-5" />
                  Report Disruption
                </button>
                <Link
                  to="/buy-policy"
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Buy Policy
                </Link>
                <Link
                  to="/claims"
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 transition-colors"
                >
                  <Eye className="w-5 h-5" />
                  View Claims
                </Link>
                <Link
                  to="/risk-profile"
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-amber-50 text-amber-700 font-medium hover:bg-amber-100 transition-colors"
                >
                  <Activity className="w-5 h-5" />
                  Risk Profile
                </Link>
                <Link
                  to="/policies"
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-purple-50 text-purple-700 font-medium hover:bg-purple-100 transition-colors"
                >
                  <ShoppingBag className="w-5 h-5" />
                  My Policies
                </Link>
              </div>
            </div>

            {/* Profile Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Profile</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Platform</span>
                  <span className="text-gray-900 font-medium">{user?.platform || '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">City</span>
                  <span className="text-gray-900 font-medium">{user?.city || '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Zone</span>
                  <span className="text-gray-900 font-medium">{user?.zone || '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vehicle</span>
                  <span className="text-gray-900 font-medium">{user?.vehicleType || '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Avg Earnings</span>
                  <span className="text-gray-900 font-medium">₹{(user?.avgWeeklyEarnings || 0).toLocaleString('en-IN')}/wk</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Disruption Modal */}
      {showReport && (
        <ReportDisruption
          onClose={() => setShowReport(false)}
          onSuccess={() => {
            setShowReport(false)
            loadData()
          }}
        />
      )}
    </div>
  )
}

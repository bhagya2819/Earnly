<div align="center">

# Earnly

### AI-Powered Income Protection for Delivery Partners

[![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge)](/)
[![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20Python-blue?style=for-the-badge)](/)
[![Database](https://img.shields.io/badge/Database-Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](/)

> **"An AI-powered parametric insurance platform that automatically compensates delivery partners for income loss caused by real-world disruptions — using real-time data and intelligent validation."**

</div>

---

## The Problem

Food delivery partners earn entirely based on deliveries completed — no fixed salary, no safety net. Real-world conditions can wipe out their income overnight.

<table>
<tr>
<td width="50%">

###  Environmental Factors
- Heavy rainfall → reduced visibility
- Flooding → blocked roads
- Extreme heat → limited working hours
- High pollution → unsafe conditions

</td>
<td width="50%">

###  Administrative Restrictions
- City-wide curfews
- Zone closures
- Emergency situations
- Protest blockades

</td>
</tr>
</table>

**Result:** Reduced orders → Increased delivery time → **Direct income loss**

*No system currently exists to automatically compensate for these losses.*

---

## Our Solution

Earnly is an **AI-powered parametric insurance system** that:

| Step | Action |
|------|--------|
| 1 | Detects real-world disruptions via live data feeds |
| 2 | Validates authenticity across multiple trusted sources |
| 3 | Verifies actual impact on individual rider activity |
| 4 | **Automatically triggers payouts** — zero manual claims |

No paperwork &nbsp;&nbsp; No delays &nbsp;&nbsp; Fully automated

---

## Disruption Detection Rules

| Disruption Type | Trigger Condition |
|---|---|
|  **Heavy Rainfall** | Rainfall ≥ 50 mm/hr for ≥ 2 hours |
|  **Flooding** | Flood alert active OR traffic speed < 30% of normal |
|  **Extreme Heat** | Temperature ≥ 42°C for ≥ 3 hours |
|  **Air Pollution** | AQI ≥ 300 for ≥ 4 hours |
|  **Curfew / Emergency** | Government-issued alerts active |

---

## Workflow

<div align="center">

![Earnly Architecture](images/Workflow.jpeg)

</div>

### Services Overview

| Component | Role |
|---|---|
| **React Frontend** | Rider dashboard, policy management, payout history |
| **Node.js Backend** | REST API, auth, policy & billing logic |
| **Firebase** | User data, policies, real-time updates |
| **Python ML Service** | Disruption validation via News API & Weather API |
| **Payment Service** | Razorpay-powered automatic payout execution |
| **Notification Service** | Rider alerts and status updates |
| **Admin Dashboard** | Manual review and override for edge cases |

---

## Decision Engine

| Signal | Weight |
|---|---|
| Disruption Validity | High |
| Activity Impact | High |
| Movement Consistency | Medium |
| Network Reliability | Medium |

**Outcomes:**
- **High Score** → Payout triggered immediately
- **Medium Score** → Flagged for additional verification
- **Low Score** → Claim rejected

---

## Adversarial Defense — GPS Spoofing

| Technique | What it catches |
|---|---|
| Movement Analysis | Unrealistic location jumps |
| Activity Verification | Movement with zero deliveries |
| Group Detection | Coordinated mass fraud patterns |

---

## Tech Stack

<table>
<tr>
<td><b>Frontend</b></td>
<td>React (Vite), Tailwind CSS</td>
</tr>
<tr>
<td><b>Backend</b></td>
<td>Node.js, Express.js</td>
</tr>
<tr>
<td><b>AI / ML</b></td>
<td>Python, Scikit-learn, Pandas</td>
</tr>
<tr>
<td><b>Database</b></td>
<td>Firebase (Firestore + Realtime DB)</td>
</tr>
<tr>
<td><b>External APIs</b></td>
<td>OpenWeatherMap, AQI APIs, News APIs</td>
</tr>
<tr>
<td><b>Payments</b></td>
<td>Razorpay (Test Mode)</td>
</tr>
<tr>
<td><b>Auth</b></td>
<td>Firebase Auth + JWT</td>
</tr>
</table>

---

## How It Works — End to End

```
User purchases weekly policy
        ↓
System monitors environment in real-time
        ↓
Disruption detected
        ↓
Multi-source validation (≥ 2/3 sources must agree)
        ↓
Activity impact verified (< 70% normal deliveries)
        ↓
Fraud checks executed
        ↓
Decision engine evaluates all signals
        ↓
Automatic payout triggered
```

---

## Key Features

| Feature | Description |
|---|---|
| Zero-Claim Payouts | Fully automated — riders never need to file a claim |
| Real-Time Monitoring | Continuous data streams from weather, traffic, and news |
| AI Risk Assessment | ML models for fraud detection and income estimation |
| Fraud-Resistant | Multi-layer validation and GPS anomaly detection |
| Subscription Model | Simple weekly policy for gig workers |
| Scalable | Modular services built to handle real-world load |

---

## Edge Case Handling

### Data-Related Issues

| Scenario | Problem | How It's Handled |
|---|---|---|
| **Incorrect Weather Data** | One source reports wrong information | Multi-source validation — at least 2 of 3 sources must agree before accepting an event |
| **Location Mismatch** | Disruption in one zone, not another | City divided into small zones; conditions validated specific to each rider's zone |
| **API Failure / Unavailability** | Data source goes down | Cached data used as fallback; backup APIs queried automatically |

---


### No Real Impact Cases

| Scenario | Problem | How It's Handled |
|---|---|---|
| **Rider Continues Working Normally** | Disruption exists but rider is unaffected | Activity threshold check — if deliveries ≥ 70% of normal → no payout |
| **Short Duration Disruption** | Brief event that doesn't meaningfully affect income | Minimum duration filters applied per disruption type (e.g., rain must last ≥ 2 hrs) |

---

### System-Level Issues

| Scenario | Problem | How It's Handled |
|---|---|---|
| **Duplicate Payouts** | Same event processed more than once | Unique event ID assigned; duplicate processing blocked |
| **Late Policy Activation** | User activates policy after disruption starts | Policy start time validated against event timestamp; backdating not allowed |

---

### Fraud Cases

| Scenario | Problem | How It's Handled |
|---|---|---|
| **False Claims** | User claims payout without real income loss | Historical behavior compared; activity data cross-validated |
| **GPS Spoofing** | Fake location to appear in disruption zone | Movement analysis detects unrealistic location jumps; flagged as suspicious |
| **No Deliveries But Active Location** | Moving without completing any orders | Activity verification: movement with zero deliveries → suspicious |
| **Coordinated Group Fraud** | Multiple users fake behaviour simultaneously | Group pattern detection identifies mass simultaneous anomalies |

---

## System Reliability

- The system uses **multiple independent APIs (3 sources)**, reducing dependency on any single data provider  
- Even if one API fails or returns incorrect data, the system continues operating using the remaining sources  
- This design avoids single-point failures and ensures consistent system availability  

---

<div align="center">

## Conclusion

Earnly provides a **fair, automated, and scalable** safety net for gig economy workers.

By combining real-time data intelligence with AI-driven validation, it ensures that delivery partners are compensated quickly and accurately — **without lifting a finger.**

---



</div>

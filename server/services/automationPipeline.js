/**
 * Automation Pipeline Service
 *
 * Core of the parametric insurance system. When a disruption is detected,
 * this service automatically finds affected riders, validates via ML,
 * checks for fraud, calculates payouts, and processes claims end-to-end.
 */

const axios = require('axios');
const { processPayout } = require('./payoutService');
const { sendNotificationEmail } = require('./emailService');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

// --------------- Notification Helper ---------------

async function createNotification(db, userId, type, title, message, metadata = {}) {
  const notification = {
    userId,
    type,
    title,
    message,
    metadata,
    read: false,
    createdAt: new Date().toISOString(),
  };

  let saved = null;
  try {
    const docRef = await db.collection('notifications').add(notification);
    saved = { id: docRef.id, ...notification };
  } catch (err) {
    console.error('[Notification] Failed to create notification:', err.message);
  }

  // Fire email in the background — don't block the caller
  (async () => {
    try {
      const riderDoc = await db.collection('riders').doc(userId).get();
      const email = riderDoc.exists ? riderDoc.data().email : null;
      if (!email) return;
      await sendNotificationEmail(email, { type, title, message, metadata });
    } catch (err) {
      console.warn(`[Notification] Email send failed for ${userId}:`, err.message);
    }
  })();

  return saved;
}

// --------------- ML Service Helpers ---------------

async function callMLValidateDisruption(disruption) {
  try {
    const res = await axios.post(`${ML_SERVICE_URL}/api/validate-disruption`, {
      type: disruption.type,
      city: disruption.city,
      severity: disruption.severity,
      duration: disruption.estimatedDuration || disruption.duration,
    }, { timeout: 5000 });
    return res.data;
  } catch (err) {
    console.warn('[AutoPipeline] ML validate-disruption unavailable, using fallback:', err.message);
    return null;
  }
}

async function callMLFraudCheck(rider, disruption, claim) {
  try {
    const res = await axios.post(`${ML_SERVICE_URL}/api/fraud-check`, {
      rider_id: rider.uid || rider.id,
      city: rider.city,
      zone: rider.zone || 'medium',
      platform: rider.platform || 'zomato',
      claim_amount: claim.maxPayout || 0,
      claim_count: rider.claimCount || 0,
      consecutive_weeks: rider.consecutiveWeeks || 0,
      disruption_type: disruption.type,
    }, { timeout: 5000 });
    return res.data;
  } catch (err) {
    console.warn('[AutoPipeline] ML fraud-check unavailable, using fallback:', err.message);
    return null;
  }
}

async function callMLCalculatePayout(rider, disruption, policy) {
  try {
    const res = await axios.post(`${ML_SERVICE_URL}/api/calculate-payout`, {
      rider_id: rider.uid || rider.id,
      city: rider.city,
      zone: rider.zone || 'medium',
      platform: rider.platform || 'zomato',
      disruption_type: disruption.type,
      severity: disruption.severity,
      duration: disruption.estimatedDuration || disruption.duration,
      avg_weekly_earnings: rider.avgWeeklyEarnings || 0,
      coverage_percent: policy.coveragePercent || 80,
      plan_name: policy.planName || policy.planId,
    }, { timeout: 5000 });
    return res.data;
  } catch (err) {
    console.warn('[AutoPipeline] ML calculate-payout unavailable, using fallback:', err.message);
    return null;
  }
}

// --------------- Fallback Logic ---------------

function fallbackSeverityScore(disruption) {
  // Convert severity to numeric if it's a string
  let score;
  if (typeof disruption.severity === 'number') {
    score = disruption.severity;
  } else {
    const severityMap = { low: 3, medium: 5, high: 7, critical: 9, extreme: 10 };
    score = severityMap[String(disruption.severity).toLowerCase()] || 5;
  }
  return score;
}

function fallbackDecision(disruption) {
  const score = fallbackSeverityScore(disruption);
  if (score > 7) return 'auto_approved';
  if (score >= 4) return 'flagged';
  return 'auto_rejected';
}

function fallbackPayoutAmount(rider, disruption, policy) {
  const weeklyEarnings = rider.avgWeeklyEarnings || 3000;
  const coveragePercent = policy.coveragePercent || 80;
  const payoutPercent = disruption.payoutPercent || 80;
  const dailyEarnings = weeklyEarnings / 7;
  const duration = disruption.estimatedDuration || disruption.duration || 4;
  const durationDays = duration >= 24 ? Math.ceil(duration / 24) : 1;

  return Math.round(dailyEarnings * durationDays * (coveragePercent / 100) * (payoutPercent / 100));
}

// --------------- Main Pipeline ---------------

async function processDisruption(disruption, db) {
  const startTime = Date.now();
  const results = {
    processedRiders: 0,
    claimsCreated: 0,
    claimsApproved: 0,
    claimsRejected: 0,
    claimsFlagged: 0,
    totalPayout: 0,
    errors: [],
  };

  console.log(`[AutoPipeline] Processing disruption: ${disruption.type} in ${disruption.city}`);

  // Step 1: Validate disruption via ML
  const validation = await callMLValidateDisruption(disruption);
  const disruptionConfidence = validation
    ? (validation.confidence || validation.disruption_confidence || 0.8)
    : disruption.confidence || 1.0;

  if (validation && disruptionConfidence < 0.3) {
    console.log('[AutoPipeline] Disruption confidence too low, skipping.');
    return results;
  }

  // Step 2: Find all riders with active policies in the affected city
  let activePolicies = [];
  try {
    const policiesSnap = await db.collection('policies')
      .where('status', '==', 'active')
      .get();

    // Filter by city (need to look up rider for each policy)
    for (const doc of policiesSnap.docs) {
      const policy = { id: doc.id, ...doc.data() };
      try {
        const riderDoc = await db.collection('riders').doc(policy.userId).get();
        if (riderDoc.exists) {
          const rider = riderDoc.data();
          const riderCity = (rider.city || '').toLowerCase();
          const disruptionCity = (disruption.city || '').toLowerCase();
          if (riderCity === disruptionCity) {
            activePolicies.push({ policy, rider: { id: policy.userId, ...rider } });
          }
        }
      } catch (err) {
        console.warn(`[AutoPipeline] Failed to fetch rider for policy ${policy.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[AutoPipeline] Failed to fetch policies:', err.message);
    results.errors.push('Failed to fetch active policies');
    return results;
  }

  console.log(`[AutoPipeline] Found ${activePolicies.length} active policies in ${disruption.city}`);

  // Step 3: Process each rider
  for (const { policy, rider } of activePolicies) {
    results.processedRiders++;

    try {
      // Check for existing claim for this disruption + user combo
      const existingClaims = await db.collection('claims')
        .where('userId', '==', rider.id)
        .where('disruptionId', '==', disruption.id || disruption.triggerId)
        .get();

      if (!existingClaims.empty) {
        console.log(`[AutoPipeline] Claim already exists for rider ${rider.id}, skipping.`);
        continue;
      }

      // ML fraud check
      const fraudResult = await callMLFraudCheck(rider, disruption, { maxPayout: policy.coveragePercent * (rider.avgWeeklyEarnings || 3000) / 100 });
      const fraudScore = fraudResult
        ? (fraudResult.fraud_score || fraudResult.fraudScore || 0.1)
        : 0.1;
      const fraudFlags = fraudResult
        ? (fraudResult.flags || fraudResult.fraud_flags || [])
        : [];

      // ML payout calculation
      const payoutResult = await callMLCalculatePayout(rider, disruption, policy);
      const payoutAmount = payoutResult
        ? (payoutResult.payout_amount || payoutResult.payoutAmount || fallbackPayoutAmount(rider, disruption, policy))
        : fallbackPayoutAmount(rider, disruption, policy);

      // Create claim document
      const claim = {
        disruptionId: disruption.id || disruption.triggerId,
        userId: rider.id,
        policyId: policy.id,
        planName: policy.planName || policy.planId,
        estimatedLoss: payoutAmount,
        coveragePercent: policy.coveragePercent,
        maxPayout: payoutAmount,
        payoutAmount: 0,
        status: 'pending',
        fraudScore,
        fraudFlags,
        fraudFlag: fraudScore > 0.5,
        disruptionConfidence,
        automationInitiated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Decision logic
      let decision;
      if (fraudScore > 0.7) {
        decision = 'auto_rejected';
      } else if (fraudScore < 0.5 && fraudFlags.length === 0 && disruptionConfidence >= 0.6) {
        decision = 'auto_approved';
      } else {
        // Use fallback severity-based logic if ML was unavailable
        if (!fraudResult && !validation) {
          decision = fallbackDecision(disruption);
        } else {
          decision = 'flagged';
        }
      }

      // Apply decision
      if (decision === 'auto_approved') {
        claim.status = 'approved';
        claim.payoutAmount = payoutAmount;
        claim.approvedAt = new Date().toISOString();
        claim.approvalMethod = 'automation';
      } else if (decision === 'auto_rejected') {
        claim.status = 'rejected';
        claim.rejectionReason = 'Automated fraud detection';
        claim.rejectedAt = new Date().toISOString();
      } else {
        claim.status = 'flagged';
        claim.flagReason = 'Medium confidence - requires manual review';
      }

      // Save claim
      const claimRef = await db.collection('claims').add(claim);
      results.claimsCreated++;

      // Update rider claim count
      try {
        await db.collection('riders').doc(rider.id).update({
          claimCount: (rider.claimCount || 0) + 1,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // ignore
      }

      // Process payout if approved
      if (decision === 'auto_approved' && payoutAmount > 0) {
        try {
          const payoutRes = await processPayout(rider.id, payoutAmount, claimRef.id);
          await db.collection('claims').doc(claimRef.id).update({
            payoutId: payoutRes.payoutId,
            payoutTimestamp: payoutRes.timestamp,
          });
          results.claimsApproved++;
          results.totalPayout += payoutAmount;

          await createNotification(db, rider.id, 'claim_approved',
            'Claim Auto-Approved',
            `Your claim for ${disruption.type} disruption has been automatically approved. Payout of INR ${payoutAmount} is being processed.`,
            { claimId: claimRef.id, payoutAmount, disruptionType: disruption.type }
          );
        } catch (err) {
          console.error(`[AutoPipeline] Payout failed for rider ${rider.id}:`, err.message);
          results.errors.push(`Payout failed for ${rider.id}: ${err.message}`);
        }
      } else if (decision === 'auto_rejected') {
        results.claimsRejected++;

        await createNotification(db, rider.id, 'claim_rejected',
          'Claim Rejected',
          `Your claim for ${disruption.type} disruption has been rejected due to automated fraud detection. You may contact support to appeal.`,
          { claimId: claimRef.id, disruptionType: disruption.type, fraudScore }
        );
      } else {
        results.claimsFlagged++;

        await createNotification(db, rider.id, 'claim_review',
          'Claim Under Review',
          `Your claim for ${disruption.type} disruption is under manual review. We will update you shortly.`,
          { claimId: claimRef.id, disruptionType: disruption.type }
        );
      }
    } catch (err) {
      console.error(`[AutoPipeline] Error processing rider ${rider.id}:`, err.message);
      results.errors.push(`Rider ${rider.id}: ${err.message}`);
    }
  }

  results.processingTimeMs = Date.now() - startTime;
  console.log(`[AutoPipeline] Complete: ${results.claimsCreated} claims created, ${results.claimsApproved} approved, ${results.claimsRejected} rejected, ${results.claimsFlagged} flagged. Total payout: INR ${results.totalPayout}`);

  return results;
}

module.exports = { processDisruption, createNotification };

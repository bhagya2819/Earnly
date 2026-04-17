/**
 * Disruption Scheduler
 *
 * Periodically polls weather and AQI for the set of cities where Earnly riders
 * are active, evaluates parametric trigger rules, and runs the automation
 * pipeline (fraud check + ML validation + claim creation + notification) on
 * any newly-detected disruptions.
 *
 * Dedupe rule: a disruption with the same triggerId + city is skipped if one
 * was stored within the last `estimatedDuration` hours.
 */

const cron = require('node-cron');
const { db } = require('../config/firebase');
const { getCurrentWeather } = require('./weatherService');
const { getAQI } = require('./aqiService');
const { evaluateTriggers } = require('./triggerEngine');
const { processDisruption } = require('./automationPipeline');

const DEFAULT_CRON = process.env.DISRUPTION_SCHEDULE || '*/15 * * * *';
const FALLBACK_CITIES = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'kolkata', 'pune'];

async function getCitiesFromRiders() {
  try {
    const snap = await db.collection('riders').get();
    const cities = new Set();
    snap.docs.forEach((doc) => {
      const c = (doc.data().city || '').trim().toLowerCase();
      if (c) cities.add(c);
    });
    return cities.size ? [...cities] : FALLBACK_CITIES;
  } catch (err) {
    console.warn('[Scheduler] Failed to read rider cities, using fallback:', err.message);
    return FALLBACK_CITIES;
  }
}

async function isDuplicate(triggerId, city, dedupeWindowHours) {
  try {
    const snap = await db
      .collection('disruptions')
      .where('triggerId', '==', triggerId)
      .where('city', '==', city)
      .get();
    const cutoff = Date.now() - dedupeWindowHours * 60 * 60 * 1000;
    return snap.docs.some((d) => {
      const ts = new Date(d.data().triggeredAt || 0).getTime();
      return ts > cutoff;
    });
  } catch {
    return false;
  }
}

async function scanCity(city) {
  const [weather, aqi] = await Promise.all([
    getCurrentWeather(city),
    getAQI(city),
  ]);

  const triggered = evaluateTriggers(weather, aqi, [], city);
  if (!triggered.length) return { city, triggered: 0, processed: 0 };

  let processed = 0;
  for (const t of triggered) {
    const dup = await isDuplicate(t.triggerId, city, t.estimatedDuration || 4);
    if (dup) continue;

    const record = { ...t, source: 'scheduler', storedAt: new Date().toISOString() };
    try {
      const ref = await db.collection('disruptions').add(record);
      await processDisruption({ id: ref.id, ...record }, db);
      processed += 1;
    } catch (err) {
      console.error(`[Scheduler] Failed to process ${t.triggerId} for ${city}:`, err.message);
    }
  }

  return { city, triggered: triggered.length, processed };
}

async function runOnce() {
  const startedAt = Date.now();
  const cities = await getCitiesFromRiders();
  console.log(`[Scheduler] Scanning ${cities.length} cities: ${cities.join(', ')}`);

  const summary = { cities: cities.length, triggered: 0, processed: 0 };
  for (const city of cities) {
    try {
      const r = await scanCity(city);
      summary.triggered += r.triggered;
      summary.processed += r.processed;
    } catch (err) {
      console.error(`[Scheduler] Scan failed for ${city}:`, err.message);
    }
  }

  const ms = Date.now() - startedAt;
  console.log(`[Scheduler] Done in ${ms}ms — triggered=${summary.triggered}, processed=${summary.processed}`);
  return summary;
}

function start() {
  if (process.env.DISABLE_DISRUPTION_SCHEDULER === 'true') {
    console.log('[Scheduler] Disabled via DISABLE_DISRUPTION_SCHEDULER');
    return;
  }

  if (!cron.validate(DEFAULT_CRON)) {
    console.error(`[Scheduler] Invalid cron expression: ${DEFAULT_CRON}, scheduler not started`);
    return;
  }

  cron.schedule(DEFAULT_CRON, () => {
    runOnce().catch((err) => console.error('[Scheduler] runOnce failed:', err.message));
  });

  console.log(`[Scheduler] Active on cron "${DEFAULT_CRON}"`);
}

module.exports = { start, runOnce };

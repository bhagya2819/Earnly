const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { getCurrentWeather } = require('../services/weatherService');
const { getAQI } = require('../services/aqiService');
const { getAlerts } = require('../services/newsService');
const { evaluateTriggers } = require('../services/triggerEngine');
const { processDisruption } = require('../services/automationPipeline');
const disruptionScheduler = require('../services/disruptionScheduler');

// GET /api/disruptions/current/:city - Fetch current weather + AQI for a city
router.get('/current/:city', async (req, res) => {
  try {
    const { city } = req.params;

    const [weather, aqi, alerts] = await Promise.all([
      getCurrentWeather(city),
      getAQI(city),
      getAlerts(city),
    ]);

    res.json({
      city,
      timestamp: new Date().toISOString(),
      weather,
      aqi,
      alerts,
    });
  } catch (err) {
    console.error('[Disruptions] Current data error:', err.message);
    res.status(500).json({ error: 'Failed to fetch current data', details: err.message });
  }
});

// POST /api/disruptions/check-triggers - Evaluate trigger rules against current data
router.post('/check-triggers', async (req, res) => {
  try {
    const { city } = req.body;

    if (!city) {
      return res.status(400).json({ error: 'city is required' });
    }

    const [weather, aqi, alerts] = await Promise.all([
      getCurrentWeather(city),
      getAQI(city),
      getAlerts(city),
    ]);

    const triggered = evaluateTriggers(weather, aqi, alerts, city);

    // Store triggered disruptions in Firestore
    for (const disruption of triggered) {
      try {
        await db.collection('disruptions').add({
          ...disruption,
          source: 'auto',
          storedAt: new Date().toISOString(),
        });
      } catch {
        // ignore storage errors
      }
    }

    res.json({
      city,
      timestamp: new Date().toISOString(),
      weather,
      aqi,
      alertCount: alerts.length,
      triggeredCount: triggered.length,
      disruptions: triggered,
    });
  } catch (err) {
    console.error('[Disruptions] Trigger check error:', err.message);
    res.status(500).json({ error: 'Trigger evaluation failed', details: err.message });
  }
});

// POST /api/disruptions/simulate - Admin endpoint to simulate a disruption
router.post('/simulate', async (req, res) => {
  try {
    const { type, city, severity, duration, payoutPercent } = req.body;

    if (!type || !city) {
      return res.status(400).json({ error: 'type and city are required' });
    }

    const validTypes = ['rain', 'heatwave', 'pollution', 'flood', 'cyclone', 'curfew', 'storm'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    const disruption = {
      triggerId: `sim_${Date.now()}`,
      name: `Simulated ${type}`,
      type,
      city,
      severity: severity || 'high',
      confidence: 1.0,
      estimatedDuration: duration || 4,
      payoutPercent: payoutPercent || 80,
      description: `Simulated ${type} disruption for ${city}`,
      triggeredAt: new Date().toISOString(),
      source: 'simulation',
      simulated: true,
    };

    const docRef = await db.collection('disruptions').add(disruption);
    const disruptionWithId = { id: docRef.id, ...disruption };

    // Run automation pipeline
    let automationResults = null;
    try {
      automationResults = await processDisruption(disruptionWithId, db);
    } catch (autoErr) {
      console.error('[Disruptions] Automation pipeline error:', autoErr.message);
      automationResults = { error: autoErr.message };
    }

    res.status(201).json({
      message: 'Disruption simulated successfully',
      disruption: disruptionWithId,
      automation: automationResults,
    });
  } catch (err) {
    console.error('[Disruptions] Simulate error:', err.message);
    res.status(500).json({ error: 'Simulation failed', details: err.message });
  }
});

// POST /api/disruptions/scan-now - Admin: run the scheduler once immediately
router.post('/scan-now', async (req, res) => {
  try {
    const summary = await disruptionScheduler.runOnce();
    res.json({ message: 'Scan complete', summary });
  } catch (err) {
    console.error('[Disruptions] Scan error:', err.message);
    res.status(500).json({ error: 'Scan failed', details: err.message });
  }
});

// POST /api/disruptions/process - Manually trigger processing for an existing disruption
router.post('/process', async (req, res) => {
  try {
    const { disruptionId } = req.body;

    if (!disruptionId) {
      return res.status(400).json({ error: 'disruptionId is required' });
    }

    const disruptionDoc = await db.collection('disruptions').doc(disruptionId).get();
    if (!disruptionDoc.exists) {
      return res.status(404).json({ error: 'Disruption not found' });
    }

    const disruption = { id: disruptionDoc.id, ...disruptionDoc.data() };

    const automationResults = await processDisruption(disruption, db);

    res.json({
      message: 'Disruption re-processed successfully',
      disruption,
      automation: automationResults,
    });
  } catch (err) {
    console.error('[Disruptions] Process error:', err.message);
    res.status(500).json({ error: 'Processing failed', details: err.message });
  }
});

// GET /api/disruptions/history/:city - Get past disruptions from Firestore
router.get('/history/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const snapshot = await db
      .collection('disruptions')
      .where('city', '==', city.toLowerCase())
      .get();

    // Also try with original casing
    const snapshot2 = await db
      .collection('disruptions')
      .where('city', '==', city)
      .get();

    const seen = new Set();
    const disruptions = [];

    const addDocs = (docs) => {
      docs.forEach((doc) => {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          disruptions.push({ id: doc.id, ...doc.data() });
        }
      });
    };

    addDocs(snapshot.docs);
    addDocs(snapshot2.docs);

    // Sort by triggeredAt descending
    disruptions.sort((a, b) => new Date(b.triggeredAt) - new Date(a.triggeredAt));

    res.json({ city, disruptions });
  } catch (err) {
    console.error('[Disruptions] History error:', err.message);
    res.status(500).json({ error: 'Failed to fetch history', details: err.message });
  }
});

module.exports = router;

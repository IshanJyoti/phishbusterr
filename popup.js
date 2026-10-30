// PhishBuster AI — popup.js

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`panel-${tab}`).classList.add('active');
  if (tab === 'gmail') checkGmailStatus();
}

function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) return;
  chrome.storage.local.set({ claudeApiKey: key }, () => showSaveMsg('save-msg'));
}

function saveGsbKey() {
  const key = document.getElementById('gsb-key-input').value.trim();
  if (!key) return;
  chrome.storage.local.set({ gsbApiKey: key }, () => showSaveMsg('gsb-save-msg'));
}

function saveMlUrl() {
  const url = document.getElementById('ml-url-input').value.trim();
  if (!url) return;
  chrome.storage.local.set({ mlBackendUrl: url }, () => showSaveMsg('ml-save-msg'));
}

function showSaveMsg(id) {
  const el = document.getElementById(id);
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

function loadSettings() {
  chrome.storage.local.get(['claudeApiKey', 'gsbApiKey', 'mlBackendUrl'], (data) => {
    if (data.claudeApiKey) document.getElementById('api-key-input').value = data.claudeApiKey;
    if (data.gsbApiKey) document.getElementById('gsb-key-input').value = data.gsbApiKey;
    if (data.mlBackendUrl) document.getElementById('ml-url-input').value = data.mlBackendUrl;
  });
}

function showResult(prefix, verdict, explanation, score, indicators, type) {
  const card = document.getElementById(`${prefix}-result`);
  const loading = document.getElementById(`${prefix}-loading`);
  loading.classList.remove('visible');
  card.className = `result-card visible ${type}`;
  document.getElementById(`${prefix}-icon`).textContent =
    type === 'safe' ? '✅' : type === 'danger' ? '🚨' : '⚠️';
  document.getElementById(`${prefix}-verdict`).textContent = verdict;
  document.getElementById(`${prefix}-explanation`).textContent = explanation;
  document.getElementById(`${prefix}-score`).textContent = score;
  const indEl = document.getElementById(`${prefix}-indicators`);
  indEl.innerHTML = '';
  (indicators || []).forEach(ind => {
    const span = document.createElement('span');
    span.className = `indicator ${ind.color}`;
    span.textContent = ind.label;
    indEl.appendChild(span);
  });
}

function showLoading(prefix) {
  document.getElementById(`${prefix}-result`).classList.remove('visible');
  document.getElementById(`${prefix}-loading`).classList.add('visible');
}

async function analyzeEmail() {
  const emailText = document.getElementById('email-input').value.trim();
  if (!emailText) { alert('Please paste some email content first.'); return; }
  showLoading('email');

  chrome.storage.local.get(['claudeApiKey', 'mlBackendUrl'], async (data) => {
    try {
      let mlResult = null;
      let aiResult = null;

      // Step 1 — Try ML model first
      if (data.mlBackendUrl) {
        try {
          mlResult = await callMLBackend(data.mlBackendUrl, emailText);
        } catch (e) {
          console.log('ML backend unavailable');
        }
      }

      // Step 2 — Try Groq AI for better explanation
      if (data.claudeApiKey) {
        try {
          aiResult = await analyzeWithClaude(emailText, data.claudeApiKey);
        } catch (e) {
          console.log('AI API unavailable');
        }
      }

      // Step 3 — Combine both results
      if (mlResult && aiResult) {
        // Use ML score + AI explanation + combined indicators
        const combined = {
          verdict: mlResult.score >= 75 ? 'PHISHING' : mlResult.score >= 40 ? 'SUSPICIOUS' : 'SAFE',
          score: mlResult.score,
          explanation: `🧠 ML Model: ${mlResult.score}% phishing probability. \n\n🤖 AI Analysis: ${aiResult.explanation}`,
          indicators: [...(mlResult.indicators || []), ...(aiResult.indicators || [])].slice(0, 6)
        };
        displayEmailResult(combined);
      } else if (mlResult) {
        displayEmailResult(mlResult);
      } else if (aiResult) {
        displayEmailResult(aiResult);
      } else {
        document.getElementById('email-loading').classList.remove('visible');
        alert('Please add your API key in Settings first.');
      }

    } catch (err) {
      document.getElementById('email-loading').classList.remove('visible');
      alert('Error: ' + err.message);
    }
  });
}
async function callMLBackend(backendUrl, text) {
  const response = await fetch(`${backendUrl}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!response.ok) return null;
  return await response.json();
}

async function analyzeWithClaude(emailText, apiKey) {
  const prompt = `You are a cybersecurity expert. Analyze this email for phishing. Reply ONLY with valid JSON, no extra text.

Email:
"""
${emailText}
"""

JSON format:
{
  "verdict": "SAFE" or "SUSPICIOUS" or "PHISHING",
  "score": number from 0 to 100,
  "explanation": "2-3 sentence explanation",
  "indicators": [{"label": "short flag", "color": "red or yellow or green or blue"}]
}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  const text = data.choices[0].message.content;
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

function displayEmailResult(result) {
  const type = result.verdict === 'PHISHING' ? 'danger' : result.verdict === 'SUSPICIOUS' ? 'warning' : 'safe';
  showResult('email', result.verdict, result.explanation, result.score + '%', result.indicators, type);
}

async function checkURL() {
  const url = document.getElementById('url-input').value.trim();
  if (!url) { alert('Please enter a URL.'); return; }
  showLoading('url');
  chrome.storage.local.get(['gsbApiKey', 'claudeApiKey'], async (data) => {
    try {
      const heuristic = runURLHeuristics(url);
      if (data.gsbApiKey) {
        try {
          const gsbResult = await checkGoogleSafeBrowsing(url, data.gsbApiKey);
          if (gsbResult.threat) {
            showResult('url', '🚨 MALICIOUS URL',
              `Google Safe Browsing flagged this as: ${gsbResult.threatType}. Do NOT visit.`,
              '99%', [{ label: gsbResult.threatType, color: 'red' }], 'danger');
            return;
          }
        } catch (e) { console.log('GSB failed:', e); }
      }
      if (data.claudeApiKey) {
        const result = await analyzeURLWithClaude(url, data.claudeApiKey, heuristic);
        showResult('url', result.verdict, result.explanation, result.score, result.indicators, result.type);
      } else {
        const type = heuristic.score > 60 ? 'warning' : 'safe';
        showResult('url', heuristic.score > 60 ? 'SUSPICIOUS' : 'LIKELY SAFE',
          heuristic.explanation, heuristic.score + '%', heuristic.indicators, type);
      }
    } catch (err) {
      document.getElementById('url-loading').classList.remove('visible');
      alert('Error: ' + err.message);
    }
  });
}

function runURLHeuristics(url) {
  const indicators = [];
  let score = 0;
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const fullUrl = url.toLowerCase();

    const suspiciousTLDs = ['.xyz', '.tk', '.ml', '.ga', '.cf', '.gq', '.top', '.click', '.link'];
    if (suspiciousTLDs.some(t => domain.endsWith(t))) { score += 25; indicators.push({ label: 'SUSPICIOUS TLD', color: 'red' }); }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) { score += 35; indicators.push({ label: 'IP ADDRESS URL', color: 'red' }); }

    const brands = ['paypal', 'amazon', 'apple', 'google', 'microsoft', 'netflix', 'facebook', 'bank'];
    brands.forEach(brand => {
      if (fullUrl.includes(brand) && !domain.endsWith(brand + '.com')) {
        score += 40; indicators.push({ label: `FAKE ${brand.toUpperCase()}`, color: 'red' });
      }
    });

    const phishKeywords = ['login', 'signin', 'verify', 'secure', 'account', 'update', 'confirm', 'password'];
    phishKeywords.forEach(k => {
      if (path.includes(k)) { score += 10; indicators.push({ label: k.toUpperCase(), color: 'yellow' }); }
    });

    if (url.length > 100) { score += 15; indicators.push({ label: 'VERY LONG URL', color: 'yellow' }); }
    if (domain.split('.').length > 4) { score += 20; indicators.push({ label: 'MANY SUBDOMAINS', color: 'yellow' }); }
    if (parsed.protocol !== 'https:') { score += 20; indicators.push({ label: 'NO HTTPS', color: 'red' }); }
    else { indicators.push({ label: 'HTTPS PRESENT', color: 'green' }); }

    score = Math.min(score, 100);
    return { score, indicators, explanation: `Heuristic scan found ${indicators.length} signals. Risk: ${score}/100.` };
  } catch {
    return { score: 50, indicators: [{ label: 'INVALID URL', color: 'red' }], explanation: 'Could not parse URL.' };
  }
}

async function checkGoogleSafeBrowsing(url, apiKey) {
  const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client: { clientId: 'phishbuster', clientVersion: '1.0.0' },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url }]
      }
    })
  });
  const data = await response.json();
  if (data.matches && data.matches.length > 0) return { threat: true, threatType: data.matches[0].threatType };
  return { threat: false };
}

async function analyzeURLWithClaude(url, apiKey, heuristic) {
  const prompt = `You are a cybersecurity expert. Analyze this URL for phishing. Reply ONLY with valid JSON.

URL: ${url}
Heuristic score: ${heuristic.score}/100
Flags: ${heuristic.indicators.map(i => i.label).join(', ')}

JSON format:
{
  "verdict": "SAFE" or "SUSPICIOUS" or "MALICIOUS",
  "score": "XX%",
  "explanation": "2-3 sentences",
  "indicators": [{"label": "flag", "color": "red or yellow or green or blue"}],
  "type": "safe" or "warning" or "danger"
}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  const text = data.choices[0].message.content;
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

async function checkGmailStatus() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('mail.google.com')) {
      document.getElementById('gmail-status').textContent = 'CONNECTED ✓';
      document.getElementById('gmail-status').style.color = 'var(--safe)';
    } else {
      document.getElementById('gmail-status').textContent = 'OPEN GMAIL FIRST';
      document.getElementById('gmail-status').style.color = 'var(--warn)';
    }
  });
  chrome.storage.local.get(['scannedCount', 'threatCount'], (data) => {
    document.getElementById('gmail-count').textContent = data.scannedCount || 0;
    document.getElementById('gmail-threats').textContent = data.threatCount || 0;
  });
}

function scanGmail() {
  showLoading('gmail');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url.includes('mail.google.com')) {
      document.getElementById('gmail-loading').classList.remove('visible');
      alert('Please open Gmail first, then open an email to scan.');
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, { action: 'extractEmail' }, async (response) => {
      if (!response || !response.success) {
        document.getElementById('gmail-loading').classList.remove('visible');
        alert('Please open an email in Gmail first, then try again.');
        return;
      }
      const { subject, sender, body } = response.data;
      const fullText = `Subject: ${subject}\nFrom: ${sender}\n\n${body}`;
      chrome.storage.local.get(['claudeApiKey', 'scannedCount', 'threatCount'], async (data) => {
        if (!data.claudeApiKey) {
          document.getElementById('gmail-loading').classList.remove('visible');
          alert('Add your Claude API key in Settings first.');
          return;
        }
        try {
          const result = await analyzeWithClaude(fullText, data.claudeApiKey);
          const type = result.verdict === 'PHISHING' ? 'danger' : result.verdict === 'SUSPICIOUS' ? 'warning' : 'safe';
          showResult('gmail', result.verdict, result.explanation, result.score + '%', result.indicators, type);
          const newCount = (data.scannedCount || 0) + 1;
          const newThreats = (data.threatCount || 0) + (type === 'danger' ? 1 : 0);
          chrome.storage.local.set({ scannedCount: newCount, threatCount: newThreats });
          document.getElementById('gmail-count').textContent = newCount;
          document.getElementById('gmail-threats').textContent = newThreats;
        } catch (err) {
          document.getElementById('gmail-loading').classList.remove('visible');
          alert('Error: ' + err.message);
        }
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // Tab switching
  document.getElementById('tab-email').addEventListener('click', () => switchTab('email'));
  document.getElementById('tab-url').addEventListener('click', () => switchTab('url'));
  document.getElementById('tab-gmail').addEventListener('click', () => switchTab('gmail'));
  document.getElementById('tab-settings').addEventListener('click', () => switchTab('settings'));

  // Buttons
  document.getElementById('btn-analyze').addEventListener('click', analyzeEmail);
  document.getElementById('btn-scan-url').addEventListener('click', checkURL);
  document.getElementById('btn-scan-gmail').addEventListener('click', scanGmail);
  document.getElementById('btn-save-api').addEventListener('click', saveApiKey);
  document.getElementById('btn-save-gsb').addEventListener('click', saveGsbKey);
  document.getElementById('btn-save-ml').addEventListener('click', saveMlUrl);
});
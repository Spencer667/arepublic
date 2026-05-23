const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, query, get, close } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize DB
let dbReady = false;
getDb().then(() => { dbReady = true; console.log('数据库已就绪'); });

function waitForDb(req, res, next) {
  if (dbReady) return next();
  res.status(503).json({ code: 1, msg: '数据库初始化中，请稍候...' });
}

app.use(waitForDb);

// ===== API Routes =====

app.get('/api/spirits', (req, res) => {
  const { name, element, egg_group } = req.query;
  let sql = 'SELECT * FROM spirits WHERE 1=1';
  const params = [];
  if (name) { sql += ' AND name LIKE ?'; params.push(`%${name}%`); }
  if (element) { sql += ' AND element = ?'; params.push(element); }
  if (egg_group) { sql += ' AND (egg_group_qq LIKE ? OR egg_group_lcx LIKE ?)'; params.push(`%${egg_group}%`, `%${egg_group}%`); }
  try {
    const data = query(sql, params);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.get('/api/spirits/:id', (req, res) => {
  const data = get('SELECT * FROM spirits WHERE id = ?', [req.params.id]);
  if (!data) return res.status(404).json({ code: 1, msg: '未找到' });
  // Parse stats fields to numbers
  const result = { ...data };
  ['hp','attack','defense','special_attack','special_defense','speed'].forEach(f => {
    result[f] = parseInt(result[f]) || 0;
  });
  res.json({ code: 0, data: result });
});

app.get('/api/skills', (req, res) => {
  const { name, element, skill_type } = req.query;
  let sql = 'SELECT * FROM skills WHERE 1=1';
  const params = [];
  if (name) { sql += ' AND name LIKE ?'; params.push(`%${name}%`); }
  if (element) { sql += ' AND element = ?'; params.push(element); }
  if (skill_type) {
    if (skill_type === '状态') { sql += " AND type = '变化'"; }
    else if (skill_type === '攻击') { sql += " AND (type = '物理攻击' OR type = '魔法攻击')"; }
    else if (skill_type === '防御') { sql += " AND type = '防御'"; }
  }
  try {
    const data = query(sql, params);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.get('/api/skills/:id', (req, res) => {
  const data = get('SELECT * FROM skills WHERE id = ?', [req.params.id]);
  if (!data) return res.status(404).json({ code: 1, msg: '未找到' });
  res.json({ code: 0, data });
});

app.get('/api/items', (req, res) => {
  const { name, category } = req.query;
  let sql = 'SELECT * FROM items WHERE 1=1';
  const params = [];
  if (name) { sql += ' AND name LIKE ?'; params.push(`%${name}%`); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  try {
    const data = query(sql, params);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.get('/api/maps', (req, res) => {
  const { name, area } = req.query;
  let sql = 'SELECT * FROM maps WHERE 1=1';
  const params = [];
  if (name) { sql += ' AND name LIKE ?'; params.push(`%${name}%`); }
  if (area) { sql += ' AND area = ?'; params.push(area); }
  try {
    const data = query(sql, params);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.get('/api/eggs', (req, res) => {
  const { name, group_name } = req.query;
  let sql = 'SELECT * FROM eggs WHERE 1=1';
  const params = [];
  if (name) { sql += ' AND name LIKE ?'; params.push(`%${name}%`); }
  if (group_name) { sql += ' AND group_name = ?'; params.push(group_name); }
  try {
    const data = query(sql, params);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.get('/api/teams', (req, res) => {
  const { purpose } = req.query;
  let sql = 'SELECT * FROM teams WHERE 1=1';
  const params = [];
  if (purpose) { sql += ' AND purpose LIKE ?'; params.push(`%${purpose}%`); }
  try {
    const data = query(sql, params);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.get('/api/merchants', (req, res) => {
  try {
    const merchants = query('SELECT * FROM merchants');
    const result = merchants.map(m => {
      const goods = query('SELECT * FROM merchant_goods WHERE merchant_id = ?', [m.id]);
      return { ...m, goods };
    });
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.get('/api/merchants/refresh', (req, res) => {
  try {
    const merchants = query('SELECT id, name, location, refresh_interval, last_refresh FROM merchants');
    const now = new Date();
    const result = merchants.map(m => {
      const last = new Date(m.last_refresh);
      const elapsed = Math.floor((now - last) / 1000);
      const remaining = Math.max(0, m.refresh_interval - elapsed);
      const hours = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      const secs = remaining % 60;
      return {
        ...m,
        elapsed,
        remaining,
        remainingText: `${hours}时${mins}分${secs}秒`,
        next_refresh: new Date(last.getTime() + m.refresh_interval * 1000).toISOString()
      };
    });
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.get('/api/news', (req, res) => {
  try {
    const data = query('SELECT * FROM news ORDER BY date DESC');
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.get('/api/spirits/:id/skills', (req, res) => {
  try {
    const data = query(`
      SELECT sl.id, sl.skill_id, s.name, s.element, s.power, s.pp, s.type, s.description, s.pinxie
      FROM skill_learn sl
      JOIN skills s ON sl.skill_id = s.id
      WHERE sl.spirit_id = ?
    `, [req.params.id]);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.get('/api/skills/:id/spirits', (req, res) => {
  try {
    const data = query(`
      SELECT sl.id, sl.spirit_id, sp.name, sp.element, sp.image_url, sp.t_id
      FROM skill_learn sl
      JOIN spirits sp ON sl.spirit_id = sp.id
      WHERE sl.skill_id = ?
    `, [req.params.id]);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.get('/api/egg-measurements', (req, res) => {
  const { name, pet_id } = req.query;
  let sql = 'SELECT * FROM egg_measurements WHERE 1=1';
  const params = [];
  if (name) { sql += ' AND pet_name LIKE ?'; params.push(`%${name}%`); }
  if (pet_id) { sql += ' AND pet_id = ?'; params.push(pet_id); }
  try {
    const data = query(sql, params);
    res.json({ code: 0, data });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.get('/api/egg-query', (req, res) => {
  const { diameter, weight } = req.query;
  const d = parseFloat(diameter);
  const w = parseFloat(weight);
  if (isNaN(d) || isNaN(w)) return res.json({ code: 1, msg: '请输入数字' });
  try {
    const all = query('SELECT pet_name, pet_id, diameter_min, diameter_max, weight_min, weight_max, measurement_type FROM egg_measurements');
    const petScores = {};
    for (const item of all) {
      const inDiam = d >= item.diameter_min && d <= item.diameter_max;
      const inWt = w >= item.weight_min && w <= item.weight_max;
      const dMid = (item.diameter_min + item.diameter_max) / 2;
      const wMid = (item.weight_min + item.weight_max) / 2;
      const dSpan = Math.max(item.diameter_max - item.diameter_min, 0.01);
      const wSpan = Math.max(item.weight_max - item.weight_min, 0.1);
      const dDist = Math.abs(d - dMid) / dSpan;
      const wDist = Math.abs(w - wMid) / wSpan;
      const score = Math.max(0, 100 - (dDist * 40 + wDist * 60));

      if (!petScores[item.pet_name]) {
        petScores[item.pet_name] = {
          pet_name: item.pet_name, pet_id: item.pet_id,
          diameter_min: item.diameter_min, diameter_max: item.diameter_max,
          weight_min: item.weight_min, weight_max: item.weight_max,
          bestScore: 0, hasExact: false, hasRange: false
        };
      }
      const p = petScores[item.pet_name];
      p.diameter_min = Math.min(p.diameter_min, item.diameter_min);
      p.diameter_max = Math.max(p.diameter_max, item.diameter_max);
      p.weight_min = Math.min(p.weight_min, item.weight_min);
      p.weight_max = Math.max(p.weight_max, item.weight_max);
      if (score > p.bestScore) p.bestScore = score;
      if (inDiam && inWt && item.measurement_type === 'exact') p.hasExact = true;
      if (inDiam && inWt) p.hasRange = true;
    }

    const results = Object.values(petScores)
      .filter(p => p.bestScore > 0)
      .map(p => {
        const inDiam = d >= p.diameter_min && d <= p.diameter_max;
        const inWt = w >= p.weight_min && w <= p.weight_max;
        let matchType = '不匹配';
        if (inDiam && inWt) matchType = p.hasExact ? '精确匹配' : '范围匹配';
        else if (inDiam || inWt) matchType = '部分匹配';
        else matchType = '近似匹配';
        return { ...p, matchType, score: Math.round(p.bestScore) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    res.json({ code: 0, data: results });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ code: 0, data: { spirits: [], skills: [], items: [] } });
  try {
    const spirits = query('SELECT id, name, element, rarity FROM spirits WHERE name LIKE ? LIMIT 5', [`%${q}%`]);
    const skills = query('SELECT id, name, element, power FROM skills WHERE name LIKE ? LIMIT 5', [`%${q}%`]);
    const items = query('SELECT id, name, category, rarity FROM items WHERE name LIKE ? LIMIT 5', [`%${q}%`]);
    res.json({ code: 0, data: { spirits, skills, items } });
  } catch (e) {
    res.status(500).json({ code: 1, msg: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`洛克广场 服务已启动: http://localhost:${PORT}`);
});

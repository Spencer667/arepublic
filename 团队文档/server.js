require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const { getDb, query, get } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize DB
let dbReady = false;
getDb().then(() => { dbReady = true; console.log('数据库已就绪'); });

function waitForDb(req, res, next) {
  if (dbReady) return next();
  res.status(503).json({ code: 1, msg: '数据库初始化中，请稍候...' });
}

app.use(waitForDb);

// ===== Chat History =====
const chatHistory = {};

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
  if (name) { sql += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${name}%`, `%${name}%`); }
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

// ===== Chat API =====

app.post('/api/chat', async (req, res) => {
  try {
    const {
      userId = 'default',
      message,
      name,
      personality,
      style,
      chatCorpus,
      gameData,
      apiKey,
      endpoint,
      model
    } = req.body;

    if (!apiKey || !endpoint || !model) {
      return res.status(400).json({ code: 400, msg: '请先填写完整的API配置信息', data: null });
    }

    if (!chatHistory[userId]) chatHistory[userId] = [];

    let systemPrompt = `
你是洛克王国世界的游戏助手兼聊天伴侣，名字叫${name || '迪莫'}。
游戏背景：洛克王国(洛克王国世界)是一款精灵收集养成对战游戏，包含火/水/草/电/冰/暗/光/地/风/龙等系别精灵，精灵有种族值(HP/物攻/物防/特攻/特防/速度)、特性、蛋组(用于配对孵蛋)、技能系统。玩家通过蛋组配对孵化新精灵，通过蛋的尺寸和重量可以推测可能孵出的精灵。
性格：${personality || '可爱、温柔、有点粘人，喜欢用语气词和颜文字'}
说话方式：${style || '短句为主，语气亲切，多用🥰💗✨之类颜文字'}
特别要求：
1. 严禁搜索网络！所有游戏数据回答必须基于我提供的本地数据库信息；
2. 用户已经在界面上看到了数据卡片（精灵信息/技能/配对结果等），你只需要用你的人格语气简短评论这些结果，不要重复列出数据，不要编造数据库中不存在的信息；
3. 如果用户的问题有本地数据，在消息中会以【本地数据摘要】格式提供，请基于这个摘要回复；
4. 保持你设定的人格，回答时带上你的人格特色；
5. 回答时不要问"这是什么游戏"，你已经知道这是洛克王国；
`;

    if (gameData) {
      systemPrompt += `
【本地游戏数据库（仅基于此回答，禁止搜索）】
${gameData}
`;
    }
    systemPrompt += '【重要】禁止搜索网络，只能使用上述本地数据回答游戏问题。如果数据不在上面，诚实地告诉用户暂时查不到。\n';

    if (chatCorpus) {
      systemPrompt += `
【历史聊天语料——你必须模仿此风格】
${chatCorpus}
`;
    }

    const messages = [
      { role: "system", content: systemPrompt.trim() },
      ...chatHistory[userId],
      { role: "user", content: message }
    ];

    const response = await axios.post(
      endpoint,
      { model, messages, temperature: 0.9 },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const aiReply = response.data.choices?.[0]?.message?.content || '💗 人家不知道怎么回复啦～';

    chatHistory[userId].push(
      { role: "user", content: message },
      { role: "assistant", content: aiReply }
    );

    // Keep history within reasonable bounds
    if (chatHistory[userId].length > 40) {
      chatHistory[userId] = chatHistory[userId].slice(-30);
    }

    res.json({
      code: 200,
      data: { reply: aiReply },
      msg: 'success'
    });

  } catch (error) {
    console.error('Chat API Error:', error.message);
    let errorMsg = '服务器错误';
    if (error.response?.data?.error?.message) {
      errorMsg = error.response.data.error.message;
    } else if (error.message.includes('timeout')) {
      errorMsg = '请求超时，请检查网络或API地址';
    } else if (error.message.includes('401') || error.response?.status === 401) {
      errorMsg = 'API Key无效，请检查密钥是否正确';
    } else if (error.message.includes('404') || error.response?.status === 404) {
      errorMsg = '接口地址错误，请检查Endpoint是否正确';
    }
    res.status(500).json({ code: 500, msg: errorMsg, data: null });
  }
});

app.post('/api/clear-history', (req, res) => {
  const { userId = 'default' } = req.body;
  chatHistory[userId] = [];
  res.json({ code: 200, msg: '聊天历史已清空', data: null });
});

app.listen(PORT, () => {
  console.log(`洛克广场 服务已启动: http://localhost:${PORT}`);
});

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'lock.db');

let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  initTables();
  return db;
}

function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS spirits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      element TEXT,
      rarity TEXT,
      description TEXT,
      skill_ids TEXT,
      evolution TEXT,
      image TEXT,
      hp INTEGER DEFAULT 0,
      attack INTEGER DEFAULT 0,
      defense INTEGER DEFAULT 0,
      special_attack INTEGER DEFAULT 0,
      special_defense INTEGER DEFAULT 0,
      speed INTEGER DEFAULT 0,
      habitat TEXT,
      height TEXT,
      weight TEXT,
      image_url TEXT,
      abilities_text TEXT,
      evolution_condition TEXT,
      chain_group TEXT,
      evolution_stage TEXT,
      egg_group_lcx TEXT,
      egg_diameter TEXT,
      egg_weight TEXT,
      pve_team TEXT,
      pvp_team TEXT,
      t_id TEXT,
      lcx_id INTEGER,
      gender TEXT,
      qq_id INTEGER,
      shiny INTEGER DEFAULT 0,
      egg_group_qq TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      element TEXT,
      power INTEGER,
      pp INTEGER,
      accuracy INTEGER,
      description TEXT,
      type TEXT,
      pinxie TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS skill_learn (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spirit_id INTEGER,
      skill_id INTEGER,
      spirit_name TEXT,
      skill_name TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      rarity TEXT,
      price INTEGER,
      effect TEXT,
      description TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS maps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      area TEXT,
      description TEXT,
      npcs TEXT,
      resources TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS eggs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      group_name TEXT,
      hatch_steps INTEGER,
      possible_spirits TEXT,
      description TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      purpose TEXT,
      spirits TEXT,
      description TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      refresh_interval INTEGER DEFAULT 3600,
      last_refresh TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS merchant_goods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      price INTEGER,
      stock INTEGER DEFAULT 1,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      date TEXT,
      type TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      description TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS egg_measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_name TEXT NOT NULL,
      pet_id TEXT,
      diameter_min REAL,
      diameter_max REAL,
      weight_min REAL,
      weight_max REAL,
      measurement_type TEXT DEFAULT 'range',
      source TEXT DEFAULT 'luoke.help'
    )
  `);
  ensureColumns();
  save();
}

function ensureColumns() {
  const spiritsCols = query("PRAGMA table_info(spirits)").map(c => c.name);
  const skillsCols = query("PRAGMA table_info(skills)").map(c => c.name);
  const addCol = (table, col, type) => {
    try { db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch(e) {}
  };
  const spiritExtras = [
    ['abilities_text', 'TEXT'], ['evolution_condition', 'TEXT'], ['chain_group', 'TEXT'],
    ['evolution_stage', 'TEXT'], ['egg_group_lcx', 'TEXT'], ['egg_diameter', 'TEXT'],
    ['egg_weight', 'TEXT'], ['pve_team', 'TEXT'], ['pvp_team', 'TEXT'],
    ['t_id', 'TEXT'], ['lcx_id', 'INTEGER'], ['gender', 'TEXT'],
    ['qq_id', 'INTEGER'], ['shiny', 'INTEGER DEFAULT 0'], ['egg_group_qq', 'TEXT']
  ];
  spiritExtras.forEach(([col, type]) => {
    if (!spiritsCols.includes(col)) addCol('spirits', col, type);
  });
  if (!skillsCols.includes('pinxie')) addCol('skills', 'pinxie', 'TEXT');
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function get(sql, params = []) {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

function insert(table, data) {
  const keys = Object.keys(data);
  const placeholders = keys.map(() => '?').join(', ');
  const values = keys.map(k => data[k]);
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  db.run(sql, values);
  save();
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0] };
}

function exec(sql) {
  db.run(sql);
  save();
}

function save() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function close() {
  if (db) {
    save();
    db.close();
    db = null;
  }
}

module.exports = { getDb, query, get, insert, exec, close, save };

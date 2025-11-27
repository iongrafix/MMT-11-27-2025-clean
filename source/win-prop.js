// win-prop.js — wrapper around DBM.PropTool.exe with robust path search + logging
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function logsDir() {
  const dir = path.join(os.homedir(), 'Documents', 'DBM', 'logs');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}
const LOG = path.join(logsDir(), 'dbm-video.log');

function logLine(line) {
  try { fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${line}\n`); } catch {}
}

function findTool() {
  const base = process.resourcesPath || path.dirname(process.execPath);
  const candidates = [
    // typical unpacked location when asarUnpack is used
    path.join(base, 'app.asar.unpacked', 'DBM.PropTool.exe'),
    // extraResources copy lands directly under resources
    path.join(base, 'DBM.PropTool.exe'),
    // dev run (electron .)
    path.join(__dirname, 'DBM.PropTool.exe'),
    // sometimes builder lays app content under "app"
    path.join(base, 'app', 'DBM.PropTool.exe'),
    // next to the exe
    path.join(path.dirname(process.execPath), 'DBM.PropTool.exe')
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  const msg = `DBM.PropTool.exe not found. Searched:\n${candidates.join('\n')}`;
  logLine(`ERROR findTool: ${msg}`);
  throw new Error(msg);
}

function runTool(args) {
  return new Promise((resolve, reject) => {
    let exe;
    try { exe = findTool(); }
    catch (e) { return reject(e); }

    logLine(`run: ${exe} ${args.map(a => (/\s/.test(a)?`"${a}"`:a)).join(' ')}`);
    let out = '', err = '';
    const child = spawn(exe, args, { windowsHide: true });

    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('error', e => { logLine(`spawn error: ${e.message}`); });
    child.on('close', code => {
      logLine(`exit ${code} | out="${out.trim()}" | err="${err.trim()}"`);
      if (code !== 0) return reject(new Error(err || (`PropTool exited ${code}`)));
      try { resolve(JSON.parse(out.trim())); }
      catch { resolve({ ok: true, raw: out.trim() }); }
    });
  });
}

const setProps = (filePath, f) =>
  runTool(['set','--path',filePath,'--title',f.title||'','--tags',f.tags||'','--comments',f.comments||'','--rating',String(f.rating||0)]);

const getProps = (filePath) =>
  runTool(['get','--path',filePath]);

// small probe so we can verify wiring from the UI
async function probe(filePath) {
  try {
    const exe = findTool();
    const r = await getProps(filePath);
    return { ok: true, exe, log: LOG, result: r };
  } catch (e) {
    return { ok: false, error: String(e.message || e), log: LOG };
  }
}

module.exports = { setProps, getProps, probe, logFilePath: LOG };

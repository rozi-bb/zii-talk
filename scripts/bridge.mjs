#!/usr/bin/env node
/**
 * Bridge Tailscale buat Zii Talk.
 *
 * Kenapa perlu: mikrofon di browser cuma jalan di "secure context" —
 * HTTPS atau localhost. Buka http://100.x.x.x:8787 dari HP = mic MATI.
 * `tailscale serve` ngasih HTTPS beneran (sertifikat *.ts.net), jadi
 * mic-nya hidup tanpa perlu ngurus sertifikat sendiri.
 *
 *   node scripts/bridge.mjs on       nyalain (idempoten)
 *   node scripts/bridge.mjs off      matiin — cuma punya Zii Talk
 *   node scripts/bridge.mjs status   lihat semua mapping
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* PORT bisa diset di .env — dibaca manual biar bridge nggak butuh dotenv. */
function portFromEnvFile(dir) {
  try {
    const m = /^PORT=(\d+)/m.exec(readFileSync(path.join(dir, '.env'), 'utf8'));
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAMP = path.join(ROOT, '.bridge.json');
const APP_PORT =
  Number(process.env.BRIDGE_TARGET) ||
  Number(process.env.PORT) ||
  portFromEnvFile(ROOT) ||
  8787;
const WANTED = Number(process.env.BRIDGE_PORT) || 0; // 0 = pilih otomatis
const CANDIDATES = [8443, 8444, 10443, 12443, 14443];
const PROXY = `http://127.0.0.1:${APP_PORT}`;

const C = {
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  c: (s) => `\x1b[36m${s}\x1b[0m`,
};

function ts(args, quiet = false) {
  try {
    return execFileSync('tailscale', args, { encoding: 'utf8', stdio: quiet ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const msg = String(e.stderr || e.stdout || e.message).trim();
    throw Object.assign(new Error(msg), { code: e.status });
  }
}

function die(msg, ...extra) {
  console.error(`\n${C.r('✗')} ${msg}`);
  extra.filter(Boolean).forEach((l) => console.error(`  ${l}`));
  console.error('');
  process.exit(1);
}

function status() {
  let j;
  try {
    j = JSON.parse(ts(['status', '--json']));
  } catch (e) {
    die(
      'Nggak bisa baca status Tailscale.',
      String(e.message).slice(0, 200),
      C.dim('Coba: tailscale status'),
    );
  }
  if (j.BackendState !== 'Running') {
    die(`Tailscale belum konek (state: ${j.BackendState}).`, C.dim('Coba: sudo tailscale up'));
  }
  return {
    name: String(j.Self?.DNSName || '').replace(/\.$/, ''),
    certs: j.CertDomains || [],
    magic: Boolean(j.CurrentTailnet?.MagicDNSEnabled),
  };
}

function serveConfig() {
  try {
    const out = ts(['serve', 'status', '--json']).trim();
    return out ? JSON.parse(out) : {};
  } catch {
    return {};
  }
}

/** Semua { port, target } yang sekarang dilayani. */
function mappings(cfg) {
  const out = [];
  for (const [hostPort, web] of Object.entries(cfg.Web || {})) {
    const port = Number(hostPort.split(':').pop());
    for (const [path, h] of Object.entries(web.Handlers || {})) {
      out.push({ port, path, target: h.Proxy || JSON.stringify(h) });
    }
  }
  return out;
}

const portFree = (p) =>
  new Promise((res) => {
    const s = net.createServer();
    s.once('error', () => res(false));
    s.once('listening', () => s.close(() => res(true)));
    s.listen(p, '0.0.0.0');
  });

/* ── perintah ──────────────────────────────────────────── */

async function on() {
  const { name, certs, magic } = status();
  if (!name) die('Tailnet ini nggak punya nama DNS.', C.dim('Nyalain MagicDNS di admin console Tailscale.'));
  if (!magic) console.log(C.y(`!  MagicDNS mati — akses lewat nama host mungkin gagal.`));

  const hasCert = certs.includes(name);
  const cfg = serveConfig();
  const maps = mappings(cfg);

  // Udah pernah dipasang? Jangan bikin dobel.
  const mine = maps.find((m) => m.target === PROXY);
  if (mine) {
    done(name, mine.port, maps, hasCert, true);
    return;
  }

  // Pilih port yang belum dipakai serve DAN belum dipakai proses lain.
  const taken = new Set(maps.map((m) => m.port));
  const list = WANTED ? [WANTED] : CANDIDATES;
  let port = 0;
  for (const p of list) {
    if (taken.has(p)) continue;
    if (await portFree(p)) {
      port = p;
      break;
    }
  }
  if (!port) {
    die(
      `Nggak nemu port HTTPS yang bebas (udah dicoba: ${list.join(', ')}).`,
      C.dim('Tentuin sendiri: BRIDGE_PORT=15443 npm run bridge'),
    );
  }

  try {
    ts(['serve', '--bg', `--https=${port}`, PROXY]);
  } catch (e) {
    const m = String(e.message);
    die(
      'tailscale serve gagal.',
      m.slice(0, 300),
      /permission|denied|operator|root/i.test(m)
        ? C.dim(`Kasih izin sekali: sudo tailscale set --operator=$USER`)
        : null,
    );
  }
  done(name, port, maps, hasCert, false);
}

function done(name, port, before, hasCert, reused) {
  const url = `https://${name}${port === 443 ? '' : `:${port}`}`;
  try {
    writeFileSync(STAMP, JSON.stringify({ url, port, target: APP_PORT }, null, 2));
  } catch { /* nggak fatal */ }
  console.log('');
  console.log(`  ${C.g('✓')} ${C.b('Bridge Tailscale ' + (reused ? 'udah nyala' : 'nyala'))}`);
  console.log('');
  console.log(`  Buka dari HP/laptop mana pun di tailnet:`);
  console.log(`     ${C.c(C.b(url))}`);
  console.log('');
  console.log(`  ${C.dim(`→ diteruskan ke ${PROXY}`)}`);
  console.log(`  ${C.dim('→ HTTPS beneran, jadi mikrofon jalan')}`);

  const others = before.filter((m) => m.target !== PROXY);
  if (others.length) {
    console.log('');
    console.log(`  ${C.dim('Mapping lain nggak diapa-apain:')}`);
    others.forEach((m) =>
      console.log(`  ${C.dim(`   :${m.port}${m.path === '/' ? '' : m.path} → ${m.target}`)}`),
    );
  }

  if (!hasCert) {
    console.log('');
    console.log(`  ${C.y('!')} Sertifikat HTTPS belum aktif buat ${name}.`);
    console.log(`    ${C.dim('Nyalain "HTTPS Certificates" di admin console Tailscale,')}`);
    console.log(`    ${C.dim('kalau nggak, browser nolak dan mic tetap mati.')}`);
  }

  console.log('');
  console.log(`  ${C.dim('Matiin nanti: npm run bridge:off')}`);
  console.log('');
}

function off() {
  const maps = mappings(serveConfig());
  const mine = maps.filter((m) => m.target === PROXY);
  if (!mine.length) {
    console.log(`\n  ${C.dim('Nggak ada bridge Zii Talk yang aktif.')}\n`);
    return;
  }
  // Sengaja per-port, BUKAN "serve reset" — biar mapping app lain aman.
  for (const m of mine) {
    try {
      ts(['serve', `--https=${m.port}`, 'off']);
      console.log(`  ${C.g('✓')} port ${m.port} dilepas`);
    } catch (e) {
      console.error(`  ${C.r('✗')} port ${m.port}: ${String(e.message).slice(0, 160)}`);
    }
  }
  try {
    rmSync(STAMP, { force: true });
  } catch { /* nggak fatal */ }

  const left = mappings(serveConfig());
  if (left.length) {
    console.log(`\n  ${C.dim('Masih jalan (punya app lain):')}`);
    left.forEach((m) => console.log(`  ${C.dim(`   :${m.port} → ${m.target}`)}`));
  }
  console.log('');
}

function show() {
  const { name } = status();
  const maps = mappings(serveConfig());
  console.log('');
  if (!maps.length) {
    console.log(`  ${C.dim('tailscale serve: kosong')}`);
  } else {
    maps.forEach((m) => {
      const url = `https://${name}${m.port === 443 ? '' : `:${m.port}`}${m.path === '/' ? '' : m.path}`;
      const tag = m.target === PROXY ? C.g('  ← Zii Talk') : '';
      console.log(`  ${url}  →  ${m.target}${tag}`);
    });
  }
  console.log('');
}

const cmd = (process.argv[2] || 'on').toLowerCase();
try {
  if (cmd === 'off') off();
  else if (cmd === 'status') show();
  else await on();
} catch (e) {
  die(String(e.message).slice(0, 400));
}

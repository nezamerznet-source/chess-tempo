import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';

const temporary = await mkdtemp(path.join(tmpdir(), 'tempo-api-'));
const environment = { ...process.env, TURSO_DATABASE_URL: 'file:' + path.join(temporary, 'test.db'), TURSO_AUTH_TOKEN: '', VERCEL: '' };
let server;
let baseUrl;
async function startServer() {
  // Run twice: re-deployments must leave existing tables intact.
  for (let i = 0; i < 2; i++) execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: environment, stdio: 'pipe' });
  const portPicker = createServer();
  portPicker.listen(0, '127.0.0.1');
  await once(portPicker, 'listening');
  const port = portPicker.address().port;
  await new Promise(resolve => portPicker.close(resolve));
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  server.stdout.on('data', value => { log += value; });
  server.stderr.on('data', value => { log += value; });
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error(log);
    try { if ((await fetch(baseUrl)).ok) return; } catch { /* Server is starting. */ }
    await setTimeout(250);
  }
  throw new Error('Next.js did not start: ' + log);
}
let cookie='';
async function request(route, body, expected=200, overrideCookie=cookie, headers={}) {
  const response = await fetch(baseUrl+route,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-tempo-request':'1',origin:baseUrl,cookie:overrideCookie,...headers},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  assert.equal(response.status,expected,JSON.stringify(data));
  if(response.headers.get('set-cookie') && overrideCookie===cookie) cookie=response.headers.get('set-cookie').split(';')[0];
  return data;
}
try {
  await startServer();
  const suffix=crypto.randomUUID(); const email=`qa-${suffix}@example.invalid`; const password=crypto.randomUUID();
  assert.equal((await request('/api/data')).account,null);
  await request('/api/players',{name:'Anonymous'},401);
  await request('/api/auth',{action:'register',name:'QA User',email,password},201);
  const firstCookie=cookie;
  const a=await request('/api/players',{name:'Белый игрок'},201);
  const b=await request('/api/players',{name:'Чёрный игрок'},201);
  const game={id:crypto.randomUUID(),whiteId:a.id,blackId:b.id,outcome:'white',base:300,increment:3,moves:22,reason:'manual',whiteRemaining:12000,blackRemaining:18000};
  await request('/api/games',game,201); await request('/api/games',game,200);
  await request('/api/games',{...game,id:crypto.randomUUID(),outcome:'draw'},201);
  await request('/api/games',{...game,id:crypto.randomUUID(),whiteId:b.id},400);
  let data=await request('/api/data'); assert.equal(data.games.length,2);
  const player=data.players.find(p=>p.id===a.id); assert.equal(player.wins,1);assert.equal(player.draws,1);assert.equal(player.games,2);
  await request('/api/auth',{action:'logout'});
  assert.equal((await request('/api/data')).account,null);
  await request('/api/auth',{action:'login',email,password:'wrongpassword'},401);
  await request('/api/auth',{action:'login',email,password});
  assert.equal((await request('/api/data')).games.length,2);
  const cookieA=cookie;
  await request('/api/auth',{action:'logout'});
  await request('/api/auth',{action:'register',name:'Second user',email:`other-${suffix}@example.invalid`,password},201);
  assert.equal((await request('/api/data')).games.length,0);
  await request('/api/games',{...game,id:crypto.randomUUID()},403);
  await request('/api/players',{name:'Cross origin'},403,cookie,{origin:'https://untrusted.invalid'});
  await request('/api/players',{name:'Missing CSRF header'},403,cookie,{'x-tempo-request':''});
  assert.equal((await request('/api/data',undefined,200,cookieA)).account,null);
  console.log('PASS: registration, login, logout, password verification, durable results, idempotency, score calculation, account isolation, validation and CSRF protection.');
} finally {
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
  await rm(temporary, { recursive: true, force: true });
}

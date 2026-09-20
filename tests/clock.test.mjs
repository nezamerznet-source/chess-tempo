import test from 'node:test';
import assert from 'node:assert/strict';
import { newClock, transition, remaining, formatTime } from '../lib/clock.ts';
test('Fischer increment is earned exactly once and inactive taps do nothing', () => {
  const initial = transition(newClock(300, 3), {type:'start',now:1000});
  assert.equal(transition(initial,{type:'move',side:'black',now:1500}), initial);
  const next = transition(initial,{type:'move',side:'white',now:2000});
  assert.equal(next.white,302000); assert.equal(next.black,300000); assert.equal(next.active,'black');
  assert.equal(next.moves.white,1); assert.equal(transition(next,{type:'move',side:'white',now:2001}),next);
});
test('pausing freezes both clocks and resuming excludes the pause duration', () => {
  let c=transition(newClock(60,0),{type:'start',now:1000});
  c=transition(c,{type:'pause',now:11000});
  assert.equal(remaining(c,'white',999999),50000);
  c=transition(c,{type:'start',now:1000000});
  assert.equal(remaining(c,'white',1002000),48000);
  assert.equal(remaining(c,'black',1002000),60000);
});
test('timeout takes precedence over a late move, pause or manual result', () => {
  const c=transition(newClock(1,3),{type:'start',now:5000});
  for(const a of [{type:'move',side:'white'},{type:'pause'},{type:'finish',outcome:'white'}]) {
    const end=transition(c,{...a,now:6000});
    assert.equal(end.status,'finished'); assert.equal(end.outcome,'black'); assert.equal(end.white,0); assert.equal(end.moves.white,0);
    assert.equal(transition(end,{type:'start',now:7000}),end);
  }
});
test('restored background clock accounts for all elapsed time', () => {
  const c=JSON.parse(JSON.stringify(transition(newClock(60,0),{type:'start',now:1000})));
  assert.equal(remaining(c,'white',31000),30000);
  assert.equal(transition(c,{type:'tick',now:90000}).reason,'timeout');
});
test('clock display formats minutes and tenths near flag fall', () => {
  assert.equal(formatTime(1),'0.0'); assert.equal(formatTime(9999),'9.9');
  assert.equal(formatTime(10001),'00:11'); assert.equal(formatTime(60000),'01:00'); assert.equal(formatTime(0),'00:00');
});

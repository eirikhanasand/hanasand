import { test, expect } from 'bun:test';
import { samplePower } from './power.mjs';
const at = Date.parse('2026-09-19T10:00:00Z');
const host = (time = at) => ({ sampledAt: new Date(time).toISOString(), gpus: [{id:'GPU-1'}, {id:'GPU-2'}], power: [{label:'GPU-1',unit:'W',value:200},{label:'GPU-2',unit:'W',value:300},{label:'cpu',unit:'W',value:100}] });
test('uses GPU readings, integrates distinct samples and survives persisted state', () => {
 const first=samplePower(host(),undefined,at);
 expect(first.watts).toBe(500);
 expect(first.kwh).toBe(0);
 const next=samplePower(host(at+60000),JSON.parse(JSON.stringify(first)),at+60000);
 expect(next.kwh).toBeCloseTo(0.5/60,8);
 expect(samplePower(host(at+60000),next,at+60000).kwh).toBe(next.kwh);
 expect(samplePower(host(at+600000),next,at+600000).kwh).toBe(next.kwh);
 const october=Date.parse('2026-10-01T00:00:00Z');
 expect(samplePower(host(october),next,october).kwh).toBe(0);
});
test('missing, stale and invalid samples never become zero usage',()=>{
 expect(samplePower({},undefined,at)).toBeNull();
 expect(samplePower(host(),undefined,at+120001)).toBeNull();
 const partial=host(); partial.power.shift();
 expect(samplePower(partial,undefined,at)).toBeNull();
 const invalid=host(); invalid.power[0].value=null;
 expect(samplePower(invalid,undefined,at)).toBeNull();
 const zero=host(); zero.power.forEach(p=>p.value=0);
 expect(samplePower(zero,undefined,at).watts).toBe(0);
});

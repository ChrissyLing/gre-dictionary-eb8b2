import assert from 'node:assert/strict';
import {CloudBaseProvider,normalizePhone} from '../releases/0.1.2/provider.mjs';
assert.equal(normalizePhone('138 0013 8000'),'+8613800138000');assert.equal(normalizePhone('+44 7700 900123'),'+447700900123');assert.throws(()=>normalizePhone('123'));
const calls=[];let user={id:'original-email-account',email:'alice@example.test'},pending;
const auth={getSession:async()=>({data:{user,session:{user,access_token:'mock'}}}),
signInWithOtp:async args=>{calls.push(['send',args]);return {data:{verifyOtp:async params=>{calls.push(['verify',params]);return {data:{user}};}}};},
signInWithPassword:async args=>{calls.push(['password',args]);return {data:{user}};},
updateUser:async params=>{calls.push(['update',params]);return {data:{verifyOtp:async params=>{calls.push(['bind-verify',params]);user={...user,phone:params.phone};return {data:{user}};}}};},
reauthenticate:async()=>({data:{updateUser:async args=>{calls.push(['reauth',args]);return {data:{user}};}}})};
const provider=new CloudBaseProvider({init:()=>({auth})},{envId:'gre-test',publishableKey:'public-test'});
await provider.sendPhoneCode('13800138000');assert.deepEqual(calls.at(-1),['send',{phone:'+8613800138000',options:{shouldCreateUser:true}}]);
await assert.rejects(()=>provider.verifyPhoneCode('13900139000','123456'),/当前手机号/);
assert.equal((await provider.verifyPhoneCode('13800138000','123456')).id,user.id);assert.deepEqual(calls.at(-1),['verify',{token:'123456'}]);
await provider.signInPassword('13800138000','Password123!');assert.deepEqual(calls.at(-1),['password',{phone:'+8613800138000',password:'Password123!'}]);
await provider.requestPhoneBinding('13800138000');const owner=user.id;assert.equal((await provider.finishPhoneBinding('13800138000','123456')).id,owner);assert.deepEqual(calls.at(-1),['bind-verify',{phone:'+8613800138000',token:'123456'}]);
await provider.requestPhoneBinding('13900139000');user={id:'different-account'};await assert.rejects(()=>provider.finishPhoneBinding('13900139000','123456'),/账号或手机号已变化/);
user={id:owner,phone:'+8613800138000'};await provider.requestPasswordReset(user.phone,{reauthenticate:true});await provider.finishPasswordReset(user.phone,'123456','NewPassword123!');assert.deepEqual(calls.at(-1),['reauth',{nonce:'123456',password:'NewPassword123!'}]);
auth.signInWithOtp=()=>new Promise(resolve=>pending=resolve);const send=provider.sendPhoneCode('13800138000');provider.cancelPhoneLogin();pending({data:{verifyOtp:async()=>({data:{user}})}});assert.equal(await send,false);assert.equal(provider.phoneVerify,null);
console.log('PASS: phone normalization, SMS challenge binding, phone/password login, same-account phone binding, account-switch rejection and phone-only password setup');

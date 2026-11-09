import assert from 'node:assert/strict';
import {CloudBaseProvider} from '../releases/0.1.1/provider.mjs';
const calls=[];let delayed;
const user={id:'existing-user-id',email:'alice@example.test'};
const auth={
 signInWithPassword:async credentials=>{calls.push(['login',credentials]);return {data:{user}};},
 resetPasswordForEmail:async email=>{calls.push(['send-reset',email]);return {data:{updateUser:async attributes=>{calls.push(['finish-reset',attributes]);if(attributes.nonce!=='123456')return {error:{message:'验证码不正确'}};return {data:{user}};}}};},
 signOut:async()=>undefined,
};
const provider=new CloudBaseProvider({init:()=>({auth})},{envId:'gre-test',publishableKey:'public-test'});
assert.equal((await provider.signInPassword(' alice@example.test ','Password123!')).id,user.id);
assert.deepEqual(calls[0][1],{email:user.email,password:'Password123!'});
await provider.signInPassword('alice_user','Password123!');assert.deepEqual(calls[1][1],{username:'alice_user',password:'Password123!'});
await provider.requestPasswordReset(user.email);
await assert.rejects(()=>provider.finishPasswordReset('other@example.test','123456','NewPassword123!'),/当前邮箱/);
await assert.rejects(()=>provider.finishPasswordReset(user.email,'000000','NewPassword123!'),/不正确/);
assert.equal((await provider.finishPasswordReset(user.email,'123456','NewPassword123!')).id,user.id,'password setup preserves existing account ID');
assert.deepEqual(calls.at(-1),['finish-reset',{nonce:'123456',password:'NewPassword123!'}]);
await assert.rejects(()=>provider.finishPasswordReset(user.email,'123456','NewPassword123!'),/先为当前邮箱/);
auth.resetPasswordForEmail=()=>new Promise(resolve=>delayed=resolve);
const pending=provider.requestPasswordReset(user.email);provider.cancelPasswordReset();delayed({data:{updateUser:async()=>({data:{user}})}});
assert.equal(await pending,false);assert.equal(provider.resetPasswordCallback,null,'late challenge cannot reopen closed recovery');
await provider.signOut();
console.log('PASS: email/username login arguments, verified password reset, account ID preservation, challenge binding, cancellation and void sign-out');

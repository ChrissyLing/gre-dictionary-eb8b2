export function normalizePhone(value){
 const compact=String(value||'').trim().replace(/[\s()-]/g,'');
 const phone=/^1[3-9]\d{9}$/.test(compact)?'+86'+compact:compact;
 if(!/^\+[1-9]\d{7,14}$/.test(phone))throw Error('请输入中国大陆手机号，或带 +国家码的手机号');return phone;
}
export class CloudBaseProvider{
 constructor(sdk,config){
  if(!/^[a-z0-9-]+$/i.test(config.envId||''))throw Error('云端环境尚未配置');
  if(!config.publishableKey||typeof config.publishableKey!=='string'||config.publishableKey.length>4096)throw Error('云端公钥格式无效');
  this.app=sdk.init({env:config.envId,region:config.region||'ap-shanghai',accessKey:config.publishableKey,auth:{persistence:'local'}});this.auth=this.app.auth;
  this.base='https://'+config.envId+'.api.tcloudbasegateway.com/v1/rdb/rest/';
 }
 check(result){if(result?.error)throw Error(result.error.message||'云端服务暂不可用');return result?.data||{};}
 async user(){const data=this.check(await this.auth.getSession());return data.user||data.session?.user||null;}
 async sendCode(email){const data=this.check(await this.auth.signInWithOtp({email,options:{shouldCreateUser:true}}));if(typeof data.verifyOtp!=='function')throw Error('验证码通道未启用');this.verify=data.verifyOtp;}
 async verifyCode(code){if(!this.verify)throw Error('请先获取验证码');const data=this.check(await this.verify({token:code}));this.verify=null;return data.user||data.session?.user;}
 async signInPassword(identity,password){
  const value=String(identity||'').trim();if(!value||!password)throw Error('请输入账号和密码');
  const credentials=value.includes('@')?{email:value,password}:/^\+?[\d\s()-]+$/.test(value)?{phone:normalizePhone(value),password}:{username:value,password};
  const data=this.check(await this.auth.signInWithPassword(credentials));
  const user=data.user||data.session?.user;if(!user)throw Error('登录未完成，请重试');return user;
 }
 cancelPasswordReset(){this.resetGeneration=(this.resetGeneration||0)+1;this.resetPasswordCallback=null;this.resetEmail=null;}
 async requestPasswordReset(email,{reauthenticate=false}={}){
  this.cancelPasswordReset();const generation=this.resetGeneration;
  const data=this.check(await (reauthenticate?this.auth.reauthenticate():this.auth.resetPasswordForEmail(email)));
  if(generation!==this.resetGeneration)return false;
  if(typeof data.updateUser!=='function')throw Error('重置通道暂不可用，请稍后再试');
  this.resetEmail=email;this.resetPasswordCallback=data.updateUser;return true;
 }
 async finishPasswordReset(email,code,password){
  if(!this.resetPasswordCallback||this.resetEmail!==email)throw Error('请先为当前邮箱获取重置验证码');
  const generation=this.resetGeneration,callback=this.resetPasswordCallback;
  const data=this.check(await callback({nonce:code,password}));
  if(generation!==this.resetGeneration)throw Error('当前重置流程已关闭，请重新登录');
  this.cancelPasswordReset();return data.user||data.session?.user||null;
 }
 async signOut(){this.check(await this.auth.signOut());}
 cancelPhoneLogin(){this.phoneGeneration=(this.phoneGeneration||0)+1;this.phoneVerify=null;}
 async sendPhoneCode(value){
  const phone=normalizePhone(value);this.cancelPhoneLogin();const generation=this.phoneGeneration;
  const data=this.check(await this.auth.signInWithOtp({phone,options:{shouldCreateUser:true}}));
  if(generation!==this.phoneGeneration)return false;
  if(typeof data.verifyOtp!=='function')throw Error('短信验证码登录未就绪，请检查后台配置');
  this.phoneTarget=phone;this.phoneVerify=data.verifyOtp;
 }
 async verifyPhoneCode(value,token){
  const phone=normalizePhone(value);if(!this.phoneVerify||phone!==this.phoneTarget)throw Error('请先为当前手机号获取验证码');
  const data=this.check(await this.phoneVerify({token}));this.phoneVerify=null;
  const user=data.user||data.session?.user;if(!user)throw Error('短信登录未完成');return user;
 }
 cancelPhoneBinding(){this.bindGeneration=(this.bindGeneration||0)+1;this.bindVerify=null;this.bindOwner=null;}
 async requestPhoneBinding(value){
  this.cancelPhoneBinding();const generation=this.bindGeneration,phone=normalizePhone(value),owner=await this.user();
  if(!owner)throw Error('请先登录原账号，再绑定手机号');
  const data=this.check(await this.auth.updateUser({phone}));
  if(generation!==this.bindGeneration)return false;
  if(typeof data.verifyOtp!=='function')throw Error('未获得手机号验证步骤，请刷新账号状态后重试');
  this.bindOwner=owner.id;this.bindTarget=phone;this.bindVerify=data.verifyOtp;return true;
 }
 async finishPhoneBinding(value,token){
  const phone=normalizePhone(value),owner=await this.user(),generation=this.bindGeneration;
  if(!this.bindVerify||this.bindTarget!==phone||!owner||owner.id!==this.bindOwner)throw Error('绑定账号或手机号已变化，请重新获取验证码');
  const data=this.check(await this.bindVerify({phone,token}));
  if(generation!==this.bindGeneration)throw Error('绑定流程已关闭，请刷新账号状态');
  const updated=data.user||data.session?.user||(await this.user());
  if(!updated||updated.id!==owner.id)throw Error('账号状态发生变化，请重新登录原账号');
  this.cancelPhoneBinding();return updated;
 }
 subscribe(callback){const {data}=this.auth.onAuthStateChange((event,session)=>callback(event,session?.user||null));return ()=>data.subscription.unsubscribe();}
 async request(path,options,expectedUid){
  const data=this.check(await this.auth.getSession()),user=data.user||data.session?.user,token=data.session?.access_token;
  if(!user||user.id!==expectedUid||!token)throw Error('登录状态已变化，请重新同步');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{const res=await fetch(this.base+path,{...options,signal:controller.signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(options?.headers||{})}});if(!res.ok)throw Error(res.status===401?'登录已过期，请重新登录':res.status===403?'个人数据权限未配置，请联系维护者':'云端同步失败，请稍后重试');return res.status===204?[]:await res.json();}finally{clearTimeout(timeout);}
 }
 async getRows(uid){const rows=[];for(let offset=0;;offset+=1000){const page=await this.request('gre_favorites_v1?select=word,payload,updated_at&owner_id=eq.'+encodeURIComponent(uid)+'&order=word.asc&limit=1000&offset='+offset,{},uid);rows.push(...page);if(page.length<1000)return rows;}}
 async putRows(rows,uid){for(let i=0;i<rows.length;i+=100)await this.request('gre_favorites_v1?on_conflict=owner_id,word',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows.slice(i,i+100).map(r=>({...r,owner_id:uid})))},uid);}
 // Separate reserved question keys keep old vocabulary clients compatible with the v1 table and owner RLS.
 async getQuantRows(uid){const rows=[];for(let offset=0;;offset+=1000){const page=await this.request('gre_favorites_v1?select=word,payload,updated_at&word=like.%40q%3A*&owner_id=eq.'+encodeURIComponent(uid)+'&order=word.asc&limit=1000&offset='+offset,{},uid);rows.push(...page);if(page.length<1000)return rows;}}
 async putQuantRows(rows,uid){return this.putRows(rows,uid);}
 async setPreference(uid,release){await this.request('gre_profiles_v1?on_conflict=owner_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({owner_id:uid,preferred_release:release})},uid);}
 async getPreference(uid){const rows=await this.request('gre_profiles_v1?select=preferred_release&owner_id=eq.'+encodeURIComponent(uid),{},uid);return rows[0]?.preferred_release||null;}
 async analyticsRpc(name,args,expectedUid){
  const user=await this.user();if(!user||user.id!==expectedUid)throw Error('登录状态已变化');
  const result=await this.app.rdb().rpc(name,args);if(result.error)throw Error(result.error.message||'统计服务暂不可用');return result.data;
 }

}

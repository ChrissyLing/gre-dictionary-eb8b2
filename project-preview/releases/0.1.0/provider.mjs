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
 async signOut(){this.check(await this.auth.signOut());}
 subscribe(callback){const {data}=this.auth.onAuthStateChange((event,session)=>callback(event,session?.user||null));return ()=>data.subscription.unsubscribe();}
 async request(path,options,expectedUid){
  const data=this.check(await this.auth.getSession()),user=data.user||data.session?.user,token=data.session?.access_token;
  if(!user||user.id!==expectedUid||!token)throw Error('登录状态已变化，请重新同步');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{const res=await fetch(this.base+path,{...options,signal:controller.signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(options?.headers||{})}});if(!res.ok)throw Error(res.status===401?'登录已过期，请重新登录':res.status===403?'个人数据权限未配置，请联系维护者':'云端同步失败，请稍后重试');return res.status===204?[]:await res.json();}finally{clearTimeout(timeout);}
 }
 async getRows(uid){const rows=[];for(let offset=0;;offset+=1000){const page=await this.request('gre_favorites_v1?select=word,payload,updated_at&owner_id=eq.'+encodeURIComponent(uid)+'&order=word.asc&limit=1000&offset='+offset,{},uid);rows.push(...page);if(page.length<1000)return rows;}}
 async putRows(rows,uid){for(let i=0;i<rows.length;i+=100)await this.request('gre_favorites_v1?on_conflict=owner_id,word',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows.slice(i,i+100).map(r=>({...r,owner_id:uid})))},uid);}
 async setPreference(uid,release){await this.request('gre_profiles_v1?on_conflict=owner_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({owner_id:uid,preferred_release:release})},uid);}
 async getPreference(uid){const rows=await this.request('gre_profiles_v1?select=preferred_release&owner_id=eq.'+encodeURIComponent(uid),{},uid);return rows[0]?.preferred_release||null;}
}

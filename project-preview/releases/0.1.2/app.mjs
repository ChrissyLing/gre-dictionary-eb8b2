import {LearningStore,selectRelease,safeReleaseUrl} from './core.mjs';
import {CloudBaseProvider,normalizePhone} from './provider.mjs';
const $=id=>document.getElementById(id), current='0.1.2';
let provider=null, user=null, store=null, catalog, config, channel='', engineReady=false, active=false, syncing=false, syncAgain=false, timer, review=[], reviewIndex=0, revealed=false;
const note=message=>{$('notice').textContent=message;$('notice').hidden=!message;};
function element(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
function button(text,fn,cls='quiet'){const b=element('button',text,cls);b.type='button';b.onclick=fn;return b;}
function engineSend(type,payload={}){if(engineReady)$('dictionaryFrame').contentWindow?.postMessage({protocol:'gre-learning-v1',channel,type,...payload},location.origin);}
function changed(){if(!store)return;renderFavorites();$('count').textContent=store.favorites().length;$('dueHint').textContent=`今天待复习 ${store.due().length} 词 · 收藏 ${store.favorites().length} 词`;engineSend('favorites',{favorites:store.favorites()});clearTimeout(timer);if(provider&&user){$('syncStatus').textContent='有本机记录待同步';timer=setTimeout(sync,800);}}
async function sync(){if(!provider||!user||!store)return;if(syncing){syncAgain=true;return;}syncing=true;const identity=store.uid;try{$('syncStatus').textContent='同步中…';await store.sync(provider);if(store.uid===identity)$('syncStatus').textContent=Object.keys(store.pending).length?'有更新待同步':'已同步';}catch(e){if(store.uid===identity)$('syncStatus').textContent='同步未完成，本机记录已保留';note(e.message);}finally{syncing=false;clearTimeout(timer);if(syncAgain){syncAgain=false;timer=setTimeout(sync,300);}}}
// Store callbacks during synchronization redraw the UI but do not schedule endless reads.
function storeChanged(){const wasSyncing=syncing;changed();if(wasSyncing)clearTimeout(timer);}
async function enter(nextUser,local=false){
 clearTimeout(timer);review=[];reviewIndex=0;revealed=false;renderReview();user=nextUser;active=!!user||local;engineReady=false;channel=crypto.randomUUID();$('dictionaryFrame').removeAttribute('src');$('dictionaryFrame').hidden=true;
 if(store)store.activate(user?.id||'local');else store=new LearningStore(localStorage,{uid:user?.id||'local',onChange:storeChanged});
 $('gate').hidden=active;$('workspace').hidden=!active;$('loginSection').hidden=!!user;$('loggedInSection').hidden=!user;$('accountEmail').textContent=user?.email||user?.phone||'';$('boundPhone').textContent=user?.phone?'已绑定手机号：'+user.phone:'尚未绑定手机号';
 if(!active)return;
 $('identity').textContent=user?.email||user?.phone||'本机体验 · 数据仅保存在此浏览器';$('syncBtn').hidden=!user;$('syncStatus').textContent=user?'准备同步':'未启用云端同步';
 const generation=channel, bytes=new TextEncoder().encode(store.uid), hash=await crypto.subtle.digest('SHA-256',bytes);if(channel!==generation)return;
 const space=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
 $('dictionaryFrame').src=`./dictionary.html?space=${space}&channel=${encodeURIComponent(channel)}`;$('dictionaryFrame').hidden=false;$('frameHint').hidden=true;
 changed();if(user){await sync();try{const uid=user.id, preferred=await provider.getPreference(uid);if(user?.id===uid&&preferred&&preferred!==current){$('preferredHint').hidden=false;$('preferredHint').textContent=`账号上次选择的是 ${preferred}。本机仍保留当前版本，你可在下方主动切换。`;}}catch(e){note(e.message);}}
}
window.addEventListener('message',event=>{const m=event.data;if(!active||event.origin!==location.origin||event.source!==$('dictionaryFrame').contentWindow||m?.protocol!=='gre-learning-v1'||m.channel!==channel)return;if(m.type==='ready'){engineReady=true;engineSend('favorites',{favorites:store.favorites()});}if(m.type==='favorite-change'&&Array.isArray(m.favorites)&&m.favorites.length<=20000){const old=new Map(store.favorites().map(r=>[r.word,r]));for(const f of m.favorites){try{if(!old.has(f.word)||old.get(f.word).zh!==f.zh)store.favorite(f.word,true,f);old.delete(f.word);}catch{}}for(const word of old.keys())store.favorite(word,false);}});
function tab(name){for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===name));for(const n of ['dictionary','favorites','review','versions'])$(n+'Pane').hidden=n!==name;}
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>tab(b.dataset.tab);
function renderFavorites(){const box=$('favoritesList');box.replaceChildren();const q=$('favoriteFilter').value.toLowerCase(), rows=store.favorites().filter(r=>(r.word+' '+r.zh).toLowerCase().includes(q));if(!rows.length)box.append(element('p','还没有匹配的收藏。可在查词页点击星标，或在上方添加。','hint'));for(const row of rows){const wrap=element('div','','favorite-row'), content=element('div',''), actions=element('div','');content.append(button(row.word,()=>{tab('dictionary');engineSend('lookup',{word:row.word});},'text'),element('p',row.zh||'尚未添加中文释义'));actions.append(button('移除',()=>store.favorite(row.word,false)));wrap.append(content,actions);box.append(wrap);}}
$('favoriteFilter').oninput=renderFavorites;
$('addForm').onsubmit=event=>{event.preventDefault();try{store.favorite($('newWord').value,true,{zh:$('newMeaning').value});$('addForm').reset();note('');}catch(e){note(e.message);}};
$('importBtn').onclick=()=>{try{const legacy=JSON.parse(localStorage.getItem('greDictFav')||'[]'), count=store.importLegacy(legacy);note(`已导入 ${count} 个词，原网站收藏仍保留。`);}catch(e){note(e.message);}};
$('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify({schema:1,exportedAt:new Date().toISOString(),favorites:store.favorites()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gre-learning-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function renderReview(){const box=$('reviewArea');box.replaceChildren();if(reviewIndex>=review.length){box.append(element('h2',review.length?'本轮已完成':'准备好复习了吗？'),element('p',review.length?`本轮复习 ${review.length} 词。记录已保存在当前账号空间。`:'优先复习到期的收藏词。','hint'));return;}const row=review[reviewIndex];box.append(element('p',`${reviewIndex+1} / ${review.length}`,'hint'),element('h2',row.word,'review-word'));if(!revealed){box.append(button('显示释义',()=>{revealed=true;renderReview();},'primary'));return;}box.append(element('p',row.zh||'未添加释义，可返回查词页查看。','review-meaning'));const actions=element('div','','review-actions');for(const [text,remembered] of [['没记住',false],['记住了',true]])actions.append(button(text,()=>{if(store.rows[row.word]?.favorite)store.rate(row.word,remembered);reviewIndex++;revealed=false;renderReview();},remembered?'primary':'quiet'));box.append(actions);}
$('startReview').onclick=()=>{review=store.due().slice(0,30);reviewIndex=0;revealed=false;renderReview();};renderReview();
function renderVersions(){const box=$('versionList');box.replaceChildren();for(const release of catalog.releases.filter(r=>r.available!==false&&r.dataSchema===1)){const row=element('div','','version-row'),text=element('div','');text.append(element('b',`${release.name} · ${release.id}`),element('p',release.notes||''));const b=button(release.id===current?'当前版本':'切换到这个版本',async()=>{try{const selected=selectRelease(catalog,release.id),url=safeReleaseUrl(new URL('../../releases.json',location.href),selected,location.origin);localStorage.setItem('gre-project:pinnedRelease',selected.id);if(user)try{await provider.setPreference(user.id,selected.id);}catch{note('版本已在本机选择，云端偏好暂未同步。');}location.assign(url.href);}catch(e){note(e.message);}});b.disabled=release.id===current;row.append(text,b);box.append(row);}}
function account(){showAuthMode('password');$('accountDialog').showModal();}$('accountBtn').onclick=account;$('gateLogin').onclick=account;
$('localPreview').onclick=()=>enter(null,true);$('syncBtn').onclick=sync;
let codeEmail='',resendAt=0;
$('sendCode').onclick=async()=>{if(!provider)return;const email=$('email').value.trim();if(!$('email').checkValidity()||!email){$('authError').textContent='请输入有效邮箱';return;}if(Date.now()<resendAt)return;$('sendCode').disabled=true;try{await provider.sendCode(email);codeEmail=email;resendAt=Date.now()+60000;$('authError').textContent='验证码已发送，请检查收件箱及垃圾邮件。';}catch(e){$('authError').textContent=e.message;}finally{const tick=()=>{const seconds=Math.ceil((resendAt-Date.now())/1000);$('sendCode').textContent=seconds>0?`${seconds} 秒后重新发送`:'获取验证码';$('sendCode').disabled=seconds>0;if(seconds>0)setTimeout(tick,1000);};tick();}};
$('verifyCode').onclick=async()=>{if(!provider)return;if(!codeEmail||codeEmail!==$('email').value.trim()){$('authError').textContent='请先为当前邮箱获取验证码';return;}if(!/^\d{6}$/.test($('code').value.trim())){$('authError').textContent='请输入 6 位验证码';return;}$('verifyCode').disabled=true;try{const u=await provider.verifyCode($('code').value.trim());if(!u)throw Error('登录未完成');$('code').value='';$('accountDialog').close();if(user?.id!==u.id)await enter(u);}catch(e){$('authError').textContent=e.message;}finally{$('verifyCode').disabled=false;}};
$('logout').onclick=async()=>{try{await sync();await provider.signOut();review=[];reviewIndex=0;renderReview();await enter(null);$('accountDialog').close();}catch(e){note(e.message);}};

function clearPasswordFields(){for(const id of ['loginPassword','newPassword','confirmPassword','resetCode','smsCode','bindCode'])$(id).value='';}
function showAuthMode(mode){
 $('passwordSetup').hidden=true;$('phoneBinding').hidden=true;$('loginSection').hidden=!!user;$('loggedInSection').hidden=!user;
 $('accountTitle').textContent=user?'我的账号':'登录 / 注册';
 $('passwordLoginForm').hidden=mode!=='password';$('otpLoginSection').hidden=mode!=='otp';$('smsLoginSection').hidden=mode!=='sms';
 for(const b of document.querySelectorAll('[data-auth-mode]'))b.setAttribute('aria-pressed',String(b.dataset.authMode===mode));
 $('authError').textContent='';$('loginPassword').value='';
}
for(const b of document.querySelectorAll('[data-auth-mode]'))b.onclick=()=>showAuthMode(b.dataset.authMode);
$('passwordLoginForm').onsubmit=async event=>{
 event.preventDefault();if(!provider)return;
 const identity=$('loginIdentity').value.trim(),password=$('loginPassword').value;
 $('passwordLoginBtn').disabled=true;$('authError').textContent='';
 try{const u=await provider.signInPassword(identity,password);$('accountDialog').close();if(user?.id!==u.id)await enter(u);}
 catch(e){$('authError').textContent=e.message;}
 finally{$('loginPassword').value='';$('passwordLoginBtn').disabled=false;}
};
let resetResendAt=0,resetBusy=false;
function openPasswordReset(){
 if(!provider)return;provider.cancelPasswordReset();clearPasswordFields();
 $('passwordSetup').hidden=false;$('phoneBinding').hidden=true;$('loginSection').hidden=true;$('loggedInSection').hidden=true;
 $('accountTitle').textContent='设置 / 重置密码';$('resetError').textContent='';
 $('resetEmail').type=user?.phone&&!user.email?'text':'email';
 $('resetEmail').value=user?.email||user?.phone||($('loginIdentity').value.includes('@')?$('loginIdentity').value.trim():$('email').value.trim());
 $('resetEmail').readOnly=!!(user?.email||user?.phone);
}
$('forgotPassword').onclick=openPasswordReset;$('setupPassword').onclick=openPasswordReset;
$('cancelReset').onclick=()=>{provider?.cancelPasswordReset();clearPasswordFields();showAuthMode('password');};
$('accountDialog').addEventListener('close',()=>{clearPasswordFields();provider?.cancelPasswordReset();provider?.cancelPhoneBinding();provider?.cancelPhoneLogin();$('code').value='';});
$('sendResetCode').onclick=async()=>{
 if(!provider||resetBusy||Date.now()<resetResendAt)return;
 const email=$('resetEmail').value.trim();if(!email||!$('resetEmail').checkValidity()){$('resetError').textContent='请输入原账号的有效邮箱';return;}
 resetBusy=true;$('sendResetCode').disabled=true;
 try{const sent=await provider.requestPasswordReset(email,{reauthenticate:!!user});if(sent){resetResendAt=Date.now()+60000;$('resetError').textContent='验证码已发往账号绑定的邮箱或手机，请查收。';}}
 catch(e){$('resetError').textContent=e.message;}
 finally{resetBusy=false;const tick=()=>{const sec=Math.ceil((resetResendAt-Date.now())/1000);$('sendResetCode').textContent=sec>0?`${sec} 秒后重新发送`:'获取重置验证码';$('sendResetCode').disabled=sec>0||resetBusy;if(sec>0)setTimeout(tick,1000);};tick();}
};
$('resetPasswordForm').onsubmit=async event=>{
 event.preventDefault();if(!provider)return;
 const email=$('resetEmail').value.trim(),code=$('resetCode').value.trim(),password=$('newPassword').value;
 if(!/^\d{6}$/.test(code)){$('resetError').textContent='请输入 6 位邮箱验证码';return;}
 if(password.length<8){$('resetError').textContent='密码至少需要 8 位';return;}
 if(password!==$('confirmPassword').value){$('resetError').textContent='两次密码不一致';return;}
 $('savePassword').disabled=true;$('resetError').textContent='';
 try{const u=await provider.finishPasswordReset(email,code,password);$('accountDialog').close();if(u&&user?.id!==u.id)await enter(u);note('密码已设置，可使用账号密码登录。');}
 catch(e){$('resetError').textContent=e.message;}
 finally{clearPasswordFields();$('savePassword').disabled=false;}
};


function cooldown(id,until,label){const tick=()=>{const sec=Math.ceil((until-Date.now())/1000);$(id).textContent=sec>0?`${sec} 秒后重新发送`:label;$(id).disabled=sec>0;if(sec>0)setTimeout(tick,1000);};tick();}
let smsResendAt=0,bindResendAt=0;
$('sendSmsCode').onclick=async()=>{
 if(!provider||Date.now()<smsResendAt)return;$('sendSmsCode').disabled=true;
 try{const phone=normalizePhone($('smsPhone').value);$('smsPhone').value=phone;const sent=await provider.sendPhoneCode(phone);if(sent!==false){smsResendAt=Date.now()+60000;$('authError').textContent='短信验证码已发送，请查收。';}}
 catch(e){$('authError').textContent=e.message;}
 finally{cooldown('sendSmsCode',smsResendAt,'获取短信验证码');}
};
$('smsLoginForm').onsubmit=async event=>{
 event.preventDefault();if(!provider)return;const token=$('smsCode').value.trim();if(!/^\d{6}$/.test(token)){$('authError').textContent='请输入 6 位短信验证码';return;}$('verifySmsCode').disabled=true;
 try{const u=await provider.verifyPhoneCode($('smsPhone').value,token);$('accountDialog').close();if(user?.id!==u.id)await enter(u);}
 catch(e){$('authError').textContent=e.message;}
 finally{$('smsCode').value='';$('verifySmsCode').disabled=false;}
};
$('setupPhone').onclick=()=>{
 if(!provider||!user)return;provider.cancelPhoneBinding();clearPasswordFields();$('passwordSetup').hidden=true;$('phoneBinding').hidden=false;$('loginSection').hidden=true;$('loggedInSection').hidden=true;$('accountTitle').textContent='绑定手机号';$('bindError').textContent='';$('bindPhone').value=user.phone||'';
};
$('cancelBindPhone').onclick=()=>{provider?.cancelPhoneBinding();$('bindCode').value='';showAuthMode('password');};
$('sendBindCode').onclick=async()=>{
 if(!provider||!user||Date.now()<bindResendAt)return;$('sendBindCode').disabled=true;
 try{const phone=normalizePhone($('bindPhone').value);$('bindPhone').value=phone;const sent=await provider.requestPhoneBinding(phone);if(sent){bindResendAt=Date.now()+60000;$('bindError').textContent='绑定验证码已发送到该手机。';}}
 catch(e){$('bindError').textContent=e.message;}
 finally{cooldown('sendBindCode',bindResendAt,'获取绑定验证码');}
};
$('bindPhoneForm').onsubmit=async event=>{
 event.preventDefault();if(!provider||!user)return;const token=$('bindCode').value.trim();if(!/^\d{6}$/.test(token)){$('bindError').textContent='请输入 6 位短信验证码';return;}$('confirmBindPhone').disabled=true;
 try{const updated=await provider.finishPhoneBinding($('bindPhone').value,token);$('accountDialog').close();await enter(updated);note('手机号已绑定到原账号，可使用短信登录同一账号。');}
 catch(e){$('bindError').textContent=e.message;}
 finally{$('bindCode').value='';$('confirmBindPhone').disabled=false;}
};

addEventListener('online',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
try{[config,catalog]=await Promise.all(['../../cloudbase-config.json','../../releases.json'].map(async path=>{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('测试配置暂不可用');return r.json();}));renderVersions();$('localPreview').hidden=!config.allowLocalPreview;if(!config.enabled){$('gateLogin').disabled=true;$('sendCode').disabled=true;$('verifyCode').disabled=true;$('gateHint').textContent='测试环境正在配置；目前可体验本机模式，尚不能登录或跨设备同步。';}else{const {default:sdk}=await import('./cloudbase-sdk.mjs');provider=new CloudBaseProvider(sdk,config);provider.subscribe((event,u)=>{if(user?.id!==u?.id)enter(u).catch(e=>note(e.message));});const u=await provider.user();$('gateLogin').disabled=false;$('accountBtn').disabled=false;if(u)await enter(u);}}
catch(e){note('账号服务尚未就绪：'+e.message);$('localPreview').hidden=false;$('gateLogin').disabled=true;}

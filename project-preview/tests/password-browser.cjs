const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const sdk=`let user=null,callback=()=>{},password='TestPassword123!';
const session=()=>user?{user,access_token:'mock-token'}:null;
const response=()=>({data:{user,session:session()}});
const login=()=>{user={id:'same-existing-user',email:'alice@example.test'};callback('SIGNED_IN',session());return response();};
export default {init:()=>({auth:{
getSession:async()=>response(),onAuthStateChange:fn=>(callback=fn,{data:{subscription:{unsubscribe(){}}}}),
signInWithPassword:async c=>c.password===password?login():{error:{message:'账号或密码错误'}},
signOut:async()=>{user=null;callback('SIGNED_OUT',null);},
resetPasswordForEmail:async()=>({data:{updateUser:async a=>{if(a.nonce!=='654321')return {error:{message:'验证码不正确'}};password=a.password;return login();}}}),
signInWithOtp:async()=>({data:{verifyOtp:async()=>login()}})
}})};`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),errors=[],rows=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname.endsWith('.tcloudbasegateway.com')){if(route.request().method()==='POST'){rows.splice(0,rows.length,...(Array.isArray(route.request().postDataJSON())?route.request().postDataJSON():rows));return route.fulfill({status:204});}return route.fulfill({json:u.pathname.includes('gre_favorites')?rows:[]});}if(u.origin!=='https://gre.local')return route.abort();
 if(u.pathname.endsWith('/cloudbase-sdk.mjs'))return route.fulfill({body:sdk,contentType:'text/javascript'});
 const file=path.resolve(root,u.pathname.replace(/^\/project-preview\//,''));if(!file.startsWith(root+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();return route.fulfill({path:file,contentType:file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html'});
 });
 await page.goto('https://gre.local/project-preview/releases/0.1.1/index.html');await page.locator('#gateLogin').click();
 await page.locator('#loginIdentity').fill('alice@example.test');await page.locator('#loginPassword').fill('wrong-password');await page.locator('#passwordLoginBtn').click();await page.getByText('账号或密码错误',{exact:true}).waitFor();assert.equal(await page.locator('#loginPassword').inputValue(),'');
 await page.locator('#loginPassword').fill('TestPassword123!');await page.locator('#passwordLoginBtn').click();await page.locator('#workspace').waitFor({state:'visible'});await page.locator('[data-tab="favorites"]').click();await page.locator('#newWord').fill('elusive');await page.locator('#newMeaning').fill('难以捉摸的');await page.locator('#addForm button').click();await page.waitForFunction(()=>document.getElementById('syncStatus').textContent==='已同步');
 await page.locator('#accountBtn').click();await page.locator('#logout').click();await page.locator('#gate').waitFor({state:'visible'});
 await page.locator('#gateLogin').click();await page.locator('#forgotPassword').click();await page.locator('#sendResetCode').click();await page.getByText('请检查邮箱中的重置验证码。',{exact:true}).waitFor();
 await page.locator('#resetCode').fill('654321');await page.locator('#newPassword').fill('NewPassword123!');await page.locator('#confirmPassword').fill('Different123!');await page.locator('#savePassword').click();await page.getByText('两次密码不一致',{exact:true}).waitFor();
 await page.locator('#confirmPassword').fill('NewPassword123!');await page.locator('#savePassword').click();await page.locator('#workspace').waitFor({state:'visible'});assert.equal(await page.locator('#newPassword').inputValue(),'');await page.locator('[data-tab="favorites"]').click();assert.equal(await page.locator('.favorite-row').count(),1,'existing account favorites preserved');
 await page.locator('#accountBtn').click();await page.locator('#logout').click();await page.locator('#gateLogin').click();await page.locator('#loginPassword').fill('NewPassword123!');await page.locator('#passwordLoginBtn').click();await page.locator('#workspace').waitFor({state:'visible'});
 const saved=await page.evaluate(()=>JSON.stringify({...localStorage}));for(const secret of ['TestPassword123!','NewPassword123!'])assert(!saved.includes(secret),'password never saved to localStorage');
 await page.locator('#accountBtn').click();await page.locator('#logout').click();await page.locator('#gateLogin').click();await page.locator('[data-auth-mode="otp"]').click();await page.locator('#email').fill('alice@example.test');await page.locator('#sendCode').click();await page.getByText('验证码已发送，请检查收件箱及垃圾邮件。',{exact:true}).waitFor();await page.locator('#code').fill('123456');await page.locator('#verifyCode').click();await page.locator('#workspace').waitFor({state:'visible'});
 await page.locator('#accountBtn').click();for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.screenshot({path:'/tmp/gre-password-'+width+'.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 assert.deepEqual(errors,[]);console.log('PASS: password errors, login, verified reset, relogin, retained cloud favorites, secret clearing, responsive account dialog');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const credentials=JSON.parse(fs.readFileSync('.tools/mobile-local/credentials.json','utf8'));
 await page.goto('http://127.0.0.1:18066');
 await page.locator('#username').fill('admin');await page.locator('#password').fill('incorrect-password-test');
 await page.getByRole('button',{name:'Open my store',exact:true}).click();
 await page.getByText('Username or password was not accepted. Use your mobile dashboard account.',{exact:true}).waitFor();
 assert.equal(await page.locator('#username').inputValue(),'admin');
 await page.locator('#password').fill(credentials.adminPassword);
 await page.getByRole('button',{name:'Show password',exact:true}).click();assert.equal(await page.locator('#password').getAttribute('type'),'text');
 await page.getByRole('button',{name:'Hide password',exact:true}).click();
 await page.getByRole('button',{name:'Open my store',exact:true}).click();
 await page.getByText('NET SALES',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.locator('#username').waitFor();
 console.log('PASS: rejected login shows a visible error, preserves username, allows a successful retry, and logs out.');
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});

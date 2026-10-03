const fs=require('fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const c=JSON.parse(fs.readFileSync('.tools/mobile-local/credentials.json','utf8'));
  await page.goto('http://127.0.0.1:18066');
  await page.locator('#username').fill('admin');await page.locator('#password').fill(c.adminPassword);
  await page.getByRole('button',{name:'Open my store'}).click();await page.getByText('NET SALES',{exact:true}).waitFor();
  await page.screenshot({path:'artifacts/mobile-demo-overview.png'});
  await page.getByRole('button',{name:'Stock',exact:true}).click();await page.getByRole('button',{name:/Stock levels/}).click();await page.getByRole('button',{name:/Coffee beans/}).waitFor();
  await page.screenshot({path:'artifacts/mobile-demo-stock.png'});
  console.log('PASS: running demo and readable stock names.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

// Explicitly seed the isolated development databases, never the installed store.
import {readFile} from 'node:fs/promises';
const config=JSON.parse(await readFile('.tools/mobile-local/credentials.json','utf8'));
const pc='http://127.0.0.1:18065',mobile='http://127.0.0.1:18066';
async function call(base,path,body,headers={},method=body?'POST':'GET'){
  const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});
  if(!r.ok)throw new Error(`${path}: ${r.status}`);return r.status===204?null:r.json();
}
const login=await call(pc,'/api/auth/login',{username:'admin',password:config.adminPassword});
const headers={Authorization:'Bearer '+login.token};
const backup=await call(pc,'/api/admin/backup/export',null,headers);
if(!backup.products.length){
  const items=[];
  for(const [name,barcode,price,cost,quantityOnHand,isSoldByWeight] of [['Coffee beans','DEMO-COFFEE',8,4,10,true],['Mineral water','DEMO-WATER',.5,.2,96,false],['Dark chocolate','DEMO-CHOCOLATE',3,1.2,24,false]]){
    items.push(await call(pc,'/api/products',{name,barcode,price,cost,quantityOnHand,isSoldByWeight,weightUnit:isSoldByWeight?'kg':null,currency:'USD',costCurrency:'USD',categoryName:'Demo groceries'},headers));
  }
  await call(pc,'/api/settings/store-profile',{name:'Aurora · Demo store'},headers,'PUT');
  await call(pc,'/api/transactions/checkout',{exchangeRate:90000,paidUsd:2,items:[{productId:items[0].id,quantity:.25}]},headers);
  await call(pc,'/api/transactions/checkout',{exchangeRate:90000,paidUsd:2,items:[{productId:items[1].id,quantity:3}]},headers);
  await call(pc,'/api/transactions/checkout',{exchangeRate:90000,paidUsd:0,debtCardName:'Demo customer',items:[{productId:items[2].id,quantity:2}]},headers);
  await call(pc,'/api/purchases',{supplierName:'Demo supplier',reference:'DEMO-001',exchangeRate:90000,items:[{productId:items[1].id,barcode:'DEMO-WATER',quantity:12,unitCost:.2,currency:'USD'}]},headers);
}
const response=await fetch(mobile+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Aurora-Request':'1'},body:JSON.stringify({username:'admin',password:config.adminPassword})});
if(!response.ok)throw new Error('Mobile demo login failed');
const mobileHeaders={Cookie:response.headers.get('set-cookie').split(';')[0],'X-Aurora-Request':'1'};
const code=await call(mobile,'/api/admin/pairing',{},mobileHeaders);
await call(pc,'/api/admin/mobile-sync/pair',{url:mobile,code:code.code},headers);
await call(mobile,'/api/auth/logout',{},mobileHeaders);
console.log('Isolated demo store prepared and paired. No installed store data was used.');

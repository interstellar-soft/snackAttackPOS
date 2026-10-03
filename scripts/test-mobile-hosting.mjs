import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import {localStack} from './start-mobile-local.mjs';
const stack=await localStack({directory:path.resolve(`.tools/mobile-hosting-test-${Date.now()}`),pcPort:18265,mobilePort:18266,mobileEnv:{Hosting__AllowLocalHttp:'false',Hosting__PublicOrigin:'https://dashboard.example.com'}});
// Node fetch versions differ in whether they preserve an explicit Host header.
function request(url,{method='GET',headers={},body}={}) { return new Promise((resolve,reject)=>{
  const req=http.request(url,{method,headers},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:{get:name=>Array.isArray(res.headers[name])?res.headers[name].join(','):res.headers[name]}}));});
  req.on('error',reject);req.end(body);
}); }
try {
  assert.equal((await fetch(stack.mobile+'/health/ready')).status,200);
  assert.equal((await fetch(stack.mobile+'/api/auth/session')).status,400);
  const headers={'Content-Type':'application/json','X-Aurora-Request':'1',Host:'dashboard.example.com',Origin:'https://dashboard.example.com'};
  const body=JSON.stringify({username:'admin',password:stack.config.adminPassword});
  assert.equal((await request(stack.mobile+'/api/auth/login',{method:'POST',headers:{...headers,Origin:'https://evil.example.com'},body})).status,403);
  const login=await request(stack.mobile+'/api/auth/login',{method:'POST',headers,body});
  assert.equal(login.status,200);
  assert.match(login.headers.get('set-cookie'),/; secure/i);
  assert.match(login.headers.get('set-cookie'),/; httponly/i);
  assert.match(login.headers.get('set-cookie'),/samesite=strict/i);
  assert.equal(login.headers.get('strict-transport-security'),'max-age=31536000');
  const session=await request(stack.mobile+'/api/auth/session',{headers:{Host:headers.Host,Cookie:login.headers.get('set-cookie').split(';')[0]}});
  assert.equal(session.status,200);
  console.log('Hosted mode passed: readiness, host/origin checks, secure cookies and authenticated session.');
} finally {await stack.stop();}

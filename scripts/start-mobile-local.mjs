import { spawn, execFile } from 'node:child_process';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function localStack({directory=path.join(repo,'.tools/mobile-local'),pcPort=18065,mobilePort=18066,mobileEnv={}}={}){
  await mkdir(directory,{recursive:true});
  const configPath=path.join(directory,'credentials.json');
  let config;
  try{config=JSON.parse(await readFile(configPath,'utf8'));}catch{config={databasePassword:randomBytes(24).toString('hex'),jwtKey:randomBytes(40).toString('hex'),adminPassword:randomBytes(10).toString('base64url')};await writeFile(configPath,JSON.stringify(config,null,2),{mode:0o600});}
  const pg=path.join(repo,'frontend/resources/postgresql/bin');
  const database=path.join(directory,'database');
  const pgPort=await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
  const processes=[];const streams=[];
  function run(exe,args,env={}){return new Promise((resolve,reject)=>{const child=spawn(exe,args,{windowsHide:true,stdio:'ignore',env:{...process.env,...env}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${path.basename(exe)} exited ${code}`)));});}
  let pgStarted=false;
  async function stop(){for(const child of processes.reverse()){if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}}if(pgStarted){await run(path.join(pg,'pg_ctl.exe'),['-D',database,'-m','fast','-w','stop']).catch(()=>{});pgStarted=false;}for(const stream of streams)stream.end();}
  try{
    try{await access(path.join(database,'PG_VERSION'));}catch{const pwfile=path.join(directory,'init-password');await writeFile(pwfile,config.databasePassword,{mode:0o600});try{await run(path.join(pg,'initdb.exe'),['-D',database,'-U','aurora','--encoding=UTF8','--locale=C','--auth=scram-sha-256',`--pwfile=${pwfile}`]);}finally{const {unlink}=await import('node:fs/promises');await unlink(pwfile);}}
    await run(path.join(pg,'pg_ctl.exe'),['-D',database,'-l',path.join(directory,'database.log'),'-o',`-h 127.0.0.1 -p ${pgPort}`,'-w','start']);pgStarted=true;
    for(const name of ['aurora_pc','aurora_mobile'])await run(path.join(pg,'createdb.exe'),['-h','127.0.0.1','-p',String(pgPort),'-U','aurora',name],{PGPASSWORD:config.databasePassword}).catch(async()=>{await run(path.join(pg,'psql.exe'),['-h','127.0.0.1','-p',String(pgPort),'-U','aurora','-d',name,'-c','SELECT 1'],{PGPASSWORD:config.databasePassword});});
    const dotnet=path.join(repo,'.tools/dotnet/dotnet.exe');
    const connection=name=>`Host=127.0.0.1;Port=${pgPort};Database=${name};Username=aurora;Password=${config.databasePassword}`;
    function start(project,port,env){const folder=path.join(repo,'backend/src',project);const log=createWriteStream(path.join(directory,project+'.log'),{flags:'a'});streams.push(log);const child=spawn(dotnet,[path.join(folder,'bin/Debug/net8.0',project+'.dll')],{cwd:folder,windowsHide:true,env:{...process.env,DOTNET_CLI_HOME:path.join(repo,'.tools/dotnet-home'),ASPNETCORE_ENVIRONMENT:'Production',ASPNETCORE_URLS:`http://127.0.0.1:${port}`,...env},stdio:['ignore','pipe','pipe']});child.stdout.pipe(log);child.stderr.pipe(log);processes.push(child);return child;}
    start('PosBackend',pcPort,{ConnectionStrings__DefaultConnection:connection('aurora_pc'),Jwt__Key:config.jwtKey,Seed__DemoData:'false',Seed__AdminPassword:config.adminPassword,MlService__Enabled:'false',MobileSync__AllowLocalHttp:'true',MobileSync__KeyDirectory:path.join(directory,'keys'),Desktop__Enabled:'true'});
    start('PosMobile',mobilePort,{Hosting__AllowLocalHttp:'true',ConnectionStrings__Mobile:connection('aurora_mobile'),Bootstrap__Username:'admin',Bootstrap__Password:config.adminPassword,Bootstrap__StoreName:'Aurora local store',...mobileEnv});
    await writeFile(path.join(directory,'runtime.json'),JSON.stringify({processes:processes.map(p=>p.pid)},null,2));
    for(const port of [pcPort,mobilePort]){let ready=false;for(let i=0;i<120;i++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok){ready=true;break;}}catch{}if(processes.some(p=>p.exitCode!==null))throw new Error('A local service exited. Inspect the logs in '+directory);await new Promise(r=>setTimeout(r,500));}if(!ready)throw new Error('Local service did not become ready.');}
    return {sql: (databaseName,query)=>new Promise((resolve,reject)=>{execFile(path.join(pg,'psql.exe'),['-h','127.0.0.1','-p',String(pgPort),'-U','aurora','-d',databaseName,'-v','ON_ERROR_STOP=1','-At','-c',query],{windowsHide:true,env:{...process.env,PGPASSWORD:config.databasePassword},maxBuffer:10*1024*1024},(error,stdout,stderr)=>error?reject(new Error(stderr)):resolve(stdout.trim()));}),pc:`http://127.0.0.1:${pcPort}`,mobile:`http://127.0.0.1:${mobilePort}`,config,configPath,directory,connection,stop};
  }catch(error){await stop();throw error;}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const stack=await localStack();
  console.log(`PC API: ${stack.pc}\nMobile dashboard: ${stack.mobile}\nUsername: admin\nPassword is in ${stack.configPath} (adminPassword).\nThis is isolated local development data, not your installed store.`);
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void stack.stop().then(()=>process.exit(0));});
}

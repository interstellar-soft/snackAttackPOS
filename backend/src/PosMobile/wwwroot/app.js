import { readInvoicePhotos, suggestedLines } from './invoice-ocr.js';
const root = document.getElementById('app');
const labels = {
  categories:['Categories','الفئات'], products:['Products','المنتجات'], product_barcodes:['Extra barcodes','الباركود الإضافي'],
  inventories:['Stock levels','المخزون'], expiration_batches:['Expiry batches','تواريخ الصلاحية'], transactions:['Sales & returns','المبيعات والمرتجعات'],
  transaction_lines:['Sale items','أصناف المبيعات'], price_rules:['Price rules','قواعد الأسعار'], offers:['Offers','العروض'], offer_items:['Offer items','أصناف العروض'],
  suppliers:['Suppliers','الموردون'], purchase_orders:['Purchases','المشتريات'], purchase_order_lines:['Purchase items','أصناف المشتريات'], users:['POS team','فريق المتجر'],
  audit_logs:['Activity log','سجل النشاط'], currency_rates:['Exchange rates','أسعار الصرف'], store_profiles:['Store profile','المتجر'], personal_purchases:['Personal purchases','المشتريات الشخصية']
};
let language = localStorage.getItem('aurora-mobile-language') || 'en';
let state = { page:'home', table:'transactions', offset:0, query:'', overview:null, start:'', end:'' };
let renderId = 0;
const t = (en, ar) => language === 'ar' ? ar : en;
const tableLabel = key => labels[key]?.[language === 'ar' ? 1 : 0] || key;
const money = value => new Intl.NumberFormat(language === 'ar' ? 'ar-LB' : 'en-US', { style:'currency',currency:'USD' }).format(Number(value || 0));
const number = value => new Intl.NumberFormat(language === 'ar' ? 'ar-LB' : 'en-US', { maximumFractionDigits:3 }).format(Number(value || 0));
const date = value => value ? new Date(value).toLocaleString(language === 'ar' ? 'ar-LB' : 'en-GB') : '—';
function el(tag, props={}, ...children) {
  const node = document.createElement(tag);
  for (const [key,value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== null && value !== undefined && value !== false) node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
const button = (text, action, className='') => el('button',{type:'button',class:className,onClick:action},text);
function brand(){return el('div',{class:'brand'},el('span',{class:'mark'},'A'),'AURORA');}
async function api(path, body, method=body ? 'POST' : 'GET') {
  const response = await fetch('/api'+path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Aurora-Request':'1'},body:body ? JSON.stringify(body) : undefined});
  if(response.status === 401){
    const message=path==='/auth/login'
      ? t('Username or password was not accepted. Use your mobile dashboard account.','اسم المستخدم أو كلمة المرور غير صحيحة. استخدم حساب لوحة إدارة الهاتف.')
      : t('Your session ended. Please sign in.','انتهت الجلسة. يرجى تسجيل الدخول.');
    if(!path.startsWith('/auth/'))showLogin(message);
    throw new Error(message);
  }
  if(response.status === 429)throw new Error(t('Too many attempts. Wait one minute, then try again.','محاولات كثيرة. انتظر دقيقة ثم حاول مجدداً.'));
  if(!response.ok){ const data=await response.json().catch(()=>({})); throw new Error(data.message || t('Unable to complete this request. Please retry.','تعذّر إتمام الطلب. يرجى المحاولة مجدداً.')); }
  return response.status === 204 ? null : response.json();
}
function showLogin(message='') {
  renderId++;
  root.replaceChildren(); document.documentElement.lang=language; document.documentElement.dir=language === 'ar' ? 'rtl' : 'ltr';
  const username=el('input',{name:'username',autocomplete:'username',required:true,id:'username'});
  const password=el('input',{name:'password',type:'password',autocomplete:'current-password',required:true,id:'password'});
  const reveal=button(t('Show password','إظهار كلمة المرور'),()=>{
    const visible=password.type==='password';password.type=visible?'text':'password';
    reveal.textContent=visible?t('Hide password','إخفاء كلمة المرور'):t('Show password','إظهار كلمة المرور');
    reveal.setAttribute('aria-pressed',String(visible));
  },'quiet');
  reveal.setAttribute('aria-controls','password');reveal.setAttribute('aria-pressed','false');
  const error=el('div',{role:'alert'}); if(message)error.append(el('p',{class:'alert'},message));
  const submit=el('button',{type:'submit'},t('Open my store','افتح متجري'));
  const form=el('form',{onSubmit:async e=>{e.preventDefault();submit.disabled=true;error.replaceChildren();try{await api('/auth/login',{username:username.value,password:password.value});await navigate('home');}catch(failure){error.append(el('p',{class:'alert'},failure.message || t('Unable to sign in. Please retry.','تعذّر تسجيل الدخول. حاول مجدداً.')));}finally{submit.disabled=false;}}},
    el('label',{},t('Username','اسم المستخدم'),username),el('label',{},t('Password','كلمة المرور'),password),reveal,error,submit);
  root.append(el('div',{class:'login'},el('section',{class:'login-card'},brand(),el('p',{class:'eyebrow'},t('YOUR STORE, WITH YOU','متجرك معك')),
    el('h1',{},t('A clear view.\nWherever you are.','متجرك بين يديك.\nأينما كنت.')),el('p',{},t('Use your mobile dashboard account. Its password may differ from your installed POS account.','استخدم حساب لوحة إدارة الهاتف. قد تختلف كلمة مروره عن حساب نقاط البيع على الكمبيوتر.')),form,
    button(t('العربية','English'),()=>{language=language==='ar'?'en':'ar';localStorage.setItem('aurora-mobile-language',language);showLogin();},'quiet'),
    el('footer',{},t('Aurora POS · Admin access','أورورا · دخول المدير')))));
}
function icon(name){
  const paths={home:'M3 10 12 3l9 7v11H3z M9 21v-8h6v8',activity:'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5',stock:'m3 7 9-4 9 4-9 4z M3 7v10l9 4 9-4V7 M12 11v10',more:'M4 6h16 M4 12h16 M4 18h16'};
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]);svg.append(path);return svg;
}
function shell(){
  document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';
  const main=el('main',{class:'main',id:'main'});
  const nav=el('nav',{class:'navigation','aria-label':t('Main navigation','التنقل الرئيسي')});
  for(const [page,en,ar] of [['home','Overview','الرئيسية'],['activity','Activity','النشاط'],['stock','Stock','المخزون'],['more','More','المزيد']]){
    const b=button('',()=>navigate(page),state.page===page?'active':'');b.append(icon(page),el('span',{},t(en,ar)));if(state.page===page)b.setAttribute('aria-current','page');nav.append(b);
  }
  root.replaceChildren(el('header',{class:'top'},el('div',{},brand(),el('small',{},t('STORE DASHBOARD','لوحة إدارة المتجر'))),el('div',{class:'actions'},
    button(t('عربي','EN'),()=>{language=language==='ar'?'en':'ar';localStorage.setItem('aurora-mobile-language',language);void render();},'quiet'),
    button(t('Sign out','خروج'),async()=>{try{await api('/auth/logout',{},'POST');showLogin();}catch(e){main.prepend(el('p',{class:'alert'},e.message));}},'quiet'))),main,nav);
  if(!navigator.onLine)root.prepend(el('div',{class:'offline'},t('No connection. Reconnect to refresh your store.','لا يوجد اتصال. أعد الاتصال لتحديث المتجر.')));
  return main;
}
function syncBanner(o){
  const stale=!o.paired || !o.lastSeen || Date.now()-new Date(o.lastSeen).getTime()>20000;
  return el('div',{class:`sync${stale?' stale':''}`,role:'status'},el('span',{class:'dot'}),el('div',{},
    el('strong',{},!o.paired?t('PC not connected','الكمبيوتر غير متصل'):stale?t('Waiting for your PC','بانتظار الكمبيوتر'):t('PC connected','الكمبيوتر متصل')),
    el('div',{},o.lastSeen?t(`Last synchronized ${date(o.lastSeen)}.`, `آخر مزامنة ${date(o.lastSeen)}.`):t('Pair your PC to see your store data.','اربط الكمبيوتر لعرض بيانات متجرك.')),
    stale && o.lastSeen ? el('div',{},t('Showing the last synchronized copy.','يتم عرض آخر نسخة تمت مزامنتها.')) : null));
}
function tile(table){return button('',()=>browse(table),'tile');}
function tiles(tables,o){return el('div',{class:'cards'},tables.map(table=>{const b=tile(table);b.append(el('b',{},tableLabel(table)),el('span',{class:'count'},number(o.counts[table]),' ',t('records','سجل')));return b;}));}
async function navigate(page){state.page=page;state.id=null;state.query='';state.offset=0;await render();window.scrollTo({top:0});}
async function browse(table,debts=false){state.debts=debts;state.table=table;state.page='records';state.id=null;state.offset=0;state.query='';await render();window.scrollTo({top:0});}
async function render(){
  const serial=++renderId;
  const main=shell();main.append(el('p',{class:'muted'},t('Refreshing store data…','جارٍ تحديث البيانات…')));
  try{
    const overview=await api('/admin/overview');if(serial!==renderId)return;state.overview=overview;state.viewRevision=overview.sequence;main.replaceChildren();
    const title=state.page==='home'?t('Your store at a glance','متجرك بنظرة واحدة'):state.page==='records'?tableLabel(state.table):state.page==='detail'?t('Record details','تفاصيل السجل'):state.page==='activity'?t('Store activity','نشاط المتجر'):state.page==='stock'?t('Stock & catalog','المخزون والمنتجات'):state.page==='pair'?t('Connect your PC','ربط الكمبيوتر'):state.page==='purchase'?t('New purchase','شراء جديد'):state.page==='drafts'?t('Purchase drafts','مسودات الشراء'):t('Store management','إدارة المتجر');
    main.append(el('div',{class:'heading'},el('div',{},el('p',{class:'eyebrow'},overview.name),el('h1',{},title)),button('↻',()=>render(),'secondary')));main.lastChild.lastChild.setAttribute('aria-label',t('Refresh','تحديث'));
    main.append(syncBanner(overview));
    if(state.page==='home')await home(main,overview,serial);
    else if(state.page==='activity'){main.append(button(t('Customer debts','ديون العملاء'),()=>browse('transactions',true),'secondary')); main.append(button(t('New purchase','شراء جديد'),()=>{newDraft();void navigate('purchase');}),button(t('Mobile purchase drafts','مسودات الهاتف'),()=>navigate('drafts'),'quiet'));main.append(tiles(['transactions','purchase_orders','personal_purchases','transaction_lines','purchase_order_lines','audit_logs'],overview));}
    else if(state.page==='stock')main.append(tiles(['products','inventories','expiration_batches','product_barcodes','categories','suppliers'],overview));
    else if(state.page==='more'){
      main.append(el('section',{class:'panel'},el('h2',{},t('A connected store','متجر متصل')),el('p',{},t('Keep Aurora POS open on the PC to synchronize changes.','اترك برنامج نقاط البيع مفتوحاً لمزامنة التغييرات.')),button(t('Manage PC connection','إدارة اتصال الكمبيوتر'),()=>navigate('pair'))),tiles(['offers','offer_items','price_rules','currency_rates','store_profiles','users','audit_logs','personal_purchases'],overview));
    }else if(state.page==='pair')pairScreen(main,overview);
    else if(state.page==='records')await records(main,serial);
    else if(state.page==='detail')await detail(main,serial);
    else if(state.page==='purchase')purchaseEditor(main);
    else if(state.page==='drafts')await purchaseDrafts(main,serial);
  }catch(error){if(serial===renderId)main.replaceChildren(el('p',{class:'alert',role:'alert'},error.message),button(t('Try again','حاول مجدداً'),()=>render()));}
}
async function home(main,o,serial){
  if(!o.generation){main.append(el('section',{class:'empty'},el('h2',{},t('Your store is ready to connect','متجرك جاهز للاتصال')),el('p',{},t('Generate a pairing code here, then enter it in Settings on your PC. Your existing records will appear after the first sync.','أنشئ رمز ربط هنا وأدخله في إعدادات الكمبيوتر. ستظهر سجلاتك بعد المزامنة الأولى.')),button(t('Connect my PC','اربط الكمبيوتر'),()=>navigate('pair'))));return;}
  const report=await api(`/admin/report${state.start?'?start='+state.start+'&end='+state.end:''}`);if(serial!==renderId)return;
  const start=el('input',{type:'date',value:state.start||report.start,required:true});const end=el('input',{type:'date',value:state.end||report.end,required:true});
  main.append(el('form',{class:'range',onSubmit:e=>{e.preventDefault();state.start=start.value;state.end=end.value;void render();}},el('label',{},t('From','من'),start),el('label',{},t('To','إلى'),end),el('button',{type:'submit',class:'secondary'},t('Apply','عرض'))));
  const m=report.metrics;
  main.append(el('section',{class:'hero'},el('div',{class:'eyebrow'},t('NET SALES','صافي المبيعات')),el('strong',{},money(m.netSalesUsd)),el('p',{},number(m.netSalesLbp),' LBP · ',report.timezone),el('p',{},t('Returns included · Personal purchases excluded','تشمل المرتجعات · تستثني المشتريات الشخصية'))));
  const stat=(title,value,note)=>el('article',{class:'stat'},el('small',{},title),el('strong',{},value),el('span',{},note));
  main.append(el('div',{class:'grid'},stat(t('Gross profit','الربح الإجمالي'),money(m.profitUsd),t('From recorded line margins','حسب هوامش الأصناف')),stat(t('Receipts','الفواتير'),number(m.receipts),`${number(m.returns)} ${t('returns','مرتجعات')}`),stat(t('Outstanding debts','الديون المتبقية'),money(m.outstandingUsd),t('All dates · USD equivalent','كل التواريخ · ما يعادل الدولار')),stat(t('Low-stock items','أصناف منخفضة المخزون'),number(m.lowStock),t('Current synchronized stock','حسب آخر مزامنة'))));
  main.append(el('div',{class:'actions'},button(t('＋ New purchase','＋ شراء جديد'),()=>{newDraft();void navigate('purchase');}),button(t('Purchase drafts','مسودات الشراء'),()=>navigate('drafts'),'secondary')));
  main.append(el('div',{class:'section-head'},el('h2',{},t('Explore your store','استكشف متجرك'))),tiles(['transactions','products','purchase_orders','inventories','suppliers','audit_logs'],o));
}
function pairScreen(main,o){
  const output=el('div',{'aria-live':'polite'});
  const create=button(t('Generate pairing code','إنشاء رمز الربط'),async()=>{create.disabled=true;try{const result=await api('/admin/pairing',{});output.replaceChildren(el('div',{class:'code'},result.code),el('p',{class:'muted'},t('Valid for 10 minutes. Enter this code in PC Settings → Mobile admin dashboard.','صالح لعشر دقائق. أدخل الرمز في إعدادات الكمبيوتر ← لوحة إدارة الهاتف.')));}catch(e){output.replaceChildren(el('p',{class:'alert'},e.message));}finally{create.disabled=false;}});
  main.append(el('section',{class:'panel'},el('h2',{},t('Link this store to Aurora POS','اربط هذا المتجر بنقاط البيع')),el('p',{},t('On your PC, open Settings → Mobile admin dashboard. Enter this dashboard URL and the code below. Pairing a new PC replaces the previous device credential.','افتح الإعدادات في الكمبيوتر وأدخل عنوان لوحة الإدارة والرمز أدناه. ربط كمبيوتر جديد يلغي اعتماد الكمبيوتر السابق.')),el('p',{class:'code'},location.origin),create,output));
  if(o.paired)main.append(el('section',{class:'panel'},el('h3',{},t('Disconnect this PC','إلغاء اتصال الكمبيوتر')),el('p',{},t('This revokes its upload access. The existing store copy stays available.','يلغي صلاحية المزامنة. تبقى نسخة المتجر الحالية متاحة.')),button(t('Revoke PC access','إلغاء صلاحية الكمبيوتر'),async()=>{if(!confirm(t('Revoke this PC’s synchronization access?','هل تريد إلغاء صلاحية المزامنة لهذا الكمبيوتر؟')))return;try{await api('/admin/device',null,'DELETE');await render();}catch(e){output.replaceChildren(el('p',{class:'alert'},e.message));}},'danger')));
}
function summary(row,table){
  const name=row.Name || row._productName || row.DisplayName || row.TransactionNumber || row.Reference || row._supplierName || row.Code || row.BatchCode || row.Action || row.Barcode || row.Entity || row.Id;
  let subtitle=row.Description || row._supplierName || row.Sku || row.DebtCardName || (row.OrderedAt?date(row.OrderedAt):row.CreatedAt?date(row.CreatedAt):'');
  let amount = row.TotalUsd !== undefined ? money(row.TotalUsd) : row.TotalCostUsd !== undefined ? money(row.TotalCostUsd) : row.PriceUsd !== undefined ? money(row.PriceUsd) : row.QuantityOnHand !== undefined ? number(row.QuantityOnHand)+' '+t('on hand','متوفر') : row.Quantity !== undefined ? number(row.Quantity)+' '+t('units','وحدة') : '';
  if(table==='transactions' && row.Type===2)subtitle=t('Return · ','مرتجع · ')+subtitle;
  return el('div',{class:'row-content'},el('strong',{},name),el('small',{},subtitle),amount?el('span',{class:'amount'},amount):null);
}
async function records(main,serial){
  const input=el('input',{type:'search',placeholder:t('Search these records…','ابحث في السجلات…'),value:state.query,'aria-label':t('Search records','بحث السجلات')});
  main.append(el('form',{class:'search',onSubmit:e=>{e.preventDefault();state.query=input.value;state.offset=0;void render();}},input,el('button',{type:'submit',class:'secondary'},t('Search','بحث'))));
  const data=await api(`/admin/records/${state.table}?offset=${state.offset}&debts=${!!state.debts}&q=${encodeURIComponent(state.query)}`);if(serial!==renderId)return;
  if(!data.records.length){main.append(el('div',{class:'empty'},el('h2',{},t('No records found','لا توجد سجلات')),el('p',{},t('Try a different search, or add records on the PC.','جرّب بحثاً آخر أو أضف سجلات من الكمبيوتر.'))));return;}
  main.append(el('div',{class:'rows'},data.records.map(row=>{const b=button('',()=>{state.id=row.Id;state.page='detail';void render();window.scrollTo({top:0});},'row');b.append(summary(row,state.table),el('span',{class:'arrow','aria-hidden':'true'},language==='ar'?'‹':'›'));return b;})));
  const prev=button(t('Previous','السابق'),()=>{state.offset=Math.max(0,state.offset-50);void render();},'secondary');prev.disabled=state.offset===0;
  const next=button(t('Next','التالي'),()=>{state.offset+=50;void render();},'secondary');next.disabled=!data.hasMore;
  main.append(el('div',{class:'pager'},prev,el('span',{},`${state.offset+1}–${state.offset+data.records.length}`),next));
}
function fieldLabel(key){return key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/\bUsd\b/g,'USD').replace(/\bLbp\b/g,'LBP');}
function properties(row){return el('dl',{class:'details'},Object.entries(row).filter(([key])=>!key.startsWith('_')).map(([key,value])=>el('div',{class:key==='ReceiptHtml'?'long':''},el('dt',{},fieldLabel(key)),el('dd',{},value===null?'—':typeof value==='boolean'?(value?t('Yes','نعم'):t('No','لا')):typeof value==='object'?JSON.stringify(value):String(value)))));}
async function detail(main,serial){
  main.append(button(t('← Back to records','العودة إلى السجلات →'),()=>{state.page='records';void render();},'quiet'));
  const data=await api(`/admin/records/${state.table}/${state.id}`);if(serial!==renderId)return;
  main.append(el('section',{class:'panel'},summary(data.record,state.table),properties(data.record)));
  for(const [table,rows] of Object.entries(data.related))main.append(el('section',{class:'panel'},el('h2',{},tableLabel(table)),rows.map(row=>el('details',{class:'related'},el('summary',{},row.Name||row.Barcode||row.Id),properties(row)))));
  if(data.relatedTruncated)main.append(el('p',{class:'alert'},t('More related records exist. Use the dedicated records screen to search the full history.','توجد سجلات مرتبطة إضافية. استخدم شاشة السجلات للبحث في التاريخ الكامل.')));
}
window.addEventListener('online',()=>void render());
window.addEventListener('offline',()=>{if(state.overview)root.prepend(el('div',{class:'offline'},t('Offline — displayed data may be outdated.','غير متصل — قد تكون البيانات المعروضة قديمة.')));});
let polling=false;
setInterval(async()=>{
  if(polling || document.visibilityState!=='visible' || document.querySelector('.login') || !state.overview)return;
  polling=true;
  try{
    const overview=await api('/admin/overview');
    if(state.page==='home' && state.viewRevision!==overview.sequence && !document.activeElement?.matches('input')){
      const position=window.scrollY;await render();window.scrollTo(0,position);
    }else{
      const banner=syncBanner(overview);
      if(state.viewRevision!==overview.sequence)banner.append(el('span',{},t('New data available. Refresh this view.','بيانات جديدة متاحة. حدّث هذه الصفحة.')));
      document.querySelector('.sync')?.replaceWith(banner);
    }
  }catch{const banner=document.querySelector('.sync');if(banner){banner.classList.add('stale');banner.replaceChildren(el('span',{},t('Connection interrupted. Displayed data may be outdated.','انقطع الاتصال. قد تكون البيانات المعروضة قديمة.')));}}
  finally{polling=false;}
},5000);
try{await api('/auth/session');await render();}catch{showLogin();}
let draft;
function newDraft(){draft={id:crypto.randomUUID(),version:0,purchase:{supplierName:'',reference:'',exchangeRate:90000,items:[]}};}
function purchaseEditor(main){
  if(!draft)newDraft();
  main.append(el('h2',{},t('Prepare a purchase','إعداد عملية شراء')),el('p',{},t('Photograph the supplier invoice, then review every item. Nothing changes in stock until you confirm and the PC accepts it.','صوّر فاتورة المورد وراجع كل صنف. لن يتغير المخزون قبل التأكيد وقبول الكمبيوتر.')));
  const message=el('div',{'aria-live':'polite'});main.append(message);
  const files=el('input',{type:'file',accept:'image/jpeg,image/png,image/webp',capture:'environment',multiple:true,'aria-label':t('Invoice photos','صور الفاتورة')});
  const extracted=el('textarea',{'aria-label':t('Recognized invoice text','النص المقروء'),placeholder:t('Recognized text appears here. You can correct it before creating lines.','يظهر النص هنا ويمكن تصحيحه قبل إنشاء الأصناف.')});
  const progress=el('p',{class:'muted',role:'status'});
  const read=button(t('Read invoice photos','قراءة صور الفاتورة'),async()=>{
    read.disabled=true;progress.textContent=t('Preparing recognition…','جارٍ إعداد القراءة…');
    try{extracted.value=await readInvoicePhotos([...files.files],text=>{progress.textContent=text;});progress.textContent=t('Text ready. Review it and create draft lines.','النص جاهز. راجعه وأنشئ أصناف المسودة.');}
    catch(e){progress.textContent=t('Could not read the photo. You can enter the purchase manually. ','تعذّرت قراءة الصورة. يمكنك إدخال الشراء يدوياً. ')+e.message;}
    finally{read.disabled=false;}
  });
  const make=button(t('Create lines from text','إنشاء أصناف من النص'),()=>{const lines=suggestedLines(extracted.value);if(!lines.length){progress.textContent=t('No item lines found. Add items manually.','لم يتم العثور على أصناف. أضفها يدوياً.');return;}draft.purchase.items.push(...lines);renderLines();progress.textContent=t('Check every suggested name and quantity. Enter prices and match barcodes below.','راجع الأسماء والكميات. أدخل الأسعار وطابق الباركود أدناه.');},'secondary');
  main.append(el('details',{class:'panel',open:true},el('summary',{},t('Start with invoice photos','ابدأ بصور الفاتورة')),el('p',{class:'muted'},t('JPG / PNG / WebP · Up to 5 pages, 10 MB each. Photos stay on this device; only reviewed purchase fields are sent.','حتى ٥ صور، ١٠ ميغابايت لكل صورة. تبقى الصور على جهازك؛ تُرسل بيانات الشراء التي تراجعها فقط.')),files,el('div',{class:'actions'},read),progress,extracted,make));
  const form=el('form');main.append(form);
  function inputField(label,value,change,props={}){const field=el('input',{value:value??'',...props,onInput:e=>change(e.target.value)});return el('label',{},label,field);}
  form.append(el('section',{class:'panel'},inputField(t('Supplier','المورد'),draft.purchase.supplierName,v=>draft.purchase.supplierName=v,{required:true,maxlength:180}),inputField(t('Invoice reference','رقم الفاتورة'),draft.purchase.reference,v=>draft.purchase.reference=v,{maxlength:120}),inputField(t('LBP per USD','ليرة لكل دولار'),draft.purchase.exchangeRate,v=>draft.purchase.exchangeRate=Number(v),{type:'number',min:.000001,step:'any',required:true})));
  const rows=el('div');form.append(rows);
  function renderLines(){rows.replaceChildren();draft.purchase.items.forEach((item,index)=>{
    const matchStatus=el('p',{class:'muted',role:'status'},item.productId?t('Matched to an existing POS product','مرتبط بمنتج موجود'):t('Match a product or complete the new product fields.','طابق منتجاً أو أكمل بيانات المنتج الجديد.'));
    const matches=el('div',{class:'actions'});
    const search=button(t('Find product','البحث عن المنتج'),async()=>{
      search.disabled=true;matches.replaceChildren();
      try{
        const query=item.barcode||item.name;let products=(await api('/admin/records/products?q='+encodeURIComponent(query))).records;
        if(item.barcode){const aliases=(await api('/admin/records/product_barcodes?q='+encodeURIComponent(item.barcode))).records.filter(r=>r.Code===item.barcode);for(const alias of aliases){const product=await api('/admin/records/products/'+alias.ProductId);if(!products.some(p=>p.Id===product.record.Id))products.push(product.record);}}
        for(const product of products.slice(0,8))matches.append(button(`${product.Name} · ${product.Barcode}`,()=>{item.productId=product.Id;item.name=product.Name;item.barcode=product.Barcode;item.categoryName='';item.salePriceUsd='';renderLines();},'secondary'));
        if(!products.length)matchStatus.textContent=t('No match. Enter the new product details below, or change the search.','لا يوجد تطابق. أدخل بيانات منتج جديد أو غيّر البحث.');
      }catch(e){matchStatus.textContent=e.message;}finally{search.disabled=false;}
    },'secondary');
    const row=el('section',{class:'panel'},el('div',{class:'heading'},el('h3',{},`${t('Item','الصنف')} ${index+1}`),button(t('Remove','حذف'),()=>{draft.purchase.items.splice(index,1);renderLines();},'quiet')),
      inputField(t('Product name','اسم المنتج'),item.name,v=>{item.name=v;item.productId=null;},{required:true,maxlength:180,readonly:!!item.productId}),
      inputField(t('Barcode (type or scan)','الباركود'),item.barcode,v=>{item.barcode=v;item.productId=null;},{required:true,maxlength:128,readonly:!!item.productId}),search,matchStatus,matches,
      inputField(t('Quantity in stock units','الكمية بوحدة المخزون'),item.quantity,v=>item.quantity=Number(v),{type:'number',min:.001,max:1000000,step:.001,required:true}),
      inputField(t('Purchase cost per unit','تكلفة الشراء للوحدة'),item.unitCost,v=>item.unitCost=v,{type:'number',min:0,step:'any',required:true}));
    const select=el('select',{onChange:e=>item.currency=e.target.value,'aria-label':t('Cost currency','عملة التكلفة')},['USD','LBP'].map(currency=>el('option',{value:currency,selected:currency===item.currency},currency)));
    row.append(el('label',{},t('Cost currency','عملة التكلفة'),select));
    if(!item.productId)row.append(inputField(t('Category for new product','فئة المنتج الجديد'),item.categoryName,v=>item.categoryName=v,{required:true,maxlength:120}),inputField(t('Selling price in USD','سعر البيع بالدولار'),item.salePriceUsd,v=>item.salePriceUsd=v,{type:'number',min:.01,step:.01,required:true}));
    else row.append(button(t('Use as a new product instead','إدخال كمنتج جديد'),()=>{item.productId=null;renderLines();},'quiet'));
    row.append(el('p',{class:'muted'},t('For packs, enter the total stock units and cost per stock unit. Example: 3 boxes × 12 = 36 units.','للعبوات أدخل إجمالي الوحدات وتكلفة الوحدة. مثال: ٣ علب × ١٢ = ٣٦ وحدة.')));rows.append(row);
  });}
  renderLines();
  form.append(button(t('＋ Add item','＋ إضافة صنف'),()=>{draft.purchase.items.push({name:'',barcode:'',categoryName:'',quantity:1,unitCost:'',currency:'USD',salePriceUsd:'',productId:null});renderLines();},'secondary'));
  const save=el('button',{type:'submit'},t('Save & review draft','حفظ ومراجعة المسودة'));form.append(el('div',{class:'actions'},save));
  form.addEventListener('submit',async e=>{
    e.preventDefault();message.replaceChildren();if(!draft.purchase.items.length){message.append(el('p',{class:'alert'},t('Add at least one item.','أضف صنفاً واحداً على الأقل.')));return;}
    save.disabled=true;
    try{const purchase={...draft.purchase,supplierName:draft.purchase.supplierName.trim(),reference:draft.purchase.reference.trim(),items:draft.purchase.items.map(item=>({...item,unitCost:Number(item.unitCost),salePriceUsd:item.salePriceUsd===''?null:Number(item.salePriceUsd)}))};const result=await api('/admin/purchases/'+draft.id,{purchase,version:draft.version},'PUT');draft.version=result.version;await navigate('drafts');}
    catch(e){message.append(el('p',{class:'alert'},e.message));}finally{save.disabled=false;}
  });
}
async function purchaseDrafts(main,serial){
  main.append(el('h2',{},t('Mobile purchase drafts','مسودات مشتريات الهاتف')),button(t('New purchase','شراء جديد'),()=>{newDraft();void navigate('purchase');}));
  const drafts=await api('/admin/purchases');if(serial!==renderId)return;
  if(!drafts.length){main.append(el('p',{class:'empty'},t('No mobile purchase drafts yet.','لا توجد مسودات بعد.')));return;}
  const names={draft:t('Review before confirming','راجع قبل التأكيد'),pending:t('Waiting for PC','بانتظار الكمبيوتر'),applied:t('Accepted by PC','تم القبول في الكمبيوتر'),rejected:t('Needs correction','تحتاج إلى تصحيح')};
  for(const saved of drafts){
    const notice=el('div',{'aria-live':'polite'});
    const panel=el('section',{class:'panel'},el('span',{class:'badge'},names[saved.status]),el('h3',{},saved.purchase.supplierName||t('Purchase','شراء')),el('p',{class:'muted'},saved.purchase.reference||'—',' · ',date(saved.createdAt)),
      el('p',{},t('Exchange rate: ','سعر الصرف: '),number(saved.purchase.exchangeRate),' LBP / USD'));
    for(const item of saved.purchase.items||[])panel.append(el('div',{class:'row'},el('div',{},el('strong',{},item.name||item.barcode),el('small',{},`${number(item.quantity)} × ${number(item.unitCost)} ${item.currency} · ${item.barcode}`)),el('span',{class:'amount'},`${number(item.quantity*Number(item.unitCost))} ${item.currency}`)));
    if(saved.result?.error)panel.append(el('p',{class:'alert'},saved.result.error));
    if(saved.status==='draft')panel.append(el('p',{class:'muted'},t('Check every product, barcode, quantity and price above. Confirmation queues this exact purchase for the PC.','راجع كل منتج وباركود وكمية وسعر. التأكيد يرسل هذه العملية إلى الكمبيوتر.')),el('div',{class:'actions'},
      button(t('Edit','تعديل'),()=>{draft={id:saved.id,version:saved.version,purchase:structuredClone(saved.purchase)};void navigate('purchase');},'secondary'),
      button(t('Confirm purchase','تأكيد الشراء'),async e=>{const control=e.currentTarget;control.disabled=true;try{await api(`/admin/purchases/${saved.id}/submit`,{version:saved.version,confirmed:true});await render();}catch(err){notice.replaceChildren(el('p',{class:'alert'},err.message));control.disabled=false;}})));
    if(saved.status==='rejected')panel.append(button(t('Copy to a new draft','نسخ إلى مسودة جديدة'),()=>{newDraft();draft.purchase=structuredClone(saved.purchase);void navigate('purchase');},'secondary'));
    if(saved.status==='applied' && saved.result?.purchaseId)panel.append(button(t('View synchronized purchase','عرض الشراء بعد المزامنة'),()=>{state.page='detail';state.table='purchase_orders';state.id=saved.result.purchaseId;void render();},'secondary'),el('p',{class:'muted'},t('The mirrored purchase appears after the next sync, usually within a few seconds.','تظهر نسخة الشراء بعد المزامنة التالية خلال ثوانٍ عادةً.')));
    panel.append(notice);main.append(panel);
  }
  main.append(el('p',{class:'muted'},t('Showing the latest 100 mobile drafts. Recorded purchase history is available under Purchases.','تظهر آخر ١٠٠ مسودة. سجل المشتريات المسجلة متاح في المشتريات.')));
}

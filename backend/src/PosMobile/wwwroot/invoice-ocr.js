// OCR runs entirely on this device. Only reviewed purchase fields are submitted.
export async function readInvoicePhotos(files,onProgress){
  if(!files.length || files.length>5)throw new Error('Choose between one and five invoice photos.');
  for(const file of files)if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Use JPG, PNG or WebP photos smaller than 10 MB each.');
  const {default: {createWorker}}=await import('/ocr/tesseract.esm.min.js');
  const worker=await createWorker(['eng','ara'],1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',workerBlobURL:false,logger:m=>onProgress(`${m.status}${m.progress!==undefined?' '+Math.round(m.progress*100)+'%':''}`)});
  let text='';
  try{for(let i=0;i<files.length;i++){onProgress(`Reading page ${i+1} of ${files.length}`);const result=await worker.recognize(files[i]);text+=result.data.text+'\n';}}finally{await worker.terminate();}
  return text;
}
export function suggestedLines(text){
  // Deliberately conservative: never infer prices or barcode identity from uncertain OCR.
  // The review screen requires the admin to confirm quantities, prices and catalog matches.
  return text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line.length>2 && /[a-zA-Z\u0600-\u06ff]/.test(line))
    .filter(line=>!/(^|\s)(total|subtotal|invoice|receipt|tax|vat|tel|phone|date|cash|change|supplier)(\s|:|$)/i.test(line))
    .filter(line=>!/المجموع|الإجمالي|فاتورة|ضريبة|هاتف|التاريخ/.test(line))
    .slice(0,100).map(line=>({name:line,barcode:'',categoryName:'',quantity:1,unitCost:'',currency:'USD',salePriceUsd:'',productId:null}));
}

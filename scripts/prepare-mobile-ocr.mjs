import { mkdir, copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const destination='backend/src/PosMobile/wwwroot/ocr';
await mkdir(path.join(destination,'core'),{recursive:true});await mkdir(path.join(destination,'lang'),{recursive:true});
for(const name of ['tesseract.esm.min.js','worker.min.js','worker.min.js.LICENSE.txt','tesseract.min.js.LICENSE.txt'])await copyFile(path.join('node_modules/tesseract.js/dist',name),path.join(destination,name));
for(const name of await readdir('node_modules/tesseract.js-core'))if(name.includes('.wasm'))await copyFile(path.join('node_modules/tesseract.js-core',name),path.join(destination,'core',name));
for(const lang of ['eng','ara'])await copyFile(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,path.join(destination,'lang',`${lang}.traineddata.gz`));
const licenses=[];
for(const module of ['tesseract.js','tesseract.js-core','@tesseract.js-data/eng','@tesseract.js-data/ara']){
  const files=await readdir('node_modules/'+module);const license=files.find(n=>/^license/i.test(n));
  const pkg=JSON.parse(await readFile(`node_modules/${module}/package.json`,'utf8'));
  licenses.push(`${module} ${pkg.version}\n${license?await readFile(`node_modules/${module}/${license}`,'utf8'):pkg.license}\n`);
}
await writeFile(path.join(destination,'LICENSES.txt'),licenses.join('\n'));
console.log('Local English/Arabic OCR assets prepared.');

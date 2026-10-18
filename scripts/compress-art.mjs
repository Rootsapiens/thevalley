import sharp from 'sharp'; import fs from 'node:fs';
// Usage: node scripts/compress-art.mjs <in.png> [...]; writes 1024px palette PNG to public/art/ (same name).
for (const f of process.argv.slice(2)) {
  const out = 'public/art/' + f.split(/[\/]/).pop();
  await sharp(f).resize(1024,1024,{fit:'cover'}).png({palette:true,quality:80,compressionLevel:9}).toFile(out+'.tmp');
  fs.renameSync(out+'.tmp', out); console.log(out, fs.statSync(out).size);
}

// Downloads Poly Haven (CC0) glTF 1k packs into art-src/models/polyhaven/<id>/ . Data only, nothing executed.
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../../art-src/models/polyhaven');
const ids = process.argv.slice(2);
for (const id of ids) {
  const dir = path.join(root, id);
  if (fs.existsSync(path.join(dir, id + '_1k.gltf'))) { console.log('have', id); continue; }
  const f = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  const g = f.gltf?.['1k']?.gltf; if (!g) { console.log('NO 1k', id); continue; }
  fs.mkdirSync(dir, { recursive: true });
  const get = async (url, rel) => { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true });
    const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); fs.writeFileSync(p, Buffer.from(await r.arrayBuffer())); };
  await get(g.url, id + '_1k.gltf');
  for (const [rel, v] of Object.entries(g.include)) await get(v.url, rel);
  console.log('ok', id, Object.keys(g.include).join(','));
}

import { NodeIO } from '@gltf-transform/core';
import { weld, simplify, dedup, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
const [,, inp, out, ratio, tex0, texN] = process.argv;
await MeshoptSimplifier.ready;
const io = new NodeIO();
const doc = await io.read(inp);
const root = doc.getRoot();
for (const t of root.listTextures()) {
  const m = await sharp(Buffer.from(t.getImage())).metadata();
  console.log('tex', t.getMimeType(), m.width, m.height, t.getImage().byteLength);
}
for (const m of root.listMaterials()) {
  console.log('mat', m.getName(), 'base', !!m.getBaseColorTexture(), 'nrm', !!m.getNormalTexture(), 'mr', !!m.getMetallicRoughnessTexture(), 'occ', !!m.getOcclusionTexture(), 'em', !!m.getEmissiveTexture(), 'rough', m.getRoughnessFactor(), 'metal', m.getMetallicFactor());
}
if (ratio !== '1') {
  await doc.transform(weld({tolerance:1e-6}), simplify({ simplifier: MeshoptSimplifier, ratio: +ratio, error: 0.003 }), prune());
}
// resize textures
for (const m of root.listMaterials()) {
  const slots = [['base', m.getBaseColorTexture(), +tex0], ['nrm', m.getNormalTexture(), +texN], ['mr', m.getMetallicRoughnessTexture(), +texN], ['occ', m.getOcclusionTexture(), +texN]];
  for (const [n, t, size] of slots) {
    if (!t) continue;
    const buf = await sharp(Buffer.from(t.getImage())).resize(size, size, {fit:'inside'}).jpeg({quality: n==='base'?88:85}).toBuffer();
    t.setImage(new Uint8Array(buf)).setMimeType('image/jpeg');
  }
}
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) console.log('out verts', p.getAttribute('POSITION').getCount(), 'idx', p.getIndices()?.getCount());
await io.write(out, doc);
console.log('wrote', out, fs.statSync(out).size);

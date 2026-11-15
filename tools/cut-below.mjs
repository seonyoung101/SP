import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
const [,, inp, out, thr] = process.argv;
const io = new NodeIO(); const doc = await io.read(inp);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute('POSITION').getArray(); const idxA = prim.getIndices(); const I = idxA.getArray();
const keep = [];
for (let t=0;t<I.length;t+=3){ const a=I[t],b=I[t+1],c=I[t+2];
  const cy=(P[3*a+1]+P[3*b+1]+P[3*c+1])/3; if (cy >= +thr) keep.push(a,b,c); }
idxA.setArray(new Uint32Array(keep)); await doc.transform(prune()); await io.write(out, doc);
const q = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getArray();
let miny=9, cx=0, cz=0, n=0; for (let i=0;i<q.length;i+=3) miny=Math.min(miny,q[i+1]);
for (let i=0;i<q.length;i+=3) if (q[i+1]<miny+0.01){cx+=q[i];cz+=q[i+2];n++;}
console.log('tris', I.length/3,'->',keep.length/3,'miny',miny.toFixed(3),'end center', (cx/n).toFixed(3), (cz/n).toFixed(3));

// Gera os .glb do Sketchfab em models/ (ver CREDITS.md).
// Uso: npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
//      node ferramentas/converter-sketchfab.mjs <pasta com os zips extraídos> models [nome,nome]
// Cada zip deve estar extraído numa pasta com o nome do arquivo (ex.: hellhound/scene.gltf).
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune, dedup, meshopt, resample, unpartition, metalRough, weld, simplify, textureCompress} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';import fs from 'fs';import path from 'path';
const [SF,OUT]=process.argv.slice(2);await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const ONLY=process.argv[4]?process.argv[4].split(','):null;
const JOBS=[
 {out:'aranha',src:'black_giant_spider__arana_gigante_negra',anims:['Atack','Dead','Idle','Walk']},
 {out:'formiga',src:'game-ready_worker_ant_model',anims:['Attack1','Formic Acid','idle','Walk'],ratio:.15,tex:512},
 {out:'formiga-rainha',src:'game-ready_queen_ant_model',anims:['Attack2','idle','Walk'],ratio:.15,tex:512},
 {out:'cao-infernal',src:'hellhound',anims:['idle01','walk_7','run_fast','hit01','attack01','death_1_1']},
 {out:'lobo-sombrio',src:'wolf_with_animations',anims:['01_Run','02_walk','04_Idle'],drop:/^Plane/},
 {out:'javali',src:'animated_realistic_boar__3d_animal_model',anims:['Armature|observing','Armature|walk','Armature|run','Armature|alerted','Armature|wound','Armature|laydown']},
 {out:'urso',src:'realistic_animated_bear_3d_model',anims:['Stand_Idle_01','Walk','Run','Attack_StandAngry_01_High','Hit_Stand_F01','Death_Stand_R01']},
 {out:'urso-polar',src:'realistic_animated_bear_3d_model',anims:['Stand_Idle_01','Walk','Run','Attack_StandAngry_01_High','Hit_Stand_F01','Death_Stand_R01'],whiten:true},
];
// clareia texturas de cor base (pelo marrom -> branco gelado)
async function whiten(doc){for(const m of doc.getRoot().listMaterials()){const t=m.getBaseColorTexture();if(!t||t.getExtras().white)continue;
  const buf=await sharp(Buffer.from(t.getImage())).greyscale().linear(1.15,95).tint({r:235,g:242,b:255}).png().toBuffer();t.setImage(new Uint8Array(buf)).setMimeType('image/png');t.setExtras({white:true})}}
fs.mkdirSync(OUT,{recursive:true});
for(const J of JOBS.filter(j=>!ONLY||ONLY.includes(j.out))){const doc=await io.read(path.join(SF,J.src,'scene.gltf'));const R=doc.getRoot();
  for(const a of R.listAnimations())if(!J.anims.includes(a.getName())){a.listChannels().forEach(c=>c.dispose());a.listSamplers().forEach(s=>s.dispose());a.dispose()}
  if(J.drop)for(const n of R.listNodes())if(J.drop.test(n.getName()))n.dispose();
  await doc.transform(metalRough());if(J.whiten)await whiten(doc);
  const steps=[unpartition(),resample(),dedup(),prune()];
  if(J.ratio)steps.push(weld(),simplify({simplifier:MeshoptSimplifier,ratio:J.ratio,error:.1}));
  steps.push(textureCompress({encoder:sharp,targetFormat:'webp',resize:[J.tex||1024,J.tex||1024]}),prune(),meshopt({encoder:MeshoptEncoder,level:'medium'}));
  await doc.transform(...steps);const f=path.join(OUT,J.out+'.glb');await io.write(f,doc);
  let tri=0;for(const m of R.listMeshes())for(const p of m.listPrimitives()){const ix=p.getIndices();tri+=(ix?ix.getCount():p.getAttribute('POSITION').getCount())/3}
  console.log(J.out.padEnd(16),Math.round(fs.statSync(f).size/1024)+'KB','tri',Math.round(tri),R.listAnimations().map(a=>a.getName()).join(','))}

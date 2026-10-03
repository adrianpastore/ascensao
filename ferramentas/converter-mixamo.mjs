// Gera os personagens e as animações do Mixamo em models/ (ver CREDITS.md).
// 1) Converter cada .fbx em .glb com FBX2glTF (npm i fbx2gltf): FBX2glTF --binary --input X.fbx --output X
//    Rode a partir de uma pasta com caminho só ASCII: com acentos (ex.: "Área de Trabalho") as texturas embutidas não são extraídas.
// 2) npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
//    node ferramentas/converter-mixamo.mjs <pasta com os .glb> models [nome,nome]
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune, dedup, meshopt, resample, unpartition, weld, simplify, textureCompress, mergeDocuments} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';import fs from 'fs';import path from 'path';
const [SRC,OUT,only]=process.argv.slice(2);const ONLY=only?only.split(','):null;await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const CHARS=[['goblin','goblin_d_shareyko'],['orc','Warrok_W_Kurniawan'],['xama','Ganfaul_M_Aure'],['mutante','Mutant',768],['yeti','Mutant',768,true],['esqueleto-zumbi','Skeletonzombie_T_Avelange'],
 ['cavaleiro','Knight_D_Pelegrini'],['feiticeira','Nightshade_J_Friedrich'],['demonio-ferreiro','Maw_J_Laygo'],['demonio','Demon_T_Wiezzorek'],['arqueira','Erika_Archer_With_Bow_Arrow'],['vampiro','Vampire_A_Lusth']];
const ANIMS=['Standing_Idle','Walking','Running','Standing_Melee_Attack_Horizontal','Dying','Standing_1H_Magic_Attack_01','Standing_Draw_Arrow',
 'Mutant_Idle','Mutant_Walking','Mutant_Run','Mutant_Swiping','Mutant_Dying','Zombie_Idle','Zombie_Walk','Zombie_Attack','Zombie_Reaction_Hit','Zombie_Dying'];
const dropAnims=doc=>{for(const a of doc.getRoot().listAnimations()){a.listChannels().forEach(c=>c.dispose());a.listSamplers().forEach(s=>s.dispose());a.dispose()}};
// clareia a cor base (pele escura -> pelagem branca)
async function whiten(doc){for(const m of doc.getRoot().listMaterials()){const t=m.getBaseColorTexture();if(!t||t.getExtras().white)continue;
  const buf=await sharp(Buffer.from(t.getImage())).greyscale().linear(1.2,110).tint({r:235,g:242,b:255}).png().toBuffer();t.setImage(new Uint8Array(buf)).setMimeType('image/png');t.setExtras({white:true})}}
const kb=f=>Math.round(fs.statSync(f).size/1024);fs.mkdirSync(OUT,{recursive:true});
for(const [name,src,tex,white] of CHARS){if(ONLY&&!ONLY.includes(name))continue;const doc=await io.read(path.join(SRC,src+'.glb'));dropAnims(doc);if(white)await whiten(doc);
  await doc.transform(unpartition(),dedup(),prune(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:.6,error:.005}),
    textureCompress({encoder:sharp,targetFormat:'webp',resize:[tex||1024,tex||1024]}),prune(),meshopt({encoder:MeshoptEncoder,level:'medium'}));
  const f=path.join(OUT,name+'.glb');await io.write(f,doc);let tri=0;for(const m of doc.getRoot().listMeshes())for(const p of m.listPrimitives())tri+=p.getIndices().getCount()/3;
  console.log(name.padEnd(18),kb(f)+'KB tri',Math.round(tri),'texturas',doc.getRoot().listTextures().map(t=>(t.getSize()||[]).join('x')).join(' '))}
if(!ONLY||ONLY.includes('mixamo-animacoes')){
  // todas as animações num arquivo sem malha; cada clipe recebe o nome do arquivo; quadril sem deslocamento horizontal (fica no lugar)
  const base=await io.read(path.join(SRC,ANIMS[0]+'.glb'));base.getRoot().listAnimations()[0].setName(ANIMS[0]);
  const byName=new Map(base.getRoot().listNodes().map(n=>[n.getName(),n]));
  for(const a of ANIMS.slice(1)){const d=await io.read(path.join(SRC,a+'.glb'));d.getRoot().listAnimations()[0].setName(a);const sc=d.getRoot().listScenes()[0];const map=mergeDocuments(base,d);
    for(const an of base.getRoot().listAnimations())for(const c of an.listChannels()){const t=c.getTargetNode();if(t&&byName.get(t.getName())!==t)c.setTargetNode(byName.get(t.getName()))}
    map.get(sc).dispose()}
  for(const an of base.getRoot().listAnimations())for(const c of an.listChannels()){if(c.getTargetPath()!=='translation'||!/Hips$/.test(c.getTargetNode().getName()))continue;
    const out=c.getSampler().getOutput(),v=[0,0,0],v0=out.getElement(0,[0,0,0]);let mx=0;
    for(let i=0;i<out.getCount();i++){out.getElement(i,v);mx=Math.max(mx,Math.hypot(v[0]-v0[0],v[2]-v0[2]));v[0]=v0[0];v[2]=v0[2];out.setElement(i,v)}
    if(mx>5)console.log('  deslocamento removido de',an.getName(),Math.round(mx))}
  for(const n of base.getRoot().listNodes()){if(n.getMesh())n.setMesh(null);if(n.getSkin())n.setSkin(null)}
  for(const m of base.getRoot().listMeshes())m.dispose();for(const s of base.getRoot().listSkins())s.dispose();
  const scene0=base.getRoot().listScenes()[0];for(const n of base.getRoot().listNodes())if(!n.getParentNode()&&!scene0.listChildren().includes(n))n.dispose();
  await base.transform(unpartition(),resample(),dedup(),prune(),meshopt({encoder:MeshoptEncoder,level:'medium'}));const f=path.join(OUT,'mixamo-animacoes.glb');await io.write(f,base);
  console.log('mixamo-animacoes',kb(f)+'KB',base.getRoot().listAnimations().map(a=>a.getName()).join(','))}

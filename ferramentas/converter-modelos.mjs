// Gera os .glb de models/ a partir dos packs originais (ver CREDITS.md).
// Uso: npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer
//      node ferramentas/converter-modelos.mjs <pasta com os packs extraídos> models
// Cada pack deve estar extraído numa pasta com o nome do zip (ex.: Ultimate_Monsters/, KayKit_Skeletons_1_1_FREE/).
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune, dedup, meshopt, resample, mergeDocuments, unpartition} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import fs from 'fs';import path from 'path';
const [PK,OUT]=process.argv.slice(2);await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const UM=PK+'/Ultimate_Monsters/Ultimate Monsters',AN=PK+'/Ultimate_Animated_Animals_July_2021/Ultimate Animated Animals - July 2021/glTF',
  KS=PK+'/KayKit_Skeletons_1_1_FREE/KayKit_Skeletons_1.1_FREE',KA=PK+'/KayKit_Adventurers_2_0_FREE/KayKit_Adventurers_2.0_FREE';
const BIG=['Idle','Walk','Run','Punch','Weapon','HitReact','Death'],BLOB=['Idle','Walk','Bite_Front','HitRecieve','Death'],ANI=['Idle','Walk','Gallop','Attack','Idle_HitReact1','Death'];
const KK=['Idle_A','Walking_A','Running_A','Throw','Hit_A','Death_A'];
const JOBS=[
 ['orc',UM+'/Big/glTF/Orc.gltf',BIG],['orc-caveira',UM+'/Big/glTF/Orc_Skull.gltf',BIG],['tribal',UM+'/Big/glTF/Tribal.gltf',BIG],['yeti',UM+'/Big/glTF/Yeti.gltf',BIG],
 ['demonio',UM+'/Big/glTF/Demon.gltf',BIG],['demonio-azul',UM+'/Big/glTF/BlueDemon.gltf',BIG],
 ['limo',UM+'/Blob/glTF/GreenBlob.gltf',BLOB],['limo-espinhos',UM+'/Blob/glTF/GreenSpikyBlob.gltf',BLOB],['cogumelo',UM+'/Blob/glTF/Mushnub.gltf',BLOB],['cogumelo-espinhos',UM+'/Blob/glTF/Mushnub_Evolved.gltf',BLOB],
 ['lobo',AN+'/Wolf.gltf',ANI],['lobo-branco',AN+'/Husky.gltf',ANI],
 ['esqueleto',KS+'/characters/gltf/Skeleton_Minion.glb',[],[['handslot.r',KS+'/assets/gltf/Skeleton_Blade.gltf']]],
 ['esqueleto-arqueiro',KS+'/characters/gltf/Skeleton_Rogue.glb',[],[['handslot.r',KS+'/assets/gltf/Skeleton_Crossbow.gltf']]],
 ['esqueleto-guerreiro',KS+'/characters/gltf/Skeleton_Warrior.glb',[],[['handslot.r',KS+'/assets/gltf/Skeleton_Axe.gltf'],['handslot.l',KS+'/assets/gltf/Skeleton_Shield_Large_A.gltf']]],
 ['esqueleto-mago',KS+'/characters/gltf/Skeleton_Mage.glb',[],[['handslot.r',KS+'/assets/gltf/Skeleton_Staff.gltf']]],
 ['elfo-lanceiro',KA+'/Characters/gltf/Rogue_Hooded.glb',[],[['handslot.r',KA+'/Assets/gltf/sword_1handed.gltf']]],
 ['elfo-arqueiro',KA+'/Characters/gltf/Ranger.glb',[],[['handslot.l',KA+'/Assets/gltf/bow_withString.gltf']]],
 ['elfo-mago',KA+'/Characters/gltf/Mage.glb',[],[['handslot.r',KA+'/Assets/gltf/staff.gltf']]],
];
const keepAnims=(doc,names)=>{for(const a of doc.getRoot().listAnimations())if(!names.includes(a.getName()))a.dispose()};
const finish=async(doc,name)=>{await doc.transform(unpartition(),resample(),dedup(),prune(),meshopt({encoder:MeshoptEncoder,level:'medium'}));
  const f=path.join(OUT,name+'.glb');await io.write(f,doc);return Math.round(fs.statSync(f).size/1024)};
fs.mkdirSync(OUT,{recursive:true});
for(const [name,src,anims,attach] of JOBS){const doc=await io.read(src);keepAnims(doc,anims);
  for(const [slot,wf] of attach||[]){const w=await io.read(wf);const wScene=w.getRoot().listScenes()[0];const map=mergeDocuments(doc,w);
    const hand=doc.getRoot().listNodes().find(n=>n.getName()===slot);const sc=map.get(wScene);
    for(const n of sc.listChildren())hand.addChild(n);sc.dispose()}
  console.log(name.padEnd(22),(await finish(doc,name))+'KB',doc.getRoot().listAnimations().map(a=>a.getName()).join(','))}
// animações KayKit compartilhadas (sem malha): junta General + MovementBasic no esqueleto do primeiro arquivo
{const doc=await io.read(KS+'/Animations/gltf/Rig_Medium/Rig_Medium_General.glb'),mv=await io.read(KS+'/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb');
  const base=new Map(doc.getRoot().listNodes().map(n=>[n.getName(),n]));const mvScene=mv.getRoot().listScenes()[0];const map=mergeDocuments(doc,mv);
  for(const a of doc.getRoot().listAnimations())for(const c of a.listChannels()){const t=c.getTargetNode();if(t&&base.get(t.getName())!==t)c.setTargetNode(base.get(t.getName()))}
  map.get(mvScene).dispose();keepAnims(doc,KK);
  for(const n of doc.getRoot().listNodes()){if(n.getMesh())n.setMesh(null);if(n.getSkin())n.setSkin(null)}
  for(const m of doc.getRoot().listMeshes())m.dispose();for(const s of doc.getRoot().listSkins())s.dispose();
  for(const n of doc.getRoot().listNodes())if(!n.getParentNode()&&!doc.getRoot().listScenes()[0].listChildren().includes(n))n.dispose();
  console.log('kaykit-animacoes'.padEnd(22),(await finish(doc,'kaykit-animacoes'))+'KB',doc.getRoot().listAnimations().map(a=>a.getName()).join(','))}

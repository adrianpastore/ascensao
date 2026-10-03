# Ascensão — Portais

Jogo de ação em primeira pessoa para navegador, inspirado na *ideia* de Solo Leveling (portais com rank, o Sistema, evolução solitária) e The King's Avatar (classes, combos, builds, arma personalizada). Todo o conteúdo é original: nomes, personagens, história e visual são nossos.

Este arquivo é o guia do projeto para o Claude (e para quem mais mexer no código). Leia antes de qualquer alteração.

---

## 1. Como rodar e publicar

- O jogo inteiro está em **um único arquivo: `index.html`** (HTML + CSS + JS inline).
- Dependências externas carregadas por CDN:
  - three.js **0.186.1** (ES modules) via `<script type="importmap">` apontando para o jsDelivr (`three` e `three/addons/`). O script do jogo é `type="module"` e importa o three com `await import()` dentro da IIFE; `GLTFLoader` e `SkeletonUtils` são opcionais (se falharem, o jogo segue sem modelos).
  - **Visual da r128 preservado**: `THREE.ColorManagement.enabled=false` e um ajuste em `ShaderChunk.lights_pars_begin` (fator π nas luzes e atenuação linear por distância, como no modo antigo). Ao trocar a versão do three.js, confira se o aviso "ajuste de luz não aplicado" aparece no console.
  - Fonte Google: **Chakra Petch**.
- Publicação: GitHub Pages, branch `main`, pasta raiz. Basta substituir o `index.html` a cada versão.
- Não há build, bundler nem servidor. Abrir o arquivo no navegador já funciona (com internet, por causa do CDN). Modelos `.glb` só carregam por http(s) (GitHub Pages ou servidor local); abrindo por `file://`, os inimigos usam as formas primitivas.

---

## 2. Regras do projeto

1. **Idioma**: toda a interface, textos, avisos do Sistema e nomes estão em **português do Brasil**.
2. **Propriedade intelectual**: nunca usar nomes, personagens, falas, termos característicos ou visual de Solo Leveling, The King's Avatar ou outras obras (ex.: nada de "Sung Jinwoo", "Glory", "Arise", "Monarca das Sombras", "Sombrinha de Mil Formas"). Inspiração em *mecânicas* sim; cópia não.
3. **Compatibilidade de save**: qualquer campo novo no jogador precisa de valor padrão em `freshPlayer()` e, se necessário, migração em `initPlayer()`. Nunca quebrar saves antigos.
4. **Nunca travar o jogo**: recurso novo que dependa de algo externo (ex.: modelos 3D) precisa de **fallback** para o comportamento atual.
5. **Desempenho em primeiro lugar** (ver seção 9). O jogo precisa rodar em celular intermediário na qualidade Baixa.
6. **Etapas jogáveis**: cada entrega deve deixar o jogo completo e testado; nada pela metade publicado.
7. **Sem `localStorage` para coisas sensíveis**: só progresso do jogo e preferência de qualidade.
8. **Testar antes de publicar**: checar sintaxe (`node --check` no script extraído) e rodar o teste headless (seção 10).
9. **Estilo de código**: o arquivo é denso de propósito (tudo inline). Ao editar, preferir substituições pontuais e manter a ordem das seções.

---

## 3. Arquitetura do código (ordem no arquivo)

1. **CSS** — tokens em `:root` (azul "Sistema" `--sys`, ouro `--xp`, vida `--hp`, mana `--mp`), HUD, cidade, janelas, controles de toque.
2. **HTML** — `#stage` com canvas, overlays de efeito (`#hurt`, `#fury`, `#stealth`, `#iron`, `#perf`), HUD (`#stats`, `#skills`, `#quest`, `#map`, `#boss`, `#combo`, `#counter`, `#notes`, `#nums`), `#city`, `#status`, `#overlay`, `#touch`.
3. **Ruído e texturas** — `hash`, `vnoise`, `fbm`, `genTex()` gera cor + normal map em canvas 256×256 (paredes, chão, teto, rocha, solo).
4. **Dados** — `MOBS`, `FAMS`, `OPENVIS`, `WORLDS`, `THEMES`, `WEAP`, `WNAMES`, `TIERS`, `SKD`, `BR`, `SETS`, `CLS`, `STATN`, `DAILY`, `INTRO`, `SHOP`.
5. **Renderização** — `renderer`, `scene`, `cam`, `hemi`, `sun`, `lantern`, pool de luzes (`poolL`), partículas (`Parts`: `glowP` aditivo, `bloodP` normal).
6. **Arma na mão** — cena separada `gunScene` + `gunCam`; modelos `VM[0..4]` (adaga, espada, lança, arco, cajado), `hand2` (segunda adaga do Assassino), arcos de corte `slash`/`slash2`, poses (`REST`, `SW[]`, `LREST`, `BREST`, `SREST`, `BLOCK`...).
7. **Som** — Web Audio sintetizado (`noise`, `tone`, `sfx`).
8. **Masmorra** — geradores `genDungeon`, `genDungeonW` (salões altos, pilares), `genCave` (autômato celular), `genOpen` (ruído + regiões), `genArena` (penalidade), `finishOrganic`, `rp()` (ponto livre numa sala). `buildFloor(f, pen, W)` monta tudo.
9. **Monstros** — `buildMob(type)` monta o corpo por tipo (`biped`, `quad`, `spider`, `insect`, `blob`, `shroom`), `spawnMob`, `makeElite`.
10. **Jogador** — `P`, `freshPlayer`, `initPlayer`, `save`, fórmulas (`maxHP`, `maxMP`, `dmgMult`, `spdMult`, `skMult`, `weaponDmg`, `critCh`).
11. **UI** — `note()` (avisos do Sistema), números de dano, barra de habilidades, `hud()`, `updateQuest()`, minimapa, janelas de status e árvore.
12. **Combate** — `attack`, `doMeleeHit`, `damage`, `breakPosture`, `kill`, `gainXP`, `bossDown`, `hurtPlayer`, projéteis (`shootProj`, `enemyShot`), `explodeAt`, `chainZap`, `launch`, invocações (`summon`, `hurtAlly`), armadilhas, habilidades (`useSkill`).
13. **Entrada** — teclado, mouse com pointer lock, toque.
14. **Fluxo** — `enterFloor`, `enterPortal`, `finishRun`, `goCity`, `renderCity`, `menu`, `intro`, `accept`.
15. **`update(dt)`** — jogador, inimigos (IA), projéteis, invocações, zonas, armadilhas, itens, penalidade, portal.
16. **`sync(dt)`** — tudo que é visual: câmera, arma, braseiros, inimigos, aliados, partículas, HUD.
17. **`loop()`** — resolução dinâmica, `update` + `sync` + render das duas cenas.

### Estado global
- `P` jogador, `L` andar atual, `RUN` portal em andamento (`{r, w, fams, floors, i, gold, kills, t0}`), `grid` (0 chão, 1/2 parede, 3 pilar).
- `state`: `menu`, `play`, `status`, `city`, `pause`, `transit`, `dead`, `win`.
- `window.__dbg()` expõe `P` e `L` para testes.

---

## 4. Sistemas de jogo (regras atuais)

### Progressão
- XP para o próximo nível: `40 × nível^1,6`.
- Por nível: **+3 pontos de atributo** e **+1 ponto de habilidade**; vida e mana cheias.
- Atributos: Força (dano +5%/pt), Agilidade (velocidade +2%/pt até 180%, crítico +0,8%/pt), Vitalidade (vida +12/pt), Inteligência (mana +8/pt, dano de habilidade +6%/pt).
- Vida: `100 + (nível−1)×8 + VIT×12`. Mana: `50 + (nível−1)×3 + INT×8`.

### Combate
- **Combo**: cada acerto soma; +2% de dano por acerto, até +50%. Zera após 2,6 s sem acertar ou ao levar dano.
- **Cadeia de golpes**: o 3º golpe seguido é pesado (×1,6, mais alcance, quebra mais postura).
- **Cancelamento**: habilidade ou esquiva logo após o acerto corta a animação (+2 no combo; habilidade +25% de dano).
- **Postura**: barra amarela; enche com golpes. Cheia → atordoado (2,6 s; chefe 2,2 s), +50% de dano recebido. Máximo = 60% da vida (chefe 45%). Regenera após 2 s sem apanhar.
- **Esquiva** (Espaço): invulnerável ~0,32 s. **Esquiva perfeita**: golpe chega durante a esquiva → câmera lenta + contra-ataque.
- **Contra-ataque**: janela de 1,3 s; próximo golpe é crítico garantido ×2,5 e quebra muita postura.
- **Status negativos no jogador**: lentidão (teia, gelo), veneno (ácido, esporos).

### Classes (escolha no nível 10, permanente; Pedra do Recomeço troca)
| Classe | Arma | Bônus | Passivas principais | Habilidades (Q / E / R / F) |
|---|---|---|---|---|
| Sem classe | adaga/espada | — | — | Investida / Corte Giratório / Lâmina de Energia / Fúria |
| Espadachim | espada | +5 FOR, +5 VIT | +20% espada, +30% postura, bloquear (botão direito/B), aparar | Investida / Corte Giratório / Corte Cruzado / Postura Inabalável |
| Assassino | 2 adagas | +5 FOR, +5 AGI | +20% dano e +15% vel. com adaga, +10% crítico, pelas costas ×2, esquiva melhor | Investida / Leque de Lâminas / Passo Sombrio / Furtividade |
| Mago de Batalha | lança | +4 FOR, +6 INT | +20% lança, 3º golpe lança para o alto, alvo no ar +30% de dano | Estocada Ascendente / Queda Meteórica / Lança de Raio / Tempestade Arcana |
| Atirador | arco | +7 AGI, +3 FOR | +20% arco, +15% movimento, 2 críticos após esquivar | Salto Para Trás / Chuva de Flechas / Flecha Perfurante / Tiro Rápido |
| Invocador | cajado | +7 INT, +3 VIT | +20% cajado, invocações escalam com INT | Lobo Espiritual / Golem de Pedra / Ordem de Ataque / Exército Espiritual |

Habilidades liberam nos níveis 2, 4, 6 e 9 do personagem.

### Árvore de habilidades (tecla K)
- Cada habilidade vai do nível 1 ao 5 (`P.sk[id].up` de 0 a 4): +15% de dano/duração e −6% de recarga por evolução.
- No nível 3 da habilidade, escolher **uma variação** (A ou B) — definitiva. Textos em `BR`.
- Pergaminho do Esquecimento devolve todos os pontos.

### Armas
- 5 armas: Adaga, Espada, Lança, Arco, Cajado (teclas 1–5; roda do mouse alterna).
- Raridades: Comum ×1, Incomum ×1,3, Rara ×1,7, Épica ×2,2, Lendária ×2,9.
- Aprimorar na loja: 250 / 600 / 1300 / 2800 de ouro. Chefe final de portal também aprimora uma arma possuída. O primeiro chefe dá a espada.

### Inimigos
- Comportamentos (`kind`): `melee`, `ranged`, `leaper` (salta), `charger` (investe), `bomber` (explode), `boss`.
- Modificadores: `shield` (reduz dano frontal), `revive` (se remonta 1×), `split` (divide ao morrer), `heal` (cura aliados), `proj` (cor, velocidade, `slow`, `poison`).
- Chefes (`abil`): `slam` (área marcada no chão), `charge`, `volley` (leque de projéteis), `summon` (chama o 1º tipo da família aos 60% e 30% de vida).
- **Elites**: chance `4% + 6% × rank`; ×2,2 vida, ×1,35 dano, ×2,5 XP, ×2 ouro, aura vermelha.
- Famílias (`FAMS`, 3 tipos + chefe cada): Goblinoides, Aracnídeos, Mortos-vivos, Formigas Gigantes, Feras, Limos e Fungos, Demônios, Feras do Gelo, Elfos do Gelo.
- Primeira vez que encontra um tipo: o Sistema mostra nome e dica (`P.seen`).

### Mundos e portais
- Cada portal sorteia **rank** (força), **mundo** (`WORLDS`) e a **família de cada região**. O rank não define o visual.
- Estilos de mapa: `dungeon` (teto 3–6 m, pilares), `cave` (orgânico, estalactites), `open` (céu, sol, obstáculos como árvores, pinheiros, gelo, rochas, ruínas).
- Mundos abertos podem ter **duas regiões** (`zoneAt`), cada uma com sua família e seus obstáculos. Ex.: Tundra = Campo de Gelo (Feras do Gelo) + Floresta Congelada (Elfos do Gelo).
- Arena do chefe maior, cercada por braseiros.
- Andares intermediários têm Sentinela (70% da vida); o último tem o chefe (120%).
- Ouro coletado só é garantido ao sair; morrer perde o ouro do portal.
- Fechar um portal do rank mais alto liberado libera o próximo (E → D → C → B → A → S).

### Cidade (Associação de Caçadores)
- Abas: Portais (3 ofertas, sortear de novo por 15 de ouro), Loja do Sistema, Recordes, Status, Habilidades.
- Loja: poção de vida (30), poção de mana (35), pergaminho de retorno (80), tomo de atributo (150 + 100 por compra), aprimoramentos, Pergaminho do Esquecimento (300), Pedra do Recomeço (1500).

### O Sistema, diária e penalidade
- Introdução (3 telas + janela do Sistema) no Novo jogo; depois o portal tutorial.
- Diária: 30 abates, 1000 m, 15 esquivas, 3 esquivas perfeitas (aparar conta). Recompensa: 3 pontos, cura total, 1 poção. Renova à meia-noite local.
- Diária incompleta ao virar o dia → próximo portal leva à **Zona de Penalidade** (sobreviver 60 s a ondas).

---

## 5. Como adicionar conteúdo

### Novo inimigo
1. Entrada em `MOBS` com `name`, `body`, `look` (cores e peças: `ears`, `tusks`, `horns`, `hood`, `robe`, `bone`, `helm`, `crown`, `pads`, `tail`, `shield`, `weapon`, `mane`, `spikes`, `bulk`, `stripe`, `armor`, `mand`, `sac`, `glow`), `s` (escala), `hp`, `dmg`, `spd`, `range`, `xp`, `r` (raio), `windup`, `cd`, `kind`, opcionais (`shield`, `revive`, `split`, `heal`, `proj`, `blood`, `tip`).
2. Colocar o tipo numa família em `FAMS` (com peso em `w`).
3. Se precisar de corpo novo, criar o ramo em `buildMob` garantindo `legs`, `arms` (2 pivôs), `bar`, `fg`, `pf`, `mats`.

### Nova família
`FAMS.chave = {name, types:[3 tipos], w:[pesos], boss:'tipoDoChefe', count?}` e incluir a chave em algum mundo.

### Novo mundo
Entrada em `WORLDS` com `name`, `style`, `ceil` (masmorra/caverna), `vis` (índice de `THEMES` ou chave de `OPENVIS`) e `zones` (`label`, `fams`, `props`, `dens` para áreas abertas).

### Nova habilidade
1. `SKD.id` (tecla, nome, nível, mana, recarga, descrição, ícone SVG) e variações em `BR.id`.
2. Incluir em `SETS[classe]` na posição da tecla.
3. Implementar o efeito em `useSkill()` usando `up` (evoluções) e `br` (variação).

### Novo item da loja
Entrada em `SHOP` com `name`, `desc`, `price()`, `can()`, `buy()`, `own()` e opcional `hide()`.

---

## 6. Save (localStorage)

- Chave do progresso: `ascensao-save-v1`. Chave da qualidade gráfica: `ascensao-q`.
- Campos salvos estão em `SAVEKEYS`. Campo novo → adicionar em `SAVEKEYS` **e** em `freshPlayer()`.
- Migrações ficam em `initPlayer()` (ex.: arrays de armas com 5 posições, pontos de habilidade retroativos).
- O save é por navegador e por endereço. Para vários aparelhos, ver seção 8 (exportar/importar ou Firebase).

---

## 7. Roadmap (etapas restantes)

- **Etapa 8 — Forja da arma própria**: chefes deixam materiais; arma única com nome escolhido; evolui; em níveis altos ganha formas (lâmina, lança, arco) trocáveis em combate, cada uma com habilidades de outra classe.
- **Etapa 9 — Equipamentos**: armaduras, anéis e colares com raridade e atributos aleatórios, conjuntos com bônus, inventário com comparação.
- **Etapa 10 — Recordes**: medalhas por tempo (bronze/prata/ouro), ranking dos melhores tempos, recompensas por bater o recorde.
- **Etapa 11 — Classe avançada**: missão secreta no nível 40, portal especial sem saída, evolução de cada classe.
- **Etapa 12 — Arena**: duelos contra inimigos-espelho de outras classes, ranking e recompensas semanais.
- **Etapa 13 — Portais especiais e acabamento**: portais vermelhos (sem saída até vencer), eventos com chefes únicos, música e sons por tema, brilho (bloom), mapa melhorado, ajustes no celular.
- **Alturas diferentes**: rampas, escadas, plataformas e pontes (mexe em movimento, colisão, IA e projéteis).

### Outros upgrades possíveis
- **Exportar/importar save** com um código copiável (sem servidor).
- **Firebase** (opcional): save na nuvem e ranking online. Só se quiser jogar em vários aparelhos ou competir.
- Mira vertical real para o Atirador e o Mago em mapas com alturas.
- Escorpiões, múmias e outros povos para o deserto; mais mundos abertos (pântano, cidade em ruínas, ilha vulcânica).
- Rosto do personagem no HUD reagindo ao dano; indicador de direção do dano.
- Mira assistida leve e vibração no celular.
- Editor de mapas simples.

---

## 8. Plano: personagens 3D bonitos (modelos `.glb`)

Hoje os inimigos são montados com formas primitivas. Fora do arquivo único, dá para usar modelos 3D animados de verdade.

### Fontes de modelos
- Pacotes gratuitos de monstros e personagens animados em `.glb`, como os de **Quaternius** e **KayKit**, normalmente em licença CC0. **Sempre conferir a licença** de cada pacote e registrar em `CREDITS.md`.
- **Mixamo** (Adobe) para animações de humanoides (andar, atacar, levar dano, morrer).
- Preferir um ou dois pacotes de **mesmo estilo** para o visual não ficar desencontrado.

### Estrutura de pastas
```
index.html
CLAUDE.md
CREDITS.md
models/
  goblin.glb
  esqueleto.glb
  aranha.glb
  ...
```

### Mudanças técnicas
1. ~~**Atualizar three.js**~~ (feito: 0.186.1) de r128 para uma versão atual com ES modules, usando `<script type="importmap">` apontando para o CDN, e importar `GLTFLoader` e `SkeletonUtils` dos exemplos.
   - Atenção às mudanças de API entre versões: `outputEncoding` virou `outputColorSpace`, `texture.encoding` virou `colorSpace`, iluminação física passou a ser padrão (rever intensidades das luzes).
2. **Mapa de modelos**: em cada entrada de `MOBS`, um campo opcional:
   ```js
   model:{file:'models/esqueleto.glb', scale:1, clips:{idle:'Idle', walk:'Walk', attack:'Attack', hit:'HitReact', death:'Death'}}
   ```
3. **Carregamento sob demanda**: ao entrar num portal, carregar só os modelos das famílias sorteadas, com tela de "carregando". Cache por arquivo; cada inimigo usa `SkeletonUtils.clone()`.
4. **Animação**: um `AnimationMixer` por inimigo; trocar de clipe por estado da IA (`chase` → walk, `windup`/`strike` → attack, `hurt` → hit, `kill` → death). Manter o tempo do golpe sincronizado com `windup`.
5. **Fallback obrigatório**: se o arquivo não existir ou falhar, usar `buildMob()` como hoje.
6. **Compatibilidade com o resto**: o objeto retornado precisa continuar com `root`, `g`, `bar`, `fg`, `pf`, `mats` (para piscar ao levar dano, elites, barras). Para o piscar, guardar os materiais da malha clonada.
7. **Elites e chefes**: mesmo modelo com escala maior e aura; chefes podem ter modelo próprio.
8. **Desempenho**: limitar inimigos animados na tela (30 no computador, ~15 no celular), pausar o mixer de inimigos fora da distância de visão, preferir modelos com poucos polígonos e texturas pequenas (até 1 MB por modelo).

### Situação atual
- **Feito**: three.js atualizado; carregador de modelos com cache (`MDL`, `loadModel`, `loadModelsFor`), `buildModelMob` (clone com `SkeletonUtils`, materiais próprios por inimigo, altura normalizada pela caixa do modelo), `mobAnim` (troca de clipe com transição), espera dos modelos em `enterFloor` (tela "Carregando...", limite de 20 s por arquivo) e fallback para `buildMob` primitivo. Testado com o robô CC0 dos exemplos do three.js.
- **Falta**: escolher e baixar os pacotes, colocar em `models/`, preencher o campo `model` em cada entrada de `MOBS` e registrar as licenças em `CREDITS.md`.

### Campo `model` em `MOBS`
```js
model:{file:'models/esqueleto.glb', clips:{idle:'Idle', walk:'Walk', run:'Run', attack:'Attack', hit:'HitReact', death:'Death'},
       h:1.1, scale:1, y:0, rot:0, hitAt:.5}
```
- `clips`: nomes exatos dos clipes no arquivo. Obrigatório ter `idle` ou `walk`; `run` (investida), `hit` e `death` são opcionais (sem `death`, o corpo tomba como antes).
- `h`: altura do modelo antes da escala `s` do inimigo (padrão por corpo em `MDL_H`). `scale`, `y` e `rot` (radianos) corrigem modelos desalinhados; a frente do modelo deve ser +Z.
- `hitAt`: fração do clipe de ataque em que o golpe acerta; o clipe é acelerado para esse ponto coincidir com o fim do `windup`.
- Desempenho: só animam inimigos visíveis; acima de `ANIM_CAP` (30 no computador, 15 no celular) metade anima em quadros alternados.

### Fluxo de trabalho com o Claude
O Claude não baixa os pacotes sozinho. O fluxo é: baixar os pacotes → enviar alguns `.glb` → o Claude lê os nomes das animações, liga cada modelo a um inimigo e devolve o `index.html` atualizado para subir junto com a pasta `models/`.

---

## 9. Regras de desempenho (aprendidas na prática)

- **No máximo 4 luzes pontuais** (lanterna + pool de 3 que segue os braseiros mais próximos). Nunca criar luz por braseiro, projétil ou efeito.
- **Não mudar a quantidade de luzes durante o jogo** (força recompilar shaders). Mudanças só ao trocar de andar.
- **Pré-compilar** materiais de efeitos ao montar o andar (`renderer.compile`) para evitar engasgos na primeira vez que um efeito aparece.
- **Instancing** para paredes, pilares, estalactites e obstáculos de áreas abertas.
- **Esconder** inimigos, braseiros e cristais além da distância de visão (`L.vd2`).
- **Interface**: atualizar HUD e minimapa no máximo 10×/s; painel de missão 2×/s; escrever estilo no DOM só quando o valor muda; não chamar `getBoundingClientRect` por quadro.
- **Sem alocações por quadro**: cores em cache (`col()`), arrays de direção reaproveitados (`DIRS`).
- **Passo de tempo**: `dt` nunca negativo (`Math.max(0, ...)`), limitado a 0,05 s; timers do jogador com `Math.max(0, ...)`.
- **Resolução dinâmica**: o loop reduz/aumenta a resolução conforme o tempo de quadro; qualidade Baixa/Média/Alta na janela de status.
- Linha de visão dos inimigos recalculada a cada ~0,15 s, não a cada quadro.

---

## 10. Testes

- **Sintaxe**: extrair o último `<script>` e rodar `node --check`.
- **Sintaxe do módulo**: o script é `type="module"`; extrair o conteúdo para um `.mjs` antes do `node --check`.
- **Headless**: Playwright + Chromium com `--use-gl=swiftshader --enable-webgl --ignore-gpu-blocklist`, servindo a cópia de teste por http e trocando as URLs do importmap por uma cópia local (`npm i three@0.186.1`; caminhos com `./`, senão o importmap os ignora). Não rodar dois navegadores swiftshader ao mesmo tempo (fica lento demais).
- Usar `window.__dbg()` (em cópia de teste é possível expor mais funções) para teletransportar o jogador, forçar portais, causar dano e checar estado.
- A renderização por software é muito lenta (1–3 quadros por segundo): usar viewport pequeno e esperas longas; medir lógica, não fluidez.
- Checklist por etapa: sem erros no console, fluxo cidade → portal → andares → chefe → saída, save/continuar, celular (controles de toque).

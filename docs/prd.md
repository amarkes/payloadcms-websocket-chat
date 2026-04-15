# PRD — Rede Social (Social Layer)

**Projeto:** payloadcms-with-websocket  
**Data:** 2026-04-15  
**Status:** Draft  
**Stack base:** PayloadCMS 3.x · Next.js 16 · PostgreSQL · WebSocket (ws)

---

## 1. Visão Geral

Adicionar uma camada de rede social ao projeto existente, preservando o módulo de chat já implementado. Os usuários poderão publicar conteúdo (posts, stories e reels), interagir com curtidas/dislikes e comentários, seguir outros perfis e gerenciar suas próprias páginas públicas.

A filosofia de implementação é **PayloadCMS-first**: todas as entidades de dados são coleções do Payload, o controle de acesso vive nas collections, e o frontend consome os endpoints REST/GraphQL gerados automaticamente, complementados por custom endpoints para operações atômicas (like/dislike, follow/unfollow).

---

## 2. Objetivos

| # | Objetivo | Métrica de sucesso |
|---|----------|--------------------|
| 1 | Usuário consegue montar e visualizar um perfil público | Perfil acessível via `/u/[username]` |
| 2 | Publicação de posts com imagem/vídeo/texto | Post aparece no feed em < 2 s após publicar |
| 3 | Stories efêmeros (24 h) | Story some automaticamente após expiração |
| 4 | Reels (vídeos curtos) com player inline | Playback sem redirecionamento de página |
| 5 | Like / Dislike em posts, reels e comentários | Contadores atualizados em tempo real via WebSocket |
| 6 | Comentários aninhados (1 nível de resposta) | Thread de comentários carrega em < 500 ms |
| 7 | Sistema de seguidores (follow/unfollow) | Feed personalizado com base em follows |

---

## 3. Personas

- **Criador de conteúdo** — publica stories, reels e posts; acompanha métricas de engajamento, navega no feed, reage e comenta.  
- **Consumidor** — publica stories, reels e posts; acompanha métricas de engajamento, navega no feed, reage e comenta.  
- **Moderador (admin)** — acessa o painel Payload para remover conteúdo impróprio.

---

## 4. Fora de Escopo (v1)

- Monetização / paywalls  
- Anúncios  
- Lives / streaming  
- Notificações por e-mail  
- DMs pela rede social (já existe o módulo de chat — não duplicar)

---

## 5. Arquitetura de Dados

### 5.1 Alterações em coleções existentes

#### `Users` — campos adicionais

```ts
{ name: 'username',    type: 'text', unique: true, required: true }
{ name: 'bio',         type: 'textarea' }
{ name: 'website',     type: 'text' }
{ name: 'isPrivate',   type: 'checkbox', defaultValue: false }
{ name: 'followersCount', type: 'number', defaultValue: 0, access: { create: () => false, update: () => false } }
{ name: 'followingCount', type: 'number', defaultValue: 0, access: { create: () => false, update: () => false } }
{ name: 'postsCount',     type: 'number', defaultValue: 0, access: { create: () => false, update: () => false } }
```

> Contadores são desnormalizados e atualizados via hooks para evitar COUNT(*) em leitura.

---

### 5.2 Novas coleções

#### `Follows`

Representa o vínculo de seguir entre dois usuários.

| Campo | Tipo | Notas |
|-------|------|-------|
| `follower` | relationship → users | quem segue |
| `following` | relationship → users | quem é seguido |
| `status` | select: `pending` / `accepted` | `pending` quando o perfil é privado |

- **Index único:** `(follower, following)`
- **Hooks:** `afterChange` incrementa/decrementa `followersCount` e `followingCount` nos Users envolvidos.

---

#### `Posts`

Conteúdo principal do feed (imagem, carrossel ou só texto).

| Campo | Tipo | Notas |
|-------|------|-------|
| `author` | relationship → users | required, index |
| `caption` | textarea | |
| `media` | array → upload (Media) | 0–10 itens; suporta imagem e vídeo |
| `tags` | array → text | hashtags extraídas do caption via hook |
| `likesCount` | number | desnormalizado |
| `dislikesCount` | number | desnormalizado |
| `commentsCount` | number | desnormalizado |
| `visibility` | select: `public` / `followers` / `private` | |
| `isArchived` | checkbox | |

**Acesso:**
- `create`: usuário autenticado  
- `read`: público se `visibility = public`; filtrado por follow se `followers`; somente autor se `private`  
- `update`: somente autor  
- `delete`: somente autor  

---

#### `Stories`

Conteúdo efêmero expira em 24 h.

| Campo | Tipo | Notas |
|-------|------|-------|
| `author` | relationship → users | required, index |
| `media` | upload (Media) | required; imagem ou vídeo curto |
| `caption` | text | opcional, sobreposto à mídia |
| `expiresAt` | date | definido via hook `beforeCreate` como `now + 24h` |
| `viewedBy` | relationship → users (hasMany) | rastrea visualizações únicas |
| `viewsCount` | number | desnormalizado |

**Filtro de leitura:** endpoint customizado `/api/stories/active` retorna apenas stories onde `expiresAt > now`. Um cron job (ou Payload scheduled task) remove os expirados periodicamente.

---

#### `Reels`

Vídeos curtos (máx. 90 s).

| Campo | Tipo | Notas |
|-------|------|-------|
| `author` | relationship → users | required, index |
| `video` | upload (Media) | required; `mimeType` validado para `video/*` |
| `thumbnail` | upload (Media) | gerado via sharp / ffmpeg no `afterCreate` hook |
| `caption` | textarea | |
| `duration` | number | segundos; preenchido via hook |
| `likesCount` | number | desnormalizado |
| `dislikesCount` | number | desnormalizado |
| `commentsCount` | number | desnormalizado |
| `visibility` | select: `public` / `followers` / `private` | |

---

#### `Reactions`

Like ou dislike unificado para qualquer entidade reativa.

| Campo | Tipo | Notas |
|-------|------|-------|
| `user` | relationship → users | required, index |
| `type` | select: `like` / `dislike` | required |
| `targetType` | select: `post` / `reel` / `comment` | required |
| `targetId` | text | ID da entidade alvo; index composto com `targetType` |

- **Index único:** `(user, targetType, targetId)` — garante 1 reação por usuário por item.
- **Hooks:** `afterChange` / `afterDelete` atualizam `likesCount` / `dislikesCount` na entidade alvo.
- **WebSocket:** ao registrar/remover uma reação, o servidor emite `reaction:update` para todos os clientes na "sala" do post/reel correspondente.

---

#### `Comments`

| Campo | Tipo | Notas |
|-------|------|-------|
| `author` | relationship → users | required, index |
| `targetType` | select: `post` / `reel` | required |
| `targetId` | text | index composto com `targetType` |
| `parent` | relationship → comments | null = comentário raiz; não-null = resposta |
| `content` | textarea | required |
| `likesCount` | number | desnormalizado |
| `dislikesCount` | number | desnormalizado |
| `isDeleted` | checkbox | soft delete para preservar threads filhas |

**Acesso:**
- `create`: autenticado  
- `read`: público (segue visibilidade da entidade pai)  
- `update`: somente autor (apenas `content`)  
- `delete`: somente autor (seta `isDeleted = true`)  

---

### 5.3 Diagrama de relacionamentos (simplificado)

```
Users ─────┬──── Follows ─────── Users
           ├──── Posts ──────────┬── Reactions
           ├──── Stories         └── Comments ── Reactions
           └──── Reels ──────────┬── Reactions
                                 └── Comments ── Reactions
```

---

## 6. Custom Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/social/follow/:userId` | Follow / unfollow toggle |
| `GET` | `/api/social/feed` | Feed paginado (posts + reels de quem o usuário segue) |
| `GET` | `/api/social/feed/explore` | Feed público de descoberta |
| `POST` | `/api/social/react` | `{ targetType, targetId, type }` — like/dislike toggle |
| `GET` | `/api/stories/active` | Stories não-expirados dos usuários seguidos |
| `POST` | `/api/stories/:id/view` | Registra visualização de story |

---

## 7. Tempo Real (WebSocket)

O handler WebSocket existente (`src/websocket/handler.ts`) é estendido com novos eventos:

| Evento (emitido pelo servidor) | Payload | Gatilho |
|-------------------------------|---------|---------|
| `reaction:update` | `{ targetType, targetId, likesCount, dislikesCount }` | Hook `afterChange` em Reactions |
| `comment:new` | `{ comment, targetType, targetId }` | Hook `afterCreate` em Comments |
| `story:new` | `{ storyId, authorId }` | Hook `afterCreate` em Stories |
| `follow:request` | `{ followerId }` | Para perfis privados |

---

## 8. Páginas e Rotas Frontend

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/u/[username]` | `ProfilePage` | Perfil público; tabs Posts / Reels / Stories |
| `/feed` | `FeedPage` | Feed personalizado com scroll infinito |
| `/explore` | `ExplorePage` | Descoberta; trending e busca por hashtag |
| `/reels` | `ReelsPage` | Player vertical estilo TikTok/Reels |
| `/u/[username]/followers` | `FollowersPage` | Lista de seguidores |
| `/u/[username]/following` | `FollowingPage` | Lista de seguidos |
| `/settings/profile` | `EditProfilePage` | Editar perfil (username, bio, avatar, website) |

---

## 9. Componentes UI Principais

- `PostCard` — mídia + caption + ações (like, dislike, comment, share)  
- `ReelPlayer` — player de vídeo com controles inline e overlay de reações  
- `StoryRing` — avatar com anel colorido indicando story não-visto  
- `StoryViewer` — modal fullscreen com barra de progresso por story  
- `CommentThread` — lista de comentários com campo de resposta inline  
- `FollowButton` — toggle com estado pending/accepted para perfis privados  
- `FeedScroller` — scroll infinito com IntersectionObserver  

---

## 10. Plano de Implementação

### Fase 1 — Fundação de Dados (sprint 1)
- [ ] Adicionar campos `username`, `bio`, `website`, `isPrivate`, contadores em `Users`
- [ ] Criar collections: `Follows`, `Posts`, `Reactions`, `Comments`
- [ ] Hooks de contadores em `Follows` e `Reactions`
- [ ] Endpoint `/api/social/follow/:userId`
- [ ] Endpoint `/api/social/react`

### Fase 2 — Perfil e Feed (sprint 2)
- [ ] Página `/u/[username]`
- [ ] Página `/settings/profile`
- [ ] Endpoint `/api/social/feed`
- [ ] Componentes `PostCard`, `FollowButton`, `FeedScroller`
- [ ] Página `/feed`

### Fase 3 — Stories (sprint 3)
- [ ] Collection `Stories` com expiração automática
- [ ] Endpoint `/api/stories/active` e `/api/stories/:id/view`
- [ ] Componentes `StoryRing`, `StoryViewer`
- [ ] Cron job de limpeza de stories expirados

### Fase 4 — Reels (sprint 4)
- [ ] Collection `Reels` com validação de mimetype
- [ ] Geração de thumbnail via hook
- [ ] Componente `ReelPlayer`
- [ ] Página `/reels`

### Fase 5 — Tempo Real e Polimento (sprint 5)
- [ ] Estender WebSocket handler com eventos `reaction:update`, `comment:new`, `story:new`
- [ ] Página `/explore` com busca por hashtag
- [ ] Testes de integração (vitest) para todos os endpoints
- [ ] Testes E2E (Playwright) para fluxos críticos: criar post, seguir usuário, curtir

---

## 11. Considerações Técnicas

### Performance
- Contadores desnormalizados (`likesCount`, `followersCount`, etc.) evitam JOINs custosos em leitura.
- Feed paginado com cursor (campo `createdAt`) em vez de offset para consistência.
- Índices compostos obrigatórios em `(targetType, targetId)` na collection `Reactions` e `Comments`.

### Controle de Acesso
- Toda lógica de visibilidade fica nas `access` functions das collections — nunca filtrar no frontend.
- Perfis privados: `Follows` com `status: pending`; a `read` access de `Posts`/`Reels` verifica o status do follow.

### Armazenamento de Mídia
- Vídeos de Reels e Stories são tratados pelo handler de upload do Payload (collection `Media` existente).
- Validação de `mimeType` e duração máxima (`duration <= 90`) via `beforeValidate` hooks.

### Migrations
- Cada sprint gera uma migration Payload (`payload migrate:create`) antes do merge.
- Campos novos em `Users` são adicionados como `nullable` primeiro, depois populados, depois com constraint.

---

## 12. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:---:|:---:|-----------|
| Counters desincronizados em alta concorrência | Média | Alto | Usar `UPDATE ... SET count = count + 1` atômico via raw query no hook, não `findByID` + `update` |
| Stories não expirados poluindo o feed | Baixa | Médio | Dupla defesa: filtro em `expiresAt` no endpoint + cron de limpeza |
| Upload de vídeos grandes travando o servidor | Média | Alto | Streaming multipart; limite de tamanho configurável no Next.js (`next.config.ts`) |
| Username único causando race condition no registro | Baixa | Médio | Index `UNIQUE` no PostgreSQL + tratamento de erro 409 no endpoint de registro |

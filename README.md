# vêTurb — SaaS de VSLs e Players Inteligentes

Aplicação construída a partir da descrição do produto e da sequência de telas enviadas (painel, builder de player, leads e métricas). O modo local é apenas para desenvolvimento. Com Supabase configurado, a conta usa Auth/MFA, estado privado por usuário, configuração pública de players publicados e Edge Functions para registrar eventos e leads. Vídeos Gumlet MP4/HLS e miniatura personalizada são suportados.


---

## ▶️ Como executar no Windows

**Não abra `index.html` com duplo clique:** o projeto precisa do servidor Vite, senão pode aparecer uma tela em branco. Instale Node.js LTS (https://nodejs.org/), extraia o ZIP e dê duplo clique em `ABRIR-VETURB.bat`. Na primeira execução, o script instala as dependências e abre `http://localhost:5173` no navegador. Para encerrar, volte à janela preta e pressione Ctrl+C.

Alternativamente, no PowerShell, dentro da pasta do projeto:

```powershell
npm install
npm run dev
```

Depois acesse `http://localhost:5173`.

## ▶️ Como executar no Linux/macOS

```bash
cd /caminho/para/veturb
npm install
npm run dev          # http://localhost:5173
```

Build de produção:

```bash
npm run build        # gera dist/
npm run preview      # serve dist/ em 0.0.0.0:4173
```

Requisitos: Node.js 20.19+ (testado em 20.20.2). Sem configurar variáveis, o app abre em modo demonstração local. Para persistência entre dispositivos, configure o Supabase seguindo a seção abaixo.

**Acesso demo (sem Supabase):** qualquer e-mail + senha com 4+ caracteres, por exemplo `joao@veturb.com.br` / `1234`.
**Com Supabase configurado:** login e criação de conta usam Supabase Auth.
Com Supabase configurado, o TOTP/MFA usa o autenticador do usuário e é verificado pelo Supabase Auth. Sem Supabase, o modo de demonstração local não equivale a autenticação de produção.

---

## 🐙 Publicar o projeto no GitHub (Windows)

Passo a passo para enviar a versão atual do projeto da pasta `F:\\veturb-projeto` ao repositório `https://github.com/amigosdasaudent-a11y/F-veturb.git`.

1. Baixe o arquivo `veturb-projeto.zip` fornecido nesta conversa. Faça uma cópia de segurança da pasta local e extraia o ZIP em uma pasta temporária.
2. Abra a pasta `veturb` que foi extraída e copie **o conteúdo dela** para `F:\\veturb-projeto`, substituindo os arquivos antigos. O pacote não inclui `node_modules`, `dist` nem `.env.local`.
3. Abra o PowerShell e entre na pasta:

```powershell
cd F:\\veturb-projeto
git --version
```

Se `git` não for reconhecido, instale o Git for Windows e abra um novo PowerShell. Configure sua identidade, se ainda não estiver configurada:

```powershell
git config --global user.name "Seu nome"
git config --global user.email "seu-email-do-github"
```

4. Inicialize o repositório e configure a branch principal e o endereço remoto:

```powershell
if (-not (Test-Path .git)) { git init }
git branch -M main
$remote = git remote
if ($remote -contains "origin") {
  git remote set-url origin https://github.com/amigosdasaudent-a11y/F-veturb.git
} else {
  git remote add origin https://github.com/amigosdasaudent-a11y/F-veturb.git
}
```

5. Confira se arquivos locais de ambiente não serão enviados. `.env.local` deve ser ignorado pelo `.gitignore`:

```powershell
git check-ignore .env.local
git status --short
```

**Não envie senhas, tokens ou chaves `service_role` ao GitHub.**

6. Adicione os arquivos, crie o commit e envie para o GitHub:

```powershell
git add .
git commit -m "Publica versão atualizada do vêTurb"
git push -u origin main
```

Se o GitHub pedir autenticação, use a janela de login no navegador/Git Credential Manager. Não cole sua senha ou token em chats. Depois, confira os arquivos em [github.com/amigosdasaudent-a11y/F-veturb](https://github.com/amigosdasaudent-a11y/F-veturb).

---

## 🗄️ Configurar banco Supabase

O Supabase conectado nesta sessão é **Lead turb pro** (região `sa-east-1`). As migrações `001_veturb_state.sql` a `005_allowlist_platform_admin_email.sql` foram aplicadas. As Edge Functions `track-player`, `capture-lead` e `save-mercadopago-credentials` foram implantadas. A tela de cobrança aceita Public Key e Access Token; o token fica no Supabase Vault. O e-mail administrativo fornecido pelo proprietário está allowlisted, mas ainda precisa ser cadastrado e confirmado no Supabase Auth deste projeto.

Para reproduzir em outro ambiente/projeto:
1. Execute, em ordem, as migrações `001` a `005` em `supabase/migrations/`.
2. Implante as Edge Functions em `supabase/functions/`, incluindo `save-mercadopago-credentials`.
3. Confirme a conta cujo e-mail está em `veturb_platform_admin_allowlist`; antes da confirmação, o formulário administrativo permanece bloqueado.
4. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com **Project URL** e **anon/public key**.
5. Configure Site URL e Redirect URLs no Auth e reinicie o Vite. Crie uma conta com seu próprio e-mail e senha.

A chave `anon/public` fica no navegador e depende das políticas RLS. **Nunca exponha nem coloque a `service_role key` no front-end, GitHub ou chat.** O estado de conta fica isolado por usuário; players públicos, eventos e leads estão em tabelas separadas com RLS e Edge Functions. Cobrança recorrente e colaboração entre diferentes contas ainda não estão configuradas.

---

## 🧭 Rotas

| Rota | Tela |
| --- | --- |
| `#/dashboard` | KPIs, gráfico de views/plays, retenção, conversões e atividade recente |
| `#/players` | Lista de players, busca, filtro, duplicar, ativar/desativar, excluir, incorporar |
| `#/players/new` | Builder de criação (13 seções + preview em tempo real) |
| `#/players/:id/edit` | Edição do player + códigos de incorporação |
| `#/leads` | Leads capturados, busca, filtro por player e exportação CSV |
| `#/metrics` | Curva de retenção, funil de conversão, performance por player, log de eventos |
| `#/plans` | Status da assinatura; checkout recorrente ainda não configurado |
| `#/profile` | Perfil, atualização de senha e configuração TOTP/MFA no Supabase Auth |
| `#/p/:id` | Player público (rota de embed ultra rápida, com console de eventos) |
| `#/embed/:id` | Player minimalista sem chrome, pronto para iframe |

O roteamento é por hash, então funciona em **Vercel, Netlify, Cloudflare Pages, hospedagem compartilhada, VPS e serverless** sem regras de rewrite.

---

## 🎛️ Builder — as 13 seções das capturas

A coluna esquerda replica a estrutura das imagens, em acordeão (uma seção aberta por vez). A seção aberta **liga o recurso correspondente no preview**, exatamente como na sequência de telas enviada.

1. **Configurações** — nome e formato 16:9 ou 9:16; origem YouTube, MP4/arquivo ou Gumlet. Para Gumlet, há campos distintos para link de compartilhamento, MP4, HLS (.m3u8) e miniatura. HLS toca com hls.js; YouTube tenta miniatura automática e aceita URL de miniatura manual como alternativa.
2. **Aparência** — cor da linha de destaque, botões controladores, fundo e texto.
3. **Controles** — menu de qualidade, voltar/avançar 5s, tela cheia, timecode, barra de progresso.
4. **Progresso Simulado** — fake progress com velocidade e grossura da barra.
5. **Play & Pausa** — botão play SVG/imagem, cor, escala, modal de pausa, overlay customizado.
6. **Botão de Ação (CTA)** — botão ou imagem, texto, 13 ícones, cores, URL, tempo de aparição, posição, tamanho, arredondamento e 10 animações.
7. **Cronômetro Regressivo** — duração, aparece após, texto de urgência, 6 posições, presets de tema, cores e ação ao expirar.
8. **Simulação ao Vivo** — selo LIVE, min/max espectadores, visitantes reais, posição, cores e bolinha pulsante.
9. **Anúncios em Vídeo** — múltiplos anúncios com segundo de entrada, "pular após" e duração.
10. **Intenção de Saída** — título, texto, botão, URL, exibir apenas uma vez e cores do popup.
11. **Captura de Leads** — gatilho em segundos, título, subtítulo, cores e texto do botão.
12. **Rastreamento** — Facebook Pixel ID, GTM ID e toggles dos eventos automáticos.
13. **Domínios Permitidos** — whitelist de domínios e bloqueio de Inspect Element/DevTools.


A coluna central traz o preview responsivo com alternância **Vídeo Horizontal / Vídeo Vertical (Shorts)**; a direita mostra o estado bloqueado antes de salvar e, depois, libera o **código iframe responsivo** e o **link direto** com botões de copiar.

**Gumlet:** envie o arquivo na biblioteca do Gumlet; em **Share video → URLs**, copie a URL MP4 (recomendada) ou HLS `.m3u8` e a URL da miniatura para os campos correspondentes no vêTurb. O campo Share URL é guardado como referência; ele não substitui o URL direto de reprodução. O HLS é reproduzido via hls.js em navegadores sem suporte HLS nativo.


---

## 🎥 Player público

- Usa a **YouTube IFrame Player API** quando a URL é do YouTube e `<video>` HTML5 para MP4/Gumlet HLS. Um player público sem fonte ou com mídia inacessível mostra um erro real — não inventa progresso nem espectadores.
- Gate "SEU VÍDEO JÁ COMEÇOU / Clique para ouvir" com desbloqueio de áudio.
- Controles customizados, quality menu, seek ±5s, fullscreen, timecode e fake progress.
- **CTA cronometrado**, selos de escassez/LIVE com contador de espectadores, anúncios overlay, modal de retomada inteligente (salva progresso), modal de pausa, exit intent e formulário de captura de leads.
- Whitelist de domínios e bloqueio de DevTools funcionam de verdade na rota pública.
- Console de eventos em tempo real em `#/p/:id`.


Para capturar leads reais, crie um player, configure uma fonte de vídeo, habilite a captura, informe a política de privacidade, salve e publique. O visitante precisa consentir; depois o lead aparecerá na tela **Leads** da conta proprietária. Não existe lead pré-carregado.

---

## 📊 Rastreamento e métricas

Ao interagir com o player público, os eventos são gravados e também enviados para as integrações nativas quando os IDs estão configurados:

| Evento interno | Facebook Pixel | GTM / dataLayer |
| --- | --- | --- |
| `view` | `PageView` | `page_view` |
| `play` | `PlayerPlay` | `player_play` |
| `progress` (25/50/75/95%) | `PlayerProgress` | `player_progress` |
| `cta` | `PlayerCtaClick` | `player_cta_click` |
| `conversion` (lead) | `PlayerLead` | `player_lead` |

`window.fbq` e `window.dataLayer` são chamados quando presentes. Em uma conta Supabase, eventos e leads ficam em tabelas separadas com acesso do dono via RLS; leads são persistidos pela Edge Function `capture-lead`, sem depender da sessão do visitante.

---

## 🔐 Segurança, pagamentos e limites atuais

- **2FA**: TOTP via Supabase Auth, com QR/chave secreta, confirmação e desafio no login. Códigos de recuperação não são oferecidos nesta versão.
- **Players públicos**: apenas players publicados ficam disponíveis anonimamente; domínio e publicação são verificados no Supabase.
- **Leads/eventos**: Edge Functions usam segredo de servidor fora do navegador, aplicam validação e limite por IP/player. Leads exigem consentimento.
- **Assinaturas**: não existe checkout ou ativação de plano ainda. Não mostramos preço nem simulamos pagamento. Precisamos definir produto, valores, periodicidade e provedor.
- **Workspaces**: organização dentro da conta atual; compartilhamento entre usuários diferentes não está implementado.

---

## ✅ Estado verificado

| Item | Estado |
| --- | --- |
| Login e persistência privada | Supabase Auth + tabela JSON por conta, com RLS |
| MFA | TOTP real pelo Supabase Auth |
| Player público e embed Gumlet | Validado no navegador com HLS Gumlet; configuração publicada servida pelo Supabase |
| Eventos/Leads | Edge Functions no Supabase; tabelas próprias e políticas RLS |
| CSV de métricas/leads | Exportação local funcional |
| Mercado Pago / assinatura recorrente | Não configurado; nenhuma cobrança é efetuada |
| Armazenamento de mídia | O vídeo continua hospedado no Gumlet; usar os links do painel, sem upload direto pelo vêTurb |
| Upload de imagem | URL local temporária; armazenamento permanente ainda requer Storage/back-end |
| Compartilhamento multiusuário/workspace | Não implementado |

A implementação usa **React 19 + Vite 6 + CSS puro**, hash routing e integração com Supabase (`src/lib/supabase.js`). Os arquivos PNG em `docs/screenshots/` são referências visuais/capturas de QA; não representam leads, preços ou métricas atuais.

### Variáveis de ambiente

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_publica
VITE_EMBED_BASE_URL=https://seu-dominio.com.br
```

As duas primeiras conectam autenticação e sincronização privada do painel. A última define a base dos links de iframe/player; se omitida, usa a origem atual. No Vercel, configure essas variáveis nas opções do projeto e substitua `VITE_EMBED_BASE_URL` pelo domínio publicado. A chave `service_role` não deve ser usada no front-end.

---

## 📁 Estrutura

```
veturb/
├── index.html
├── package.json
├── vite.config.js          # host 0.0.0.0, allowedHosts para preview
├── README.md
├── supabase/
│   ├── migrations/          # RLS, estado, players públicos, eventos e leads
│   └── functions/           # Edge Functions de eventos e captura de leads
├── docs/screenshots/        # referências visuais e capturas de QA
└── src/
    ├── main.jsx
    ├── App.jsx              # shell, sidebar, roteamento hash, auth, notificações
    ├── styles.css           # design system completo
    ├── lib/
    │   ├── db.js            # estado inicial vazio, limpeza de fixtures legadas, eventos e agregações
    │   ├── ctx.jsx          # context da aplicação
    │   └── icons.jsx        # ícones SVG inline
    ├── components/
    │   ├── ui.jsx           # botões, campos, toggles, modais, gráficos
    │   └── PlayerEngine.jsx # motor do player (builder + público)
    └── pages/
        ├── Auth.jsx  Dashboard.jsx  Players.jsx  Builder.jsx
        ├── Leads.jsx  Metrics.jsx  Plans.jsx  Profile.jsx
        └── PublicPlayer.jsx
```

---

## ✅ Validação desta versão

- `npm run build` — concluído sem erros após as últimas alterações.
- Gumlet HLS testado no Chromium por 15 segundos; `readyState=4`, sem erros de console/requisição, duração reportada de aproximadamente 638 segundos. Captura: `docs/screenshots/36-gumlet-playback-test.png`.
- Edge Functions `track-player` e `capture-lead` responderam e retornaram 404 esperado ao receberem IDs de player inexistentes; sem dados de conta de teste foram criados.
- Banco Supabase consultado: `veturb_state`, `veturb_public_players`, `veturb_events` e `veturb_leads` estavam vazios no momento da consulta.
- Fluxo de cobrança não foi testado nem está ativo.

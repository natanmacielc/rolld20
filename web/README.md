# web

Site estático e verificador em JavaScript, que busca o round direto no drand. Testes: `node --test "web/**/*.test.mjs"` (o Node 22 não aceita diretório como argumento).

| arquivo | papel |
|---|---|
| `index.html`, `app.js` | tela de rolagem: escolha do dado, rolagem animada (botão ou clique no dado), folha "Você", mesa, "Suas mesas" (folha própria, 6 por página, cache de 10 min no localStorage), histórico |
| `identity.js` | chave Ed25519 do aparelho (não exportável, no IndexedDB), identidade e vínculos, apelido, assinatura do pedido e da lista de mesas |
| `pairing.js` | pareamento de aparelhos (link `/#parear=…`, HMAC com o segredo do fragmento), lógica pura testada no Node |
| `confianca.html`, `confianca.js` | "Por que confiar?": explicação e conferência de qualquer rolagem, com o passo a passo da conta |
| `roll.js` | página `/r/{rollId}` (o HTML vem do template Qute em `rolld20-app`) |
| `dice3d/` | motor 3D dos dados em Canvas 2D: poliedros (`geometry.js`), quatérnios e curvas (`math.js`), poses e queda (`pose.js`), luz e material de gema (`shade.js`), desenho (`renderer.js`), bandeja com as animações (`tray.js`) e ícone SVG estático (`icon.js`). Esperando o drand, as faces têm runas; os números só existem depois do resultado |
| `ui.js` | reexporta a bandeja e o ícone do motor; aro do tablado, diálogos (folha que sobe e fecha arrastando no celular), avisos e checklist (sem regra de negócio, sem innerHTML) |
| `shell.js` | comum às páginas: cabeçalho que vira vidro ao rolar, aviso sem conexão e cards que inclinam com o ponteiro |
| `lost.js` | página de rolagem não encontrada (d20 girando só com runas) |
| `api.js` | chamadas à API (sob `/api`, POST com `x-amz-content-sha256`) e verificação no navegador (o drand-client só carrega quando precisa) |
| `page-logic.js` | lógica pura, testada no Node |
| `verifier/` | verificadores do dice-v1, da chain-v1 e da chain-v2 (fonte da verdade no navegador) |
| `fonts/`, `vendor/` | fontes (Cinzel e Bricolage Grotesque) e drand-client vendorizados, com origem e SHA-256 |
| `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | ícone d20. O SVG é feito à mão; os outros saem de `java tools/icons/GenerateIcons.java web` (mesmo desenho; mudou um, mude o outro) |
| `manifest.json` | app na tela inicial (standalone, cores do tema, ícones) |
| `sigil.svg`, `stars.svg` | fundo: sigilo e ladrilho de estrelas (decoração) |
| `static/` | imagens Open Graph das páginas estáticas e do roll pendente |

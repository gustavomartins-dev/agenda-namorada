# Agenda da Nicolly 💜

Agenda pessoal e privada criada com carinho para a Nicolly. O aplicativo usa uma
identidade visual punk-kawaii inspirada na Kuromi e foi pensado primeiro para
Android/Xiaomi. A agenda continua offline; o assistente inteligente é opcional e
usa um pequeno servidor local no computador.

> [!IMPORTANT]
> **Projeto desenvolvido com IA:** a ideia, a finalidade e as decisões de produto
> são de Gustavo Martins. A implementação, a interface, os testes, a documentação
> e a preparação Android contaram com assistência substancial do
> **OpenAI Codex**. Consulte [Transparência sobre IA](./AI_DISCLOSURE.md).

## O que já funciona

- tela Hoje com faixa semanal e próximo compromisso;
- calendário mensal, semanal e diário;
- criação, edição, conclusão e exclusão de compromissos;
- categorias, horário, duração e notas;
- persistência local no aparelho com AsyncStorage;
- recadinho personalizável do Gustavo;
- preferência de redução dos efeitos visuais;
- layout responsivo, áreas seguras e rótulos de acessibilidade;
- chat por texto com histórico local e estado offline;
- propostas de criação, alteração e exclusão que sempre exigem confirmação;
- lembretes locais persistentes, com reagendamento e cancelamento;
- gravação de áudio com duração, prévia, cancelamento e envio;
- backend privado separado, sessão Hermes persistente e validação de ações.

## Arquitetura

```text
App Expo ── texto/transcrição ──> server:8787 ── texto ──> Hermes:8642
    │                                │
    ├─ AsyncStorage                  ├─ chave privada
    ├─ confirmação humana            ├─ sessão persistente
    └─ notificações locais           └─ validação Zod + sem ferramentas
```

O Hermes nunca é acessado diretamente pelo APK. O servidor apenas interpreta e
propõe; o aplicativo é a fonte de verdade e só altera a agenda depois do toque
em **Confirmar**.

## Rodar o projeto

```bash
npm install
npm run start
```

Para usar o assistente, isole as ferramentas da plataforma API do Hermes e
prepare o backend seguindo
[server/README.md](./server/README.md). Em outro terminal:

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Para verificar a primeira entrega:

```bash
npm run typecheck
npm test
npm run doctor
npm run export:android
```

No `server/` também execute `npm run typecheck`, `npm test` e `npm run build`.

## Limitação atual do áudio

`expo-audio` e o upload temporário estão prontos. O computador inspecionado não
tem Whisper, ffprobe nem ffmpeg instalados, então a transcrição inicia desabilitada e
explica isso na interface. Veja o procedimento substituível no README do servidor.

O assistente local chega ao Xiaomi por USB com `adb reverse`. Na web ele exige o
backend no mesmo computador; em iPhone físico, nesta etapa, somente a agenda
offline funciona. Nenhuma porta foi aberta na LAN e nenhum túnel foi criado.

## Uso pessoal e marcas

Este é um projeto pessoal e sem fins comerciais. Kuromi é uma personagem da
Sanrio; este aplicativo não é oficial, licenciado, patrocinado ou afiliado à
Sanrio.

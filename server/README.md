# Servidor privado da Agenda Kuromi

Este servidor é a única camada que conversa com o Hermes. O aplicativo nunca
recebe `API_SERVER_KEY`, nunca acessa a porta 8642 e nunca envia áudio ao Hermes.

## 1. Isolar a superfície da API Hermes

O API server padrão do Hermes habilita terminal e arquivos. A mudança mínima
abaixo afeta apenas a plataforma `api_server`; as ferramentas do Hermes no
terminal continuam como estavam:

```bash
hermes config set platform_toolsets.api_server '["no_mcp"]'
hermes config get platform_toolsets.api_server --json
hermes config env-path
```

O segundo comando precisa mostrar somente `["no_mcp"]`. O Hermes 0.20.4 não
inclui MCPs globais herdados na resposta de `GET /v1/toolsets`, embora eles
possam entrar no agente real. Por isso o backend combina duas barreiras:

1. recusa iniciar até você declarar `HERMES_NO_MCP_CONFIRMED=true` no
   `server/.env`, depois de conferir o comando acima;
2. antes de cada conversa, recusa continuar se `GET /v1/toolsets` revelar
   qualquer toolset visível habilitado.

Essa confirmação explícita cobre uma limitação de observabilidade da API; não é
uma prova criptográfica da configuração. Não use apenas uma lista vazia: o
sentinela `no_mcp` é o que impede a herança dos MCPs globais.

Abra o caminho mostrado pelo último comando e configure:

```dotenv
API_SERVER_ENABLED=true
API_SERVER_HOST=127.0.0.1
API_SERVER_PORT=8642
API_SERVER_KEY=gere-uma-chave-longa-e-exclusiva
```

Inicie em primeiro plano para ver erros com clareza:

```bash
hermes gateway run
```

Se você já mantém o gateway como serviço, use `hermes gateway restart` no lugar
do comando acima.

Confirme que nenhuma ferramenta está habilitada. O endpoint exige a mesma chave:

```bash
curl -H "Authorization: Bearer SUA_CHAVE" http://127.0.0.1:8642/v1/toolsets
```

Não use `0.0.0.0` e não exponha 8642 na rede.

Como endurecimento futuro, é possível criar um perfil `agenda-kuromi` dedicado,
reautenticar somente o provedor necessário nele e aplicar a mesma lista
`platform_toolsets.api_server`. Isso separa memória e sessões, mas não é exigido
para testar a primeira versão e não foi aplicado automaticamente ao seu Hermes.

## 2. Servidor da agenda

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Edite `server/.env`, copie para `HERMES_API_SERVER_KEY` a chave privada do
perfil acima e, somente depois de verificar `["no_mcp"]`, altere
`HERMES_NO_MCP_CONFIRMED` para `true`. O arquivo `.env` e o estado de sessão em
`server/var/` são ignorados pelo Git. O backend fica em `127.0.0.1:8787`.

Rotas públicas apenas no loopback:

- `GET /api/v1/health` — vida do pequeno servidor;
- `POST /api/v1/chat` — texto + snapshot mínimo dos eventos;
- `POST /api/v1/audio/transcriptions` — um áudio temporário, nunca um caminho.

O backend reaproveita uma sessão Hermes, serializa os turnos, valida o JSON com
Zod e devolve apenas uma proposta. Ele não possui endpoint para salvar eventos:
a confirmação e a alteração real pertencem ao app.

## 3. Xiaomi via USB

Com depuração USB e Android Platform Tools instalados:

```bash
adb reverse tcp:8787 tcp:8787
```

Assim `http://127.0.0.1:8787` no app chega ao servidor do computador sem abrir
uma porta na rede Wi-Fi. A reversão dura enquanto o aparelho/ADB permanecer
conectado.

Na web, o assistente funciona quando navegador e backend estão no mesmo
computador. A agenda funciona em iOS, mas um iPhone físico não consegue alcançar
o loopback do computador nesta etapa (não existe equivalente direto ao
`adb reverse`). Até existir um transporte remoto privado com autenticação e TLS,
use o fluxo completo no Xiaomi via USB; calendário e dados locais continuam
funcionando normalmente nas demais plataformas.

## Áudio local

O ambiente atual não tem `whisper-cli`, `ffprobe` nem `ffmpeg`. A interface e o
provider substituível estão implementados, mas
`TRANSCRIPTION_PROVIDER=disabled` devolve um erro honesto. Para habilitar
depois:

1. instale `ffmpeg`/`ffprobe` e `whisper.cpp` localmente;
2. baixe um modelo compatível, por exemplo `ggml-base.bin`;
3. use caminhos absolutos em `FFPROBE_BIN`, `FFMPEG_BIN`, `WHISPER_BIN` e `WHISPER_MODEL`;
4. altere `TRANSCRIPTION_PROVIDER=whisper-cpp`.

O processo usa argumentos fixos e `shell: false`, valida MIME, assinatura,
tamanho e duração, converte M4A/WebM para WAV PCM mono de 16 kHz e remove upload,
WAV e transcrição temporários em `finally`.

## Verificações

```bash
npm run typecheck
npm test
npm run build
```

# Contribuindo com a Agenda da Nicolly 💜

Obrigada por querer deixar este cantinho ainda mais bonito e útil. Issues e pull
requests são bem-vindos, desde que preservem a proposta pessoal, a privacidade e
a acessibilidade do aplicativo.

## Antes de começar

1. Abra uma issue curta descrevendo a mudança ou escolha uma issue existente.
2. Crie uma branch a partir de `main`.
3. Não inclua `.env`, chaves, sessões, APKs, keystores ou dados reais da agenda.
4. Para imagens, use apenas material original ou licenciado e documente a origem.
5. Se IA generativa tiver participação substancial, informe isso no pull request.

## Ambiente local

```bash
npm install
npm run web
```

O assistente é opcional. Caso trabalhe nessa área, siga obrigatoriamente o
[modelo de segurança do servidor](./server/README.md) e nunca exponha a porta
privada do Hermes.

## Verificações obrigatórias

```bash
npm run typecheck
npm test
npm run doctor
npm run export:android

cd server
npm run typecheck
npm test
npm run build
```

## Direção de produto e visual

- preserve o tema roxo, preto, rosa e punk-kawaii;
- mantenha contraste, áreas de toque, rótulos e redução de movimento;
- prefira componentes e tokens existentes;
- toda ação destrutiva deve pedir confirmação;
- a agenda local continua sendo a fonte de verdade;
- não introduza telemetria, serviços pagos ou sincronização remota sem discussão.

Ao contribuir, você concorda que sua contribuição de código original será
disponibilizada sob a licença MIT do projeto. Assets e marcas seguem as regras de
[ASSET_NOTICE.md](./ASSET_NOTICE.md).

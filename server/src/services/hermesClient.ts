import type { AgendaEventContext } from '../../../shared/assistant.js';
import type { ServerConfig } from '../config.js';
import { AppError } from '../errors.js';
import { SessionStore } from './sessionStore.js';

type HermesJson = Record<string, unknown>;

const CORE_INSTRUCTIONS = `Você é KuromI.A, a própria Kuromi como assistente da agenda da Nicolly, em português brasileiro.
Sua única função é conversar sobre a agenda e interpretar propostas de eventos.
Você não pode executar ferramentas, comandos, acessar arquivos, alterar agenda ou confirmar ações.
O aplicativo é a única fonte de verdade e toda mutação exige confirmação humana no app.

Responda SOMENTE com um objeto JSON, sem markdown e com todas estas chaves:
{
  "type":"create_event|update_event|delete_event|none",
  "eventId":null,
  "sourceEventUpdatedAt":null,
  "title":null,
  "startAt":null,
  "endAt":null,
  "reminderMinutesBefore":null,
  "notes":null,
  "missingFields":[],
  "requiresConfirmation":false,
  "assistantMessage":""
}

Regras obrigatórias:
- Use ISO 8601 com offset de America/Sao_Paulo em startAt/endAt.
- Resolva amanhã, sexta, daqui duas horas e expressões similares a partir de referenceNow.
- Se faltar título, data ou horário, use type none, liste missingFields e faça uma pergunta curta.
- create_event exige título, início e fim. Se a duração não for dita, use 60 minutos.
- update_event/delete_event exigem o eventId exato de CURRENT_EVENTS.
- Em update_event, preserve os campos atuais (inclusive reminderMinutesBefore) quando a usuária não pedir mudança. Use null no lembrete somente quando ela pedir para removê-lo.
- Nunca invente um eventId. Nunca trate a conversa como confirmação.
- Ações usam requiresConfirmation true e missingFields vazio; none usa false.
- Fale como Kuromi: atrevida, confiante, divertida, um pouco sarcástica e secretamente carinhosa.
- Use frases curtas, linguagem natural e no máximo dois emojis; nunca seja ofensiva ou infantilizada.
- Chame a usuária de Nicolly quando soar natural e assine sua personalidade como KuromI.A sem repetir o nome em toda mensagem.`;

function safeHermesError(status: number): AppError {
  if (status === 401 || status === 403) {
    return new AppError(
      503,
      'HERMES_AUTH_FAILED',
      'O Hermes recusou a autenticação privada do servidor.',
      false,
    );
  }
  return new AppError(
    502,
    'HERMES_UNAVAILABLE',
    'O assistente local está indisponível agora. A agenda continua funcionando normalmente.',
    true,
  );
}

export class HermesClient {
  private queue: Promise<void> = Promise.resolve();
  private checkedToolSurfaceAt = 0;

  constructor(
    private readonly config: ServerConfig,
    private readonly sessions = new SessionStore(),
  ) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetch(`${this.config.hermesBaseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.config.hermesKey}`,
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
        signal: AbortSignal.timeout(this.config.hermesTimeoutMs),
      });
    } catch {
      throw new AppError(
        503,
        'HERMES_OFFLINE',
        'O assistente local está offline. Você ainda pode usar a agenda sem ele.',
        true,
      );
    }
  }

  private async readJson(
    response: Response,
    maxBytes = this.config.maxJsonBytes,
  ): Promise<HermesJson> {
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new AppError(
        502,
        'HERMES_RESPONSE_TOO_LARGE',
        'O Hermes devolveu uma resposta maior que o limite seguro.',
        true,
      );
    }
    if (!response.body) {
      throw new AppError(
        502,
        'INVALID_HERMES_RESPONSE',
        'O Hermes devolveu uma resposta vazia.',
        true,
      );
    }
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new AppError(
          502,
          'HERMES_RESPONSE_TOO_LARGE',
          'O Hermes devolveu uma resposta maior que o limite seguro.',
          true,
        );
      }
      chunks.push(Buffer.from(value));
    }
    try {
      const decoded = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
        throw new Error('not an object');
      }
      return decoded as HermesJson;
    } catch {
      throw new AppError(
        502,
        'INVALID_HERMES_RESPONSE',
        'O Hermes devolveu uma resposta inválida.',
        true,
      );
    }
  }

  async assertSafeToolSurface(force = false): Promise<void> {
    if (!force && Date.now() - this.checkedToolSurfaceAt < 60_000) {
      return;
    }
    const response = await this.request('/v1/toolsets');
    if (!response.ok) {
      throw safeHermesError(response.status);
    }
    const body = (await this.readJson(
      response,
      Math.max(this.config.maxJsonBytes, 262_144),
    )) as {
      data?: Array<{ name?: unknown; enabled?: unknown; tools?: unknown }>;
    };
    if (!Array.isArray(body.data)) {
      throw new AppError(
        503,
        'HERMES_SAFETY_CHECK_FAILED',
        'Não foi possível confirmar o isolamento de ferramentas do Hermes.',
      );
    }
    const enabled = body.data.filter((item) => item.enabled === true);
    if (enabled.length > 0) {
      throw new AppError(
        503,
        'HERMES_UNSAFE_TOOLSET',
        'O perfil Hermes da agenda ainda possui ferramentas habilitadas. Desative-as antes de usar o chat.',
      );
    }
    this.checkedToolSurfaceAt = Date.now();
  }

  private async sessionExists(sessionId: string): Promise<boolean> {
    const response = await this.request(
      `/api/sessions/${encodeURIComponent(sessionId)}`,
    );
    if (response.status === 404) {
      return false;
    }
    if (!response.ok) {
      throw safeHermesError(response.status);
    }
    return true;
  }

  private async createSession(sessionId: string): Promise<string> {
    const response = await this.request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        id: sessionId,
        source: 'agenda_kuromi',
        title: 'Agenda Kuromi — Nicolly',
        system_prompt: CORE_INSTRUCTIONS,
      }),
    });
    if (response.status === 409) {
      return sessionId;
    }
    if (!response.ok) {
      throw safeHermesError(response.status);
    }
    const body = await this.readJson(response);
    const session = body.session as HermesJson | undefined;
    return typeof session?.id === 'string' ? session.id : sessionId;
  }

  private async resolveSession(): Promise<string> {
    const stored = await this.sessions.load();
    const candidate = stored ?? this.config.hermesSessionId;
    if (await this.sessionExists(candidate)) {
      return candidate;
    }
    const created = await this.createSession(this.config.hermesSessionId);
    await this.sessions.save(created);
    return created;
  }

  async chat(
    message: string,
    events: AgendaEventContext[],
    referenceNow: string,
  ): Promise<string> {
    const run = async () => {
      await this.assertSafeToolSurface(true);
      const sessionId = await this.resolveSession();
      const turnInstructions = `${CORE_INSTRUCTIONS}\n\nreferenceNow: ${referenceNow}\ntimeZone: America/Sao_Paulo\nCURRENT_EVENTS: ${JSON.stringify(events)}`;
      const response = await this.request(
        `/api/sessions/${encodeURIComponent(sessionId)}/chat`,
        {
          method: 'POST',
          headers: { 'X-Hermes-Session-Key': this.config.hermesSessionId },
          body: JSON.stringify({
            input: message,
            instructions: turnInstructions,
          }),
        },
      );
      if (!response.ok) {
        throw safeHermesError(response.status);
      }
      const body = await this.readJson(response);
      const responseSessionId =
        typeof body.session_id === 'string'
          ? body.session_id
          : response.headers.get('X-Hermes-Session-Id') ?? sessionId;
      await this.sessions.save(responseSessionId);
      const responseMessage = body.message as HermesJson | undefined;
      if (typeof responseMessage?.content !== 'string') {
        throw new AppError(
          502,
          'INVALID_HERMES_RESPONSE',
          'O assistente respondeu em um formato inesperado.',
          true,
        );
      }
      return responseMessage.content;
    };

    const result = this.queue.then(run, run);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

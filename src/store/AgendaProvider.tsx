import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';

import { loadAgendaSnapshot, saveAgendaSnapshot } from '@/data/agendaStorage';
import {
  AgendaEvent,
  AgendaEventDraft,
  AgendaMutationResult,
  AgendaPreferences,
  defaultPreferences,
} from '@/domain/agenda';
import {
  cancelEventNotification,
  replaceEventNotification,
  scheduleEventNotification,
} from '@/services/notifications';

type AgendaState = {
  events: AgendaEvent[];
  preferences: AgendaPreferences;
  hydrated: boolean;
};

type AgendaAction =
  | { type: 'hydrate'; events: AgendaEvent[]; preferences: AgendaPreferences }
  | { type: 'add'; event: AgendaEvent }
  | { type: 'update'; event: AgendaEvent }
  | { type: 'delete'; id: string }
  | { type: 'toggle'; id: string; updatedAt: number }
  | { type: 'preferences'; preferences: Partial<AgendaPreferences> };

type AgendaContextValue = AgendaState & {
  storageError: boolean;
  addEvent: (draft: AgendaEventDraft) => Promise<AgendaMutationResult>;
  updateEvent: (id: string, draft: AgendaEventDraft) => Promise<AgendaMutationResult>;
  deleteEvent: (id: string) => Promise<AgendaMutationResult>;
  toggleEvent: (id: string) => void;
  updatePreferences: (preferences: Partial<AgendaPreferences>) => void;
  getEvent: (id: string) => AgendaEvent | undefined;
};

const initialState: AgendaState = {
  events: [],
  preferences: defaultPreferences,
  hydrated: false,
};

function reducer(state: AgendaState, action: AgendaAction): AgendaState {
  switch (action.type) {
    case 'hydrate':
      return {
        events: action.events,
        preferences: action.preferences,
        hydrated: true,
      };
    case 'add':
      return { ...state, events: [...state.events, action.event] };
    case 'update':
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === action.event.id ? action.event : event,
        ),
      };
    case 'delete':
      return {
        ...state,
        events: state.events.filter((event) => event.id !== action.id),
      };
    case 'toggle':
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === action.id
            ? {
                ...event,
                completed: !event.completed,
                updatedAt: action.updatedAt,
              }
            : event,
        ),
      };
    case 'preferences':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.preferences },
      };
    default:
      return state;
  }
}

const AgendaContext = createContext<AgendaContextValue | null>(null);

function makeEventId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AgendaProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    let active = true;

    loadAgendaSnapshot().then((snapshot) => {
      if (active) {
        dispatch({
          type: 'hydrate',
          events: snapshot.events,
          preferences: snapshot.preferences,
        });
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!state.hydrated) {
      return;
    }

    saveAgendaSnapshot({
      schemaVersion: 2,
      events: state.events,
      preferences: state.preferences,
    })
      .then(() => setStorageError(false))
      .catch(() => setStorageError(true));
  }, [state.events, state.hydrated, state.preferences]);

  const addEvent = useCallback(async (draft: AgendaEventDraft) => {
    if (!state.hydrated) {
      return { event: null, notificationIssue: null };
    }
    const now = Date.now();
    const id = makeEventId();
    const pendingEvent: AgendaEvent = {
      ...draft,
      id,
      notificationId: null,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    const notification = await scheduleEventNotification(pendingEvent);
    const event = {
      ...pendingEvent,
      notificationId: notification.notificationId,
    };
    dispatch({
      type: 'add',
      event,
    });
    return { event, notificationIssue: notification.issue };
  }, [state.hydrated]);

  const updateEvent = useCallback(
    async (id: string, draft: AgendaEventDraft) => {
      if (!state.hydrated) return { event: null, notificationIssue: null };
      const previous = state.events.find((event) => event.id === id);
      if (!previous) return { event: null, notificationIssue: null };
      const pendingEvent: AgendaEvent = {
        ...previous,
        ...draft,
        notificationId: null,
        updatedAt: Date.now(),
      };
      const notification = await replaceEventNotification(
        previous.notificationId,
        pendingEvent,
      );
      if (notification.issue === 'cancel-failed') {
        return { event: null, notificationIssue: notification.issue };
      }
      const event = {
        ...pendingEvent,
        notificationId: notification.notificationId,
      };
      dispatch({ type: 'update', event });
      return { event, notificationIssue: notification.issue };
    },
    [state.events, state.hydrated],
  );

  const deleteEvent = useCallback(
    async (id: string): Promise<AgendaMutationResult> => {
      if (!state.hydrated) return { event: null, notificationIssue: null };
      const event = state.events.find((item) => item.id === id) ?? null;
      if (event && !(await cancelEventNotification(event.notificationId))) {
        return { event: null, notificationIssue: 'cancel-failed' };
      }
      dispatch({ type: 'delete', id });
      return { event, notificationIssue: null };
    },
    [state.events, state.hydrated],
  );

  const toggleEvent = useCallback((id: string) => {
    dispatch({ type: 'toggle', id, updatedAt: Date.now() });
  }, []);

  const updatePreferences = useCallback(
    (preferences: Partial<AgendaPreferences>) => {
      dispatch({ type: 'preferences', preferences });
    },
    [],
  );

  const getEvent = useCallback(
    (id: string) => state.events.find((event) => event.id === id),
    [state.events],
  );

  const value = useMemo<AgendaContextValue>(
    () => ({
      ...state,
      storageError,
      addEvent,
      updateEvent,
      deleteEvent,
      toggleEvent,
      updatePreferences,
      getEvent,
    }),
    [
      addEvent,
      deleteEvent,
      getEvent,
      state,
      storageError,
      toggleEvent,
      updateEvent,
      updatePreferences,
    ],
  );

  return <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>;
}

export function useAgenda(): AgendaContextValue {
  const context = useContext(AgendaContext);
  if (!context) {
    throw new Error('useAgenda precisa estar dentro de AgendaProvider');
  }
  return context;
}

import type { Topic, Solution } from "./schema";

// ---- Type aliases for seed rows ----
export type TestRow = {
  id: string; mode: string; name: string; domain: string; tags: string[];
  description: string; status: string; accent: string;
  topics: Topic[]; solutions: Solution[];
  branding: null; createdAt: string;
};

export type ResponseRow = {
  id: string; testId: string; respondent: string | null; company: string | null;
  email: string | null; role: string | null; submittedAt: string;
  answers: Record<string, string>;
};

export type InvitationRow = {
  id: string; testId: string; name: string | null; email: string | null;
  company: string | null; status: string; sentAt: string | null;
};

export type TaskActionRow = {
  id: string; testId: string; solutionId: string; entityName: string;
  status: string; assignee: string | null;
};

export type ConsultantNoteRow = {
  id: string; company: string; mode: string; content: string;
};

// ===========================================================================
// CLIENTES seed
// ===========================================================================
export function makeSeedClientes(): { tests: TestRow[]; responses: ResponseRow[]; invitations: InvitationRow[]; taskActions: TaskActionRow[]; consultantNotes: ConsultantNoteRow[] } {
  const t1: TestRow = {
    id: "test_cl_001",
    mode: "clientes",
    name: "Evaluación de Cultura Laboral 2026",
    domain: "Recursos Humanos",
    tags: ["cultura", "engagement"],
    description: "Diagnóstico integral del clima organizacional, valores y comunicación interna.",
    status: "publicado",
    accent: "#1f8a5b",
    createdAt: "2026-01-15",
    branding: null,
    topics: [
      {
        id: "cl1_t1",
        name: "Liderazgo y Dirección",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        description: "Evalúa la calidad del liderazgo y la dirección estratégica.",
        questions: [
          {
            id: "cl1_t1_q1",
            text: "¿Con qué frecuencia su jefe directo reconoce públicamente el buen trabajo?",
            options: [
              { id: "cl1_t1_q1_a", label: "Frecuentemente", points: 3, correct: true },
              { id: "cl1_t1_q1_b", label: "A veces", points: 2, correct: false },
              { id: "cl1_t1_q1_c", label: "Raramente", points: 1, correct: false },
              { id: "cl1_t1_q1_d", label: "Nunca", points: 0, correct: false },
            ],
          },
          {
            id: "cl1_t1_q2",
            text: "¿Siente que la dirección comunica claramente los objetivos de la empresa?",
            options: [
              { id: "cl1_t1_q2_a", label: "Siempre", points: 3, correct: true },
              { id: "cl1_t1_q2_b", label: "Generalmente", points: 2, correct: false },
              { id: "cl1_t1_q2_c", label: "Pocas veces", points: 1, correct: false },
              { id: "cl1_t1_q2_d", label: "Nunca", points: 0, correct: false },
            ],
          },
          {
            id: "cl1_t1_q3",
            text: "¿Su líder fomenta el desarrollo profesional de su equipo?",
            options: [
              { id: "cl1_t1_q3_a", label: "Activamente", points: 3, correct: true },
              { id: "cl1_t1_q3_b", label: "Ocasionalmente", points: 2, correct: false },
              { id: "cl1_t1_q3_c", label: "Muy poco", points: 1, correct: false },
              { id: "cl1_t1_q3_d", label: "No lo hace", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "cl1_t2",
        name: "Comunicación Interna",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        description: "Mide la efectividad de los canales y flujos de comunicación.",
        questions: [
          {
            id: "cl1_t2_q1",
            text: "¿Considera que la información relevante llega a tiempo a su área?",
            options: [
              { id: "cl1_t2_q1_a", label: "Siempre", points: 3, correct: true },
              { id: "cl1_t2_q1_b", label: "Casi siempre", points: 2, correct: false },
              { id: "cl1_t2_q1_c", label: "A veces", points: 1, correct: false },
              { id: "cl1_t2_q1_d", label: "Rara vez", points: 0, correct: false },
            ],
          },
          {
            id: "cl1_t2_q2",
            text: "¿Existe espacio para expresar ideas y sugerencias al equipo directivo?",
            options: [
              { id: "cl1_t2_q2_a", label: "Sí, de manera abierta", points: 3, correct: true },
              { id: "cl1_t2_q2_b", label: "Sí, pero con limitaciones", points: 2, correct: false },
              { id: "cl1_t2_q2_c", label: "Muy poco espacio", points: 1, correct: false },
              { id: "cl1_t2_q2_d", label: "No existe ese espacio", points: 0, correct: false },
            ],
          },
          {
            id: "cl1_t2_q3",
            text: "¿Los canales de comunicación interna (correo, reuniones, intranet) son efectivos?",
            options: [
              { id: "cl1_t2_q3_a", label: "Muy efectivos", points: 3, correct: true },
              { id: "cl1_t2_q3_b", label: "Efectivos", points: 2, correct: false },
              { id: "cl1_t2_q3_c", label: "Poco efectivos", points: 1, correct: false },
              { id: "cl1_t2_q3_d", label: "Inefectivos", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "cl1_t3",
        name: "Clima y Bienestar",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        description: "Evalúa el ambiente de trabajo y el bienestar del equipo.",
        questions: [
          {
            id: "cl1_t3_q1",
            text: "¿Cómo califica el ambiente de trabajo en su área?",
            options: [
              { id: "cl1_t3_q1_a", label: "Excelente", points: 3, correct: true },
              { id: "cl1_t3_q1_b", label: "Bueno", points: 2, correct: false },
              { id: "cl1_t3_q1_c", label: "Regular", points: 1, correct: false },
              { id: "cl1_t3_q1_d", label: "Malo", points: 0, correct: false },
            ],
          },
          {
            id: "cl1_t3_q2",
            text: "¿La empresa se preocupa genuinamente por el bienestar de sus empleados?",
            options: [
              { id: "cl1_t3_q2_a", label: "Completamente de acuerdo", points: 3, correct: true },
              { id: "cl1_t3_q2_b", label: "De acuerdo", points: 2, correct: false },
              { id: "cl1_t3_q2_c", label: "En desacuerdo", points: 1, correct: false },
              { id: "cl1_t3_q2_d", label: "Completamente en desacuerdo", points: 0, correct: false },
            ],
          },
          {
            id: "cl1_t3_q3",
            text: "¿Cómo es la colaboración entre diferentes áreas o departamentos?",
            options: [
              { id: "cl1_t3_q3_a", label: "Muy colaborativa", points: 3, correct: true },
              { id: "cl1_t3_q3_b", label: "Colaborativa", points: 2, correct: false },
              { id: "cl1_t3_q3_c", label: "Poca colaboración", points: 1, correct: false },
              { id: "cl1_t3_q3_d", label: "Sin colaboración", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "cl1_t4",
        name: "Desarrollo Profesional",
        scoring: "weighted",
        includeInOverall: true,
        weight: 1,
        description: "Mide oportunidades de crecimiento y capacitación.",
        questions: [
          {
            id: "cl1_t4_q1",
            text: "¿La empresa ofrece oportunidades reales de crecimiento y ascenso?",
            options: [
              { id: "cl1_t4_q1_a", label: "Muchas oportunidades", points: 3, correct: true },
              { id: "cl1_t4_q1_b", label: "Algunas oportunidades", points: 2, correct: false },
              { id: "cl1_t4_q1_c", label: "Pocas oportunidades", points: 1, correct: false },
              { id: "cl1_t4_q1_d", label: "Ninguna oportunidad", points: 0, correct: false },
            ],
          },
          {
            id: "cl1_t4_q2",
            text: "¿Ha recibido capacitación relevante para su puesto en el último año?",
            options: [
              { id: "cl1_t4_q2_a", label: "Capacitación completa y actualizada", points: 3, correct: true },
              { id: "cl1_t4_q2_b", label: "Alguna capacitación", points: 2, correct: false },
              { id: "cl1_t4_q2_c", label: "Capacitación mínima", points: 1, correct: false },
              { id: "cl1_t4_q2_d", label: "Sin capacitación", points: 0, correct: false },
            ],
          },
          {
            id: "cl1_t4_q3",
            text: "¿Tiene claridad sobre su plan de carrera dentro de la organización?",
            options: [
              { id: "cl1_t4_q3_a", label: "Sí, plan claro y documentado", points: 3, correct: true },
              { id: "cl1_t4_q3_b", label: "Más o menos claro", points: 2, correct: false },
              { id: "cl1_t4_q3_c", label: "Poco claro", points: 1, correct: false },
              { id: "cl1_t4_q3_d", label: "No tengo plan de carrera", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "cl1_t5",
        name: "Compromiso e Identidad",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        description: "Evalúa el nivel de compromiso y sentido de pertenencia.",
        questions: [
          {
            id: "cl1_t5_q1",
            text: "¿Recomendaría a esta empresa como lugar de trabajo a amigos o familiares?",
            options: [
              { id: "cl1_t5_q1_a", label: "Sin duda", points: 3, correct: true },
              { id: "cl1_t5_q1_b", label: "Probablemente sí", points: 2, correct: false },
              { id: "cl1_t5_q1_c", label: "Probablemente no", points: 1, correct: false },
              { id: "cl1_t5_q1_d", label: "No la recomendaría", points: 0, correct: false },
            ],
          },
          {
            id: "cl1_t5_q2",
            text: "¿Se identifica con los valores y misión de la organización?",
            options: [
              { id: "cl1_t5_q2_a", label: "Totalmente identificado", points: 3, correct: true },
              { id: "cl1_t5_q2_b", label: "Bastante identificado", points: 2, correct: false },
              { id: "cl1_t5_q2_c", label: "Poco identificado", points: 1, correct: false },
              { id: "cl1_t5_q2_d", label: "No me identifico", points: 0, correct: false },
            ],
          },
          {
            id: "cl1_t5_q3",
            text: "¿Planea continuar en la empresa en los próximos 2 años?",
            options: [
              { id: "cl1_t5_q3_a", label: "Definitivamente sí", points: 3, correct: true },
              { id: "cl1_t5_q3_b", label: "Probablemente sí", points: 2, correct: false },
              { id: "cl1_t5_q3_c", label: "Incertidumbre", points: 1, correct: false },
              { id: "cl1_t5_q3_d", label: "Probablemente no", points: 0, correct: false },
            ],
          },
        ],
      },
    ],
    solutions: [
      {
        id: "cl1_sol1",
        name: "Plan de Comunicación Interna",
        description: "Implementar un plan estructurado de comunicación para mejorar el flujo de información.",
        category: "Comunicación",
        conditions: [{ scope: "topic", topicId: "cl1_t2", operator: "below", threshold: 65 }],
        logic: "all",
        link: { label: "Ver plantilla", url: "#" },
        actions: ["Definir canales oficiales", "Crear boletín semanal", "Reuniones de área quincenales"],
      },
      {
        id: "cl1_sol2",
        name: "Programa de Liderazgo",
        description: "Capacitar a mandos medios en habilidades de liderazgo y gestión de equipos.",
        category: "Liderazgo",
        conditions: [{ scope: "topic", topicId: "cl1_t1", operator: "below", threshold: 70 }],
        logic: "all",
        link: null,
        actions: ["Taller de liderazgo situacional", "Coaching ejecutivo", "360° feedback"],
      },
      {
        id: "cl1_sol3",
        name: "Plan de Desarrollo de Carrera",
        description: "Diseñar planes individuales de carrera para retener y motivar al talento.",
        category: "Desarrollo",
        conditions: [{ scope: "topic", topicId: "cl1_t4", operator: "below", threshold: 60 }],
        logic: "all",
        link: null,
        actions: ["Entrevistas de carrera individuales", "Mapa de competencias", "Programa de mentoría"],
      },
      {
        id: "cl1_sol4",
        name: "Programa de Bienestar Organizacional",
        description: "Iniciativas para mejorar el clima y bienestar del equipo.",
        category: "Bienestar",
        conditions: [
          { scope: "topic", topicId: "cl1_t3", operator: "below", threshold: 65 },
          { scope: "overall", operator: "below", threshold: 60 },
        ],
        logic: "any",
        link: null,
        actions: ["Encuestas de pulso mensual", "Actividades de team building", "Flexibilidad horaria"],
      },
    ],
  };

  const t2: TestRow = {
    id: "test_cl_002",
    mode: "clientes",
    name: "Diagnóstico de Ciberseguridad",
    domain: "Tecnología",
    tags: ["tecnología", "seguridad"],
    description: "Evaluación de prácticas y concientización en seguridad de la información.",
    status: "publicado",
    accent: "#2563eb",
    createdAt: "2026-02-10",
    branding: null,
    topics: [
      {
        id: "cl2_t1",
        name: "Gestión de Contraseñas",
        scoring: "percent",
        includeInOverall: true,
        weight: 1,
        questions: [
          {
            id: "cl2_t1_q1",
            text: "¿Utiliza contraseñas únicas para cada sistema o plataforma?",
            options: [
              { id: "cl2_t1_q1_a", label: "Sí, siempre", points: 1, correct: true },
              { id: "cl2_t1_q1_b", label: "No, uso las mismas en varios sistemas", points: 0, correct: false },
            ],
          },
          {
            id: "cl2_t1_q2",
            text: "¿Usa un gestor de contraseñas?",
            options: [
              { id: "cl2_t1_q2_a", label: "Sí", points: 1, correct: true },
              { id: "cl2_t1_q2_b", label: "No", points: 0, correct: false },
            ],
          },
          {
            id: "cl2_t1_q3",
            text: "¿Sus contraseñas tienen al menos 12 caracteres con letras, números y símbolos?",
            options: [
              { id: "cl2_t1_q3_a", label: "Sí", points: 1, correct: true },
              { id: "cl2_t1_q3_b", label: "No siempre", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "cl2_t2",
        name: "Phishing y Amenazas",
        scoring: "percent",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "cl2_t2_q1",
            text: "¿Sabe identificar un correo de phishing?",
            options: [
              { id: "cl2_t2_q1_a", label: "Sí, con confianza", points: 1, correct: true },
              { id: "cl2_t2_q1_b", label: "No estoy seguro", points: 0, correct: false },
            ],
          },
          {
            id: "cl2_t2_q2",
            text: "¿Ha recibido entrenamiento sobre phishing en el último año?",
            options: [
              { id: "cl2_t2_q2_a", label: "Sí", points: 1, correct: true },
              { id: "cl2_t2_q2_b", label: "No", points: 0, correct: false },
            ],
          },
          {
            id: "cl2_t2_q3",
            text: "Si recibe un archivo adjunto inesperado, ¿qué hace?",
            options: [
              { id: "cl2_t2_q3_a", label: "Lo verifico con el remitente antes de abrir", points: 1, correct: true },
              { id: "cl2_t2_q3_b", label: "Lo abro si parece legítimo", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "cl2_t3",
        name: "Políticas y Procedimientos",
        scoring: "percent",
        includeInOverall: true,
        weight: 1,
        questions: [
          {
            id: "cl2_t3_q1",
            text: "¿Conoce la política de seguridad de la información de su empresa?",
            options: [
              { id: "cl2_t3_q1_a", label: "Sí, la he leído", points: 1, correct: true },
              { id: "cl2_t3_q1_b", label: "No la conozco", points: 0, correct: false },
            ],
          },
          {
            id: "cl2_t3_q2",
            text: "¿Sabe a quién reportar un incidente de seguridad?",
            options: [
              { id: "cl2_t3_q2_a", label: "Sí, tengo el contacto claro", points: 1, correct: true },
              { id: "cl2_t3_q2_b", label: "No sé a quién reportar", points: 0, correct: false },
            ],
          },
        ],
      },
    ],
    solutions: [
      {
        id: "cl2_sol1",
        name: "Taller de Concientización en Phishing",
        description: "Simulaciones y capacitación para detectar y evitar ataques de phishing.",
        category: "Capacitación",
        conditions: [{ scope: "topic", topicId: "cl2_t2", operator: "below", threshold: 70 }],
        logic: "all",
        link: null,
        actions: ["Simulaciones de phishing mensual", "Módulo e-learning", "Reportes de incidentes"],
      },
      {
        id: "cl2_sol2",
        name: "Implementación de Gestor de Contraseñas",
        description: "Adoptar un gestor de contraseñas corporativo para toda la organización.",
        category: "Tecnología",
        conditions: [{ scope: "topic", topicId: "cl2_t1", operator: "below", threshold: 70 }],
        logic: "all",
        link: { label: "Ver opciones", url: "#" },
        actions: ["Evaluar herramientas (1Password, Bitwarden)", "Piloto con TI", "Despliegue organizacional"],
      },
    ],
  };

  const t3: TestRow = {
    id: "test_cl_003",
    mode: "clientes",
    name: "Salud Financiera PyME",
    domain: "Finanzas",
    tags: ["finanzas", "pyme"],
    description: "Diagnóstico de la salud financiera y buenas prácticas contables.",
    status: "publicado",
    accent: "#b07d18",
    createdAt: "2026-03-05",
    branding: null,
    topics: [
      {
        id: "cl3_t1",
        name: "Control de Flujo de Caja",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "cl3_t1_q1",
            text: "¿Con qué frecuencia revisa el flujo de caja de su empresa?",
            options: [
              { id: "cl3_t1_q1_a", label: "Diariamente", points: 3, correct: true },
              { id: "cl3_t1_q1_b", label: "Semanalmente", points: 2, correct: false },
              { id: "cl3_t1_q1_c", label: "Mensualmente", points: 1, correct: false },
              { id: "cl3_t1_q1_d", label: "Raramente", points: 0, correct: false },
            ],
          },
          {
            id: "cl3_t1_q2",
            text: "¿Tiene proyectado el flujo de caja para los próximos 3 meses?",
            options: [
              { id: "cl3_t1_q2_a", label: "Sí, con detalle", points: 3, correct: true },
              { id: "cl3_t1_q2_b", label: "Tengo una estimación general", points: 2, correct: false },
              { id: "cl3_t1_q2_c", label: "No tengo proyección", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "cl3_t2",
        name: "Gestión de Deuda",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "cl3_t2_q1",
            text: "¿El nivel de endeudamiento actual es manejable respecto a sus ingresos?",
            options: [
              { id: "cl3_t2_q1_a", label: "Sí, completamente manejable", points: 3, correct: true },
              { id: "cl3_t2_q1_b", label: "Manejable con esfuerzo", points: 2, correct: false },
              { id: "cl3_t2_q1_c", label: "Difícil de manejar", points: 1, correct: false },
              { id: "cl3_t2_q1_d", label: "Es un problema crítico", points: 0, correct: false },
            ],
          },
          {
            id: "cl3_t2_q2",
            text: "¿Cuenta con un fondo de emergencia o reserva de capital?",
            options: [
              { id: "cl3_t2_q2_a", label: "Sí, cubre más de 3 meses", points: 3, correct: true },
              { id: "cl3_t2_q2_b", label: "Cubre hasta 1 mes", points: 2, correct: false },
              { id: "cl3_t2_q2_c", label: "No tengo fondo de emergencia", points: 0, correct: false },
            ],
          },
        ],
      },
    ],
    solutions: [
      {
        id: "cl3_sol1",
        name: "Asesoría en Flujo de Caja",
        description: "Implementar herramientas y procesos para monitorear el flujo de caja.",
        category: "Finanzas",
        conditions: [{ scope: "topic", topicId: "cl3_t1", operator: "below", threshold: 65 }],
        logic: "all",
        link: null,
        actions: ["Plantilla de proyección mensual", "Reunión financiera semanal", "Software de gestión financiera"],
      },
    ],
  };

  const t4: TestRow = {
    id: "test_cl_004",
    mode: "clientes",
    name: "Experiencia del Cliente",
    domain: "Servicio",
    tags: ["servicio", "cx"],
    description: "Borrador en desarrollo para medir NPS y satisfacción del cliente.",
    status: "borrador",
    accent: "#7c3aed",
    createdAt: "2026-04-01",
    branding: null,
    topics: [
      {
        id: "cl4_t1",
        name: "Satisfacción General",
        scoring: "weighted",
        includeInOverall: true,
        weight: 1,
        questions: [
          {
            id: "cl4_t1_q1",
            text: "¿Cómo califica su experiencia general con nuestros productos/servicios?",
            options: [
              { id: "cl4_t1_q1_a", label: "Excelente", points: 3, correct: true },
              { id: "cl4_t1_q1_b", label: "Buena", points: 2, correct: false },
              { id: "cl4_t1_q1_c", label: "Regular", points: 1, correct: false },
              { id: "cl4_t1_q1_d", label: "Mala", points: 0, correct: false },
            ],
          },
        ],
      },
    ],
    solutions: [],
  };

  const responses: ResponseRow[] = [
    // Logística Andes — test_cl_001
    {
      id: "resp_cl_001",
      testId: "test_cl_001",
      respondent: "Carlos Medina",
      company: "Logística Andes",
      email: "c.medina@logandes.com",
      role: "Gerente de Operaciones",
      submittedAt: "2026-02-01T10:30:00.000Z",
      answers: {
        cl1_t1_q1: "cl1_t1_q1_b", cl1_t1_q2: "cl1_t1_q2_b", cl1_t1_q3: "cl1_t1_q3_b",
        cl1_t2_q1: "cl1_t2_q1_c", cl1_t2_q2: "cl1_t2_q2_c", cl1_t2_q3: "cl1_t2_q3_b",
        cl1_t3_q1: "cl1_t3_q1_b", cl1_t3_q2: "cl1_t3_q2_b", cl1_t3_q3: "cl1_t3_q3_b",
        cl1_t4_q1: "cl1_t4_q1_b", cl1_t4_q2: "cl1_t4_q2_b", cl1_t4_q3: "cl1_t4_q3_c",
        cl1_t5_q1: "cl1_t5_q1_b", cl1_t5_q2: "cl1_t5_q2_b", cl1_t5_q3: "cl1_t5_q3_b",
      },
    },
    {
      id: "resp_cl_002",
      testId: "test_cl_001",
      respondent: "Sofía Torres",
      company: "Logística Andes",
      email: "s.torres@logandes.com",
      role: "Analista de Proyectos",
      submittedAt: "2026-02-02T09:15:00.000Z",
      answers: {
        cl1_t1_q1: "cl1_t1_q1_c", cl1_t1_q2: "cl1_t1_q2_c", cl1_t1_q3: "cl1_t1_q3_c",
        cl1_t2_q1: "cl1_t2_q1_d", cl1_t2_q2: "cl1_t2_q2_d", cl1_t2_q3: "cl1_t2_q3_c",
        cl1_t3_q1: "cl1_t3_q1_c", cl1_t3_q2: "cl1_t3_q2_c", cl1_t3_q3: "cl1_t3_q3_c",
        cl1_t4_q1: "cl1_t4_q1_c", cl1_t4_q2: "cl1_t4_q2_c", cl1_t4_q3: "cl1_t4_q3_d",
        cl1_t5_q1: "cl1_t5_q1_c", cl1_t5_q2: "cl1_t5_q2_c", cl1_t5_q3: "cl1_t5_q3_c",
      },
    },
    // Cafés del Valle — test_cl_001
    {
      id: "resp_cl_003",
      testId: "test_cl_001",
      respondent: "Andrés Varela",
      company: "Cafés del Valle",
      email: "a.varela@cafesdelvalle.com",
      role: "Director General",
      submittedAt: "2026-02-10T14:00:00.000Z",
      answers: {
        cl1_t1_q1: "cl1_t1_q1_a", cl1_t1_q2: "cl1_t1_q2_a", cl1_t1_q3: "cl1_t1_q3_a",
        cl1_t2_q1: "cl1_t2_q1_b", cl1_t2_q2: "cl1_t2_q2_b", cl1_t2_q3: "cl1_t2_q3_b",
        cl1_t3_q1: "cl1_t3_q1_a", cl1_t3_q2: "cl1_t3_q2_a", cl1_t3_q3: "cl1_t3_q3_a",
        cl1_t4_q1: "cl1_t4_q1_a", cl1_t4_q2: "cl1_t4_q2_a", cl1_t4_q3: "cl1_t4_q3_a",
        cl1_t5_q1: "cl1_t5_q1_a", cl1_t5_q2: "cl1_t5_q2_a", cl1_t5_q3: "cl1_t5_q3_a",
      },
    },
    // Clínica Norte — test_cl_001
    {
      id: "resp_cl_004",
      testId: "test_cl_001",
      respondent: "Laura Espinoza",
      company: "Clínica Norte",
      email: "l.espinoza@clinicanorte.com",
      role: "Coordinadora RRHH",
      submittedAt: "2026-02-15T11:30:00.000Z",
      answers: {
        cl1_t1_q1: "cl1_t1_q1_b", cl1_t1_q2: "cl1_t1_q2_a", cl1_t1_q3: "cl1_t1_q3_b",
        cl1_t2_q1: "cl1_t2_q1_b", cl1_t2_q2: "cl1_t2_q2_a", cl1_t2_q3: "cl1_t2_q3_b",
        cl1_t3_q1: "cl1_t3_q1_b", cl1_t3_q2: "cl1_t3_q2_b", cl1_t3_q3: "cl1_t3_q3_b",
        cl1_t4_q1: "cl1_t4_q1_b", cl1_t4_q2: "cl1_t4_q2_a", cl1_t4_q3: "cl1_t4_q3_b",
        cl1_t5_q1: "cl1_t5_q1_b", cl1_t5_q2: "cl1_t5_q2_a", cl1_t5_q3: "cl1_t5_q3_b",
      },
    },
    // Ciberseguridad responses
    {
      id: "resp_cl_005",
      testId: "test_cl_002",
      respondent: "Marco Reyes",
      company: "Logística Andes",
      email: "m.reyes@logandes.com",
      role: "Coordinador TI",
      submittedAt: "2026-03-01T10:00:00.000Z",
      answers: {
        cl2_t1_q1: "cl2_t1_q1_b", cl2_t1_q2: "cl2_t1_q2_b", cl2_t1_q3: "cl2_t1_q3_b",
        cl2_t2_q1: "cl2_t2_q1_b", cl2_t2_q2: "cl2_t2_q2_b", cl2_t2_q3: "cl2_t2_q3_b",
        cl2_t3_q1: "cl2_t3_q1_b", cl2_t3_q2: "cl2_t3_q2_b",
      },
    },
    {
      id: "resp_cl_006",
      testId: "test_cl_002",
      respondent: "Isabel Mora",
      company: "Cafés del Valle",
      email: "i.mora@cafesdelvalle.com",
      role: "Gerente Administrativo",
      submittedAt: "2026-03-05T15:00:00.000Z",
      answers: {
        cl2_t1_q1: "cl2_t1_q1_a", cl2_t1_q2: "cl2_t1_q2_a", cl2_t1_q3: "cl2_t1_q3_a",
        cl2_t2_q1: "cl2_t2_q1_a", cl2_t2_q2: "cl2_t2_q2_a", cl2_t2_q3: "cl2_t2_q3_a",
        cl2_t3_q1: "cl2_t3_q1_a", cl2_t3_q2: "cl2_t3_q2_a",
      },
    },
  ];

  const invitations: InvitationRow[] = [
    { id: "inv_cl_001", testId: "test_cl_001", name: "Carlos Medina", email: "c.medina@logandes.com", company: "Logística Andes", status: "completada", sentAt: "2026-01-20" },
    { id: "inv_cl_002", testId: "test_cl_001", name: "Sofía Torres", email: "s.torres@logandes.com", company: "Logística Andes", status: "completada", sentAt: "2026-01-20" },
    { id: "inv_cl_003", testId: "test_cl_001", name: "Andrés Varela", email: "a.varela@cafesdelvalle.com", company: "Cafés del Valle", status: "completada", sentAt: "2026-02-05" },
    { id: "inv_cl_004", testId: "test_cl_001", name: "Laura Espinoza", email: "l.espinoza@clinicanorte.com", company: "Clínica Norte", status: "completada", sentAt: "2026-02-10" },
    { id: "inv_cl_005", testId: "test_cl_001", name: "Roberto Chávez", email: "r.chavez@clinicanorte.com", company: "Clínica Norte", status: "pendiente", sentAt: "2026-02-10" },
    { id: "inv_cl_006", testId: "test_cl_002", name: "Marco Reyes", email: "m.reyes@logandes.com", company: "Logística Andes", status: "completada", sentAt: "2026-02-25" },
    { id: "inv_cl_007", testId: "test_cl_002", name: "Isabel Mora", email: "i.mora@cafesdelvalle.com", company: "Cafés del Valle", status: "completada", sentAt: "2026-02-25" },
    { id: "inv_cl_008", testId: "test_cl_002", name: "Beatriz Soto", email: "b.soto@clinicanorte.com", company: "Clínica Norte", status: "pendiente", sentAt: "2026-02-25" },
    { id: "inv_cl_009", testId: "test_cl_003", name: "Andrés Varela", email: "a.varela@cafesdelvalle.com", company: "Cafés del Valle", status: "pendiente", sentAt: "2026-03-10" },
  ];

  const taskActions: TaskActionRow[] = [];

  const consultantNotes: ConsultantNoteRow[] = [
    {
      id: "note_cl_001",
      company: "Logística Andes",
      mode: "clientes",
      content: "Empresa con desafíos importantes en comunicación interna y desarrollo de liderazgo en mandos medios. Los dos evaluadores mostraron puntajes por debajo del promedio en todas las dimensiones. Se recomienda priorizar el Programa de Liderazgo y el Plan de Comunicación Interna como primeras acciones.\n\nPuntos a reforzar en próxima visita:\n- Alinear expectativas con dirección general\n- Revisar canales de comunicación entre áreas\n- Validar disposición del equipo directivo para capacitación",
    },
    {
      id: "note_cl_002",
      company: "Cafés del Valle",
      mode: "clientes",
      content: "Cultura organizacional muy sólida. Andrés Varela (Director General) mostró puntajes sobresalientes en todas las dimensiones. El liderazgo está alineado con los valores de la empresa y existe una comunicación fluida en todos los niveles.\n\nOportunidades de mejora:\n- Continuar con el plan de carrera ya iniciado\n- Mantener el monitoreo trimestral para sostener los indicadores\n- Explorar posibilidad de replicar buenas prácticas a nuevas sucursales",
    },
    {
      id: "note_cl_003",
      company: "Clínica Norte",
      mode: "clientes",
      content: "Resultados mixtos. Laura Espinoza (Coordinadora RRHH) está muy comprometida con el proceso de mejora. Los indicadores de bienestar se encuentran por debajo del promedio del sector salud. Pendiente incorporar a Roberto Chávez en la siguiente ronda de evaluación.\n\nAcciones acordadas:\n- Lanzar programa de bienestar en Q2 2026\n- Reunión de seguimiento el 15/03 con dirección médica\n- Revisar cargas de trabajo del equipo de enfermería",
    },
  ];

  return { tests: [t1, t2, t3, t4], responses, invitations, taskActions, consultantNotes };
}

// ===========================================================================
// TIENDAS seed
// ===========================================================================
export function makeSeedTiendas(): { tests: TestRow[]; responses: ResponseRow[]; invitations: InvitationRow[]; taskActions: TaskActionRow[]; consultantNotes: ConsultantNoteRow[] } {
  const t1: TestRow = {
    id: "test_ti_001",
    mode: "tiendas",
    name: "Auditoría de Estándares Operativos",
    domain: "Operaciones",
    tags: ["operaciones", "estándares"],
    description: "Verificación del cumplimiento de estándares operativos en punto de venta.",
    status: "publicado",
    accent: "#0891b2",
    createdAt: "2026-01-10",
    branding: null,
    topics: [
      {
        id: "ti1_t1",
        name: "Apertura y Cierre",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "ti1_t1_q1",
            text: "¿Se cumple el protocolo de apertura en los tiempos establecidos?",
            options: [
              { id: "ti1_t1_q1_a", label: "Siempre puntual", points: 3, correct: true },
              { id: "ti1_t1_q1_b", label: "Con retrasos menores", points: 2, correct: false },
              { id: "ti1_t1_q1_c", label: "Con retrasos frecuentes", points: 1, correct: false },
              { id: "ti1_t1_q1_d", label: "Sin protocolo definido", points: 0, correct: false },
            ],
          },
          {
            id: "ti1_t1_q2",
            text: "¿El proceso de cierre de caja está completo y cuadra correctamente?",
            options: [
              { id: "ti1_t1_q2_a", label: "Siempre cuadra", points: 3, correct: true },
              { id: "ti1_t1_q2_b", label: "Con diferencias menores", points: 2, correct: false },
              { id: "ti1_t1_q2_c", label: "Frecuentes descuadres", points: 1, correct: false },
              { id: "ti1_t1_q2_d", label: "Sin control de cierre", points: 0, correct: false },
            ],
          },
          {
            id: "ti1_t1_q3",
            text: "¿Las llaves y sistemas de alarma son manejados según el protocolo?",
            options: [
              { id: "ti1_t1_q3_a", label: "Sí, sin excepciones", points: 3, correct: true },
              { id: "ti1_t1_q3_b", label: "Con excepciones menores", points: 2, correct: false },
              { id: "ti1_t1_q3_c", label: "Con excepciones frecuentes", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "ti1_t2",
        name: "Presentación de Producto",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "ti1_t2_q1",
            text: "¿El planograma está implementado correctamente en todas las categorías?",
            options: [
              { id: "ti1_t2_q1_a", label: "100% implementado", points: 3, correct: true },
              { id: "ti1_t2_q1_b", label: "80-99% implementado", points: 2, correct: false },
              { id: "ti1_t2_q1_c", label: "50-79% implementado", points: 1, correct: false },
              { id: "ti1_t2_q1_d", label: "Menos del 50%", points: 0, correct: false },
            ],
          },
          {
            id: "ti1_t2_q2",
            text: "¿Los precios están correctamente etiquetados y visibles para el cliente?",
            options: [
              { id: "ti1_t2_q2_a", label: "Todos los precios visibles", points: 3, correct: true },
              { id: "ti1_t2_q2_b", label: "Algunas etiquetas faltantes", points: 2, correct: false },
              { id: "ti1_t2_q2_c", label: "Muchas etiquetas faltantes", points: 0, correct: false },
            ],
          },
          {
            id: "ti1_t2_q3",
            text: "¿Los displays y exhibidores están en buen estado y limpios?",
            options: [
              { id: "ti1_t2_q3_a", label: "Excelente estado", points: 3, correct: true },
              { id: "ti1_t2_q3_b", label: "Buen estado", points: 2, correct: false },
              { id: "ti1_t2_q3_c", label: "Estado regular", points: 1, correct: false },
              { id: "ti1_t2_q3_d", label: "Mal estado", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "ti1_t3",
        name: "Inventario y Stock",
        scoring: "weighted",
        includeInOverall: true,
        weight: 1,
        questions: [
          {
            id: "ti1_t3_q1",
            text: "¿El inventario físico coincide con el sistema en más del 95%?",
            options: [
              { id: "ti1_t3_q1_a", label: "Sí, alta precisión", points: 3, correct: true },
              { id: "ti1_t3_q1_b", label: "Diferencia menor al 10%", points: 2, correct: false },
              { id: "ti1_t3_q1_c", label: "Diferencia significativa", points: 0, correct: false },
            ],
          },
          {
            id: "ti1_t3_q2",
            text: "¿Los quiebres de stock son reportados y gestionados oportunamente?",
            options: [
              { id: "ti1_t3_q2_a", label: "Siempre en tiempo real", points: 3, correct: true },
              { id: "ti1_t3_q2_b", label: "Con algo de demora", points: 2, correct: false },
              { id: "ti1_t3_q2_c", label: "Sin gestión activa", points: 0, correct: false },
            ],
          },
        ],
      },
    ],
    solutions: [
      {
        id: "ti1_sol1",
        name: "Refuerzo de Protocolo de Apertura/Cierre",
        description: "Revisar y capacitar al equipo en el protocolo de apertura y cierre.",
        category: "Operaciones",
        conditions: [{ scope: "topic", topicId: "ti1_t1", operator: "below", threshold: 70 }],
        logic: "all",
        link: null,
        actions: ["Checklist digital de apertura", "Capacitación a supervisores", "Auditoría semanal"],
      },
      {
        id: "ti1_sol2",
        name: "Plan de Mejora de Exhibición",
        description: "Estandarizar la presentación de productos y cumplimiento del planograma.",
        category: "Merchandising",
        conditions: [{ scope: "topic", topicId: "ti1_t2", operator: "below", threshold: 65 }],
        logic: "all",
        link: null,
        actions: ["Actualizar planograma", "Capacitación en merchandising", "Revisión quincenal"],
      },
    ],
  };

  const t2: TestRow = {
    id: "test_ti_002",
    mode: "tiendas",
    name: "Evaluación de Servicio en Piso",
    domain: "Atención al Cliente",
    tags: ["servicio", "cliente"],
    description: "Auditoría del nivel de servicio y atención al cliente en sala de ventas.",
    status: "publicado",
    accent: "#7c3aed",
    createdAt: "2026-02-01",
    branding: null,
    topics: [
      {
        id: "ti2_t1",
        name: "Bienvenida y Abordaje",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "ti2_t1_q1",
            text: "¿El personal saluda proactivamente a todos los clientes?",
            options: [
              { id: "ti2_t1_q1_a", label: "Siempre, a todos los clientes", points: 3, correct: true },
              { id: "ti2_t1_q1_b", label: "A la mayoría", points: 2, correct: false },
              { id: "ti2_t1_q1_c", label: "Solo a algunos", points: 1, correct: false },
              { id: "ti2_t1_q1_d", label: "Raramente", points: 0, correct: false },
            ],
          },
          {
            id: "ti2_t1_q2",
            text: "¿El tiempo de espera para ser atendido es adecuado?",
            options: [
              { id: "ti2_t1_q2_a", label: "Inmediato (menos de 2 min)", points: 3, correct: true },
              { id: "ti2_t1_q2_b", label: "Aceptable (2-5 min)", points: 2, correct: false },
              { id: "ti2_t1_q2_c", label: "Largo (más de 5 min)", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "ti2_t2",
        name: "Conocimiento de Producto",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "ti2_t2_q1",
            text: "¿El personal puede responder preguntas técnicas sobre los productos?",
            options: [
              { id: "ti2_t2_q1_a", label: "Con seguridad y detalle", points: 3, correct: true },
              { id: "ti2_t2_q1_b", label: "De forma básica", points: 2, correct: false },
              { id: "ti2_t2_q1_c", label: "Con dificultad", points: 1, correct: false },
              { id: "ti2_t2_q1_d", label: "No puede responder", points: 0, correct: false },
            ],
          },
          {
            id: "ti2_t2_q2",
            text: "¿El personal ofrece alternativas o up-selling cuando es apropiado?",
            options: [
              { id: "ti2_t2_q2_a", label: "Siempre de forma natural", points: 3, correct: true },
              { id: "ti2_t2_q2_b", label: "A veces", points: 2, correct: false },
              { id: "ti2_t2_q2_c", label: "Raramente", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "ti2_t3",
        name: "Proceso de Pago",
        scoring: "weighted",
        includeInOverall: true,
        weight: 1,
        questions: [
          {
            id: "ti2_t3_q1",
            text: "¿El proceso de pago es ágil y sin errores?",
            options: [
              { id: "ti2_t3_q1_a", label: "Rápido y sin errores", points: 3, correct: true },
              { id: "ti2_t3_q1_b", label: "Ágil con errores menores", points: 2, correct: false },
              { id: "ti2_t3_q1_c", label: "Lento o con errores frecuentes", points: 0, correct: false },
            ],
          },
        ],
      },
    ],
    solutions: [
      {
        id: "ti2_sol1",
        name: "Capacitación en Técnicas de Venta",
        description: "Entrenar al equipo de ventas en técnicas de abordaje y up-selling.",
        category: "Capacitación",
        conditions: [{ scope: "overall", operator: "below", threshold: 70 }],
        logic: "all",
        link: null,
        actions: ["Taller de ventas consultivas", "Role-playing de atención", "KPIs de servicio"],
      },
    ],
  };

  const t3: TestRow = {
    id: "test_ti_003",
    mode: "tiendas",
    name: "Seguridad e Higiene en Tienda",
    domain: "Seguridad",
    tags: ["seguridad", "higiene"],
    description: "Auditoría de condiciones de seguridad, higiene y cumplimiento normativo.",
    status: "publicado",
    accent: "#dc2626",
    createdAt: "2026-02-15",
    branding: null,
    topics: [
      {
        id: "ti3_t1",
        name: "Limpieza y Orden",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "ti3_t1_q1",
            text: "¿Los pasillos y áreas de tránsito están libres de obstrucciones?",
            options: [
              { id: "ti3_t1_q1_a", label: "Sí, completamente", points: 3, correct: true },
              { id: "ti3_t1_q1_b", label: "Con obstrucciones menores", points: 1, correct: false },
              { id: "ti3_t1_q1_c", label: "Obstrucciones frecuentes", points: 0, correct: false },
            ],
          },
          {
            id: "ti3_t1_q2",
            text: "¿Los baños de clientes están limpios y abastecidos?",
            options: [
              { id: "ti3_t1_q2_a", label: "Siempre limpios y abastecidos", points: 3, correct: true },
              { id: "ti3_t1_q2_b", label: "Generalmente limpios", points: 2, correct: false },
              { id: "ti3_t1_q2_c", label: "Limpios ocasionalmente", points: 1, correct: false },
              { id: "ti3_t1_q2_d", label: "En mal estado", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "ti3_t2",
        name: "Seguridad y Emergencias",
        scoring: "percent",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "ti3_t2_q1",
            text: "¿El personal conoce el plan de evacuación?",
            options: [
              { id: "ti3_t2_q1_a", label: "Sí, todos lo conocen", points: 1, correct: true },
              { id: "ti3_t2_q1_b", label: "Solo algunos", points: 0, correct: false },
            ],
          },
          {
            id: "ti3_t2_q2",
            text: "¿Los extintores están vigentes y en su lugar?",
            options: [
              { id: "ti3_t2_q2_a", label: "Sí, todos vigentes", points: 1, correct: true },
              { id: "ti3_t2_q2_b", label: "Algunos vencidos", points: 0, correct: false },
            ],
          },
          {
            id: "ti3_t2_q3",
            text: "¿Las salidas de emergencia están señalizadas y desbloqueadas?",
            options: [
              { id: "ti3_t2_q3_a", label: "Sí, todas", points: 1, correct: true },
              { id: "ti3_t2_q3_b", label: "Algunas bloqueadas o sin señal", points: 0, correct: false },
            ],
          },
        ],
      },
    ],
    solutions: [
      {
        id: "ti3_sol1",
        name: "Plan de Mantenimiento e Higiene",
        description: "Establecer rutinas de limpieza y mantenimiento preventivo.",
        category: "Operaciones",
        conditions: [{ scope: "topic", topicId: "ti3_t1", operator: "below", threshold: 70 }],
        logic: "all",
        link: null,
        actions: ["Checklist de limpieza por turnos", "Contrato de aseo externo", "Supervisión diaria"],
      },
    ],
  };

  const t4: TestRow = {
    id: "test_ti_004",
    mode: "tiendas",
    name: "Clima del Equipo de Tienda",
    domain: "Recursos Humanos",
    tags: ["equipo", "clima"],
    description: "Borrador para evaluar el clima y compromiso del equipo en sucursal.",
    status: "borrador",
    accent: "#1f8a5b",
    createdAt: "2026-04-01",
    branding: null,
    topics: [
      {
        id: "ti4_t1",
        name: "Satisfacción del Equipo",
        scoring: "weighted",
        includeInOverall: true,
        weight: 1,
        questions: [
          {
            id: "ti4_t1_q1",
            text: "¿Cómo describiría el ambiente de trabajo en su sucursal?",
            options: [
              { id: "ti4_t1_q1_a", label: "Excelente", points: 3, correct: true },
              { id: "ti4_t1_q1_b", label: "Bueno", points: 2, correct: false },
              { id: "ti4_t1_q1_c", label: "Regular", points: 1, correct: false },
              { id: "ti4_t1_q1_d", label: "Malo", points: 0, correct: false },
            ],
          },
        ],
      },
    ],
    solutions: [],
  };

  const responses: ResponseRow[] = [
    // Sucursal Centro
    {
      id: "resp_ti_001",
      testId: "test_ti_001",
      respondent: "Patricia Núñez",
      company: "Sucursal Centro",
      email: "p.nunez@retail.com",
      role: "Supervisora de Tienda",
      submittedAt: "2026-02-05T08:30:00.000Z",
      answers: {
        ti1_t1_q1: "ti1_t1_q1_a", ti1_t1_q2: "ti1_t1_q2_a", ti1_t1_q3: "ti1_t1_q3_a",
        ti1_t2_q1: "ti1_t2_q1_b", ti1_t2_q2: "ti1_t2_q2_a", ti1_t2_q3: "ti1_t2_q3_b",
        ti1_t3_q1: "ti1_t3_q1_a", ti1_t3_q2: "ti1_t3_q2_a",
      },
    },
    // Sucursal Norte
    {
      id: "resp_ti_002",
      testId: "test_ti_001",
      respondent: "Rodrigo Fuentes",
      company: "Sucursal Norte",
      email: "r.fuentes@retail.com",
      role: "Gerente de Sucursal",
      submittedAt: "2026-02-06T09:00:00.000Z",
      answers: {
        ti1_t1_q1: "ti1_t1_q1_b", ti1_t1_q2: "ti1_t1_q2_b", ti1_t1_q3: "ti1_t1_q3_b",
        ti1_t2_q1: "ti1_t2_q1_c", ti1_t2_q2: "ti1_t2_q2_b", ti1_t2_q3: "ti1_t2_q3_c",
        ti1_t3_q1: "ti1_t3_q1_b", ti1_t3_q2: "ti1_t3_q2_b",
      },
    },
    // Sucursal Sur
    {
      id: "resp_ti_003",
      testId: "test_ti_001",
      respondent: "Camila Rojas",
      company: "Sucursal Sur",
      email: "c.rojas@retail.com",
      role: "Supervisora de Tienda",
      submittedAt: "2026-02-07T10:00:00.000Z",
      answers: {
        ti1_t1_q1: "ti1_t1_q1_c", ti1_t1_q2: "ti1_t1_q2_c", ti1_t1_q3: "ti1_t1_q3_c",
        ti1_t2_q1: "ti1_t2_q1_d", ti1_t2_q2: "ti1_t2_q2_c", ti1_t2_q3: "ti1_t2_q3_d",
        ti1_t3_q1: "ti1_t3_q1_c", ti1_t3_q2: "ti1_t3_q2_c",
      },
    },
    // Sucursal Oriente
    {
      id: "resp_ti_004",
      testId: "test_ti_001",
      respondent: "Diego Castillo",
      company: "Sucursal Oriente",
      email: "d.castillo@retail.com",
      role: "Gerente de Sucursal",
      submittedAt: "2026-02-08T11:00:00.000Z",
      answers: {
        ti1_t1_q1: "ti1_t1_q1_a", ti1_t1_q2: "ti1_t1_q2_a", ti1_t1_q3: "ti1_t1_q3_a",
        ti1_t2_q1: "ti1_t2_q1_a", ti1_t2_q2: "ti1_t2_q2_a", ti1_t2_q3: "ti1_t2_q3_a",
        ti1_t3_q1: "ti1_t3_q1_a", ti1_t3_q2: "ti1_t3_q2_a",
      },
    },
    // Servicio en Piso responses
    {
      id: "resp_ti_005",
      testId: "test_ti_002",
      respondent: "Ana López",
      company: "Sucursal Centro",
      email: "a.lopez@retail.com",
      role: "Auditora",
      submittedAt: "2026-03-01T09:00:00.000Z",
      answers: {
        ti2_t1_q1: "ti2_t1_q1_b", ti2_t1_q2: "ti2_t1_q2_b",
        ti2_t2_q1: "ti2_t2_q1_b", ti2_t2_q2: "ti2_t2_q2_b",
        ti2_t3_q1: "ti2_t3_q1_b",
      },
    },
    {
      id: "resp_ti_006",
      testId: "test_ti_002",
      respondent: "Ana López",
      company: "Sucursal Norte",
      email: "a.lopez@retail.com",
      role: "Auditora",
      submittedAt: "2026-03-02T09:00:00.000Z",
      answers: {
        ti2_t1_q1: "ti2_t1_q1_c", ti2_t1_q2: "ti2_t1_q2_c",
        ti2_t2_q1: "ti2_t2_q1_c", ti2_t2_q2: "ti2_t2_q2_c",
        ti2_t3_q1: "ti2_t3_q1_c",
      },
    },
    {
      id: "resp_ti_007",
      testId: "test_ti_002",
      respondent: "Ana López",
      company: "Sucursal Sur",
      email: "a.lopez@retail.com",
      role: "Auditora",
      submittedAt: "2026-03-03T09:00:00.000Z",
      answers: {
        ti2_t1_q1: "ti2_t1_q1_a", ti2_t1_q2: "ti2_t1_q2_a",
        ti2_t2_q1: "ti2_t2_q1_a", ti2_t2_q2: "ti2_t2_q2_a",
        ti2_t3_q1: "ti2_t3_q1_a",
      },
    },
    {
      id: "resp_ti_008",
      testId: "test_ti_002",
      respondent: "Ana López",
      company: "Sucursal Oriente",
      email: "a.lopez@retail.com",
      role: "Auditora",
      submittedAt: "2026-03-04T09:00:00.000Z",
      answers: {
        ti2_t1_q1: "ti2_t1_q1_b", ti2_t1_q2: "ti2_t1_q2_a",
        ti2_t2_q1: "ti2_t2_q1_b", ti2_t2_q2: "ti2_t2_q2_a",
        ti2_t3_q1: "ti2_t3_q1_a",
      },
    },
    // Seguridad e Higiene
    {
      id: "resp_ti_009",
      testId: "test_ti_003",
      respondent: "Luis Herrera",
      company: "Sucursal Centro",
      email: "l.herrera@retail.com",
      role: "Inspector",
      submittedAt: "2026-03-10T08:00:00.000Z",
      answers: {
        ti3_t1_q1: "ti3_t1_q1_a", ti3_t1_q2: "ti3_t1_q2_a",
        ti3_t2_q1: "ti3_t2_q1_a", ti3_t2_q2: "ti3_t2_q2_a", ti3_t2_q3: "ti3_t2_q3_a",
      },
    },
    {
      id: "resp_ti_010",
      testId: "test_ti_003",
      respondent: "Luis Herrera",
      company: "Sucursal Sur",
      email: "l.herrera@retail.com",
      role: "Inspector",
      submittedAt: "2026-03-11T08:00:00.000Z",
      answers: {
        ti3_t1_q1: "ti3_t1_q1_b", ti3_t1_q2: "ti3_t1_q2_c",
        ti3_t2_q1: "ti3_t2_q1_b", ti3_t2_q2: "ti3_t2_q2_b", ti3_t2_q3: "ti3_t2_q3_b",
      },
    },
  ];

  const invitations: InvitationRow[] = [
    { id: "inv_ti_001", testId: "test_ti_001", name: "Patricia Núñez", email: "p.nunez@retail.com", company: "Sucursal Centro", status: "completada", sentAt: "2026-02-01" },
    { id: "inv_ti_002", testId: "test_ti_001", name: "Rodrigo Fuentes", email: "r.fuentes@retail.com", company: "Sucursal Norte", status: "completada", sentAt: "2026-02-01" },
    { id: "inv_ti_003", testId: "test_ti_001", name: "Camila Rojas", email: "c.rojas@retail.com", company: "Sucursal Sur", status: "completada", sentAt: "2026-02-01" },
    { id: "inv_ti_004", testId: "test_ti_001", name: "Diego Castillo", email: "d.castillo@retail.com", company: "Sucursal Oriente", status: "completada", sentAt: "2026-02-01" },
    { id: "inv_ti_005", testId: "test_ti_002", name: "Ana López", email: "a.lopez@retail.com", company: "Sucursal Centro", status: "completada", sentAt: "2026-02-28" },
    { id: "inv_ti_006", testId: "test_ti_002", name: "Ana López", email: "a.lopez@retail.com", company: "Sucursal Norte", status: "completada", sentAt: "2026-02-28" },
    { id: "inv_ti_007", testId: "test_ti_002", name: "Ana López", email: "a.lopez@retail.com", company: "Sucursal Sur", status: "completada", sentAt: "2026-02-28" },
    { id: "inv_ti_008", testId: "test_ti_002", name: "Ana López", email: "a.lopez@retail.com", company: "Sucursal Oriente", status: "completada", sentAt: "2026-02-28" },
    { id: "inv_ti_009", testId: "test_ti_003", name: "Luis Herrera", email: "l.herrera@retail.com", company: "Sucursal Centro", status: "completada", sentAt: "2026-03-08" },
    { id: "inv_ti_010", testId: "test_ti_003", name: "Luis Herrera", email: "l.herrera@retail.com", company: "Sucursal Sur", status: "completada", sentAt: "2026-03-08" },
    { id: "inv_ti_011", testId: "test_ti_003", name: "Luis Herrera", email: "l.herrera@retail.com", company: "Sucursal Norte", status: "pendiente", sentAt: "2026-03-08" },
  ];

  const taskActions: TaskActionRow[] = [
    { id: "ta_ti_001", testId: "test_ti_001", solutionId: "ti1_sol2", entityName: "Sucursal Norte", status: "en_curso", assignee: "R. Fuentes" },
    { id: "ta_ti_002", testId: "test_ti_001", solutionId: "ti1_sol1", entityName: "Sucursal Sur", status: "pendiente", assignee: null },
    { id: "ta_ti_003", testId: "test_ti_001", solutionId: "ti1_sol2", entityName: "Sucursal Sur", status: "pendiente", assignee: null },
    { id: "ta_ti_004", testId: "test_ti_002", solutionId: "ti2_sol1", entityName: "Sucursal Centro", status: "hecho", assignee: "A. López" },
    { id: "ta_ti_005", testId: "test_ti_002", solutionId: "ti2_sol1", entityName: "Sucursal Norte", status: "en_curso", assignee: "A. López" },
    { id: "ta_ti_006", testId: "test_ti_003", solutionId: "ti3_sol1", entityName: "Sucursal Sur", status: "pendiente", assignee: null },
  ];

  const consultantNotes: ConsultantNoteRow[] = [];

  return { tests: [t1, t2, t3, t4], responses, invitations, taskActions, consultantNotes };
}

// ===========================================================================
// EMPLEADOS seed
// ===========================================================================
export function makeSeedEmpleados(): { tests: TestRow[]; responses: ResponseRow[]; invitations: InvitationRow[]; taskActions: TaskActionRow[]; consultantNotes: ConsultantNoteRow[] } {
  const t1: TestRow = {
    id: "test_em_001",
    mode: "empleados",
    name: "Evaluación de Desempeño Anual",
    domain: "Gestión del Talento",
    tags: ["desempeño", "anual"],
    description: "Evaluación integral del desempeño y cumplimiento de objetivos del período.",
    status: "publicado",
    accent: "#1f8a5b",
    createdAt: "2026-01-05",
    branding: null,
    topics: [
      {
        id: "em1_t1",
        name: "Cumplimiento de Objetivos",
        scoring: "weighted",
        includeInOverall: true,
        weight: 3,
        questions: [
          {
            id: "em1_t1_q1",
            text: "¿Cuál fue el nivel de cumplimiento de los objetivos asignados este período?",
            options: [
              { id: "em1_t1_q1_a", label: "Superó todos los objetivos", points: 4, correct: true },
              { id: "em1_t1_q1_b", label: "Cumplió todos los objetivos", points: 3, correct: false },
              { id: "em1_t1_q1_c", label: "Cumplió la mayoría", points: 2, correct: false },
              { id: "em1_t1_q1_d", label: "Cumplió parcialmente", points: 1, correct: false },
              { id: "em1_t1_q1_e", label: "No cumplió los objetivos", points: 0, correct: false },
            ],
          },
          {
            id: "em1_t1_q2",
            text: "¿Con qué calidad entregó su trabajo durante el período?",
            options: [
              { id: "em1_t1_q2_a", label: "Calidad excepcional", points: 4, correct: true },
              { id: "em1_t1_q2_b", label: "Alta calidad", points: 3, correct: false },
              { id: "em1_t1_q2_c", label: "Calidad aceptable", points: 2, correct: false },
              { id: "em1_t1_q2_d", label: "Calidad por debajo del estándar", points: 0, correct: false },
            ],
          },
          {
            id: "em1_t1_q3",
            text: "¿Cuán eficiente fue en el manejo del tiempo y prioridades?",
            options: [
              { id: "em1_t1_q3_a", label: "Excelente gestión del tiempo", points: 4, correct: true },
              { id: "em1_t1_q3_b", label: "Buena gestión", points: 3, correct: false },
              { id: "em1_t1_q3_c", label: "Gestión regular", points: 2, correct: false },
              { id: "em1_t1_q3_d", label: "Dificultades con el tiempo", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "em1_t2",
        name: "Trabajo en Equipo",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "em1_t2_q1",
            text: "¿Cómo es la colaboración con sus compañeros de equipo?",
            options: [
              { id: "em1_t2_q1_a", label: "Referente de colaboración", points: 4, correct: true },
              { id: "em1_t2_q1_b", label: "Muy colaborativo", points: 3, correct: false },
              { id: "em1_t2_q1_c", label: "Colaborativo cuando se requiere", points: 2, correct: false },
              { id: "em1_t2_q1_d", label: "Poco colaborativo", points: 0, correct: false },
            ],
          },
          {
            id: "em1_t2_q2",
            text: "¿Cómo maneja los conflictos dentro del equipo?",
            options: [
              { id: "em1_t2_q2_a", label: "Resuelve conflictos proactivamente", points: 4, correct: true },
              { id: "em1_t2_q2_b", label: "Los resuelve cuando surgen", points: 3, correct: false },
              { id: "em1_t2_q2_c", label: "Evita los conflictos", points: 2, correct: false },
              { id: "em1_t2_q2_d", label: "Genera o intensifica conflictos", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "em1_t3",
        name: "Iniciativa e Innovación",
        scoring: "weighted",
        includeInOverall: true,
        weight: 1,
        questions: [
          {
            id: "em1_t3_q1",
            text: "¿Propone mejoras o nuevas ideas para el área?",
            options: [
              { id: "em1_t3_q1_a", label: "Constantemente, con impacto real", points: 4, correct: true },
              { id: "em1_t3_q1_b", label: "Frecuentemente", points: 3, correct: false },
              { id: "em1_t3_q1_c", label: "Ocasionalmente", points: 2, correct: false },
              { id: "em1_t3_q1_d", label: "Rara vez", points: 0, correct: false },
            ],
          },
          {
            id: "em1_t3_q2",
            text: "¿Toma la iniciativa ante problemas sin esperar instrucciones?",
            options: [
              { id: "em1_t3_q2_a", label: "Siempre, de forma proactiva", points: 4, correct: true },
              { id: "em1_t3_q2_b", label: "Frecuentemente", points: 3, correct: false },
              { id: "em1_t3_q2_c", label: "Solo cuando es necesario", points: 2, correct: false },
              { id: "em1_t3_q2_d", label: "Espera siempre instrucciones", points: 0, correct: false },
            ],
          },
        ],
      },
    ],
    solutions: [
      {
        id: "em1_sol1",
        name: "Plan de Mejora de Desempeño",
        description: "Establecer un plan de mejora individual con objetivos SMART.",
        category: "Desempeño",
        conditions: [{ scope: "topic", topicId: "em1_t1", operator: "below", threshold: 65 }],
        logic: "all",
        link: null,
        actions: ["Reunión 1:1 de feedback", "Plan de objetivos SMART", "Revisión mensual de avance"],
      },
      {
        id: "em1_sol2",
        name: "Capacitación en Trabajo en Equipo",
        description: "Taller de habilidades interpersonales y trabajo colaborativo.",
        category: "Desarrollo",
        conditions: [{ scope: "topic", topicId: "em1_t2", operator: "below", threshold: 60 }],
        logic: "all",
        link: null,
        actions: ["Taller de comunicación asertiva", "Dinámicas de equipo", "Retroalimentación 360°"],
      },
    ],
  };

  const t2: TestRow = {
    id: "test_em_002",
    mode: "empleados",
    name: "Evaluación por Competencias",
    domain: "Desarrollo Organizacional",
    tags: ["competencias", "habilidades"],
    description: "Medición de competencias clave según el modelo de la organización.",
    status: "publicado",
    accent: "#7c3aed",
    createdAt: "2026-01-20",
    branding: null,
    topics: [
      {
        id: "em2_t1",
        name: "Orientación al Cliente",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "em2_t1_q1",
            text: "¿Cómo responde el empleado a las necesidades de clientes internos/externos?",
            options: [
              { id: "em2_t1_q1_a", label: "Supera expectativas consistentemente", points: 4, correct: true },
              { id: "em2_t1_q1_b", label: "Cumple las expectativas", points: 3, correct: false },
              { id: "em2_t1_q1_c", label: "Cumple parcialmente", points: 2, correct: false },
              { id: "em2_t1_q1_d", label: "No cumple las expectativas", points: 0, correct: false },
            ],
          },
          {
            id: "em2_t1_q2",
            text: "¿Gestiona con eficacia las quejas y problemas del cliente?",
            options: [
              { id: "em2_t1_q2_a", label: "Resuelve con excelencia", points: 4, correct: true },
              { id: "em2_t1_q2_b", label: "Resuelve adecuadamente", points: 3, correct: false },
              { id: "em2_t1_q2_c", label: "Resuelve con dificultad", points: 1, correct: false },
              { id: "em2_t1_q2_d", label: "No resuelve bien", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "em2_t2",
        name: "Pensamiento Analítico",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "em2_t2_q1",
            text: "¿El empleado analiza situaciones complejas de forma estructurada?",
            options: [
              { id: "em2_t2_q1_a", label: "Análisis muy profundo y estructurado", points: 4, correct: true },
              { id: "em2_t2_q1_b", label: "Análisis adecuado", points: 3, correct: false },
              { id: "em2_t2_q1_c", label: "Análisis superficial", points: 1, correct: false },
              { id: "em2_t2_q1_d", label: "No analiza antes de actuar", points: 0, correct: false },
            ],
          },
          {
            id: "em2_t2_q2",
            text: "¿Toma decisiones basadas en datos y evidencia?",
            options: [
              { id: "em2_t2_q2_a", label: "Siempre, con rigor", points: 4, correct: true },
              { id: "em2_t2_q2_b", label: "Frecuentemente", points: 3, correct: false },
              { id: "em2_t2_q2_c", label: "A veces", points: 2, correct: false },
              { id: "em2_t2_q2_d", label: "Decisiones más intuitivas", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "em2_t3",
        name: "Adaptabilidad",
        scoring: "weighted",
        includeInOverall: true,
        weight: 1,
        questions: [
          {
            id: "em2_t3_q1",
            text: "¿Cómo reacciona ante cambios inesperados en el trabajo?",
            options: [
              { id: "em2_t3_q1_a", label: "Se adapta y lidera el cambio", points: 4, correct: true },
              { id: "em2_t3_q1_b", label: "Se adapta bien", points: 3, correct: false },
              { id: "em2_t3_q1_c", label: "Le cuesta adaptarse", points: 1, correct: false },
              { id: "em2_t3_q1_d", label: "Rechaza o evita el cambio", points: 0, correct: false },
            ],
          },
        ],
      },
    ],
    solutions: [
      {
        id: "em2_sol1",
        name: "Plan de Desarrollo de Competencias",
        description: "Plan personalizado para desarrollar competencias prioritarias.",
        category: "Desarrollo",
        conditions: [{ scope: "overall", operator: "below", threshold: 65 }],
        logic: "all",
        link: null,
        actions: ["Mapa de brechas individual", "Asignación de mentor", "Plan de capacitación trimestral"],
      },
    ],
  };

  const t3: TestRow = {
    id: "test_em_003",
    mode: "empleados",
    name: "Evaluación 360°",
    domain: "Feedback Integral",
    tags: ["360", "feedback"],
    description: "Evaluación de retroalimentación completa desde pares, subordinados y superiores.",
    status: "publicado",
    accent: "#b07d18",
    createdAt: "2026-02-01",
    branding: null,
    topics: [
      {
        id: "em3_t1",
        name: "Comunicación",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "em3_t1_q1",
            text: "¿Comunica sus ideas de manera clara y efectiva?",
            options: [
              { id: "em3_t1_q1_a", label: "Siempre, con mucha claridad", points: 4, correct: true },
              { id: "em3_t1_q1_b", label: "Generalmente claro", points: 3, correct: false },
              { id: "em3_t1_q1_c", label: "A veces confuso", points: 1, correct: false },
              { id: "em3_t1_q1_d", label: "Comunicación deficiente", points: 0, correct: false },
            ],
          },
          {
            id: "em3_t1_q2",
            text: "¿Escucha activamente y toma en cuenta las opiniones del equipo?",
            options: [
              { id: "em3_t1_q2_a", label: "Excelente escucha activa", points: 4, correct: true },
              { id: "em3_t1_q2_b", label: "Buena escucha", points: 3, correct: false },
              { id: "em3_t1_q2_c", label: "Escucha parcial", points: 1, correct: false },
              { id: "em3_t1_q2_d", label: "No escucha al equipo", points: 0, correct: false },
            ],
          },
        ],
      },
      {
        id: "em3_t2",
        name: "Impacto en el Equipo",
        scoring: "weighted",
        includeInOverall: true,
        weight: 2,
        questions: [
          {
            id: "em3_t2_q1",
            text: "¿Su presencia tiene un impacto positivo en el equipo?",
            options: [
              { id: "em3_t2_q1_a", label: "Gran impacto positivo", points: 4, correct: true },
              { id: "em3_t2_q1_b", label: "Impacto positivo", points: 3, correct: false },
              { id: "em3_t2_q1_c", label: "Impacto neutro", points: 2, correct: false },
              { id: "em3_t2_q1_d", label: "Impacto negativo", points: 0, correct: false },
            ],
          },
        ],
      },
    ],
    solutions: [
      {
        id: "em3_sol1",
        name: "Taller de Comunicación Efectiva",
        description: "Capacitación en comunicación verbal, escrita y no verbal.",
        category: "Comunicación",
        conditions: [{ scope: "topic", topicId: "em3_t1", operator: "below", threshold: 65 }],
        logic: "all",
        link: null,
        actions: ["Taller de comunicación asertiva", "Presentaciones en equipo", "Feedback semanal"],
      },
    ],
  };

  const t4: TestRow = {
    id: "test_em_004",
    mode: "empleados",
    name: "Diagnóstico de Capacitación",
    domain: "Aprendizaje y Desarrollo",
    tags: ["capacitación", "aprendizaje"],
    description: "Borrador para identificar necesidades de capacitación del equipo.",
    status: "borrador",
    accent: "#0891b2",
    createdAt: "2026-04-01",
    branding: null,
    topics: [
      {
        id: "em4_t1",
        name: "Necesidades Detectadas",
        scoring: "weighted",
        includeInOverall: true,
        weight: 1,
        questions: [
          {
            id: "em4_t1_q1",
            text: "¿En qué área necesita más capacitación?",
            options: [
              { id: "em4_t1_q1_a", label: "Habilidades técnicas", points: 1, correct: false },
              { id: "em4_t1_q1_b", label: "Habilidades blandas", points: 1, correct: false },
              { id: "em4_t1_q1_c", label: "Liderazgo y gestión", points: 1, correct: false },
              { id: "em4_t1_q1_d", label: "Herramientas digitales", points: 1, correct: false },
            ],
          },
        ],
      },
    ],
    solutions: [],
  };

  const responses: ResponseRow[] = [
    // Evaluaciones de Desempeño — distintos empleados
    {
      id: "resp_em_001",
      testId: "test_em_001",
      respondent: "Ana García",
      company: "Departamento de Ventas",
      email: "a.garcia@empresa.com",
      role: "Evaluador: Jefa Directa",
      submittedAt: "2026-01-20T10:00:00.000Z",
      answers: {
        em1_t1_q1: "em1_t1_q1_b", em1_t1_q2: "em1_t1_q2_b", em1_t1_q3: "em1_t1_q3_b",
        em1_t2_q1: "em1_t2_q1_b", em1_t2_q2: "em1_t2_q2_b",
        em1_t3_q1: "em1_t3_q1_b", em1_t3_q2: "em1_t3_q2_b",
      },
    },
    {
      id: "resp_em_002",
      testId: "test_em_001",
      respondent: "Jorge Rivas",
      company: "Departamento de Operaciones",
      email: "j.rivas@empresa.com",
      role: "Evaluador: Par",
      submittedAt: "2026-01-21T11:00:00.000Z",
      answers: {
        em1_t1_q1: "em1_t1_q1_c", em1_t1_q2: "em1_t1_q2_c", em1_t1_q3: "em1_t1_q3_c",
        em1_t2_q1: "em1_t2_q1_c", em1_t2_q2: "em1_t2_q2_c",
        em1_t3_q1: "em1_t3_q1_c", em1_t3_q2: "em1_t3_q2_c",
      },
    },
    {
      id: "resp_em_003",
      testId: "test_em_001",
      respondent: "María Fernández",
      company: "Departamento de Marketing",
      email: "m.fernandez@empresa.com",
      role: "Evaluador: Jefe Directo",
      submittedAt: "2026-01-22T09:00:00.000Z",
      answers: {
        em1_t1_q1: "em1_t1_q1_a", em1_t1_q2: "em1_t1_q2_a", em1_t1_q3: "em1_t1_q3_a",
        em1_t2_q1: "em1_t2_q1_a", em1_t2_q2: "em1_t2_q2_a",
        em1_t3_q1: "em1_t3_q1_a", em1_t3_q2: "em1_t3_q2_a",
      },
    },
    {
      id: "resp_em_004",
      testId: "test_em_001",
      respondent: "Pedro Gutiérrez",
      company: "Departamento de Tecnología",
      email: "p.gutierrez@empresa.com",
      role: "Evaluador: Subordinado",
      submittedAt: "2026-01-23T14:00:00.000Z",
      answers: {
        em1_t1_q1: "em1_t1_q1_d", em1_t1_q2: "em1_t1_q2_d", em1_t1_q3: "em1_t1_q3_d",
        em1_t2_q1: "em1_t2_q1_d", em1_t2_q2: "em1_t2_q2_d",
        em1_t3_q1: "em1_t3_q1_d", em1_t3_q2: "em1_t3_q2_d",
      },
    },
    // Evaluación por Competencias
    {
      id: "resp_em_005",
      testId: "test_em_002",
      respondent: "Ana García",
      company: "Departamento de Ventas",
      email: "a.garcia@empresa.com",
      role: "Autoevaluación",
      submittedAt: "2026-02-05T10:00:00.000Z",
      answers: {
        em2_t1_q1: "em2_t1_q1_b", em2_t1_q2: "em2_t1_q2_b",
        em2_t2_q1: "em2_t2_q1_b", em2_t2_q2: "em2_t2_q2_b",
        em2_t3_q1: "em2_t3_q1_b",
      },
    },
    {
      id: "resp_em_006",
      testId: "test_em_002",
      respondent: "Jorge Rivas",
      company: "Departamento de Operaciones",
      email: "j.rivas@empresa.com",
      role: "Autoevaluación",
      submittedAt: "2026-02-06T11:00:00.000Z",
      answers: {
        em2_t1_q1: "em2_t1_q1_c", em2_t1_q2: "em2_t1_q2_c",
        em2_t2_q1: "em2_t2_q1_c", em2_t2_q2: "em2_t2_q2_c",
        em2_t3_q1: "em2_t3_q1_c",
      },
    },
    {
      id: "resp_em_007",
      testId: "test_em_002",
      respondent: "María Fernández",
      company: "Departamento de Marketing",
      email: "m.fernandez@empresa.com",
      role: "Autoevaluación",
      submittedAt: "2026-02-07T09:00:00.000Z",
      answers: {
        em2_t1_q1: "em2_t1_q1_a", em2_t1_q2: "em2_t1_q2_a",
        em2_t2_q1: "em2_t2_q1_a", em2_t2_q2: "em2_t2_q2_a",
        em2_t3_q1: "em2_t3_q1_a",
      },
    },
    // Evaluación 360°
    {
      id: "resp_em_008",
      testId: "test_em_003",
      respondent: "Carlos Moreno",
      company: "Departamento de Finanzas",
      email: "c.moreno@empresa.com",
      role: "Evaluador: Par",
      submittedAt: "2026-02-15T10:00:00.000Z",
      answers: {
        em3_t1_q1: "em3_t1_q1_b", em3_t1_q2: "em3_t1_q2_b",
        em3_t2_q1: "em3_t2_q1_b",
      },
    },
    {
      id: "resp_em_009",
      testId: "test_em_003",
      respondent: "Ana García",
      company: "Departamento de Ventas",
      email: "a.garcia@empresa.com",
      role: "Evaluador: Par",
      submittedAt: "2026-02-16T11:00:00.000Z",
      answers: {
        em3_t1_q1: "em3_t1_q1_a", em3_t1_q2: "em3_t1_q2_a",
        em3_t2_q1: "em3_t2_q1_a",
      },
    },
    {
      id: "resp_em_010",
      testId: "test_em_003",
      respondent: "Jorge Rivas",
      company: "Departamento de Operaciones",
      email: "j.rivas@empresa.com",
      role: "Evaluador: Subordinado",
      submittedAt: "2026-02-17T09:00:00.000Z",
      answers: {
        em3_t1_q1: "em3_t1_q1_c", em3_t1_q2: "em3_t1_q2_c",
        em3_t2_q1: "em3_t2_q1_c",
      },
    },
    {
      id: "resp_em_011",
      testId: "test_em_003",
      respondent: "Pedro Gutiérrez",
      company: "Departamento de Tecnología",
      email: "p.gutierrez@empresa.com",
      role: "Evaluador: Jefe Directo",
      submittedAt: "2026-02-18T14:00:00.000Z",
      answers: {
        em3_t1_q1: "em3_t1_q1_d", em3_t1_q2: "em3_t1_q2_d",
        em3_t2_q1: "em3_t2_q1_d",
      },
    },
  ];

  const invitations: InvitationRow[] = [
    { id: "inv_em_001", testId: "test_em_001", name: "Ana García", email: "a.garcia@empresa.com", company: "Departamento de Ventas", status: "completada", sentAt: "2026-01-15" },
    { id: "inv_em_002", testId: "test_em_001", name: "Jorge Rivas", email: "j.rivas@empresa.com", company: "Departamento de Operaciones", status: "completada", sentAt: "2026-01-15" },
    { id: "inv_em_003", testId: "test_em_001", name: "María Fernández", email: "m.fernandez@empresa.com", company: "Departamento de Marketing", status: "completada", sentAt: "2026-01-15" },
    { id: "inv_em_004", testId: "test_em_001", name: "Pedro Gutiérrez", email: "p.gutierrez@empresa.com", company: "Departamento de Tecnología", status: "completada", sentAt: "2026-01-15" },
    { id: "inv_em_005", testId: "test_em_001", name: "Lucía Vargas", email: "l.vargas@empresa.com", company: "Departamento de RRHH", status: "pendiente", sentAt: "2026-01-15" },
    { id: "inv_em_006", testId: "test_em_002", name: "Ana García", email: "a.garcia@empresa.com", company: "Departamento de Ventas", status: "completada", sentAt: "2026-01-30" },
    { id: "inv_em_007", testId: "test_em_002", name: "Jorge Rivas", email: "j.rivas@empresa.com", company: "Departamento de Operaciones", status: "completada", sentAt: "2026-01-30" },
    { id: "inv_em_008", testId: "test_em_002", name: "María Fernández", email: "m.fernandez@empresa.com", company: "Departamento de Marketing", status: "completada", sentAt: "2026-01-30" },
    { id: "inv_em_009", testId: "test_em_003", name: "Carlos Moreno", email: "c.moreno@empresa.com", company: "Departamento de Finanzas", status: "completada", sentAt: "2026-02-10" },
    { id: "inv_em_010", testId: "test_em_003", name: "Ana García", email: "a.garcia@empresa.com", company: "Departamento de Ventas", status: "completada", sentAt: "2026-02-10" },
    { id: "inv_em_011", testId: "test_em_003", name: "Jorge Rivas", email: "j.rivas@empresa.com", company: "Departamento de Operaciones", status: "completada", sentAt: "2026-02-10" },
    { id: "inv_em_012", testId: "test_em_003", name: "Pedro Gutiérrez", email: "p.gutierrez@empresa.com", company: "Departamento de Tecnología", status: "completada", sentAt: "2026-02-10" },
  ];

  const taskActions: TaskActionRow[] = [
    { id: "ta_em_001", testId: "test_em_001", solutionId: "em1_sol1", entityName: "Departamento de Operaciones", status: "en_curso", assignee: "RRHH" },
    { id: "ta_em_002", testId: "test_em_001", solutionId: "em1_sol1", entityName: "Departamento de Tecnología", status: "pendiente", assignee: null },
    { id: "ta_em_003", testId: "test_em_001", solutionId: "em1_sol2", entityName: "Departamento de Tecnología", status: "pendiente", assignee: null },
    { id: "ta_em_004", testId: "test_em_002", solutionId: "em2_sol1", entityName: "Departamento de Operaciones", status: "en_curso", assignee: "RRHH" },
    { id: "ta_em_005", testId: "test_em_003", solutionId: "em3_sol1", entityName: "Departamento de Finanzas", status: "pendiente", assignee: null },
    { id: "ta_em_006", testId: "test_em_003", solutionId: "em3_sol1", entityName: "Departamento de Tecnología", status: "pendiente", assignee: null },
  ];

  const consultantNotes: ConsultantNoteRow[] = [];

  return { tests: [t1, t2, t3, t4], responses, invitations, taskActions, consultantNotes };
}

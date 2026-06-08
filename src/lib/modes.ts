export type ModeId = "clientes" | "tiendas" | "empleados";

export type ModeConfig = {
  id: ModeId;
  label: string;
  menuTitle: string;
  menuSub: string;
  icon: string;
  plural: string;
  singular: string;
  groupTitle: string;
  groupNoun: string;
  groupNounCap: string;
  groupNounPlural: string;
  emptyTitle: string;
  emptyClients: string;
  clientsDesc: string;
  person: string;
  personPlural: string;
};

export const MODE_CONFIG: Record<ModeId, ModeConfig> = {
  clientes: {
    id: "clientes",
    label: "Clientes",
    menuTitle: "Consultoría · Clientes",
    menuSub: "Evaluaciones a organizaciones externas",
    icon: "building",
    plural: "Clientes",
    singular: "Cliente",
    groupTitle: "Organizaciones",
    groupNoun: "empresa",
    groupNounCap: "Empresa",
    groupNounPlural: "Empresas",
    emptyTitle: "Aún no hay clientes",
    emptyClients: "Cuando lleguen respuestas con empresa, aparecerán aquí agrupadas.",
    clientsDesc: "Cada cliente agrupa sus respuestas en todos los cuestionarios. Ordenados por puntaje — los más bajos primero.",
    person: "Persona",
    personPlural: "Personas",
  },
  tiendas: {
    id: "tiendas",
    label: "Tiendas",
    menuTitle: "Retail · Tiendas y Departamentos",
    menuSub: "Auditorías internas a tiendas y departamentos",
    icon: "store",
    plural: "Tiendas",
    singular: "Tienda",
    groupTitle: "Tiendas y departamentos",
    groupNoun: "tienda",
    groupNounCap: "Tienda",
    groupNounPlural: "Tiendas",
    emptyTitle: "Aún no hay tiendas",
    emptyClients: "Cuando lleguen auditorías con tienda asignada, aparecerán aquí agrupadas.",
    clientsDesc: "Cada tienda o departamento agrupa sus auditorías en todos los cuestionarios. Ordenadas por puntaje — las más bajas primero.",
    person: "Auditor",
    personPlural: "Auditores",
  },
  empleados: {
    id: "empleados",
    label: "Empleados",
    menuTitle: "Talento · Empleados",
    menuSub: "Evaluaciones de desempeño y competencias",
    icon: "user",
    plural: "Empleados",
    singular: "Empleado",
    groupTitle: "Equipo evaluado",
    groupNoun: "empleado",
    groupNounCap: "Empleado",
    groupNounPlural: "Empleados",
    emptyTitle: "Aún no hay empleados",
    emptyClients: "Cuando lleguen evaluaciones con empleado asignado, aparecerán aquí agrupadas.",
    clientsDesc: "Cada empleado agrupa sus evaluaciones en todos los cuestionarios. Ordenados por puntaje — los más bajos primero.",
    person: "Evaluador",
    personPlural: "Evaluadores",
  },
};

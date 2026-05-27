export type StageId = "new" | "qualified" | "proposal" | "negotiation" | "won";

export type LeadSource =
  | "Website"
  | "Referência"
  | "LinkedIn"
  | "Evento"
  | "Campanha";

export type Lead = {
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  value: number;
  probability: number;
  stage: StageId;
  source: LeadSource;
  owner: string;
  city: string;
  nextStep: string;
  dueDate: string;
  lastActivity: string;
  tags: string[];
};

export type Task = {
  id: string;
  leadId: string;
  title: string;
  due: string;
  type: "Chamada" | "Email" | "Reunião" | "Proposta";
  done: boolean;
};

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Download,
  Filter,
  History,
  LayoutDashboard,
  Mail,
  Menu,
  Phone,
  Plus,
  Search,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";
import { initialLeads, initialTasks, stages } from "./data";
import type { Lead, LeadSource, StageId, Task } from "./types";

const currency = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const stageAccent: Record<StageId, string> = {
  new: "accent-sky",
  qualified: "accent-teal",
  proposal: "accent-amber",
  negotiation: "accent-coral",
  won: "accent-emerald",
};

const sourceOptions: LeadSource[] = [
  "Website",
  "Referência",
  "LinkedIn",
  "Evento",
  "Campanha",
];

const storageKeys = {
  leads: "leadflow-crm:leads:v1",
  tasks: "leadflow-crm:tasks:v1",
};

function formatCurrency(value: number) {
  return currency.format(value);
}

function readStoredState<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredState<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A demo continua funcional mesmo se o browser bloquear storage.
  }
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function exportLeadsCsv(leads: Lead[]) {
  const headers = [
    "Empresa",
    "Contacto",
    "Email",
    "Telefone",
    "Fase",
    "Valor",
    "Probabilidade",
    "Origem",
    "Dono",
    "Cidade",
    "Proximo passo",
  ];
  const rows = leads.map((lead) => [
    lead.company,
    lead.contact,
    lead.email,
    lead.phone,
    getStageLabel(lead.stage),
    lead.value,
    `${lead.probability}%`,
    lead.source,
    lead.owner,
    lead.city,
    lead.nextStep,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "leadflow-leads.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function nextStage(stage: StageId): StageId {
  const index = stages.findIndex((item) => item.id === stage);
  return stages[Math.min(index + 1, stages.length - 1)].id;
}

function getStageLabel(stage: StageId) {
  return stages.find((item) => item.id === stage)?.label ?? stage;
}

export function App() {
  const [leads, setLeads] = useState<Lead[]>(() =>
    readStoredState(storageKeys.leads, initialLeads),
  );
  const [tasks, setTasks] = useState<Task[]>(() =>
    readStoredState(storageKeys.tasks, initialTasks),
  );
  const [selectedLeadId, setSelectedLeadId] = useState(initialLeads[1].id);
  const [query, setQuery] = useState("");
  const [activeStage, setActiveStage] = useState<StageId | "all">("all");
  const [isCreating, setIsCreating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? leads[0];

  useEffect(() => {
    writeStoredState(storageKeys.leads, leads);
  }, [leads]);

  useEffect(() => {
    writeStoredState(storageKeys.tasks, tasks);
  }, [tasks]);

  const metrics = useMemo(() => {
    const openLeads = leads.filter((lead) => lead.stage !== "won");
    const pipeline = openLeads.reduce((sum, lead) => sum + lead.value, 0);
    const forecast = openLeads.reduce(
      (sum, lead) => sum + lead.value * (lead.probability / 100),
      0,
    );
    const won = leads.filter((lead) => lead.stage === "won");
    const avgDeal =
      leads.length > 0
        ? leads.reduce((sum, lead) => sum + lead.value, 0) / leads.length
        : 0;

    return {
      pipeline,
      forecast,
      wonValue: won.reduce((sum, lead) => sum + lead.value, 0),
      avgDeal,
      openCount: openLeads.length,
      wonCount: won.length,
      pendingTasks: tasks.filter((task) => !task.done).length,
    };
  }, [leads, tasks]);

  const filteredLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStage = activeStage === "all" || lead.stage === activeStage;
      const matchesQuery =
        normalized.length === 0 ||
        [lead.company, lead.contact, lead.city, lead.source, lead.owner]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesStage && matchesQuery;
    });
  }, [activeStage, leads, query]);

  const recentActivity = useMemo(
    () =>
      leads.slice(0, 5).map((lead) => ({
        id: lead.id,
        title: lead.lastActivity,
        meta: `${lead.company} · ${getStageLabel(lead.stage)}`,
      })),
    [leads],
  );

  function moveLead(leadId: string) {
    setLeads((current) =>
      current.map((lead) => {
        if (lead.id !== leadId) return lead;
        const stage = nextStage(lead.stage);
        const probability = stages.find((item) => item.id === stage)?.probability;
        return {
          ...lead,
          stage,
          probability: probability ?? lead.probability,
          lastActivity: `Fase atualizada para ${getStageLabel(stage)}`,
        };
      }),
    );
  }

  function toggleTask(taskId: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    );
  }

  function createLead(formData: FormData) {
    const company = String(formData.get("company") ?? "").trim();
    const contact = String(formData.get("contact") ?? "").trim();
    const value = Number(formData.get("value") ?? 0);
    const source = String(formData.get("source") ?? "Website") as LeadSource;

    if (!company || !contact || value <= 0) return;

    const id = `lead-${Date.now()}`;
    const lead: Lead = {
      id,
      company,
      contact,
      email: `${contact.toLowerCase().split(" ")[0]}@${company
        .toLowerCase()
        .replaceAll(" ", "")
        .replaceAll("&", "e")}.pt`,
      phone: "+351 910 000 000",
      value,
      probability: 15,
      stage: "new",
      source,
      owner: "Roberto",
      city: "Portugal",
      nextStep: "Qualificar necessidade e orçamento",
      dueDate: "2026-06-05",
      lastActivity: "Lead criado manualmente",
      tags: ["Novo", "Qualificar"],
    };

    setLeads((current) => [lead, ...current]);
    setSelectedLeadId(id);
    setIsCreating(false);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark">
            <Target size={20} />
          </div>
          <div>
            <strong>LeadFlow</strong>
            <span>CRM Comercial</span>
          </div>
          <button
            className="icon-button sidebar-close"
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list" aria-label="Navegação principal">
          <a className="nav-item active" href="#dashboard">
            <LayoutDashboard size={18} />
            Dashboard
          </a>
          <a className="nav-item" href="#pipeline">
            <BarChart3 size={18} />
            Pipeline
          </a>
          <a className="nav-item" href="#leads">
            <Users size={18} />
            Leads
          </a>
          <a className="nav-item" href="#tarefas">
            <ClipboardList size={18} />
            Tarefas
          </a>
        </nav>

        <div className="sidebar-card">
          <div className="card-icon">
            <Sparkles size={18} />
          </div>
          <strong>Resumo IA</strong>
          <p>
            3 oportunidades devem ser acompanhadas esta semana para proteger
            {` ${formatCurrency(22200)}`} em pipeline.
          </p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          <div>
            <p className="eyebrow">Pipeline comercial</p>
            <h1>Controlo de vendas para PMEs</h1>
          </div>

          <div className="topbar-actions">
            <div className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pesquisar lead, cidade ou dono"
                aria-label="Pesquisar leads"
              />
            </div>
            <button className="icon-button" type="button" aria-label="Notificações">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsCreating(true)}
            >
              <Plus size={18} />
              Novo lead
            </button>
          </div>
        </header>

        <section className="metric-grid" id="dashboard" aria-label="Métricas comerciais">
          <MetricCard
            label="Pipeline aberto"
            value={formatCurrency(metrics.pipeline)}
            hint={`${metrics.openCount} oportunidades ativas`}
            icon={<CircleDollarSign size={20} />}
          />
          <MetricCard
            label="Previsão ponderada"
            value={formatCurrency(metrics.forecast)}
            hint="Com base na probabilidade por fase"
            icon={<Target size={20} />}
          />
          <MetricCard
            label="Negócios ganhos"
            value={formatCurrency(metrics.wonValue)}
            hint={`${metrics.wonCount} negócio fechado este mês`}
            icon={<Check size={20} />}
          />
          <MetricCard
            label="Tarefas pendentes"
            value={String(metrics.pendingTasks)}
            hint={`Ticket médio ${formatCurrency(metrics.avgDeal)}`}
            icon={<CalendarClock size={20} />}
          />
        </section>

        <section className="content-grid">
          <div className="workspace">
            <section className="section-block" id="pipeline">
              <div className="section-heading">
                <div>
                  <h2>Pipeline</h2>
                  <p>Avança oportunidades e vê o impacto imediato nas métricas.</p>
                </div>
                <div className="segmented">
                  <button
                    className={activeStage === "all" ? "selected" : ""}
                    type="button"
                    onClick={() => setActiveStage("all")}
                  >
                    Todos
                  </button>
                  {stages.slice(0, 4).map((stage) => (
                    <button
                      key={stage.id}
                      className={activeStage === stage.id ? "selected" : ""}
                      type="button"
                      onClick={() => setActiveStage(stage.id)}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pipeline-board">
                {stages.map((stage) => {
                  const stageLeads = leads.filter((lead) => lead.stage === stage.id);
                  const stageValue = stageLeads.reduce(
                    (sum, lead) => sum + lead.value,
                    0,
                  );

                  return (
                    <article className="stage-column" key={stage.id}>
                      <div className="stage-head">
                        <span className={`stage-dot ${stageAccent[stage.id]}`} />
                        <strong>{stage.label}</strong>
                        <span>{stageLeads.length}</span>
                      </div>
                      <p className="stage-total">{formatCurrency(stageValue)}</p>
                      <div className="deal-list">
                        {stageLeads.map((lead) => (
                          <button
                            className={`deal-card ${
                              selectedLeadId === lead.id ? "deal-selected" : ""
                            }`}
                            type="button"
                            key={lead.id}
                            onClick={() => setSelectedLeadId(lead.id)}
                          >
                            <span className="deal-topline">
                              <strong>{lead.company}</strong>
                              <span>{lead.probability}%</span>
                            </span>
                            <span className="deal-contact">{lead.contact}</span>
                            <span className="deal-bottom">
                              <span>{formatCurrency(lead.value)}</span>
                              <span>{lead.city}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="section-block" id="leads">
              <div className="section-heading compact">
                <div>
                  <h2>Leads</h2>
                  <p>{filteredLeads.length} registos encontrados</p>
                </div>
                <div className="heading-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => exportLeadsCsv(filteredLeads)}
                  >
                    <Download size={16} />
                    Exportar CSV
                  </button>
                  <button className="ghost-button" type="button">
                    <Filter size={16} />
                    Filtros
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Fase</th>
                      <th>Valor</th>
                      <th>Dono</th>
                      <th>Próximo passo</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id}>
                        <td>
                          <button
                            className="company-cell"
                            type="button"
                            onClick={() => setSelectedLeadId(lead.id)}
                          >
                            <span className="avatar">{initials(lead.company)}</span>
                            <span>
                              <strong>{lead.company}</strong>
                              <small>{lead.contact}</small>
                            </span>
                          </button>
                        </td>
                        <td>
                          <span className={`status-pill ${stageAccent[lead.stage]}`}>
                            {getStageLabel(lead.stage)}
                          </span>
                        </td>
                        <td className="num-cell">{formatCurrency(lead.value)}</td>
                        <td>{lead.owner}</td>
                        <td className="muted-cell">{lead.nextStep}</td>
                        <td>
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => moveLead(lead.id)}
                            aria-label={`Avançar ${lead.company}`}
                          >
                            <ChevronRight size={17} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="right-rail">
            <section className="detail-panel">
              <div className="panel-top">
                <div className="avatar large">{initials(selectedLead.company)}</div>
                <div>
                  <p className="eyebrow">Oportunidade ativa</p>
                  <h2>{selectedLead.company}</h2>
                  <span>{selectedLead.contact}</span>
                </div>
              </div>

              <div className="value-box">
                <span>Valor estimado</span>
                <strong>{formatCurrency(selectedLead.value)}</strong>
                <small>
                  {selectedLead.probability}% probabilidade ·{" "}
                  {getStageLabel(selectedLead.stage)}
                </small>
              </div>

              <div className="contact-actions">
                <a href={`mailto:${selectedLead.email}`}>
                  <Mail size={16} />
                  Email
                </a>
                <a href={`tel:${selectedLead.phone}`}>
                  <Phone size={16} />
                  Chamar
                </a>
              </div>

              <dl className="detail-list">
                <div>
                  <dt>Origem</dt>
                  <dd>{selectedLead.source}</dd>
                </div>
                <div>
                  <dt>Cidade</dt>
                  <dd>{selectedLead.city}</dd>
                </div>
                <div>
                  <dt>Última atividade</dt>
                  <dd>{selectedLead.lastActivity}</dd>
                </div>
                <div>
                  <dt>Próximo passo</dt>
                  <dd>{selectedLead.nextStep}</dd>
                </div>
              </dl>

              <div className="tag-row">
                {selectedLead.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>

              <button
                className="primary-button full"
                type="button"
                onClick={() => moveLead(selectedLead.id)}
              >
                Avançar fase
                <ArrowRight size={18} />
              </button>
            </section>

            <section className="section-block tasks-panel" id="tarefas">
              <div className="section-heading compact">
                <div>
                  <h2>Tarefas</h2>
                  <p>Follow-ups comerciais</p>
                </div>
              </div>

              <div className="task-list">
                {tasks.map((task) => {
                  const lead = leads.find((item) => item.id === task.leadId);
                  return (
                    <button
                      className={`task-item ${task.done ? "task-done" : ""}`}
                      type="button"
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                    >
                      <span className="task-check">
                        {task.done ? <Check size={14} /> : null}
                      </span>
                      <span>
                        <strong>{task.title}</strong>
                        <small>
                          {task.type} · {task.due} · {lead?.company}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="section-block activity-panel">
              <div className="section-heading compact">
                <div>
                  <h2>Atividade recente</h2>
                  <p>Últimos movimentos do pipeline</p>
                </div>
              </div>

              <div className="activity-list">
                {recentActivity.map((activity) => (
                  <button
                    className="activity-item"
                    type="button"
                    key={activity.id}
                    onClick={() => setSelectedLeadId(activity.id)}
                  >
                    <span className="activity-icon">
                      <History size={15} />
                    </span>
                    <span>
                      <strong>{activity.title}</strong>
                      <small>{activity.meta}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </main>

      {isCreating ? (
        <div className="modal-backdrop" role="presentation">
          <form
            className="lead-modal"
            onSubmit={(event) => {
              event.preventDefault();
              createLead(new FormData(event.currentTarget));
            }}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">Novo registo</p>
                <h2>Criar lead</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setIsCreating(false)}
                aria-label="Fechar modal"
              >
                <X size={18} />
              </button>
            </div>

            <label>
              Empresa
              <input name="company" placeholder="Ex: Norte Digital" required />
            </label>
            <label>
              Contacto
              <input name="contact" placeholder="Ex: Ana Costa" required />
            </label>
            <label>
              Valor estimado
              <input
                name="value"
                type="number"
                min="1"
                step="100"
                placeholder="5000"
                required
              />
            </label>
            <label>
              Origem
              <select name="source" defaultValue="Website">
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>

            <button className="primary-button full" type="submit">
              <Plus size={18} />
              Guardar lead
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

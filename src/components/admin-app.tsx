"use client";
import React, { useState, useCallback, useEffect, Suspense } from "react";
import { useStore } from "./store";
import { AdminTopbar } from "./topbar";
import { useToast, Skeleton, SkeletonCard } from "./ui";
import { CommandPalette, useGlobalShortcuts, ShortcutsModal } from "./command-palette";
import { OnboardingTour } from "./onboarding-tour";

// ---- Route types ----
type Route = { name: string; testId?: string; company?: string };
type NavFn = (name: string, params?: Record<string, string>) => void;
type ToastFn = (msg: string, icon?: string) => void;

// ---- Lazy page imports ----
const HomePage = React.lazy(() => import("./pages/home"));
const DashboardPage = React.lazy(() => import("./pages/dashboard"));
const BuilderPage = React.lazy(() => import("./pages/builder"));
const ResponsesPage = React.lazy(() => import("./pages/responses"));
const ClientesPage = React.lazy(() => import("./pages/clientes"));
const ClienteDetailPage = React.lazy(() => import("./pages/cliente-detail"));
const TableroPage = React.lazy(() => import("./pages/tablero"));
const SolucionesPage = React.lazy(() => import("./pages/soluciones"));
const ReportesPage = React.lazy(() => import("./pages/reportes"));
const ReporteDetailPage = React.lazy(() => import("./pages/reporte-detail"));
const SettingsPage = React.lazy(() => import("./pages/settings"));

// ---- Hash parsing ----
function parseHash(): Route {
  const h = (typeof window !== "undefined" ? location.hash : "").replace(/^#/, "");
  const [name, ...rest] = h.split("/");
  if (name === "builder" && rest[0]) return { name: "builder", testId: rest[0] };
  if (name === "responses" && rest[0]) return { name: "responses", testId: rest[0] };
  if (name === "cliente" && rest[0]) return { name: "cliente", company: decodeURIComponent(rest[0]) };
  if (name === "reporte" && rest[0]) return { name: "reporte", company: decodeURIComponent(rest[0]) };
  if (name === "clientes") return { name: "clientes" };
  if (name === "tablero") return { name: "tablero" };
  if (name === "soluciones") return { name: "soluciones" };
  if (name === "reportes") return { name: "reportes" };
  if (name === "cuestionarios") return { name: "dashboard" };
  if (name === "configuracion") return { name: "settings" };
  return { name: "inicio" };
}

// ---- Suspense fallback (skeleton layout instead of plain text) ----
function PageFallback() {
  return (
    <div style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: "32px 28px" }} aria-busy="true">
      <Skeleton width={260} height={26} style={{ marginBottom: 10 }} />
      <Skeleton width={420} height={14} style={{ marginBottom: 28 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        <SkeletonCard lines={1} /><SkeletonCard lines={1} /><SkeletonCard lines={1} /><SkeletonCard lines={1} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        <SkeletonCard lines={3} /><SkeletonCard lines={3} />
      </div>
    </div>
  );
}

// ---- Main app ----
export default function AdminApp() {
  const [route, setRoute] = useState<Route>({ name: "inicio" });
  const [toastNode, toast] = useToast();

  const nav = useCallback<NavFn>((name, params = {}) => {
    const r: Route = { name, ...params };
    setRoute(r);
    let hash = name;
    if (name === "builder" && params.testId) hash = "builder/" + params.testId;
    else if (name === "responses" && params.testId) hash = "responses/" + params.testId;
    else if (name === "cliente" && params.company) hash = "cliente/" + encodeURIComponent(params.company);
    else if (name === "reporte" && params.company) hash = "reporte/" + encodeURIComponent(params.company);
    else if (name === "dashboard") hash = "cuestionarios";
    else if (name === "settings") hash = "configuracion";
    if (typeof window !== "undefined") {
      location.hash = hash;
      window.scrollTo(0, 0);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRoute(parseHash());
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // global keyboard shortcuts (g+letter, ? for cheat sheet)
  const [cheatOpen, setCheatOpen] = useGlobalShortcuts(nav);

  function renderPage() {
    switch (route.name) {
      case "inicio":
        return (
          <Suspense fallback={<PageFallback />}>
            <HomePage nav={nav} />
          </Suspense>
        );
      case "dashboard":
        return (
          <Suspense fallback={<PageFallback />}>
            <DashboardPage nav={nav} toast={toast} />
          </Suspense>
        );
      case "builder":
        return route.testId ? (
          <Suspense fallback={<PageFallback />}>
            <BuilderPage testId={route.testId} nav={nav} toast={toast} />
          </Suspense>
        ) : null;
      case "responses":
        return route.testId ? (
          <Suspense fallback={<PageFallback />}>
            <ResponsesPage testId={route.testId} nav={nav} toast={toast} />
          </Suspense>
        ) : null;
      case "clientes":
        return (
          <Suspense fallback={<PageFallback />}>
            <ClientesPage nav={nav} />
          </Suspense>
        );
      case "cliente":
        return route.company ? (
          <Suspense fallback={<PageFallback />}>
            <ClienteDetailPage company={route.company} nav={nav} />
          </Suspense>
        ) : null;
      case "tablero":
        return (
          <Suspense fallback={<PageFallback />}>
            <TableroPage nav={nav} toast={toast} />
          </Suspense>
        );
      case "soluciones":
        return (
          <Suspense fallback={<PageFallback />}>
            <SolucionesPage nav={nav} toast={toast} />
          </Suspense>
        );
      case "reportes":
        return (
          <Suspense fallback={<PageFallback />}>
            <ReportesPage nav={nav} />
          </Suspense>
        );
      case "reporte":
        return route.company ? (
          <Suspense fallback={<PageFallback />}>
            <ReporteDetailPage company={route.company} nav={nav} toast={toast} />
          </Suspense>
        ) : null;
      case "settings":
        return (
          <Suspense fallback={<PageFallback />}>
            <SettingsPage nav={nav} toast={toast} />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<PageFallback />}>
            <HomePage nav={nav} />
          </Suspense>
        );
    }
  }

  // key the page wrapper by route so navigation gets a subtle entrance animation
  const routeKey = route.name + (route.testId || "") + (route.company || "");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <AdminTopbar route={route.name} onNav={nav} />
      <div key={routeKey} className="page-enter">
        {renderPage()}
      </div>
      <CommandPalette nav={nav} />
      <ShortcutsModal open={cheatOpen} onClose={() => setCheatOpen(false)} />
      <OnboardingTour />
      {toastNode}
    </div>
  );
}

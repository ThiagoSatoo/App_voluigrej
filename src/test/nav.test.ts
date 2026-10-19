import { describe, expect, it } from "vitest";
import { emptyState } from "@/data/store";
import { routeBlocked, visibleNav } from "@/lib/nav";
import type { AppState, Role } from "@/data/types";

const as = (role: Role, navConfig: AppState["navConfig"] = {}): AppState => ({
  ...emptyState(),
  session: { role, userId: "u", name: "U", mustChangePassword: false },
  navConfig,
});
const keys = (s: AppState, a: "supervisor" | "voluntario") => visibleNav(s, a).map((i) => i.key);

describe("Abas do menu", () => {
  const cfg = { supervisor: { sorteio: false, configuracoes: false }, voluntario: { vagas: false, perfil: false, turnos: false } };

  it("supervisor não vê aba desligada nem a tela Admin; abas travadas continuam", () => {
    const k = keys(as("supervisor", cfg), "supervisor");
    expect(k).not.toContain("sorteio");
    expect(k).not.toContain("admin");
    expect(k).toContain("configuracoes"); // travada
  });

  it("admin vê tudo, inclusive Admin, mesmo com abas desligadas", () => {
    const k = keys(as("admin", cfg), "supervisor");
    expect(k).toContain("sorteio");
    expect(k).toContain("admin");
  });

  it("bloqueia acesso pelo endereço às abas desligadas", () => {
    expect(routeBlocked(as("supervisor", cfg), "supervisor", "/supervisor/sorteio")).toBe(true);
    expect(routeBlocked(as("supervisor", cfg), "supervisor", "/supervisor/admin")).toBe(true);
    expect(routeBlocked(as("supervisor", cfg), "supervisor", "/supervisor")).toBe(false);
    expect(routeBlocked(as("admin", cfg), "supervisor", "/supervisor/sorteio")).toBe(false);
    expect(routeBlocked(as("voluntario", cfg), "voluntario", "/voluntario/vagas")).toBe(true);
  });

  it("voluntário: Turnos só para responsável, Perfil sempre visível", () => {
    expect(keys(as("voluntario"), "voluntario")).not.toContain("turnos");
    expect(keys(as("responsavel"), "voluntario")).toContain("turnos");
    expect(keys(as("responsavel", cfg), "voluntario")).not.toContain("turnos");
    expect(keys(as("voluntario", cfg), "voluntario")).toContain("perfil");
  });
});

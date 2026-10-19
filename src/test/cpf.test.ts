import { describe, expect, it } from "vitest";
import { validCpf } from "@/lib/format";

describe("validCpf", () => {
  it("aceita CPFs válidos, com ou sem pontuação", () => {
    expect(validCpf("52998224725")).toBe(true);
    expect(validCpf("529.982.247-25")).toBe(true);
  });
  it("recusa dígito verificador errado, tamanho errado e números repetidos", () => {
    expect(validCpf("52998224724")).toBe(false);
    expect(validCpf("5299822472")).toBe(false);
    expect(validCpf("11111111111")).toBe(false);
  });
});

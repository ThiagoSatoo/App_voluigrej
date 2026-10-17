import { toast } from "sonner";
import type { Result } from "@/data/repository";

/** Executa uma ação do repositório e mostra o resultado em um aviso. */
export async function act<R extends Result>(p: Promise<R>, success?: string): Promise<R> {
  const r = await p;
  if (!r.ok) toast.error(r.error);
  else if (success) toast.success(success);
  return r;
}

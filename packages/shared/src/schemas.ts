import { z } from "zod";
import { ROLE_CODES, DECISIONS } from "./enums";

export const devLoginSchema = z.object({
  identifier: z.string().min(1).optional(), // email atau NIM/NIP
  userId: z.string().uuid().optional(),
  role: z.enum(ROLE_CODES),
});

const score = z.coerce.number().int().min(1).max(5);

export const logbookInputSchema = z.object({
  lecturerId: z.string().uuid({ message: "Pilih pembimbing" }),
  sessionDate: z.string().min(1, "Tanggal wajib diisi"),
  topic: z.string().min(3, "Topik minimal 3 karakter"),
  progress: z.string().min(3, "Progres wajib diisi"),
  challenges: z.string().default(""),
  nextSteps: z.string().default(""),
  attachmentName: z.string().nullable().optional(),
  attachmentKey: z.string().nullable().optional(),
});
export type LogbookInput = z.infer<typeof logbookInputSchema>;

export const logbookSaveSchema = logbookInputSchema.extend({
  submit: z.boolean().default(false),
});

export const evaluationSchema = z
  .object({
    logbookId: z.string().uuid(),
    researchProgressScore: score,
    scheduleComplianceScore: score,
    onTimeCompletionScore: score,
    comments: z.string().default(""),
    decision: z.enum(DECISIONS),
  })
  .refine((v) => v.decision !== "PERLU_REVISI" || v.comments.trim().length > 0, {
    message: "Komentar wajib diisi jika memilih Perlu Revisi",
    path: ["comments"],
  });
export type EvaluationInput = z.infer<typeof evaluationSchema>;

export const topicInputSchema = z.object({
  title: z.string().min(5, "Judul topik minimal 5 karakter"),
  description: z.string().min(10, "Deskripsi topik minimal 10 karakter"),
  focusArea: z.string().min(3, "Bidang fokus riset wajib diisi"),
  lecturerId: z.string().uuid("Pilih dosen pembimbing"),
  quota: z.coerce.number().int().min(1, "Minimal kuota 1").max(10).default(1),
  status: z.enum(["TERSEDIA", "PENUH", "DITUTUP"]).default("TERSEDIA"),
});
export type TopicInput = z.infer<typeof topicInputSchema>;

export const selectTopicSchema = z.object({
  topicId: z.string().uuid("Pilih topik yang valid"),
});
export type SelectTopicInput = z.infer<typeof selectTopicSchema>;

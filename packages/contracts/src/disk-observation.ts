import { z } from "zod";

import { IsoDateTimeSchema, SafeIntegerSchema } from "./common.js";

export const DiskObservationSchema = z
  .object({
    availableBytes: SafeIntegerSchema,
    totalBytes: SafeIntegerSchema,
    observedAt: IsoDateTimeSchema,
    source: z.literal("statfs"),
  })
  .strict()
  .refine((value) => value.availableBytes <= value.totalBytes, {
    message: "availableBytes не может превышать totalBytes",
    path: ["availableBytes"],
  });

export type DiskObservation = z.infer<typeof DiskObservationSchema>;

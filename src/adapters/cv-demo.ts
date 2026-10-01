import run from "@/data/cv-demo/run.json";
import observations from "@/data/cv-demo/observations.json";
import events from "@/data/cv-demo/events.json";
import { CameraObservationSchema, processCameraObservation } from "./camera";

/**
 * Resultado da demonstração de visão computacional (cv/), processado pelo MESMO adaptador
 * usado para câmeras: valida o contrato e separa observado → calculado → interpretado.
 */
export function cvDemo() {
  const processed = observations.map((o) => processCameraObservation(CameraObservationSchema.parse(o)));
  return { run, events, observations, processed };
}

export type CvEvent = (typeof events)[number];

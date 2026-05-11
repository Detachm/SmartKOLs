import type { RuntimeEvent } from "../../domain/runtime-event";

export interface RuntimeEventsRepository {
  save(event: RuntimeEvent): Promise<void>;
}

import { ViewMediaType } from '../../view/item';
import { Engine, EventQueryResults } from '../types';

export interface QVREvent {
  id: string;
  cameraID: string;
  start: Date;
  end: Date;
  type: ViewMediaType.Clip | ViewMediaType.Snapshot;
  guid?: string;
  thumbnail?: string;
  title?: string;
}

export interface QVREventQueryResults extends EventQueryResults {
  engine: Engine.QVR;
  events: QVREvent[];
}

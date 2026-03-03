import { isEqual } from 'lodash-es';
import {
  EventViewMedia,
  ViewMedia,
  ViewMediaType,
} from '../../view/item';
import { VideoContentType } from '../../view/item';

export interface QVREvent {
  id: string;
  cameraID: string;
  start: Date;
  end: Date;
  type: ViewMediaType;
  guid?: string;
  thumbnail?: string;
  title?: string;
}

export class QVREventViewMedia extends ViewMedia implements EventViewMedia {
  protected _event: QVREvent;

  constructor(mediaType: ViewMediaType, event: QVREvent) {
    super(mediaType, { cameraID: event.cameraID });
    this._event = event;
  }

  public getStartTime(): Date {
    return this._event.start;
  }

  public getEndTime(): Date | null {
    return this._event.end;
  }

  public getID(): string {
    return this._event.id;
  }

  public getContentID(): string {
    return this._event.id;
  }

  public getTitle(): string | null {
    return this._event.title ?? null;
  }

  public getThumbnail(): string | null {
    return this._event.thumbnail ?? null;
  }

  public getVideoContentType(): VideoContentType | null {
    return ViewMediaType.Clip === this.getMediaType() ? VideoContentType.MP4 : null;
  }

  public getEvent(): QVREvent {
    return this._event;
  }

  public getWhat(): string[] | null {
    return null;
  }

  public getWhere(): string[] | null {
    return null;
  }

  public getScore(): number | null {
    return null;
  }

  public getTags(): string[] | null {
    return null;
  }

  public isGroupableWith(that: EventViewMedia): boolean {
    return (
      this.getMediaType() === that.getMediaType() &&
      isEqual(this.getWhere(), that.getWhere()) &&
      isEqual(this.getWhat(), that.getWhat())
    );
  }
}

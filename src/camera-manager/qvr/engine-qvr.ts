/**
 * QVR Camera Manager Engine - QNAP QVR Connector integration.
 * Fetches Surveillance Events from QNAP QVR via Home Assistant API.
 */
import { StateWatcherSubscriptionInterface } from '../../card-controller/hass/state-watcher';
import { CameraConfig } from '../../config/schema/cameras';
import { getEntityTitle } from '../../ha/get-entity-title';
import { HomeAssistant } from '../../ha/types';
import { ViewMedia, ViewMediaType } from '../../view/item';
import { ViewItemCapabilities } from '../../view/types';
import { Camera } from '../camera';
import { CameraManagerEngine } from '../engine';
import { GenericCameraManagerEngine } from '../generic/engine-generic';
import { CameraManagerReadOnlyConfigStore } from '../store';
import {
  CameraEventCallback,
  CameraManagerCameraMetadata,
  CameraQuery,
  Engine,
  EventQuery,
  EventQueryResultsMap,
  PartialEventQuery,
  QueryReturnType,
  QueryType,
  QueryResultsType,
  RecordingQuery,
} from '../types';
import type { Endpoint } from '../../types';
import { getCameraEntityFromConfig } from '../utils/camera-entity-from-config';
import { getPTZCapabilitiesFromCameraConfig } from '../utils/ptz';
import { QVREventViewMedia } from './media';
import { QVREvent, QVREventQueryResults } from './types';

export class QVRCameraManagerEngine
  extends GenericCameraManagerEngine
  implements CameraManagerEngine
{
  constructor(
    stateWatcher: StateWatcherSubscriptionInterface,
    eventCallback?: CameraEventCallback,
  ) {
    super(stateWatcher, eventCallback);
  }

  public getEngineType(): Engine {
    return Engine.QVR;
  }

  public generateDefaultEventQuery(
    store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query: PartialEventQuery,
  ): EventQuery[] | null {
    const firstId = [...cameraIDs][0];
    const config = firstId ? store.getCameraConfig(firstId) : null;
    const entryId = config?.qvr?.entry_id;
    if (!entryId || !query.start || !query.end) return null;
    return [
      {
        type: QueryType.Event,
        cameraIDs,
        start: query.start,
        end: query.end,
        hasSnapshot: query.hasSnapshot,
        hasClip: query.hasClip,
      },
    ];
  }

  public async getEvents(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: EventQuery,
  ): Promise<EventQueryResultsMap | null> {
    let entryId: string | undefined;
    for (const id of query.cameraIDs) {
      const config = store.getCameraConfig(id);
      if (config?.qvr?.entry_id) {
        entryId = config.qvr.entry_id;
        break;
      }
    }
    if (!entryId) return null;

    const baseUrl = hass.hassUrl?.() ?? '';
    const url = `${baseUrl}/api/qnap_qvr_connector/events?entry_id=${encodeURIComponent(entryId)}&start_time=${query.start?.getTime() ?? 0}&end_time=${query.end?.getTime() ?? 0}&max_result=100`;

    try {
      const accessToken = (hass.connection?.options?.auth as { accessToken?: string })?.accessToken ?? '';
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const items = data?.items ?? data?.item ?? [];

      const results: EventQueryResultsMap = new Map();
      const events: QVREvent[] = [];
      const cameraID = [...query.cameraIDs][0] ?? 'unknown';

      for (const evt of items) {
        const ts = evt.UTC_time ?? evt.UTC_time_s;
        const startMs = typeof ts === 'string' ? parseInt(ts, 10) : ts;
        if (!startMs) continue;
        const start = new Date(startMs);
        const end = new Date(startMs + 10000);
        events.push({
          id: `qvr_${evt.log_id ?? startMs}_${cameraID}`,
          cameraID,
          start,
          end,
          type: ViewMediaType.Clip,
          title: String(evt.content ?? '').slice(0, 80),
        });
      }

      const eventResults: QVREventQueryResults = {
        type: QueryResultsType.Event,
        engine: Engine.QVR,
        events,
      };
      results.set(query, eventResults);
      return results;
    } catch {
      return null;
    }
  }

  public generateMediaFromEvents(
    _hass: HomeAssistant,
    _store: CameraManagerReadOnlyConfigStore,
    query: EventQuery,
    results: QueryReturnType<EventQuery>,
  ): ViewMedia[] | null {
    void _hass;
    void _store;
    if (results.engine !== Engine.QVR || !('events' in results)) return null;
    const qvrResults = results as QVREventQueryResults;
    const output: ViewMedia[] = [];
    for (const evt of qvrResults.events) {
      if (query.cameraIDs.has(evt.cameraID)) {
        output.push(new QVREventViewMedia(ViewMediaType.Clip, evt));
      }
    }
    return output;
  }

  public generateMediaFromRecordings(
    _hass: HomeAssistant,
    _store: CameraManagerReadOnlyConfigStore,
    _query: RecordingQuery,
    _results: QueryReturnType<RecordingQuery>,
  ): ViewMedia[] | null {
    void _hass;
    void _store;
    void _query;
    void _results;
    return null;
  }

  public getQueryResultMaxAge(_query: CameraQuery): number | null {
    void _query;
    return 60;
  }

  public async getMediaSeekTime(
    _hass: HomeAssistant,
    _store: CameraManagerReadOnlyConfigStore,
    _media: ViewMedia,
    _target: Date,
  ): Promise<number | null> {
    void _hass;
    void _store;
    void _media;
    void _target;
    return null;
  }

  public async getMediaDownloadPath(
    _hass: HomeAssistant,
    _cameraConfig: CameraConfig,
    _media: ViewMedia,
  ): Promise<Endpoint | null> {
    void _hass;
    void _cameraConfig;
    void _media;
    return null;
  }

  public async favoriteMedia(
    _hass: HomeAssistant,
    _cameraConfig: CameraConfig,
    _media: ViewMedia,
    _favorite: boolean,
  ): Promise<void> {
    void _hass;
    void _cameraConfig;
    void _media;
    void _favorite;
    return;
  }

  public getMediaCapabilities(_media: ViewMedia): ViewItemCapabilities | null {
    void _media;
    return { canFavorite: false, canDownload: true };
  }

  public async createCamera(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ) {
    return await new Camera(cameraConfig, this, {
      eventCallback: this._eventCallback,
    }).initialize({
      hass,
      stateWatcher: this._stateWatcher,
      capabilityOptions: {
        raw: {
          ptz: getPTZCapabilitiesFromCameraConfig(cameraConfig) ?? undefined,
        },
        disable: cameraConfig.capabilities?.disable,
        disableExcept: cameraConfig.capabilities?.disable_except,
      },
    });
  }

  public getCameraMetadata(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): CameraManagerCameraMetadata {
    const entityId = getCameraEntityFromConfig(cameraConfig);
    const title =
      (entityId ? getEntityTitle(hass, entityId) : null) ??
      cameraConfig.title ??
      'QVR Camera';
    return {
      title,
      icon: {
        entity: entityId ?? undefined,
        icon: cameraConfig.icon,
        fallback: 'mdi:cctv',
      },
      engineIcon: 'mdi:cctv',
    };
  }
}

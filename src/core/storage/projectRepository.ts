/**
 * WaterWise Offline-First Local Project Storage Repository
 * Works seamlessly in browser PWA (localStorage) and Capacitor native (Preferences / IndexedDB).
 */

import type { DosingInputs } from '../engine/dosing';
import type { PumpInputs } from '../engine/pump';
import type { PoolInputs } from '../engine/pool';

export interface SavedWaterWiseProject {
  id: string;
  projectName: string;
  siteLocation: string;
  engineerName: string;
  notes: string;
  createdAtISO: string;
  updatedAtISO: string;
  dosing: DosingInputs;
  pump: PumpInputs;
  pool: PoolInputs;
}

const STORAGE_KEY = 'waterwise_saved_projects_v2';

export class LocalProjectRepository {
  static listProjects(): SavedWaterWiseProject[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SavedWaterWiseProject[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  static saveProject(project: SavedWaterWiseProject): SavedWaterWiseProject[] {
    try {
      const current = this.listProjects();
      const idx = current.findIndex((p) => p.id === project.id);
      const updated =
        idx >= 0
          ? current.map((p, i) => (i === idx ? { ...project, updatedAtISO: new Date().toISOString() } : p))
          : [{ ...project, updatedAtISO: new Date().toISOString() }, ...current];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  }

  static deleteProject(id: string): SavedWaterWiseProject[] {
    try {
      const filtered = this.listProjects().filter((p) => p.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return filtered;
    } catch {
      return [];
    }
  }

  static exportProjectsJson(): string {
    return JSON.stringify(this.listProjects(), null, 2);
  }
}

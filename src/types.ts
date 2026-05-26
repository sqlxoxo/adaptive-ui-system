/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  name: string;
  level: "Novice" | "Expert";
  joinedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "inprogress" | "done";
  priority: "low" | "medium" | "high";
  createdAt: string;
  completedAt?: string;
}

export interface TelemetryMetrics {
  errorsCount: number;
  hoverTime: number; // in seconds
  firstTaskDuration: number; // in seconds, 0 if not created yet
  shortcutCount: number;
  actionsCount: number;
  totalTime: number; // in seconds
}

export interface TelemetryLog {
  id: string;
  userId: string;
  timestamp: string;
  metrics: TelemetryMetrics;
}

export interface UIConfig {
  level: "Novice" | "Expert";
  score: number; // composite skill score from 0 to 100
  showHelperTooltips: boolean;
  showInteractiveGuide: boolean;
  showSimpleView: boolean;
  showDetailedAnalytics: boolean;
  showAdvancedFilters: boolean;
  showQuickActionsPanel: boolean;
  buttonSize: "large" | "compact";
}



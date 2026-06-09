export interface IconMeta {
  id: string;
  name: string;
  originalName: string;
  width: number;
  height: number;
  addedAt: number;
}

export interface IconItem extends IconMeta {
  dataUrl: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  iconIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SpriteConfig {
  columns: number;
  spacing: number;
  bgColor: string;
  classPrefix: string;
  retina: boolean;
}

export interface IconPosition {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpriteResult {
  imageDataUrl: string;
  cssCode: string;
  scssCode: string;
  iconPositions: IconPosition[];
  totalWidth: number;
  totalHeight: number;
  cellWidth: number;
  cellHeight: number;
}

export interface SplitConfig {
  rows: number;
  columns: number;
  iconWidth: number;
  iconHeight: number;
  spacing: number;
  padding: number;
}

export interface SplitIcon {
  index: number;
  dataUrl: string;
  width: number;
  height: number;
  name: string;
}

export type ExpireOption = '1h' | '24h' | '7d' | '30d' | 'never';

export interface ShareConfig {
  expiresAt: number | null;
  passwordHash: string | null;
  createdAt: number;
}

export interface SharedIconItem {
  name: string;
  width: number;
  height: number;
  addedAt: number;
  dataUrl: string;
}

export interface SharePayload {
  projectName: string;
  projectDescription: string;
  icons: SharedIconItem[];
  config: ShareConfig;
}

export interface ShareParseResult {
  valid: boolean;
  expired: boolean;
  needPassword: boolean;
  payload?: SharePayload;
  error?: string;
}

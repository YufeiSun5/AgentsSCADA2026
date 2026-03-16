import { mockPages } from '../mock/pages';
import { cloneSchema, createEmptyPageSchema, normalizePageSchema, type PageListQuery, type PageSchema, type PagedResult, type PageStatus } from '../schema/pageSchema';
import http from './http';

const STORAGE_KEY = 'agents-scada-pages';
const STORAGE_VERSION_KEY = 'agents-scada-pages-version';
const STORAGE_VERSION = 'scada-layout-v2';

function seedLocalPages(force = false) {
  const currentVersion = window.localStorage.getItem(STORAGE_VERSION_KEY);

  if (force || currentVersion !== STORAGE_VERSION) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mockPages));
    window.localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
  }
}

function hasRemoteApi() {
  return Boolean(import.meta.env.VITE_API_BASE_URL);
}

function readLocalPages(): PageSchema[] {
  seedLocalPages();
  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    seedLocalPages(true);
    return cloneSchema(mockPages);
  }

  try {
    return (JSON.parse(rawValue) as PageSchema[]).map((page) => normalizePageSchema(page));
  } catch {
    seedLocalPages(true);
    return cloneSchema(mockPages);
  }
}

function writeLocalPages(pages: PageSchema[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
}

function queryLocalPages(query: PageListQuery): PagedResult<PageSchema> {
  const keyword = query.keyword.trim().toLowerCase();
  const filtered = readLocalPages().filter((page) => {
    const matchesKeyword = keyword
      ? page.name.toLowerCase().includes(keyword) || page.description.toLowerCase().includes(keyword)
      : true;
    const matchesStatus = query.status === 'all' ? true : page.status === query.status;
    return matchesKeyword && matchesStatus;
  });
  const start = (query.page - 1) * query.pageSize;
  return {
    list: filtered.slice(start, start + query.pageSize),
    total: filtered.length,
  };
}

export async function listPages(query: PageListQuery): Promise<PagedResult<PageSchema>> {
  if (hasRemoteApi()) {
    try {
      const response = await http.get<PagedResult<PageSchema>>('/pages', { params: query });
      return response.data;
    } catch {
      return queryLocalPages(query);
    }
  }

  return queryLocalPages(query);
}

export async function getPage(pageId: string): Promise<PageSchema | null> {
  if (pageId === 'demo') {
    return cloneSchema(readLocalPages()[0] ?? mockPages[0]);
  }

  if (hasRemoteApi()) {
    try {
      const response = await http.get<PageSchema>(`/pages/${pageId}`);
      return response.data;
    } catch {
      const found = readLocalPages().find((page) => page.id === pageId);
      return found ? cloneSchema(found) : null;
    }
  }

  const found = readLocalPages().find((page) => page.id === pageId);
  return found ? cloneSchema(found) : null;
}

export async function savePage(schema: PageSchema): Promise<PageSchema> {
  const payload = {
    ...normalizePageSchema(cloneSchema(schema)),
    updatedAt: new Date().toISOString(),
  };

  if (hasRemoteApi()) {
    try {
      const response = await http.put<PageSchema>(`/pages/${schema.id}`, payload);
      return response.data;
    } catch {
      // Fallback to local persistence during initialization.
    }
  }

  const pages = readLocalPages();
  const index = pages.findIndex((page) => page.id === payload.id);
  if (index >= 0) {
    pages[index] = payload;
  } else {
    pages.unshift(payload);
  }
  writeLocalPages(pages);
  return payload;
}

export async function createBlankPage(name?: string): Promise<PageSchema> {
  const pages = readLocalPages();
  const schema = createEmptyPageSchema(name || `新建页面 ${pages.length + 1}`);
  pages.unshift(schema);
  writeLocalPages(pages);
  return cloneSchema(schema);
}

export async function duplicatePage(pageId: string): Promise<PageSchema | null> {
  const original = readLocalPages().find((page) => page.id === pageId);
  if (!original) {
    return null;
  }
  const copy = cloneSchema(original);
  copy.id = `${original.id}-copy-${Math.random().toString(36).slice(2, 7)}`;
  copy.name = `${original.name} - 副本`;
  copy.status = 'draft';
  copy.updatedAt = new Date().toISOString();
  const pages = readLocalPages();
  pages.unshift(copy);
  writeLocalPages(pages);
  return copy;
}

export async function deletePage(pageId: string): Promise<void> {
  if (hasRemoteApi()) {
    try {
      await http.delete(`/pages/${pageId}`);
      return;
    } catch {
      // Fallback to local persistence during initialization.
    }
  }

  writeLocalPages(readLocalPages().filter((page) => page.id !== pageId));
}

export async function togglePageStatus(pageId: string): Promise<PageSchema | null> {
  const pages = readLocalPages();
  const page = pages.find((item) => item.id === pageId);
  if (!page) {
    return null;
  }

  const nextStatus: PageStatus = page.status === 'enabled' ? 'disabled' : 'enabled';
  page.status = nextStatus;
  page.updatedAt = new Date().toISOString();
  writeLocalPages(pages);
  return cloneSchema(page);
}
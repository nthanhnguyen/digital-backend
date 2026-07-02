export interface Identifiable {
  id: string;
}

export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

export async function* queryAllByPagingID<T extends Identifiable>(
  queryFunc: (lastId: string) => Promise<T[]>,
): AsyncGenerator<T[]> {
  let lastId = '00000000-0000-0000-0000-000000000000';
  let dbRecords = await queryFunc(lastId);
  while (dbRecords.length > 0) {
    yield dbRecords;
    lastId = dbRecords[dbRecords.length - 1].id;
    dbRecords = await queryFunc(lastId);
  }
}

import type { ExtractedItem } from '@/types/portfolio';

let extractedItemsState: ExtractedItem[] = [];

export function setExtractedItems(items: ExtractedItem[]) {
  extractedItemsState = items;
}

export function getExtractedItems(): ExtractedItem[] {
  return extractedItemsState;
}

export function clearExtractedItems() {
  extractedItemsState = [];
}

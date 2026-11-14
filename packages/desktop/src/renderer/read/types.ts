export type ReaderSourceLocation = {
  paragraphId: string | null;
  confirmed: boolean;
  chapterTitle: string | null;
  page: number | null;
  href: string | null;
  unconfirmedLabel?: string;
};

export type ReaderChunk = {
  id: string;
  bookId: string;
  chapter: string | null;
  page: number | null;
  location: ReaderSourceLocation;
  text: string;
  contentHash: string;
  ordinal: number;
};

export type ReaderBook = {
  id: string;
  title: string;
  author: string | null;
  format: string;
  filePath: string;
  contentHash: string;
  parseStatus: string;
  chunks: ReaderChunk[];
};

export type LibraryBookSummary = {
  id: string;
  title: string;
  author: string | null;
  format: string;
  parseStatus: string;
};

export type ReaderAnnotation = {
  id: string;
  bookId: string;
  kind: "excerpt";
  text: string;
  note: string;
  chunkId: string | null;
  paragraphId: string | null;
  chapter: string | null;
  page: number | null;
  confirmed: boolean;
  unconfirmedLabel?: string;
  createdAt: string;
};

export type LibraryUiState = {
  loaded: boolean;
  books: LibraryBookSummary[];
  error: string | null;
  openBook: ReaderBook | null;
  annotations: ReaderAnnotation[];
  draftSelection: string;
  draftNote: string;
  focusedChunkId: string | null;
  jumpMessage: string | null;
};

export type JumpResult = {
  focusedChunkId: string | null;
  confirmed: boolean;
  message: string | null;
};

export type CreateExcerptOptions = {
  book: ReaderBook;
  selectedText: string;
  note?: string;
  now?: Date;
  id?: string;
};

export function emptyLibraryUiState(): LibraryUiState {
  return {
    loaded: false,
    books: [],
    error: null,
    openBook: null,
    annotations: [],
    draftSelection: "",
    draftNote: "",
    focusedChunkId: null,
    jumpMessage: null,
  };
}

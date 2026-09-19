export interface IBoardImages {
  images: string[];
}

export const defaultBoardImagesData: IBoardImages = {
  images: [
    "",
    "",
    "",
  ],
};

export const AutodartsToolsBoardImages: WxtStorageItem<IBoardImages, any> = storage.defineItem(
  "local:board-images",
  {
    defaultValue: defaultBoardImagesData,
  },
);

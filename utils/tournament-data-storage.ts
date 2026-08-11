export interface ITournament {
  event: "start" | "player" | "tree" | string;
  body?: any;
  tournamentId: string;
}

export const AutodartsToolsTournamentData: WxtStorageItem<ITournament | undefined, any> = storage.defineItem(
  "local:tournament-data",
  {
    defaultValue: undefined,
  },
);
